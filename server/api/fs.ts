import { Router } from 'express';
import * as fileService from '../services/fileService.ts';
import multer from 'multer';
import path from 'path';

const router = Router();
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || './latex-workspace';

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subfolder = req.body.path || '';
    const dest = path.join(WORKSPACE_DIR, subfolder);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Get directory tree
router.get('/tree', async (req, res) => {
  try {
    const tree = await fileService.getDirectoryTree();
    res.json(tree);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Read file content
router.get('/file', async (req, res) => {
  const { path } = req.query;
  if (typeof path !== 'string') {
    return res.status(400).json({ error: 'Path is required' });
  }
  
  try {
    const content = await fileService.readFileContent(path);
    res.send(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Write file content (Save)
router.post('/file', async (req, res) => {
  const { path, content } = req.body;
  if (typeof path !== 'string' || typeof content !== 'string') {
    return res.status(400).json({ error: 'Path and content are required' });
  }
  
  try {
    await fileService.writeFileContent(path, content);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create file or folder
router.post('/create', async (req, res) => {
  const { path: relativePath, isFolder } = req.body;
  if (typeof relativePath !== 'string') {
    return res.status(400).json({ error: 'Path is required' });
  }
  
  try {
    await fileService.createNode(relativePath, !!isFolder);
    
    // Inject boilerplate for new .tex files
    if (!isFolder && relativePath.toLowerCase().endsWith('.tex')) {
      const boilerplate = `\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\title{New Document}
\\author{}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

\\end{document}`;
      await fileService.writeFileContent(relativePath, boilerplate);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload image/file
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ success: true, filePath: req.file.path });
});

// Serve binary assets (images, etc)
router.get('/asset', async (req, res) => {
  const { path: relativePath } = req.query;
  if (typeof relativePath !== 'string') {
    return res.status(400).json({ error: 'Path is required' });
  }

  try {
    const fullPath = path.resolve(WORKSPACE_DIR, relativePath);
    // Security check to ensure it's in workspace
    if (!fullPath.startsWith(path.resolve(WORKSPACE_DIR))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.sendFile(fullPath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file or folder
router.post('/delete', async (req, res) => {
  const { path } = req.body;
  if (typeof path !== 'string') {
    return res.status(400).json({ error: 'Path is required' });
  }
  
  try {
    await fileService.deleteNode(path);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rename file or folder
router.post('/rename', async (req, res) => {
  const { oldPath, newPath } = req.body;
  if (typeof oldPath !== 'string' || typeof newPath !== 'string') {
    return res.status(400).json({ error: 'oldPath and newPath are required' });
  }
  
  try {
    await fileService.renameNode(oldPath, newPath);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
