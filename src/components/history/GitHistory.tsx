import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { GitBranch, GitCommit, GitPullRequest, Send, RefreshCw, Loader2, CheckCircle2, ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GitCommitInfo {
  hash: string;
  date: string;
  message: string;
  author_name: string;
}

interface GitHistoryProps {
  onCollapse?: () => void;
}

export default function GitHistory({ onCollapse }: GitHistoryProps) {
  const [history, setHistory] = useState<GitCommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<'pull' | 'push' | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/git/history');
      setHistory(response.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to load git history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handlePull = async () => {
    setSyncing('pull');
    try {
      const token = localStorage.getItem('git_token') || undefined;
      const repoUrl = localStorage.getItem('git_repo_url') || undefined;
      const branch = localStorage.getItem('git_branch') || undefined;

      const response = await axios.post('/api/git/pull', { token, repoUrl, branch });
      if (response.data.conflict) {
        setError(`Merge Conflict: Resolve conflicts in ${response.data.files.join(', ')}`);
      } else {
        await fetchHistory();
        setError(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Pull failed');
    } finally {
      setSyncing(null);
    }
  };

  const handlePush = async () => {
    if (!commitMessage.trim()) return;
    setSyncing('push');
    try {
      const token = localStorage.getItem('git_token') || undefined;
      const repoUrl = localStorage.getItem('git_repo_url') || undefined;
      const branch = localStorage.getItem('git_branch') || undefined;

      await axios.post('/api/git/push', { 
        message: commitMessage,
        token,
        repoUrl,
        branch
      });
      setCommitMessage('');
      await fetchHistory();
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Push failed');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-100 border-r border-zinc-300">
      <div className="p-3 flex items-center justify-between border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <GitBranch className="w-3 h-3" />
          Version History
        </h2>
        <div className="flex items-center gap-1">
          <button 
            onClick={fetchHistory}
            disabled={loading}
            className="p-1 hover:bg-zinc-200 rounded text-zinc-400 transition-colors cursor-pointer"
            title="Refresh History"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              title="Slide / Collapse History Section (<)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 bg-white border-b border-zinc-200 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={handlePull}
            disabled={!!syncing}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-bold bg-zinc-800 text-white rounded hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {syncing === 'pull' ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitPullRequest className="w-3 h-3" />}
            Sync / Pull
          </button>
        </div>
        
        <div className="space-y-2">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            className="w-full h-16 p-2 text-xs border border-zinc-200 rounded resize-none focus:ring-1 focus:ring-green-500 outline-none"
          />
          <button
            onClick={handlePush}
            disabled={!!syncing || !commitMessage.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] font-bold bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {syncing === 'push' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Manual Push
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {error && (
          <div className="p-4 text-xs text-red-500 bg-red-50 border border-red-100 mx-2 rounded mb-4">
            {error}
          </div>
        )}
        
        <div className="space-y-4 px-3">
          {history.map((commit, i) => (
            <div key={commit.hash} className="relative pl-6 pb-2 border-l border-zinc-300 last:border-l-0">
              <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-zinc-400 border border-white"></div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400 font-bold tracking-tight">
                    {commit.hash.substring(0, 7)}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(commit.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-zinc-800 font-medium leading-tight">
                  {commit.message}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-4 h-4 rounded-full bg-zinc-200 flex items-center justify-center text-[8px] font-bold text-zinc-500">
                    {commit.author_name.charAt(0)}
                  </div>
                  <span className="text-[10px] text-zinc-500">{commit.author_name}</span>
                </div>
              </div>
            </div>
          ))}
          {!loading && history.length === 0 && !error && (
            <div className="p-4 text-xs text-zinc-400 text-center italic">
              No commit history
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
