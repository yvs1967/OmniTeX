import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || './latex-workspace';

export interface CompileResult {
  success: boolean;
  pdfPath: string | null;
  logs: string;
}

/**
 * Fallback to secure online LaTeX compilation when no local compiler (MiKTeX/TeX Live) is present
 */
async function compileLatexOnline(fileContent: string, outputPdfPath: string): Promise<string | null> {
  // Option 1: LatexOnline.cc (Highly reliable public compiler node)
  try {
    console.log('Attempting zero-install LaTeX compilation via LatexOnline.cc...');
    const response = await axios.get(`https://latexonline.cc/compile?text=${encodeURIComponent(fileContent)}`, {
      responseType: 'arraybuffer',
      timeout: 25000
    });
    
    if (response.status === 200 && response.data && response.data.length > 1000) {
      await fs.writeFile(outputPdfPath, response.data);
      return 'Compiled successfully via LatexOnline.cc API';
    }
  } catch (e: any) {
    console.warn('LatexOnline compiler fallback failed. Trying backup API...', e.message);
  }

  // Option 2: TexAPI.ovh backup node
  try {
    console.log('Attempting zero-install LaTeX compilation via texapi.ovh backup node...');
    const response = await axios.post('https://texapi.ovh/api', {
      code: fileContent
    }, {
      responseType: 'arraybuffer',
      timeout: 25000
    });

    if (response.status === 200 && response.data && response.data.length > 1000) {
      await fs.writeFile(outputPdfPath, response.data);
      return 'Compiled successfully via texapi.ovh backup API';
    }
  } catch (e: any) {
    console.error('Backup LaTeX compiler API failed as well:', e.message);
  }

  return null;
}

let miktexConfigured = false;

/**
 * Configure MiKTeX to install packages automatically without asking (Overleaf behavior)
 */
async function configureMikTexAutoInstall() {
  if (miktexConfigured) return;
  try {
    // Configures MiKTeX package manager (MPM) to always auto-install missing packages on-the-fly:
    // AutoInstall=1 corresponds to 'Yes' (no GUI dialog or interactive prompt)
    await execAsync('initexmf --set-config-value [MPM]AutoInstall=1');
    miktexConfigured = true;
    console.log('MiKTeX configured for automatic on-the-fly package installation (AutoInstall=1).');
  } catch {
    // If initexmf is not installed or not in PATH, mark checked so we don't spam attempts
    miktexConfigured = true;
  }
}

/**
 * Compiles a LaTeX file using the specified engine.
 */
export async function compileLatex(fileRelativePath: string, engine: string = 'pdflatex'): Promise<CompileResult> {
  const allowedEngines = ['pdflatex', 'lualatex', 'xelatex'];
  const compilerEngine = allowedEngines.includes(engine) ? engine : 'pdflatex';

  const absoluteWorkspace = path.resolve(WORKSPACE_DIR);
  const fullPath = path.resolve(WORKSPACE_DIR, fileRelativePath);
  const workDir = path.dirname(fullPath);
  const fileName = path.basename(fullPath);
  const baseName = fileName.replace(/\.tex$/, '');
  
  // We want the PDF to be in the same directory as the source file
  const outputDir = workDir;

  // Ensure MiKTeX is set to auto-install packages without interruption
  await configureMikTexAutoInstall();

  // Command: Include -synctex=1 and --enable-installer to generate SyncTeX and auto-install CTAN packages
  let command = `${compilerEngine} -synctex=1 --enable-installer -interaction=nonstopmode -halt-on-error -output-directory="${outputDir}" "${fullPath}"`;

  try {
    let { stdout, stderr } = await execAsync(command, { 
      cwd: workDir, 
      timeout: 180000, // 3 minutes to allow downloading packages on first run
      maxBuffer: 10 * 1024 * 1024 
    });

    // Overleaf-style second pass if references or table of contents need syncing
    if (stdout.includes('Rerun to get cross-references right') || stdout.includes('Rerun to get outlines right')) {
      try {
        const rerunResult = await execAsync(command, { 
          cwd: workDir, 
          timeout: 120000, 
          maxBuffer: 10 * 1024 * 1024 
        });
        stdout += `\n[Second Pass Sync]\n${rerunResult.stdout}`;
      } catch (_) {
        // Keep initial pass if rerun encountered any issue
      }
    }
    
    const pdfPath = path.join(outputDir, `${baseName}.pdf`);
    const logPath = path.join(outputDir, `${baseName}.log`);
    const relativePdfPath = path.relative(absoluteWorkspace, pdfPath);
    const fullLogs = stdout + (stderr ? `\nERRORS:\n${stderr}` : '');

    try {
      await fs.writeFile(logPath, fullLogs, 'utf-8');
    } catch (_) {}

    return {
      success: true,
      pdfPath: relativePdfPath,
      logs: fullLogs,
    };
  } catch (error: any) {
    // If the compiler engine does not support --enable-installer (e.g., pure TeX Live), retry without it
    const errorMsg = (error.message || '') + (error.stderr || '') + (error.stdout || '');
    if (errorMsg.includes('unrecognized option') && errorMsg.includes('enable-installer')) {
      try {
        const fallbackCmd = `${compilerEngine} -interaction=nonstopmode -halt-on-error -output-directory="${outputDir}" "${fullPath}"`;
        const { stdout, stderr } = await execAsync(fallbackCmd, { 
          cwd: workDir, 
          timeout: 180000, 
          maxBuffer: 10 * 1024 * 1024 
        });
        const pdfPath = path.join(outputDir, `${baseName}.pdf`);
        const logPath = path.join(outputDir, `${baseName}.log`);
        const relativePdfPath = path.relative(absoluteWorkspace, pdfPath);
        const fullLogs = stdout + (stderr ? `\nERRORS:\n${stderr}` : '');
        try {
          await fs.writeFile(logPath, fullLogs, 'utf-8');
        } catch (_) {}

        return {
          success: true,
          pdfPath: relativePdfPath,
          logs: fullLogs,
        };
      } catch (fallbackErr: any) {
        error = fallbackErr;
      }
    }
    const errorStr = (error.message || '').toLowerCase();
    const isCommandNotFound = error.code === 'ENOENT' || 
                              errorStr.includes('not found') || 
                              errorStr.includes('not recognized') || 
                              errorStr.includes('no such file or directory');
    
    // If local compiler executable is missing (e.g., MiKTeX/TeX Live is not installed)
    if (isCommandNotFound) {
      console.log(`Local compiler '${compilerEngine}' not found on system. Falling back to zero-install online compilers...`);
      try {
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const pdfPath = path.join(outputDir, `${baseName}.pdf`);
        const logPath = path.join(outputDir, `${baseName}.log`);
        
        const successMessage = await compileLatexOnline(fileContent, pdfPath);
        if (successMessage) {
          const relativePdfPath = path.relative(absoluteWorkspace, pdfPath);
          const logsText = `[Zero-Install Fallback Mode Activated]\n${successMessage}\n\nNote: Since no local LaTeX distribution (MiKTeX/TeX Live) was found on your system, the application compiled your document online securely on-demand.`;
          try {
            await fs.writeFile(logPath, logsText, 'utf-8');
          } catch (_) {}
          return {
            success: true,
            pdfPath: relativePdfPath,
            logs: logsText
          };
        } else {
          const failureText = `Error: No local LaTeX distribution (like MiKTeX or TeX Live) found on this computer, and the built-in online compiling APIs are currently offline or unreachable. Please connect to the internet or install a local LaTeX compiler for full offline capabilities.`;
          try {
            await fs.writeFile(logPath, failureText, 'utf-8');
          } catch (_) {}
          return {
            success: false,
            pdfPath: null,
            logs: failureText
          };
        }
      } catch (readErr: any) {
        const errText = `Failed to read LaTeX source file for online compilation: ${readErr.message}`;
        const logPath = path.join(outputDir, `${baseName}.log`);
        try {
          await fs.writeFile(logPath, errText, 'utf-8');
        } catch (_) {}
        return {
          success: false,
          pdfPath: null,
          logs: errText
        };
      }
    }

    // pdflatex usually exits with non-zero on compilation errors
    const failLogs = error.stdout || (error.stderr ? `ERRORS:\n${error.stderr}` : error.message);
    const logPath = path.join(outputDir, `${baseName}.log`);
    try {
      await fs.writeFile(logPath, failLogs, 'utf-8');
    } catch (_) {}

    return {
      success: false,
      pdfPath: null,
      logs: failLogs,
    };
  }
}
