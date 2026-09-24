import React, { useState, useEffect } from 'react';
import { 
  Github, 
  DownloadCloud, 
  UploadCloud, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Settings, 
  Key, 
  Link, 
  User, 
  Mail, 
  GitBranch, 
  X, 
  Send,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';

interface GitInfo {
  branch: string;
  branches: string[];
  remoteUrl: string;
  hasRemote: boolean;
  changedFiles: number;
  userName: string;
  userEmail: string;
}

export default function GitControls() {
  const [pullStatus, setPullStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pushStatus, setPushStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [gitName, setGitName] = useState('');
  const [gitEmail, setGitEmail] = useState('');
  const [branch, setBranch] = useState('main');

  const [commitMessage, setCommitMessage] = useState('Update LaTeX documents');
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const fetchGitInfo = async () => {
    try {
      const res = await axios.get('/api/git/info');
      setGitInfo(res.data);
      if (res.data.branch) {
        setBranch(res.data.branch);
      }
      if (res.data.userName && !gitName) {
        setGitName(res.data.userName);
      }
      if (res.data.userEmail && !gitEmail) {
        setGitEmail(res.data.userEmail);
      }
    } catch (err) {
      console.error('Failed to fetch git info:', err);
    }
  };

  // Load from localStorage and backend on mount
  useEffect(() => {
    const savedUrl = localStorage.getItem('git_repo_url') || '';
    const savedToken = localStorage.getItem('git_token') || '';
    const savedName = localStorage.getItem('git_name') || '';
    const savedEmail = localStorage.getItem('git_email') || '';
    const savedBranch = localStorage.getItem('git_branch') || 'main';

    setRepoUrl(savedUrl);
    setToken(savedToken);
    setGitName(savedName);
    setGitEmail(savedEmail);
    setBranch(savedBranch);

    fetchGitInfo();

    if (savedName && savedEmail) {
      axios.post('/api/git/config', { name: savedName, email: savedEmail })
        .catch(err => console.error('Failed to sync Git config with backend on mount:', err));
    }
  }, []);

  const saveSettings = async () => {
    setIsTesting(true);
    setErrorMessage(null);
    try {
      localStorage.setItem('git_repo_url', repoUrl.trim());
      localStorage.setItem('git_token', token.trim());
      localStorage.setItem('git_name', gitName.trim());
      localStorage.setItem('git_email', gitEmail.trim());
      localStorage.setItem('git_branch', branch.trim() || 'main');

      if (gitName.trim() && gitEmail.trim()) {
        await axios.post('/api/git/config', {
          name: gitName.trim(),
          email: gitEmail.trim()
        });
      }

      await fetchGitInfo();
      setSuccessMessage('GitHub settings saved!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowSettings(false);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsTesting(false);
    }
  };

  const handlePull = async () => {
    if (!repoUrl) {
      setErrorMessage('Please configure GitHub repository URL first.');
      setShowSettings(true);
      return;
    }

    setPullStatus('loading');
    setErrorMessage(null);
    try {
      const response = await axios.post('/api/git/pull', { 
        repoUrl: repoUrl.trim(),
        token: token.trim() || undefined,
        branch: branch.trim() || 'main'
      });

      if (response.data.success === false && response.data.conflict) {
        setPullStatus('error');
        setErrorMessage(`Merge conflict in: ${response.data.files?.join(', ') || 'files'}.`);
      } else {
        setPullStatus('success');
        setSuccessMessage('Successfully pulled latest changes from GitHub!');
        setTimeout(() => {
          setPullStatus('idle');
          setSuccessMessage(null);
        }, 3000);
        await fetchGitInfo();
      }
    } catch (err: any) {
      console.error('Pull failed', err);
      setPullStatus('error');
      setErrorMessage(err.response?.data?.error || 'Failed to pull changes from GitHub');
      setTimeout(() => setPullStatus('idle'), 4000);
    }
  };

  const openPushDialog = () => {
    if (!repoUrl) {
      setErrorMessage('Please configure GitHub repository URL first.');
      setShowSettings(true);
      return;
    }
    setShowCommitModal(true);
  };

  const executePush = async () => {
    if (!commitMessage.trim()) {
      setErrorMessage('Commit message is required');
      return;
    }

    setPushStatus('loading');
    setErrorMessage(null);
    try {
      await axios.post('/api/git/push', { 
        message: commitMessage.trim(),
        repoUrl: repoUrl.trim(),
        token: token.trim() || undefined,
        branch: branch.trim() || 'main'
      });

      setPushStatus('success');
      setShowCommitModal(false);
      setSuccessMessage('Successfully pushed changes to GitHub!');
      setTimeout(() => {
        setPushStatus('idle');
        setSuccessMessage(null);
      }, 3000);
      await fetchGitInfo();
    } catch (err: any) {
      console.error('Push failed', err);
      setPushStatus('error');
      setErrorMessage(err.response?.data?.error || 'Failed to push changes to GitHub');
      setTimeout(() => setPushStatus('idle'), 4000);
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/70 rounded-lg border border-zinc-800 shadow-inner">
        {/* GitHub / Remote status indicator */}
        <div 
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono"
          title={gitInfo?.hasRemote ? `Connected to ${gitInfo.remoteUrl}` : "No remote configured"}
        >
          <span className={cn(
            "w-2 h-2 rounded-full",
            gitInfo?.hasRemote ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-zinc-600"
          )} />
          <GitBranch className="w-3 h-3 text-zinc-400" />
          <span className="max-w-[70px] truncate hidden md:inline">{gitInfo?.branch || branch}</span>
        </div>

        {/* Settings Toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            "p-1.5 rounded transition-all active:scale-95 cursor-pointer",
            showSettings ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          )}
          title="GitHub & Git Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-zinc-800 mx-0.5"></div>

        {/* Pull Button */}
        <button
          onClick={handlePull}
          disabled={pullStatus === 'loading'}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-all active:scale-95 group shrink-0 cursor-pointer",
            pullStatus === 'loading' ? "text-zinc-600 cursor-not-allowed" :
            pullStatus === 'success' ? "text-green-400" :
            pullStatus === 'error' ? "text-red-400" :
            "text-zinc-300 hover:text-white hover:bg-zinc-800"
          )}
          title="Pull latest changes from GitHub"
        >
          {pullStatus === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
          ) : pullStatus === 'success' ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
          ) : pullStatus === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <DownloadCloud className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform text-blue-400" />
          )}
          <span className="hidden sm:inline">Pull</span>
        </button>

        {/* Push Button */}
        <button
          onClick={openPushDialog}
          disabled={pushStatus === 'loading'}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded transition-all active:scale-95 shrink-0 shadow-sm cursor-pointer",
            pushStatus === 'loading' ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" :
            pushStatus === 'success' ? "bg-green-600 text-white" :
            pushStatus === 'error' ? "bg-red-600 text-white" :
            "bg-indigo-600 hover:bg-indigo-500 text-white"
          )}
          title="Commit & Push changes to GitHub"
        >
          {pushStatus === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : pushStatus === 'success' ? (
            <CheckCircle className="w-3.5 h-3.5" />
          ) : pushStatus === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5" />
          ) : (
            <UploadCloud className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Push</span>
        </button>
      </div>

      {/* Commit & Push Modal */}
      {showCommitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Push to GitHub</h3>
              </div>
              <button 
                onClick={() => setShowCommitModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-xs">
                <span className="text-zinc-400">Target Branch:</span>
                <span className="font-mono text-indigo-300 font-bold flex items-center gap-1">
                  <GitBranch className="w-3.5 h-3.5" />
                  {branch || 'main'}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Commit Message
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Describe your changes..."
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                />
              </div>

              <div className="text-[11px] text-zinc-500">
                This will stage all files in your workspace, create a commit, and push to origin/{branch || 'main'}.
              </div>
            </div>

            <div className="p-4 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCommitModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executePush}
                disabled={pushStatus === 'loading' || !commitMessage.trim()}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-md"
              >
                {pushStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Commit & Push
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dropdown / Modal */}
      {showSettings && (
        <div className="absolute top-12 right-0 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-[80] p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Github className="w-4 h-4 text-white" />
              GitHub Repository Sync
            </h3>
            <button 
              onClick={() => setShowSettings(false)} 
              className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1.5">
                <Link className="w-3 h-3 text-indigo-400" /> Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/my-latex-project"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-700"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-indigo-400" /> Personal Access Token (PAT)
                </label>
                <a 
                  href="https://github.com/settings/tokens" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[9px] text-indigo-400 hover:underline flex items-center gap-0.5"
                >
                  Generate <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-700"
              />
              <span className="text-[9px] text-zinc-500">Requires `repo` scope to push & pull private or public repos.</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1.5">
                <GitBranch className="w-3 h-3 text-indigo-400" /> Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Author Name
                </label>
                <input
                  type="text"
                  value={gitName}
                  onChange={(e) => setGitName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> Author Email
                </label>
                <input
                  type="email"
                  value={gitEmail}
                  onChange={(e) => setGitEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-700"
                />
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={isTesting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg transition-colors mt-2 flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Save & Connect
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 bg-emerald-950 border border-emerald-800 text-emerald-100 text-xs px-4 py-2.5 rounded-lg shadow-2xl z-[90] flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="fixed bottom-6 right-6 bg-red-950 border border-red-800 text-red-100 text-xs px-4 py-3 rounded-lg shadow-2xl z-[90] animate-in slide-in-from-bottom-2 max-w-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <p className="flex-1 font-medium">{errorMessage}</p>
            <button 
              onClick={() => setErrorMessage(null)} 
              className="text-red-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
