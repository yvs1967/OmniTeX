import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, Loader2, AlertCircle, Terminal, FileText, ChevronUp, ZoomIn, ZoomOut, RotateCcw, Download, FolderOpen, Check, Crosshair, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Document, Page, pdfjs } from 'react-pdf';

// Required styles for react-pdf
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up the worker for PDF.js parsing
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  activeFilePath: string | null;
  onCompileSuccess?: () => void;
  onNavigateToSource?: (text: string, word?: string) => void;
  onCollapse?: () => void;
}

export default function PdfViewer({ activeFilePath, onCompileSuccess, onNavigateToSource, onCollapse }: PdfViewerProps) {
  const [compiling, setCompiling] = useState(false);
  const [engine, setEngine] = useState('pdflatex');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [zoom, setZoom] = useState<number>(1);
  const [numPages, setNumPages] = useState<number | null>(null);

  // SyncTeX / Reverse search state
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [selectedTextForSync, setSelectedTextForSync] = useState<string | null>(null);
  const [selectedWordForSync, setSelectedWordForSync] = useState<string | null>(null);
  const [syncButtonPos, setSyncButtonPos] = useState<{ x: number; y: number } | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(800);

  // ResizeObserver to detect when the toolbar is narrow and switch to icons-only
  useEffect(() => {
    if (!toolbarRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setToolbarWidth(entry.contentRect.width);
      }
    });
    ro.observe(toolbarRef.current);
    return () => ro.disconnect();
  }, []);

  const isCompact = toolbarWidth < 620;
  const isUltraCompact = toolbarWidth < 450;

  // State for Save PDF modal & options
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFilename, setSaveFilename] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => setZoom(1);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const triggerSyncFeedback = (msg: string) => {
    setSyncFeedback(msg);
    setTimeout(() => {
      setSyncFeedback(null);
    }, 2400);
  };

  const handleJumpToSource = (textToSync?: string, wordToSync?: string) => {
    const text = (textToSync || selectedTextForSync || '').trim();
    if (!text) return;
    const word = wordToSync || selectedWordForSync || text.split(/\s+/)[0];
    onNavigateToSource?.(text, word);
    triggerSyncFeedback(`Mapped to: "${word} |"`);
    setSelectedTextForSync(null);
    setSelectedWordForSync(null);
    setSyncButtonPos(null);
  };

  // Accurately extracts the clicked word and sentence from point or target
  const extractClickedInfo = (e: React.MouseEvent) => {
    // 1. Check if user made a drag selection
    const selection = window.getSelection();
    const selText = selection ? selection.toString().trim() : '';
    if (selText.length > 0) {
      const words = selText.split(/\s+/).filter(Boolean);
      return {
        word: words[0] || selText,
        phrase: selText
      };
    }

    // 2. Exact word under click using caretRangeFromPoint / caretPositionFromPoint
    let textNode: Node | null = null;
    let offset = 0;

    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        textNode = range.startContainer;
        offset = range.startOffset;
      }
    } else if ((document as any).caretPositionFromPoint) {
      const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
      if (pos && pos.offsetNode) {
        textNode = pos.offsetNode;
        offset = pos.offset;
      }
    }

    // If textNode was an Element, find its first text child
    if (textNode && textNode.nodeType === Node.ELEMENT_NODE) {
      const el = textNode as HTMLElement;
      const span = el.closest('span');
      if (span) {
        for (let i = 0; i < span.childNodes.length; i++) {
          if (span.childNodes[i].nodeType === Node.TEXT_NODE) {
            textNode = span.childNodes[i];
            break;
          }
        }
      }
    }

    // Fallback to event target if textNode wasn't found
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      const target = e.target as HTMLElement;
      const span = target.closest('.textLayer span, [class*="textLayer"] span, span');
      if (span) {
        for (let i = 0; i < span.childNodes.length; i++) {
          if (span.childNodes[i].nodeType === Node.TEXT_NODE) {
            textNode = span.childNodes[i];
            offset = 0;
            break;
          }
        }
        if (!textNode && span.textContent) {
          const text = span.textContent.trim();
          const words = text.split(/\s+/).filter(Boolean);
          return {
            word: words[0] || text,
            phrase: text
          };
        }
      }
    }

    if (textNode && textNode.textContent) {
      const fullText = textNode.textContent;
      const len = fullText.length;
      if (len > 0) {
        let safeOffset = Math.min(Math.max(offset, 0), len);
        if (safeOffset < len && /\s/.test(fullText[safeOffset]) && safeOffset > 0 && !/\s/.test(fullText[safeOffset - 1])) {
          safeOffset--;
        }

        // Find boundaries of clicked word
        let start = safeOffset;
        while (start > 0 && /[^\s\.,;:!?()\[\]{}"'`~\\/]/.test(fullText[start - 1])) {
          start--;
        }
        let end = safeOffset;
        while (end < len && /[^\s\.,;:!?()\[\]{}"'`~\\/]/.test(fullText[end])) {
          end++;
        }

        const clickedWord = fullText.slice(start, end).trim();
        if (clickedWord.length > 0) {
          return {
            word: clickedWord,
            phrase: fullText.trim()
          };
        }

        const words = fullText.trim().split(/\s+/).filter(Boolean);
        if (words.length > 0) {
          return {
            word: words[0],
            phrase: fullText.trim()
          };
        }
      }
    }

    return null;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!syncEnabled || !onNavigateToSource) return;
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    if (text.length > 0) {
      const words = text.split(/\s+/).filter(Boolean);
      setSelectedTextForSync(text);
      setSelectedWordForSync(words[0] || text);
      if (contentAreaRef.current) {
        const rect = contentAreaRef.current.getBoundingClientRect();
        setSyncButtonPos({
          x: Math.min(Math.max(e.clientX - rect.left - 60, 20), rect.width - 200),
          y: Math.max(e.clientY - rect.top - 46, 12)
        });
      }
    } else {
      setTimeout(() => {
        setSelectedTextForSync(null);
        setSelectedWordForSync(null);
        setSyncButtonPos(null);
      }, 250);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!syncEnabled || !onNavigateToSource) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, .modal')) return;

    const info = extractClickedInfo(e);
    if (info && (info.word || info.phrase)) {
      onNavigateToSource(info.phrase, info.word);
      triggerSyncFeedback(`Mapped to: "${info.word || info.phrase} |"`);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!syncEnabled || !onNavigateToSource) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, .modal')) return;

    // Check if clicked inside PDF page canvas or text layer
    const pageEl = target.closest('.react-pdf__Page, .textLayer, .react-pdf__Document');
    if (!pageEl) return;

    const info = extractClickedInfo(e);
    if (info && (info.word || info.phrase)) {
      onNavigateToSource(info.phrase, info.word);
      triggerSyncFeedback(`Mapped to: "${info.word || info.phrase} |"`);
    }
  };

  const openSaveModal = () => {
    if (!pdfUrl) return;
    const defaultName = activeFilePath 
      ? activeFilePath.split('/').pop()?.replace(/\.tex$/i, '.pdf') || 'document.pdf' 
      : 'document.pdf';
    setSaveFilename(defaultName);
    setSaveSuccessMsg(null);
    setShowSaveModal(true);
  };

  const triggerDirectDownload = async (filename?: string) => {
    if (!pdfUrl) return;
    let cleanName = (filename || saveFilename).trim();
    if (!cleanName.toLowerCase().endsWith('.pdf')) cleanName += '.pdf';
    
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);

      setSaveSuccessMsg(`Saved as ${cleanName}`);
      setTimeout(() => {
        setShowSaveModal(false);
        setSaveSuccessMsg(null);
      }, 1200);
    } catch (e: any) {
      console.error('Download error:', e);
    }
  };

  const handleSaveNativePicker = async () => {
    if (!pdfUrl) return;
    setIsSaving(true);
    let cleanName = saveFilename.trim();
    if (!cleanName.toLowerCase().endsWith('.pdf')) cleanName += '.pdf';

    try {
      if ('showSaveFilePicker' in window) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: cleanName,
            types: [{
              description: 'PDF Document',
              accept: { 'application/pdf': ['.pdf'] }
            }]
          });
          const writable = await fileHandle.createWritable();
          const response = await fetch(pdfUrl);
          const blob = await response.blob();
          await writable.write(blob);
          await writable.close();

          setSaveSuccessMsg(`Saved successfully to chosen location!`);
          setTimeout(() => {
            setShowSaveModal(false);
            setSaveSuccessMsg(null);
          }, 1200);
          return;
        } catch (pickerErr: any) {
          if (pickerErr.name === 'AbortError') {
            setIsSaving(false);
            return;
          }
        }
      }
      // Fallback: direct download
      triggerDirectDownload(cleanName);
    } catch (err: any) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompile = async () => {
    if (!activeFilePath) return;

    setCompiling(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/compiler/compile', {
        path: activeFilePath,
        compilerEngine: engine
      });

      const { success, pdfPath, logs: compileLogs } = response.data;
      setLogs(compileLogs);

      if (success && pdfPath) {
        // Append timestamp to bypass browser cache
        const timestamp = new Date().getTime();
        setPdfUrl(`/api/compiler/pdf?path=${encodeURIComponent(pdfPath)}&t=${timestamp}`);
        setShowLogs(false);
        onCompileSuccess?.();
      } else {
        setError('Compilation Failed');
        setShowLogs(true);
        onCompileSuccess?.();
      }
    } catch (err: any) {
      console.error('Compilation error:', err);
      setError('An unexpected error occurred during compilation.');
      setLogs(err.response?.data?.logs || err.message);
      setShowLogs(true);
      onCompileSuccess?.();
    } finally {
      setCompiling(false);
    }
  };

  // Check if PDF and logs already exist when active file changes
  useEffect(() => {
    setError(null);
    setShowLogs(false);
    setZoom(1);
    setNumPages(null);

    if (activeFilePath && activeFilePath.endsWith('.tex')) {
      axios.get(`/api/compiler/status?path=${encodeURIComponent(activeFilePath)}`)
        .then(res => {
          if (res.data.pdfExists && res.data.pdfPath) {
            const timestamp = new Date().getTime();
            setPdfUrl(`/api/compiler/pdf?path=${encodeURIComponent(res.data.pdfPath)}&t=${timestamp}`);
          } else {
            setPdfUrl(null);
          }
          if (res.data.logs) {
            setLogs(res.data.logs);
          }
        })
        .catch(() => {
          setPdfUrl(null);
        });
    } else {
      setPdfUrl(null);
      setLogs(null);
    }
  }, [activeFilePath]);

  return (
    <div className="flex flex-col h-full bg-zinc-600 overflow-hidden relative">
      {/* Tool Bar */}
      <div 
        ref={toolbarRef}
        className="h-10 bg-zinc-800 border-b border-black flex items-center justify-between px-3 shrink-0 z-10 gap-1.5"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Recompile Button */}
          <button
            onClick={handleCompile}
            disabled={compiling || !activeFilePath}
            title={compiling ? "Compiling..." : "Recompile document"}
            className={cn(
              "flex items-center gap-1.5 py-1 text-xs text-white rounded font-bold transition-all shadow-sm shrink-0",
              isCompact ? "px-2.5" : "px-3.5",
              compiling || !activeFilePath 
                ? "bg-zinc-700 text-zinc-500 cursor-not-allowed" 
                : "bg-green-600 hover:bg-green-700 active:scale-95 cursor-pointer"
            )}
          >
            {compiling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className={cn(isCompact ? "hidden" : "inline")}>Recompile</span>
          </button>

          {/* Option to Save the PDF on the right side of the recompile button */}
          <button
            onClick={openSaveModal}
            disabled={!pdfUrl || compiling}
            title={pdfUrl ? "Save PDF to Workspace or Download" : "Compile document first to generate and save PDF"}
            className={cn(
              "flex items-center gap-1.5 py-1 text-xs font-bold rounded transition-all shadow-sm border shrink-0",
              isCompact ? "px-2" : "px-2.5",
              pdfUrl && !compiling
                ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-100 hover:text-white border-zinc-500 hover:border-zinc-400 active:scale-95 cursor-pointer"
                : "bg-zinc-800 text-zinc-500 border-zinc-700/60 cursor-not-allowed"
            )}
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className={cn(isCompact ? "hidden" : "inline")}>Save PDF</span>
          </button>

          {!isUltraCompact && (
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="bg-zinc-700 text-white text-[10px] font-bold px-2 py-1 rounded border border-zinc-600 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer hover:bg-zinc-600 transition-colors shrink-0"
              title="LaTeX Compiler Engine"
            >
              <option value="pdflatex">pdfLaTeX</option>
              <option value="lualatex">LuaLaTeX</option>
              <option value="xelatex">XeLaTeX</option>
            </select>
          )}
          
          <div className="flex items-center gap-0.5 bg-black/30 rounded p-0.5 shrink-0">
            <button 
              onClick={() => setShowLogs(false)}
              className={cn(
                "px-2.5 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer",
                !showLogs ? "bg-zinc-100 text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              PDF
            </button>
            <button 
              onClick={() => setShowLogs(true)}
              className={cn(
                "px-2.5 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer",
                showLogs ? "bg-zinc-100 text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Logs
            </button>
          </div>

          {/* SyncTeX Quick Toggle */}
          <button
            onClick={() => setSyncEnabled(prev => !prev)}
            className={cn(
              "flex items-center gap-1 py-1 text-[10px] font-bold rounded border transition-colors cursor-pointer shrink-0",
              isCompact ? "px-2" : "px-2.5",
              syncEnabled 
                ? "bg-blue-600/30 text-blue-300 border-blue-500/50 hover:bg-blue-600/40" 
                : "bg-zinc-700/60 text-zinc-400 border-zinc-600 hover:text-zinc-200"
            )}
            title="SyncTeX: Click any word in the PDF to place blinking cursor at that exact spot in LaTeX"
          >
            <Crosshair className="w-3 h-3 text-blue-400" />
            <span className={cn(isCompact ? "hidden" : "inline")}>SyncTeX {syncEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {error && (
            <div className="flex items-center gap-1 text-red-400 text-[10px] font-bold uppercase tracking-wider" title={error}>
              <AlertCircle className="w-3.5 h-3.5" />
              <span className={cn(isCompact ? "hidden" : "inline")}>Build Error</span>
            </div>
          )}

          {pdfUrl && !showLogs && (
            <div className="flex items-center gap-1 bg-black/30 p-1 rounded-md border border-zinc-700">
              <button onClick={handleZoomOut} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Zoom Out">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              {!isUltraCompact && (
                <span className="text-[10px] text-zinc-300 font-bold w-9 text-center">
                  {Math.round(zoom * 100)}%
                </span>
              )}
              <button onClick={handleZoomIn} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Zoom In">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3 bg-zinc-600 mx-0.5"></div>
              <button onClick={handleReset} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Reset Zoom">
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Slide/Collapse PDF Section Button */}
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors ml-1 cursor-pointer"
              title="Slide / Collapse PDF Section (>)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div 
        ref={contentAreaRef}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
        className="flex-1 relative overflow-hidden flex flex-col bg-zinc-600 select-text"
      >
        {/* SyncTeX Feedback Toast */}
        {syncFeedback && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-blue-950/90 border border-blue-500 text-blue-100 text-xs font-medium px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none">
            <Crosshair className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Floating Quick Action: Map to TeX Script */}
        {selectedTextForSync && syncButtonPos && (
          <div
            style={{ left: `${syncButtonPos.x}px`, top: `${syncButtonPos.y}px` }}
            className="absolute z-40 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleJumpToSource();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl text-xs font-bold ring-2 ring-white/30 transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
              title="Position cursor and edit corresponding LaTeX code"
            >
              <Crosshair className="w-3.5 h-3.5 text-blue-200 animate-pulse" />
              <span>Map to TeX Script</span>
            </button>
          </div>
        )}
        {!activeFilePath ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-4">
             <FileText className="w-12 h-12 opacity-10" />
             <p className="font-serif text-lg italic tracking-wide">Select a file to preview</p>
          </div>
        ) : !pdfUrl && !compiling && !showLogs ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-4">
             <Play className="w-16 h-16 opacity-10" />
             <button 
               onClick={handleCompile}
               className="text-sm font-medium hover:text-white transition-colors underline underline-offset-4"
             >
               Click Recompile to generate PDF
             </button>
          </div>
        ) : null}

        {/* PDF Document View using react-pdf */}
        {pdfUrl && !showLogs && (
          <div className="w-full h-full overflow-auto flex flex-col items-center p-8 bg-zinc-600 scrollbar-thin scrollbar-thumb-zinc-700">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center gap-2 text-zinc-300 py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                  <span className="text-[10px] uppercase tracking-widest font-bold">Loading PDF...</span>
                </div>
              }
              error={
                <div className="flex flex-col items-center gap-2 text-red-400 py-10">
                  <AlertCircle className="w-6 h-6" />
                  <span className="text-xs font-bold">Failed to load PDF. Check compilation logs.</span>
                </div>
              }
            >
              {Array.from(new Array(numPages || 0), (el, index) => (
                <div key={`page_${index + 1}`} className="mb-6 shadow-2xl ring-1 ring-black/20 bg-white">
                  <Page 
                    pageNumber={index + 1} 
                    scale={zoom} 
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </div>
              ))}
            </Document>
          </div>
        )}

        {/* Logs View */}
        {showLogs && (
          <div className="w-full h-full bg-zinc-900 text-zinc-300 font-mono text-xs overflow-auto p-4 selection:bg-green-500/30">
            <div className="flex items-center gap-2 mb-4 text-zinc-500 border-b border-zinc-800 pb-2">
              <Terminal className="w-3.5 h-3.5" />
              <span className="uppercase tracking-widest text-[10px] font-bold">Compilation Output</span>
            </div>
            <pre className="whitespace-pre-wrap leading-relaxed">
              {logs || 'No logs available.'}
            </pre>
          </div>
        )}

        {/* Compiling Overlay */}
        {compiling && (
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[1px] flex flex-col items-center justify-center z-20 text-white gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-green-500" />
            <p className="text-sm font-bold uppercase tracking-[0.2em] animate-pulse">Compiling...</p>
          </div>
        )}
      </div>

      {/* Log Toggle Footer */}
      {logs && !showLogs && (
        <button 
          onClick={() => setShowLogs(true)}
          className="h-6 bg-zinc-800/80 hover:bg-zinc-800 border-t border-black/50 flex items-center justify-center gap-2 text-[10px] font-bold text-zinc-400 hover:text-white transition-all uppercase tracking-wider shrink-0"
        >
          {error ? <AlertCircle className="w-3 h-3 text-red-500" /> : <ChevronUp className="w-3 h-3" />}
          Show Compilation Logs
        </button>
      )}

      {/* Save PDF Modal Overlay */}
      {showSaveModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-800 border border-zinc-700 text-white rounded-lg shadow-2xl p-5 w-full max-w-md flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm">Save PDF Document</h3>
              </div>
              <button 
                onClick={() => setShowSaveModal(false)} 
                className="text-zinc-400 hover:text-white text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-zinc-300 font-medium">Choose file name:</label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={saveFilename}
                  onChange={(e) => setSaveFilename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNativePicker();
                    if (e.key === 'Escape') setShowSaveModal(false);
                  }}
                  placeholder="document.pdf"
                  className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  autoFocus
                />
              </div>
              <span className="text-[11px] text-zinc-400">
                You can save directly or choose a specific directory on your computer.
              </span>
            </div>

            {saveSuccessMsg && (
              <div className="p-2.5 bg-green-900/40 border border-green-600 text-green-300 rounded text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-green-400" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-700">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => triggerDirectDownload()}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 hover:text-white rounded border border-zinc-600 transition-colors flex items-center gap-1.5"
                title="Direct browser download"
              >
                <Download className="w-3.5 h-3.5" />
                Quick Download
              </button>
              <button
                onClick={handleSaveNativePicker}
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors flex items-center gap-1.5 shadow-sm"
                title="Choose folder location & save"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                Choose Location & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
