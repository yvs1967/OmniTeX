import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || './latex-workspace';

const options: Partial<SimpleGitOptions> = {
  baseDir: path.resolve(WORKSPACE_DIR),
  binary: 'git',
  maxConcurrentProcesses: 6,
  trimmed: false,
};

let git: SimpleGit;

async function ensureRepo() {
  if (!git) {
    const absolutePath = path.resolve(WORKSPACE_DIR);
    try {
      await fs.access(path.join(absolutePath, '.git'));
    } catch {
      console.log('Initializing local git repository in workspace...');
      const initGit = simpleGit(absolutePath);
      await initGit.init();
      try {
        await initGit.branch(['-M', 'main']);
      } catch {
        // Ignored
      }
    }
    git = simpleGit(options);

    // Ensure default author identity is configured so commits never fail
    try {
      const userName = await git.getConfig('user.name');
      if (!userName.value) {
        await git.addConfig('user.name', 'LaTeX Editor User', false);
      }
      const userEmail = await git.getConfig('user.email');
      if (!userEmail.value) {
        await git.addConfig('user.email', 'latex-user@local.local', false);
      }
    } catch (e) {
      console.warn('Could not check/set default git user config:', e);
    }
  }
  return git;
}

export async function getGitInfo() {
  const g = await ensureRepo();
  try {
    const [branchInfo, remotes, status, nameConfig, emailConfig] = await Promise.all([
      g.branch().catch(() => ({ current: 'main', all: ['main'] })),
      g.getRemotes(true).catch(() => []),
      g.status().catch(() => null),
      g.getConfig('user.name').catch(() => ({ value: '' })),
      g.getConfig('user.email').catch(() => ({ value: '' })),
    ]);

    const originRemote = remotes.find(r => r.name === 'origin');
    let cleanRemoteUrl = originRemote?.refs.push || originRemote?.refs.fetch || '';
    cleanRemoteUrl = cleanRemoteUrl.replace(/https?:\/\/[^@]*@/, 'https://');

    return {
      branch: branchInfo.current || 'main',
      branches: branchInfo.all || ['main'],
      remoteUrl: cleanRemoteUrl,
      hasRemote: !!originRemote,
      changedFiles: status?.files.length || 0,
      userName: nameConfig.value || '',
      userEmail: emailConfig.value || '',
    };
  } catch (error: any) {
    console.error('getGitInfo error:', error);
    return {
      branch: 'main',
      branches: ['main'],
      remoteUrl: '',
      hasRemote: false,
      changedFiles: 0,
      userName: '',
      userEmail: '',
    };
  }
}

export async function getHistory() {
  const g = await ensureRepo();
  try {
    const log = await g.log();
    return log.all;
  } catch (error) {
    console.error('Git log error:', error);
    return [];
  }
}

export async function gitStatus() {
  const g = await ensureRepo();
  return await g.status();
}

export async function commitAndPush(message: string, accessToken?: string, repoUrl?: string, branch?: string) {
  const g = await ensureRepo();
  try {
    // 1. Stage all changes
    await g.add('.');

    // 2. Commit if there are changes
    const status = await g.status();
    let commitResult: any = null;
    if (status.staged.length > 0 || status.created.length > 0 || status.deleted.length > 0 || status.modified.length > 0) {
      commitResult = await g.commit(message);
    }

    // 3. Configure remote with token if provided
    if (repoUrl && accessToken) {
      const cleanUrl = repoUrl.trim().replace(/^https?:\/\/[^@]*@/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authUrl = `https://${accessToken}@${cleanUrl}`;
      await g.removeRemote('origin').catch(() => {});
      await g.addRemote('origin', authUrl);
    } else if (repoUrl) {
      const cleanUrl = repoUrl.trim().replace(/\/$/, '');
      const standardUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      await g.removeRemote('origin').catch(() => {});
      await g.addRemote('origin', standardUrl);
    } else if (accessToken) {
      const remotes = await g.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      if (origin && origin.refs.push.includes('github.com')) {
        const cleanPush = origin.refs.push.replace(/^https?:\/\/[^@]*@/, '').replace(/^https?:\/\//, '');
        await g.remote(['set-url', 'origin', `https://${accessToken}@${cleanPush}`]);
      }
    }

    // 4. Identify branch
    const branchInfo = await g.branch();
    const currentBranch = branch || branchInfo.current || 'main';

    const remotes = await g.getRemotes();
    if (remotes.length > 0) {
      try {
        const pushResult = await g.push('origin', currentBranch, ['-u']);
        return { success: true, commitResult, pushResult, branch: currentBranch };
      } catch (pushErr: any) {
        // Fallback without -u if already tracking
        const pushResult = await g.push('origin', currentBranch);
        return { success: true, commitResult, pushResult, branch: currentBranch };
      }
    }

    return { success: true, commitResult, pushResult: 'Skipped: No remote configured', branch: currentBranch };
  } catch (error: any) {
    throw new Error(`Git commit/push failed: ${error.message}`);
  }
}

export async function pullChanges(accessToken?: string, repoUrl?: string, branch?: string) {
  const g = await ensureRepo();
  try {
    // Configure remote with token if provided
    if (repoUrl && accessToken) {
      const cleanUrl = repoUrl.trim().replace(/^https?:\/\/[^@]*@/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      const authUrl = `https://${accessToken}@${cleanUrl}`;
      await g.removeRemote('origin').catch(() => {});
      await g.addRemote('origin', authUrl);
    } else if (repoUrl) {
      const cleanUrl = repoUrl.trim().replace(/\/$/, '');
      const standardUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
      await g.removeRemote('origin').catch(() => {});
      await g.addRemote('origin', standardUrl);
    } else if (accessToken) {
      const remotes = await g.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      if (origin && origin.refs.fetch.includes('github.com')) {
        const cleanFetch = origin.refs.fetch.replace(/^https?:\/\/[^@]*@/, '').replace(/^https?:\/\//, '');
        await g.remote(['set-url', 'origin', `https://${accessToken}@${cleanFetch}`]);
      }
    }

    const remotes = await g.getRemotes(true);
    if (remotes.length === 0) {
      throw new Error('No remote configured to pull from. Configure your GitHub repository URL in Git Settings.');
    }

    const branchInfo = await g.branch();
    const currentBranch = branch || branchInfo.current || 'main';

    try {
      const pullResult = await g.pull('origin', currentBranch, { '--allow-unrelated-histories': null });
      return { success: true, ...pullResult };
    } catch (pullErr: any) {
      if (pullErr.message.includes('CONFLICT')) {
        const status = await g.status();
        return {
          success: false,
          conflict: true,
          files: status.conflicted,
          logs: pullErr.message
        };
      }
      throw pullErr;
    }
  } catch (error: any) {
    throw new Error(`Git pull failed: ${error.message}`);
  }
}

export async function configureUser(name: string, email: string) {
  const g = await ensureRepo();
  try {
    await g.addConfig('user.name', name, false);
    await g.addConfig('user.email', email, false);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to configure git user: ${error.message}`);
  }
}
