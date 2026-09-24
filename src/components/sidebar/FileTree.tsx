import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { File, Folder, ChevronRight, ChevronDown, ChevronLeft, RefreshCw, Plus, FolderPlus, Upload, Image as ImageIcon, Pencil, Trash2, AlertTriangle, Terminal, FileText, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  activePath: string | null;
  refreshTrigger?: number;
  onCollapse?: () => void;
}

export default function FileTree({ onFileSelect, activePath, refreshTrigger, onCollapse }: FileTreeProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [showAuxFiles, setShowAuxFiles] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // State for our custom delete confirmation modal
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const fetchTree = async () => {
    setLoading(true);
    try {
      const response = await axios.get<FileNode[]>('/api/fs/tree');
      setTree(response.data);
      setError(null);
    } catch (err: any) {
      setError('Failed to load file tree');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [refreshTrigger]);

  useEffect(() => {
    if (activePath) {
      const lastSlash = activePath.lastIndexOf('/');
      setSelectedFolder(lastSlash !== -1 ? activePath.substring(0, lastSlash) : '');
    }
  }, [activePath]);

  const handleInlineCreate = async () => {
    if (!newName.trim()) {
      setCreating(null);
      return;
    }
    
    let baseName = newName.trim();
    if (creating === 'file' && !baseName.includes('.')) {
        baseName += '.tex';
    }

    const finalPath = selectedFolder ? `${selectedFolder}/${baseName}` : baseName;

    try {
      await axios.post('/api/fs/create', { path: finalPath, isFolder: creating === 'folder' });
      if (creating === 'folder') {
        setExpandedFolders(prev => new Set(prev).add(finalPath));
      }
      await fetchTree();
    } catch (err: any) {
      setError(`Creation failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setCreating(null);
      setNewName('');
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', selectedFolder); 

    try {
      await axios.post('/api/fs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchTree();
    } catch (err: any) {
      setError(`Upload failed: ${err.response?.data?.error || err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRenameSubmit = async (oldPath: string) => {
    if (!renameValue.trim() || renameValue === oldPath.split('/').pop()) {
      setRenamingPath(null);
      return;
    }

    const basePath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = basePath ? `${basePath}/${renameValue}` : renameValue;

    try {
      await axios.post('/api/fs/rename', { oldPath, newPath });
      if (activePath === oldPath) onFileSelect(newPath);
      await fetchTree();
    } catch (err: any) {
      setError(`Rename failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setRenamingPath(null);
    }
  };

  // UPDATED: Now triggers our custom modal instead of window.confirm
  const handleDeleteClick = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFileToDelete(path); 
  };

  // NEW: The actual execution function called by our modal
  const executeDelete = async () => {
    if (!fileToDelete) return;
    
    try {
      await axios.post('/api/fs/delete', { path: fileToDelete });
      if (activePath === fileToDelete) onFileSelect(''); 
      await fetchTree();
    } catch (err: any) {
      setError(`Delete failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setFileToDelete(null);
    }
  };

  const startRename = (path: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingPath(path);
    setRenameValue(name);
  };

  const handleFolderClick = (path: string) => {
    setSelectedFolder(path);
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const onDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.setData('application/latex-path', path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPath !== folderPath) setDragOverPath(folderPath);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPath(null);
  };

  const onDrop = async (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    setDragOverPath(null);
    
    const oldPath = e.dataTransfer.getData('application/latex-path');
    if (!oldPath || oldPath === targetFolderPath) return;
    if (targetFolderPath.startsWith(oldPath + '/') || oldPath === targetFolderPath) return;

    const fileName = oldPath.split('/').pop();
    const newPath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;

    if (oldPath === newPath) return;

    try {
      await axios.post('/api/fs/rename', { oldPath, newPath });
      await fetchTree();
    } catch (err: any) {
      setError(`Move failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const isAuxFile = (name: string) => {
    return /\.(aux|out|fls|fdb_latexmk|synctex\.gz|toc|lof|lot|nav|snm|vrb|bcf|run\.xml)$/i.test(name);
  };

  const getFileIcon = (name: string, isActive: boolean) => {
    if (name.match(/\.(png|jpe?g|gif|svg)$/i)) {
      return <ImageIcon className={cn("w-4 h-4 shrink-0", isActive ? "text-zinc-800" : "text-emerald-500")} />;
    }
    if (name.endsWith('.pdf')) {
      return <FileText className={cn("w-4 h-4 shrink-0", isActive ? "text-zinc-800" : "text-red-500")} />;
    }
    if (name.endsWith('.log')) {
      return <Terminal className={cn("w-4 h-4 shrink-0", isActive ? "text-zinc-800" : "text-amber-500")} />;
    }
    if (name.endsWith('.tex')) {
      return <File className={cn("w-4 h-4 shrink-0", isActive ? "text-zinc-800" : "text-blue-500")} />;
    }
    return <File className={cn("w-4 h-4 shrink-0", isActive ? "text-zinc-800" : "text-zinc-400")} />;
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    if (node.type === 'file' && !showAuxFiles && isAuxFile(node.name)) {
      return null;
    }

    const isExpanded = expandedFolders.has(node.path);
    const isActive = activePath === node.path;
    const isSelectedFolder = selectedFolder === node.path;
    const isDragTarget = dragOverPath === node.path;
    const isRenaming = renamingPath === node.path;

    const ActionButtons = () => (
      <div className="hidden group-hover:flex items-center gap-1 ml-auto shrink-0">
        <button onClick={(e) => startRename(node.path, node.name, e)} className="p-1 text-zinc-400 hover:text-blue-600 rounded hover:bg-white" title="Rename">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => handleDeleteClick(node.path, e)} className="p-1 text-zinc-400 hover:text-red-600 rounded hover:bg-white" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );

    if (node.type === 'directory') {
      return (
        <div key={node.path} className="flex flex-col">
          <div
            draggable
            onDragStart={(e) => onDragStart(e, node.path)}
            onDragOver={(e) => onDragOver(e, node.path)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, node.path)}
            onClick={() => !isRenaming && handleFolderClick(node.path)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 transition-colors text-sm w-full text-left group cursor-pointer",
              isSelectedFolder ? "bg-zinc-200 text-zinc-900 font-medium" : "text-zinc-700 hover:bg-zinc-200",
              isDragTarget && "bg-emerald-100 ring-1 ring-emerald-400"
            )}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0 text-zinc-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-zinc-400" />}
            <Folder className={cn("w-4 h-4 shrink-0", isSelectedFolder ? "text-blue-500 fill-blue-500" : "text-zinc-400 fill-zinc-400")} />
            
            {isRenaming ? (
              <input 
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleRenameSubmit(node.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(node.path);
                  if (e.key === 'Escape') setRenamingPath(null);
                }}
                className="flex-1 min-w-0 px-1 py-0.5 text-sm bg-white border border-blue-400 rounded outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate flex-1">{node.name}</span>
            )}

            {!isRenaming && <ActionButtons />}
          </div>
          {isExpanded && node.children?.map(child => renderNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <div
        key={node.path}
        draggable
        onDragStart={(e) => onDragStart(e, node.path)}
        onClick={() => {
          if (isRenaming) return;
          onFileSelect(node.path);
          const lastSlash = node.path.lastIndexOf('/');
          setSelectedFolder(lastSlash !== -1 ? node.path.substring(0, lastSlash) : '');
        }}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 transition-colors text-sm w-full text-left group cursor-pointer",
          isActive ? "bg-zinc-300 text-zinc-900 font-medium border-l-2 border-zinc-900 pl-[calc(1.5rem-2px)]" : "text-zinc-600 hover:bg-zinc-200 pl-6"
        )}
        style={{ paddingLeft: `${depth * 12 + (isActive ? 26 : 28)}px` }}
      >
        {getFileIcon(node.name, isActive)}
        
        {isRenaming ? (
          <input 
            autoFocus
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => handleRenameSubmit(node.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit(node.path);
              if (e.key === 'Escape') setRenamingPath(null);
            }}
            className="flex-1 min-w-0 px-1 py-0.5 text-sm bg-white border border-blue-400 rounded outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex-1 flex items-center justify-between min-w-0 gap-1.5">
            <span className="truncate">{node.name}</span>
            {node.name.endsWith('.log') && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300 shrink-0">
                LOG
              </span>
            )}
          </div>
        )}

        {!isRenaming && <ActionButtons />}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-100 border-r border-zinc-300 relative">
      <div className="p-3 flex items-center justify-between border-b border-zinc-200 bg-zinc-50">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">File Outline</h2>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setCreating('file')} className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-600" title="New File"><Plus className="w-3.5 h-3.5" /></button>
          <button onClick={() => setCreating('folder')} className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-600" title="New Folder"><FolderPlus className="w-3.5 h-3.5" /></button>
          <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-600" title="Upload Image"><Upload className="w-3.5 h-3.5" /></button>
          <button 
            onClick={() => setShowAuxFiles(prev => !prev)} 
            className={cn("p-1 rounded transition-colors", showAuxFiles ? "text-blue-600 bg-blue-100/50 hover:bg-blue-100" : "text-zinc-400 hover:bg-zinc-200")} 
            title={showAuxFiles ? "Showing aux files (.aux, .out). Click to hide" : "Hiding aux files. Click to show"}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
          <div className="w-[1px] h-3 bg-zinc-300 mx-1"></div>
          <button onClick={() => { fetchTree(); setSelectedFolder(''); }} className="p-1 hover:bg-zinc-200 rounded text-zinc-400" title="Refresh & Reset Target"><RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /></button>
          {onCollapse && (
            <button 
              onClick={onCollapse} 
              className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-zinc-700 ml-0.5 transition-colors cursor-pointer" 
              title="Slide / Collapse File Section (<)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*,.pdf" />
      
      {creating && (
        <div className="p-2 bg-zinc-200 border-b border-zinc-300 flex flex-col gap-2">
          <div className="text-[10px] text-zinc-500 font-mono">Target: /{selectedFolder}</div>
          <div className="flex items-center gap-2">
            <input 
              autoFocus
              type="text" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleInlineCreate()}
              placeholder={`New ${creating} name...`}
              className="flex-1 text-sm px-2 py-1 rounded border border-zinc-400 focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleInlineCreate} className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Add</button>
            <button onClick={() => { setCreating(null); setNewName(''); }} className="text-xs bg-zinc-300 text-zinc-700 px-2 py-1 rounded hover:bg-zinc-400">Cancel</button>
          </div>
        </div>
      )}

      {/* ERROR BANNER */}
      {error && (
        <div className="p-2 m-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded flex items-start gap-2">
           <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
           <div className="flex-1">{error}</div>
           <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* CUSTOM DELETE MODAL OVERLAY */}
      {fileToDelete && (
        <div className="absolute inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-[250px] flex flex-col gap-3 animate-in fade-in zoom-in duration-200">
            <h3 className="font-semibold text-zinc-900 text-sm">Delete Item</h3>
            <p className="text-xs text-zinc-600 break-all">
              Are you sure you want to delete <strong className="text-zinc-900">{fileToDelete}</strong>?
            </p>
            <div className="flex justify-end gap-2 mt-2">
              <button 
                onClick={() => setFileToDelete(null)} 
                className="px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete} 
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className={cn("flex-1 overflow-y-auto py-2", dragOverPath === '' && "bg-emerald-50")}
        onDragOver={(e) => onDragOver(e, '')}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, '')}
      >
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  );
}