import { Router } from 'express';
import * as gitService from '../services/gitService.ts';

const router = Router();

// GET /api/git/history
router.get('/history', async (req, res) => {
  try {
    const history = await gitService.getHistory();
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/git/info
router.get('/info', async (req, res) => {
  try {
    const info = await gitService.getGitInfo();
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/git/status
router.get('/status', async (req, res) => {
  try {
    const status = await gitService.gitStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/git/push
router.post('/push', async (req, res) => {
  const { message, token, repoUrl, branch } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Commit message is required' });
  }

  try {
    const result = await gitService.commitAndPush(message, token, repoUrl, branch);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/git/pull
router.post('/pull', async (req, res) => {
  const { token, repoUrl, branch } = req.body;
  try {
    const result = await gitService.pullChanges(token, repoUrl, branch);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/git
router.post('/', async (req, res) => {
  const { action, commitMessage, token, repoUrl, branch } = req.body;

  if (action === 'pull') {
    try {
      const result = await gitService.pullChanges(token, repoUrl, branch);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  } else if (action === 'push') {
    if (!commitMessage) {
      return res.status(400).json({ error: 'Commit message is required for push' });
    }
    try {
      const result = await gitService.commitAndPush(commitMessage, token, repoUrl, branch);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(400).json({ error: 'Invalid action. Use "pull" or "push".' });
  }
});

// POST /api/git/config
router.post('/config', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Username and email are required' });
  }
  try {
    const result = await gitService.configureUser(name, email);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
