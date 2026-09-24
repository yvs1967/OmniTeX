import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import * as latexService from '../services/latexService.ts';

const router = Router();
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || './latex-workspace';

// GET /api/compiler/status?path=...
router.get('/status', async (req, res) => {
  const { path: texRelativePath } = req.query;
  if (typeof texRelativePath !== 'string') {
    return res.status(400).json({ error: 'Path is required' });
  }

  const absoluteWorkspace = path.resolve(WORKSPACE_DIR);
  const fullPath = path.resolve(WORKSPACE_DIR, texRelativePath);
  const workDir = path.dirname(fullPath);
  const baseName = path.basename(fullPath).replace(/\.tex$/, '');
  const pdfPath = path.join(workDir, `${baseName}.pdf`);
  const logPath = path.join(workDir, `${baseName}.log`);

  try {
    const pdfExists = await fs.stat(pdfPath).then(() => true).catch(() => false);
    const logExists = await fs.stat(logPath).then(() => true).catch(() => false);
    let logs: string | null = null;
    if (logExists) {
      logs = await fs.readFile(logPath, 'utf-8').catch(() => null);
    }

    res.json({
      pdfExists,
      pdfPath: pdfExists ? path.relative(absoluteWorkspace, pdfPath) : null,
      logExists,
      logPath: logExists ? path.relative(absoluteWorkspace, logPath) : null,
      logs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compiler/compile
router.post('/compile', async (req, res) => {
  const { path: filePath, compilerEngine } = req.body;
  if (typeof filePath !== 'string') {
    return res.status(400).json({ error: 'File path is required' });
  }

  try {
    const result = await latexService.compileLatex(filePath, compilerEngine);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/compiler/pdf?path=...
router.get('/pdf', (req, res) => {
  const { path: pdfRelativePath } = req.query;
  if (typeof pdfRelativePath !== 'string') {
    return res.status(400).json({ error: 'PDF path is required' });
  }

  // Security: prevent directory traversal
  const absoluteWorkspace = path.resolve(WORKSPACE_DIR);
  const pdfPath = path.resolve(WORKSPACE_DIR, pdfRelativePath);

  if (!pdfPath.startsWith(absoluteWorkspace)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.sendFile(pdfPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'PDF not found' });
    }
  });
});

export default router;
