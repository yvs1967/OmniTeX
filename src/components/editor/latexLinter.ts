export interface LatexQuickFix {
  title: string;
  isPreferred?: boolean;
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  newText: string;
}

export interface LatexDiagnostic {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  startCol: number;
  endCol: number;
  code?: string;
  quickFixes?: LatexQuickFix[];
}

export interface WorkspaceFileItem {
  path: string;
  name: string;
  isImage: boolean;
  isTex: boolean;
  isBib?: boolean;
}

const STANDARD_ENVIRONMENTS = new Set([
  'document',
  'center',
  'flushleft',
  'flushright',
  'itemize',
  'enumerate',
  'description',
  'tabular',
  'tabular*',
  'array',
  'table',
  'table*',
  'figure',
  'figure*',
  'quote',
  'quotation',
  'verse',
  'verbatim',
  'verbatim*',
  'minipage',
  'titlepage',
  'abstract',
  'math',
  'displaymath',
  'equation',
  'equation*',
  'picture',
  'letter'
]);

const AMSMATH_ENVIRONMENTS = new Set([
  'align',
  'align*',
  'gather',
  'gather*',
  'multline',
  'multline*',
  'split',
  'cases',
  'matrix',
  'pmatrix',
  'bmatrix',
  'Bmatrix',
  'vmatrix',
  'Vmatrix',
  'subequations',
  'aligned',
  'gathered',
  'flalign',
  'flalign*'
]);

const PACKAGE_REQUIRED_ENVIRONMENTS: Record<string, { package: string; description: string }> = {
  tikzpicture: { package: 'tikz', description: 'TikZ vector graphics canvas' },
  lstlisting: { package: 'listings', description: 'Source code listings' },
  tcolorbox: { package: 'tcolorbox', description: 'Colored framed boxes' },
  tabularx: { package: 'tabularx', description: 'Adjustable-width tables' },
  longtable: { package: 'longtable', description: 'Multi-page tables' },
  multicols: { package: 'multicol', description: 'Multi-column text' },
  algorithm: { package: 'algorithm', description: 'Algorithm floating wrapper' },
  algorithmic: { package: 'algpseudocode', description: 'Pseudocode formatting' },
  wrapfigure: { package: 'wrapfig', description: 'Text-wrapped figures' },
  wraptable: { package: 'wrapfig', description: 'Text-wrapped tables' },
  circuitikz: { package: 'circuitikz', description: 'Electrical circuits' },
};

const COMMON_THEOREM_ENVIRONMENTS = [
  'problem',
  'question',
  'solution',
  'exercise',
  'theorem',
  'lemma',
  'corollary',
  'definition',
  'proposition',
  'claim',
  'example',
  'remark',
  'conjecture',
  'hypothesis',
  'axiom',
  'property',
  'proof'
];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function analyzeLatexDocument(content: string, workspaceFiles: WorkspaceFileItem[] = []): LatexDiagnostic[] {
  const diagnostics: LatexDiagnostic[] = [];
  const lines = content.split('\n');

  // =========================================================================
  // Phase 1: Parse Preamble (Packages, DocumentClass, Custom Environments)
  // =========================================================================
  let docClassLine = -1;
  let docClass = '';
  let beginDocLine = -1;
  let endDocLine = -1;
  const importedPackages = new Set<string>();
  const definedEnvironments = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Strip comment
    const commentIdx = rawLine.indexOf('%');
    const line = commentIdx !== -1 ? rawLine.substring(0, commentIdx) : rawLine;
    const lineNum = i + 1;

    // Document class
    const dcMatch = line.match(/\\documentclass(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}/);
    if (dcMatch) {
      docClassLine = lineNum;
      docClass = dcMatch[1].trim();
    }

    // Packages
    const pkgMatches = line.matchAll(/\\usepackage(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}/g);
    for (const pm of pkgMatches) {
      const pkgs = pm[1].split(',').map(p => p.trim());
      pkgs.forEach(p => importedPackages.add(p));
    }

    // Custom environment definitions: \newenvironment, \newtheorem
    const newEnvMatches = line.matchAll(/\\newenvironment\{([^}]+)\}/g);
    for (const nem of newEnvMatches) {
      definedEnvironments.add(nem[1].trim());
    }
    const newThmMatches = line.matchAll(/\\newtheorem\*?\{([^}]+)\}/g);
    for (const ntm of newThmMatches) {
      definedEnvironments.add(ntm[1].trim());
    }

    // Document bounds
    if (line.includes('\\begin{document}')) {
      beginDocLine = lineNum;
    }
    if (line.includes('\\end{document}')) {
      endDocLine = lineNum;
    }
  }

  // Helper to calculate preamble insert position (right after \documentclass or before \begin{document} or line 1)
  const getPreambleInsertPos = () => {
    if (docClassLine !== -1) {
      const targetLine = lines[docClassLine - 1];
      return {
        line: docClassLine,
        col: targetLine.length + 1,
        prependNewline: true
      };
    }
    if (beginDocLine !== -1) {
      return {
        line: beginDocLine,
        col: 1,
        prependNewline: false
      };
    }
    return {
      line: 1,
      col: 1,
      prependNewline: false
    };
  };

  const createPreambleFix = (title: string, codeToInsert: string): LatexQuickFix => {
    const pos = getPreambleInsertPos();
    if (pos.prependNewline) {
      return {
        title,
        isPreferred: true,
        range: {
          startLineNumber: pos.line,
          startColumn: pos.col,
          endLineNumber: pos.line,
          endColumn: pos.col,
        },
        newText: `\n${codeToInsert}`
      };
    } else {
      return {
        title,
        isPreferred: true,
        range: {
          startLineNumber: pos.line,
          startColumn: pos.col,
          endLineNumber: pos.line,
          endColumn: pos.col,
        },
        newText: `${codeToInsert}\n`
      };
    }
  };

  // Check document structure
  if (docClassLine === -1 && lines.length > 0 && content.trim().length > 0) {
    diagnostics.push({
      id: 'missing-documentclass',
      severity: 'warning',
      message: "Document is missing a '\\documentclass{article}' declaration at the top.",
      line: 1,
      startCol: 1,
      endCol: Math.min(lines[0].length + 1, 15),
      quickFixes: [{
        title: "Insert '\\documentclass{article}' at top of file",
        isPreferred: true,
        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
        newText: "\\documentclass{article}\n"
      }]
    });
  }

  if (beginDocLine === -1 && content.trim().length > 0) {
    diagnostics.push({
      id: 'missing-begin-document',
      severity: 'error',
      message: "Document is missing '\\begin{document}'.",
      line: Math.max(docClassLine + 1, 1),
      startCol: 1,
      endCol: 20,
      quickFixes: [{
        title: "Insert '\\begin{document}' and '\\end{document}'",
        isPreferred: true,
        range: {
          startLineNumber: lines.length,
          startColumn: lines[lines.length - 1].length + 1,
          endLineNumber: lines.length,
          endColumn: lines[lines.length - 1].length + 1
        },
        newText: "\n\\begin{document}\n\n\\end{document}\n"
      }]
    });
  } else if (endDocLine === -1 && beginDocLine !== -1) {
    diagnostics.push({
      id: 'missing-end-document',
      severity: 'error',
      message: "Document is missing '\\end{document}' at the end.",
      line: lines.length,
      startCol: 1,
      endCol: lines[lines.length - 1].length + 1,
      quickFixes: [{
        title: "Append '\\end{document}' at bottom",
        isPreferred: true,
        range: {
          startLineNumber: lines.length,
          startColumn: lines[lines.length - 1].length + 1,
          endLineNumber: lines.length,
          endColumn: lines[lines.length - 1].length + 1
        },
        newText: "\n\\end{document}\n"
      }]
    });
  }

  // =========================================================================
  // Phase 2: Environment Stack & Command Checks
  // =========================================================================
  interface EnvStackItem {
    name: string;
    line: number;
    startCol: number;
    endCol: number;
  }
  const envStack: EnvStackItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const commentIdx = rawLine.indexOf('%');
    const line = commentIdx !== -1 ? rawLine.substring(0, commentIdx) : rawLine;
    const lineNum = i + 1;

    // Check accidental nested command bugs like \usepackage{\usepackage{...}} or \begin{\begin{...}}
    const nestedUsepkg = line.match(/\\usepackage\s*\{[^}]*\\usepackage/);
    if (nestedUsepkg && nestedUsepkg.index !== undefined) {
      diagnostics.push({
        id: `nested-usepkg-${lineNum}`,
        severity: 'error',
        message: "Accidental nested '\\usepackage{\\usepackage{...}}' command detected.",
        line: lineNum,
        startCol: nestedUsepkg.index + 1,
        endCol: nestedUsepkg.index + nestedUsepkg[0].length + 1,
        quickFixes: [{
          title: "Clean nested \\usepackage",
          isPreferred: true,
          range: {
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: rawLine.length + 1
          },
          newText: rawLine.replace(/\\usepackage\s*\{\s*\\usepackage\s*\{([^}]+)\}\s*\}/g, '\\usepackage{$1}')
        }]
      });
    }

    const nestedBegin = line.match(/\\begin\s*\{[^}]*\\begin/);
    if (nestedBegin && nestedBegin.index !== undefined) {
      diagnostics.push({
        id: `nested-begin-${lineNum}`,
        severity: 'error',
        message: "Accidental nested '\\begin{\\begin{...}}' command detected.",
        line: lineNum,
        startCol: nestedBegin.index + 1,
        endCol: nestedBegin.index + nestedBegin[0].length + 1
      });
    }

    // -----------------------------------------------------------------------
    // Command Check 1: \includegraphics
    // -----------------------------------------------------------------------
    const includegraphicsMatches = Array.from(line.matchAll(/\\includegraphics(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}/g));
    for (const ig of includegraphicsMatches) {
      const fullCmd = ig[0];
      const imgPath = ig[1].trim();
      const col = (ig.index || 0) + 1;

      // Check package: graphicx
      if (!importedPackages.has('graphicx')) {
        diagnostics.push({
          id: `missing-graphicx-${lineNum}-${col}`,
          severity: 'error',
          message: "Command '\\includegraphics' requires the 'graphicx' package. Add '\\usepackage{graphicx}' to your preamble.",
          line: lineNum,
          startCol: col,
          endCol: col + fullCmd.length,
          quickFixes: [createPreambleFix("Add '\\usepackage{graphicx}' to preamble", "\\usepackage{graphicx}")]
        });
      }

      // Check if image file exists in workspace
      if (workspaceFiles.length > 0 && imgPath && !imgPath.includes('example')) {
        const found = workspaceFiles.some(f => 
          f.isImage && (
            f.path === imgPath || 
            f.name === imgPath || 
            f.path === 'images/' + imgPath ||
            imgPath.endsWith(f.path) ||
            f.path.replace(/\.[^/.]+$/, '') === imgPath.replace(/\.[^/.]+$/, '')
          )
        );

        if (!found) {
          const availableImages = workspaceFiles.filter(f => f.isImage);
          const fixes: LatexQuickFix[] = availableImages.slice(0, 3).map(img => ({
            title: `Replace with '${img.path}'`,
            range: {
              startLineNumber: lineNum,
              startColumn: col + fullCmd.indexOf(`{${imgPath}}`) + 1,
              endLineNumber: lineNum,
              endColumn: col + fullCmd.indexOf(`{${imgPath}}`) + 1 + imgPath.length
            },
            newText: img.path
          }));

          diagnostics.push({
            id: `missing-image-${lineNum}-${col}`,
            severity: 'warning',
            message: `Image file '${imgPath}' was not found in project workspace.`,
            line: lineNum,
            startCol: col,
            endCol: col + fullCmd.length,
            quickFixes: fixes.length > 0 ? fixes : undefined
          });
        }
      }
    }

    // -----------------------------------------------------------------------
    // Command Check 2: Commands needing specific packages (\href, \toprule, etc.)
    // -----------------------------------------------------------------------
    if (line.includes('\\href') || line.includes('\\url')) {
      if (!importedPackages.has('hyperref') && !importedPackages.has('url')) {
        const idx = Math.max(line.indexOf('\\href'), line.indexOf('\\url'));
        diagnostics.push({
          id: `missing-hyperref-${lineNum}`,
          severity: 'error',
          message: "Hyperlinks (\\href / \\url) require the 'hyperref' package. Add '\\usepackage{hyperref}' to your preamble.",
          line: lineNum,
          startCol: idx + 1,
          endCol: idx + 6,
          quickFixes: [createPreambleFix("Add '\\usepackage{hyperref}' to preamble", "\\usepackage{hyperref}")]
        });
      }
    }

    if (line.includes('\\toprule') || line.includes('\\midrule') || line.includes('\\bottomrule')) {
      if (!importedPackages.has('booktabs')) {
        const idx = Math.max(line.indexOf('\\toprule'), line.indexOf('\\midrule'), line.indexOf('\\bottomrule'));
        diagnostics.push({
          id: `missing-booktabs-${lineNum}`,
          severity: 'error',
          message: "Publication-quality table rules (\\toprule, \\midrule, \\bottomrule) require the 'booktabs' package.",
          line: lineNum,
          startCol: idx + 1,
          endCol: idx + 10,
          quickFixes: [createPreambleFix("Add '\\usepackage{booktabs}' to preamble", "\\usepackage{booktabs}")]
        });
      }
    }

    if (line.includes('\\bm{')) {
      if (!importedPackages.has('bm')) {
        const idx = line.indexOf('\\bm{');
        diagnostics.push({
          id: `missing-bm-${lineNum}`,
          severity: 'error',
          message: "Bold math symbols (\\bm) require the 'bm' package. Add '\\usepackage{bm}' to your preamble.",
          line: lineNum,
          startCol: idx + 1,
          endCol: idx + 4,
          quickFixes: [createPreambleFix("Add '\\usepackage{bm}' to preamble", "\\usepackage{bm}")]
        });
      }
    }

    if (line.includes('\\mathbb{')) {
      if (!importedPackages.has('amssymb') && !importedPackages.has('amsmath')) {
        const idx = line.indexOf('\\mathbb{');
        diagnostics.push({
          id: `missing-amssymb-${lineNum}`,
          severity: 'error',
          message: "Blackboard bold symbols (\\mathbb) require the 'amssymb' package. Add '\\usepackage{amssymb}' to your preamble.",
          line: lineNum,
          startCol: idx + 1,
          endCol: idx + 8,
          quickFixes: [createPreambleFix("Add '\\usepackage{amssymb}' to preamble", "\\usepackage{amssymb}")]
        });
      }
    }

    if (line.includes('\\textcolor{') || line.includes('\\color{') || line.includes('\\colorbox{')) {
      if (!importedPackages.has('xcolor') && !importedPackages.has('color')) {
        const idx = Math.max(line.indexOf('\\textcolor{'), line.indexOf('\\color{'));
        diagnostics.push({
          id: `missing-xcolor-${lineNum}`,
          severity: 'error',
          message: "Color commands (\\textcolor, \\color) require the 'xcolor' package.",
          line: lineNum,
          startCol: idx + 1,
          endCol: idx + 10,
          quickFixes: [createPreambleFix("Add '\\usepackage{xcolor}' to preamble", "\\usepackage{xcolor}")]
        });
      }
    }

    if (line.includes('\\cref{') || line.includes('\\Cref{')) {
      if (!importedPackages.has('cleveref')) {
        const idx = Math.max(line.indexOf('\\cref{'), line.indexOf('\\Cref{'));
        diagnostics.push({
          id: `missing-cleveref-${lineNum}`,
          severity: 'error',
          message: "Smart cross-referencing (\\cref) requires the 'cleveref' package.",
          line: lineNum,
          startCol: idx + 1,
          endCol: idx + 6,
          quickFixes: [createPreambleFix("Add '\\usepackage{cleveref}' to preamble", "\\usepackage{cleveref}")]
        });
      }
    }

    // -----------------------------------------------------------------------
    // Command Check 3: \begin{...} Environments
    // -----------------------------------------------------------------------
    const beginMatches = Array.from(line.matchAll(/\\begin\{([a-zA-Z0-9*]+)\}/g));
    for (const bm of beginMatches) {
      const envName = bm[1];
      const col = (bm.index || 0) + 1;
      const endCol = col + bm[0].length;

      // Push to stack for environment matching verification
      envStack.push({
        name: envName,
        line: lineNum,
        startCol: col,
        endCol: endCol
      });

      // 1. Is it an amsmath environment?
      if (AMSMATH_ENVIRONMENTS.has(envName)) {
        if (!importedPackages.has('amsmath')) {
          diagnostics.push({
            id: `missing-amsmath-env-${lineNum}-${envName}`,
            severity: 'error',
            message: `Math environment '\\begin{${envName}}' requires the 'amsmath' package. Add '\\usepackage{amsmath}' to your preamble.`,
            line: lineNum,
            startCol: col,
            endCol: endCol,
            quickFixes: [createPreambleFix("Add '\\usepackage{amsmath}' to preamble", "\\usepackage{amsmath}")]
          });
        }
        continue;
      }

      // 2. Is it another package-required environment?
      if (PACKAGE_REQUIRED_ENVIRONMENTS[envName]) {
        const req = PACKAGE_REQUIRED_ENVIRONMENTS[envName];
        if (!importedPackages.has(req.package)) {
          diagnostics.push({
            id: `missing-pkg-env-${lineNum}-${envName}`,
            severity: 'error',
            message: `Environment '\\begin{${envName}}' (${req.description}) requires the '${req.package}' package.`,
            line: lineNum,
            startCol: col,
            endCol: endCol,
            quickFixes: [createPreambleFix(`Add '\\usepackage{${req.package}}' to preamble`, `\\usepackage{${req.package}}`)]
          });
        }
        continue;
      }

      // 3. Is it a standard built-in environment?
      if (STANDARD_ENVIRONMENTS.has(envName)) {
        continue;
      }

      // 4. Is it already defined in preamble via \newenvironment or \newtheorem?
      if (definedEnvironments.has(envName)) {
        continue;
      }

      // 5. Beamer environments in beamer class
      if (docClass === 'beamer' && ['frame', 'columns', 'column', 'block', 'alertblock', 'exampleblock'].includes(envName)) {
        continue;
      }

      // 6. Check for typo in standard environments (Levenshtein distance <= 2)
      let closestKnown = '';
      let lowestDist = 999;
      for (const std of STANDARD_ENVIRONMENTS) {
        const d = levenshtein(envName.toLowerCase(), std);
        if (d < lowestDist && d <= 2) {
          lowestDist = d;
          closestKnown = std;
        }
      }
      for (const ams of AMSMATH_ENVIRONMENTS) {
        const d = levenshtein(envName.toLowerCase(), ams);
        if (d < lowestDist && d <= 2) {
          lowestDist = d;
          closestKnown = ams;
        }
      }

      if (closestKnown && lowestDist <= 2) {
        diagnostics.push({
          id: `typo-env-${lineNum}-${col}`,
          severity: 'error',
          message: `Unknown environment '${envName}'. Did you mean '${closestKnown}'?`,
          line: lineNum,
          startCol: col,
          endCol: endCol,
          quickFixes: [{
            title: `Change to '\\begin{${closestKnown}}'`,
            isPreferred: true,
            range: {
              startLineNumber: lineNum,
              startColumn: col,
              endLineNumber: lineNum,
              endColumn: endCol
            },
            newText: `\\begin{${closestKnown}}`
          }]
        });
        continue;
      }

      // 7. Domain / Problem / Question / Theorem environment: Suggest definition!
      const capName = capitalize(envName);
      const isCommonTheorem = COMMON_THEOREM_ENVIRONMENTS.includes(envName.toLowerCase());

      const thmCode = importedPackages.has('amsthm')
        ? `\\newtheorem{${envName}}{${capName}}`
        : `\\usepackage{amsthm}\n\\newtheorem{${envName}}{${capName}}`;

      const fixes: LatexQuickFix[] = [
        createPreambleFix(`Define theorem environment: \\newtheorem{${envName}}{${capName}}`, thmCode),
        createPreambleFix(`Define custom environment: \\newenvironment{${envName}}{...}{...}`, `\\newenvironment{${envName}}\n  {\\par\\medskip\\noindent\\textbf{${capName}:}\\itshape}\n  {\\par\\medskip}`)
      ];

      diagnostics.push({
        id: `undefined-env-${lineNum}-${col}`,
        severity: 'error',
        message: `Environment '${envName}' is not defined. You need to define it using '\\newtheorem{${envName}}{${capName}}' in your preamble or import an appropriate package.`,
        line: lineNum,
        startCol: col,
        endCol: endCol,
        quickFixes: fixes
      });
    }

    // -----------------------------------------------------------------------
    // Command Check 4: \end{...} Environment matching
    // -----------------------------------------------------------------------
    const endMatches = Array.from(line.matchAll(/\\end\{([a-zA-Z0-9*]+)\}/g));
    for (const em of endMatches) {
      const endEnvName = em[1];
      const col = (em.index || 0) + 1;
      const endCol = col + em[0].length;

      if (envStack.length === 0) {
        diagnostics.push({
          id: `unmatched-end-${lineNum}-${col}`,
          severity: 'error',
          message: `Unexpected '\\end{${endEnvName}}' with no matching '\\begin{${endEnvName}}'.`,
          line: lineNum,
          startCol: col,
          endCol: endCol
        });
      } else {
        const top = envStack[envStack.length - 1];
        if (top.name === endEnvName) {
          envStack.pop();
        } else {
          // Check if top was closed out-of-order or mismatched
          const matchingIdx = envStack.map(e => e.name).lastIndexOf(endEnvName);
          if (matchingIdx !== -1) {
            // Some inner environment was left unclosed
            const unclosed = envStack[envStack.length - 1];
            diagnostics.push({
              id: `unclosed-inner-${unclosed.line}`,
              severity: 'error',
              message: `Unclosed environment: '\\begin{${unclosed.name}}' on line ${unclosed.line} was not closed before '\\end{${endEnvName}}'.`,
              line: unclosed.line,
              startCol: unclosed.startCol,
              endCol: unclosed.endCol,
              quickFixes: [{
                title: `Insert '\\end{${unclosed.name}}' before '\\end{${endEnvName}}'`,
                isPreferred: true,
                range: {
                  startLineNumber: lineNum,
                  startColumn: col,
                  endLineNumber: lineNum,
                  endColumn: col
                },
                newText: `\\end{${unclosed.name}}\n`
              }]
            });
            envStack.splice(matchingIdx);
          } else {
            // Direct mismatch: \begin{center} ... \end{itemize}
            diagnostics.push({
              id: `mismatched-env-${lineNum}-${col}`,
              severity: 'error',
              message: `Mismatched environment: '\\begin{${top.name}}' on line ${top.line} is closed by '\\end{${endEnvName}}'.`,
              line: lineNum,
              startCol: col,
              endCol: endCol,
              quickFixes: [
                {
                  title: `Change '\\end{${endEnvName}}' to '\\end{${top.name}}'`,
                  isPreferred: true,
                  range: {
                    startLineNumber: lineNum,
                    startColumn: col,
                    endLineNumber: lineNum,
                    endColumn: endCol
                  },
                  newText: `\\end{${top.name}}`
                },
                {
                  title: `Change '\\begin{${top.name}}' on line ${top.line} to '\\begin{${endEnvName}}'`,
                  range: {
                    startLineNumber: top.line,
                    startColumn: top.startCol,
                    endLineNumber: top.line,
                    endColumn: top.endCol
                  },
                  newText: `\\begin{${endEnvName}}`
                }
              ]
            });
            envStack.pop();
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Command Check 5: Unbalanced inline math ($)
    // -----------------------------------------------------------------------
    // Count unescaped dollar signs on this line (excluding $$ display math)
    const cleanedLine = line.replace(/\\\$/g, '').replace(/\$\$/g, '');
    const dollarCount = (cleanedLine.match(/\$/g) || []).length;
    if (dollarCount % 2 !== 0) {
      diagnostics.push({
        id: `unbalanced-dollar-${lineNum}`,
        severity: 'warning',
        message: "Unbalanced inline math delimiter '$' on this line. Formula may be unclosed.",
        line: lineNum,
        startCol: 1,
        endCol: line.length + 1
      });
    }
  }

  // Report any remaining unclosed environments on stack
  for (const remaining of envStack) {
    if (remaining.name === 'document') continue; // Handled separately
    diagnostics.push({
      id: `unclosed-env-${remaining.line}-${remaining.name}`,
      severity: 'error',
      message: `Unclosed environment: '\\begin{${remaining.name}}' is missing a matching '\\end{${remaining.name}}'.`,
      line: remaining.line,
      startCol: remaining.startCol,
      endCol: remaining.endCol,
      quickFixes: [{
        title: `Append '\\end{${remaining.name}}'`,
        isPreferred: true,
        range: {
          startLineNumber: lines.length,
          startColumn: lines[lines.length - 1].length + 1,
          endLineNumber: lines.length,
          endColumn: lines[lines.length - 1].length + 1
        },
        newText: `\n\\end{${remaining.name}}\n`
      }]
    });
  }

  return diagnostics;
}
