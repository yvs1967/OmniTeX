import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import fsRouter from './server/api/fs.ts';
import compilerRouter from './server/api/compiler.ts';
import gitRouter from './server/api/git.ts';
import * as gitService from './server/services/gitService.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // Session configuration for iframe compatibility
  app.use(session({
    secret: process.env.SESSION_SECRET || 'latex-editor-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,      // Required for SameSite=None
      sameSite: 'none',  // Required for cross-origin iframe
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  }));

  // API Routes
  app.use('/api/fs', fsRouter);
  app.use('/api/compiler', compilerRouter);
  app.use('/api/git', gitRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  // Auto-push on close
  const handleShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Attempting auto-push before exit...`);
    try {
      // Check if there are changes to commit
      const status = await gitService.gitStatus();
      if (status.files.length > 0) {
        console.log('Detected local changes. Performing auto-push...');
        await gitService.commitAndPush(`Auto-save on exit (${new Date().toISOString()})`);
        console.log('Auto-push successful.');
      } else {
        console.log('No local changes detected. Skipping auto-push.');
      }
    } catch (err) {
      console.error('Auto-push failed during shutdown:', err);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

startServer();
