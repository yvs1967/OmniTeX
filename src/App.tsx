/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import FileTree from './components/sidebar/FileTree';
import GitHistory from './components/history/GitHistory';
import LatexEditor, { NavigationTarget } from './components/editor/LatexEditor';
import ImageViewer from './components/editor/ImageViewer';
import AssetPdfViewer from './components/editor/AssetPdfViewer';
import PdfViewer from './components/preview/PdfViewer';
import GitControls from './components/GitControls';
import { 
  Clock, 
  Send, 
  Play, 
  Terminal, 
  HelpCircle, 
  User, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle as AlertIcon,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from './lib/utils';
import axios from 'axios';

export default function App() {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'history'>('files');
  const [treeRefreshTrigger, setTreeRefreshTrigger] = useState(0);
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget | null>(null);

  // Sliding & collapsible panel states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPdfOpen, setIsPdfOpen] = useState(true);

  const isFocusMode = !isSidebarOpen && !isPdfOpen;

  const toggleFocusMode = () => {
    if (isFocusMode) {
      setIsSidebarOpen(true);
      setIsPdfOpen(true);
    } else {
      setIsSidebarOpen(false);
      setIsPdfOpen(false);
    }
  };

  const handleNavigateToSource = (text: string, word?: string) => {
    setNavigationTarget({
      text,
      word,
      timestamp: Date.now()
    });
  };

  const getEditorContent = () => {
    if (!activeFilePath) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 text-zinc-400">
          <FileText className="w-12 h-12 opacity-10 mb-4" />
          <p className="text-sm">Select a file to begin editing</p>
        </div>
      );
    }

    const ext = activeFilePath.split('.').pop()?.toLowerCase();

    if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext || '')) {
      return <ImageViewer filePath={activeFilePath} />;
    }

    if (ext === 'pdf') {
       return <AssetPdfViewer filePath={activeFilePath} />;
    }

    return (
      <LatexEditor 
        filePath={activeFilePath} 
        navigationTarget={navigationTarget}
      />
    );
  };

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-50 overflow-hidden font-sans text-zinc-900">
      {/* Top Header */}
      <header className="h-12 bg-zinc-900 flex items-center justify-between px-3 sm:px-4 border-b border-black text-white shrink-0 z-20">
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2">
            <img src="src\omni_tex.png" alt="Logo" className="w-6 h-6 object-contain" />
            <span className="font-semibold tracking-tight text-sm">OmniTeX</span>
          </div>
        </div>
        
        {/* Center Panel Controls */}
        <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2 py-1 rounded-md border border-zinc-700/60">
          {/* Toggle Sidebar */}
          <button
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer",
              isSidebarOpen ? "text-zinc-200 hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-200"
            )}
            title={isSidebarOpen ? "Hide File Section (<)" : "Show File Section (>)"}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5 text-green-400" />}
            <span className="hidden md:inline">{isSidebarOpen ? "Hide Files" : "Files"}</span>
          </button>

          <div className="h-3 w-px bg-zinc-700"></div>

          {/* Focus Mode */}
          <button
            onClick={toggleFocusMode}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer font-medium",
              isFocusMode 
                ? "bg-blue-600 text-white shadow-sm" 
                : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
            )}
            title={isFocusMode ? "Exit Focus Mode (Show Files & PDF)" : "Focus Mode (Concentrate on TeX Editor)"}
          >
            {isFocusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">{isFocusMode ? "Exit Focus" : "Focus Mode"}</span>
          </button>

          <div className="h-3 w-px bg-zinc-700"></div>

          {/* Toggle PDF Viewer */}
          <button
            onClick={() => setIsPdfOpen(prev => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer",
              isPdfOpen ? "text-zinc-200 hover:bg-zinc-700" : "text-zinc-400 hover:text-zinc-200"
            )}
            title={isPdfOpen ? "Hide PDF Section (>)" : "Show PDF Section (<)"}
          >
            {isPdfOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5 text-blue-400" />}
            <span className="hidden md:inline">{isPdfOpen ? "Hide PDF" : "PDF"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => {
              if (!isSidebarOpen) setIsSidebarOpen(true);
              setSidebarTab(sidebarTab === 'files' ? 'history' : 'files');
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer",
              sidebarTab === 'history' ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            )}
            title="Toggle Git Version History"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{sidebarTab === 'history' ? 'Files' : 'History'}</span>
          </button>
          
          <div className="h-6 w-px bg-zinc-700 mx-0.5"></div>
          
          <GitControls />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 relative flex overflow-hidden">
        {/* Left Vertical Collapsed Navbar Strip when Files panel is closed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="w-7 h-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-r border-black flex flex-col items-center py-4 gap-3 transition-colors shrink-0 z-10 cursor-pointer group shadow-md"
            title="Slide Out File Section (>)"
          >
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform text-green-400" />
            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] tracking-widest uppercase font-bold text-zinc-400 group-hover:text-zinc-200 select-none">
              Files
            </span>
          </button>
        )}

        <div className="flex-1 min-w-0 h-full relative">
          <PanelGroup direction="horizontal">
            {/* Sidebar (File Tree or Git History) */}
            {isSidebarOpen && (
              <>
                <Panel defaultSize={20} minSize={14} maxSize={40}>
                  {sidebarTab === 'files' ? (
                    <FileTree 
                      activePath={activeFilePath} 
                      onFileSelect={setActiveFilePath} 
                      refreshTrigger={treeRefreshTrigger}
                      onCollapse={() => setIsSidebarOpen(false)}
                    />
                  ) : (
                    <GitHistory onCollapse={() => setIsSidebarOpen(false)} />
                  )}
                </Panel>
                <PanelResizeHandle className="w-1 bg-zinc-200 hover:bg-green-500 transition-colors" />
              </>
            )}

            {/* Editor / Viewer (Concentrate on writing the TeX file) */}
            <Panel minSize={25}>
              {getEditorContent()}
            </Panel>

            {/* PDF Preview Section */}
            {isPdfOpen && (
              <>
                <PanelResizeHandle className="w-1 bg-zinc-200 hover:bg-green-500 transition-colors" />
                <Panel defaultSize={40} minSize={20} maxSize={70}>
                  <PdfViewer 
                    activeFilePath={activeFilePath} 
                    onCompileSuccess={() => setTreeRefreshTrigger(prev => prev + 1)}
                    onNavigateToSource={handleNavigateToSource}
                    onCollapse={() => setIsPdfOpen(false)}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>

        {/* Right Vertical Collapsed Navbar Strip when PDF panel is closed */}
        {!isPdfOpen && (
          <button
            onClick={() => setIsPdfOpen(true)}
            className="w-7 h-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-l border-black flex flex-col items-center py-4 gap-3 transition-colors shrink-0 z-10 cursor-pointer group shadow-md"
            title="Slide Out PDF Preview (<)"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-blue-400" />
            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] tracking-widest uppercase font-bold text-zinc-400 group-hover:text-zinc-200 select-none">
              PDF Preview
            </span>
          </button>
        )}
      </main>

      {/* Footer */}
      <footer className="h-7 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between px-3 text-[10px] text-zinc-500 shrink-0 z-20">

        {/* Contributors Attribution */}
        <div className="flex items-center gap-1 text-zinc-600 font-medium text-[10px] truncate mx-2">
          <span>Designed & Built by</span>
          <a 
            href="https://yvs1967.github.io" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-zinc-900 font-semibold hover:underline"
          >
            Venkata Subbaiah
          </a>
          <span className="text-zinc-400 hidden sm:inline">(Using AI Studio)</span>
        </div>

        <div className="flex items-center gap-3 font-medium uppercase tracking-tight">
          <span className="flex items-center gap-1 hover:text-zinc-900 cursor-pointer transition-colors">
            <HelpCircle className="w-3 h-3" />
            Help
          </span>
          <span className="text-zinc-200">|</span>
          <span>Ln 1, Col 1</span>
          <span>Spaces: 2</span>
          <User className="w-3 h-3 text-zinc-400" />
        </div>
      </footer>
    </div>
  );
}
