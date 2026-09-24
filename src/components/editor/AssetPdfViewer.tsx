import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, AlertCircle, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

// Import mandatory styles for react-pdf
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure pdf.js worker using unpkg CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface AssetPdfViewerProps {
  filePath: string;
}

export default function AssetPdfViewer({ filePath }: AssetPdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const assetUrl = `/api/fs/asset?path=${encodeURIComponent(filePath)}`;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-700 overflow-hidden">
      <div className="h-10 bg-zinc-50 border-b border-zinc-300 flex items-center px-4 shrink-0 shadow-sm z-10">
        <span className="text-xs font-medium text-zinc-500 truncate font-mono tracking-tight">{filePath}</span>
      </div>
      
      <div className="flex-1 overflow-auto p-8 flex flex-col items-center bg-zinc-600 shadow-inner scrollbar-thin scrollbar-thumb-zinc-800">
        <Document
          file={assetUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center gap-4 text-zinc-300 py-20">
              <Loader2 className="w-8 h-8 animate-spin text-green-500" />
              <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Loading Asset PDF...</p>
            </div>
          }
          error={
            <div className="flex flex-col items-center gap-4 text-red-300 py-20">
              <AlertCircle className="w-12 h-12" />
              <p className="text-sm font-bold uppercase tracking-tight">Failed to load PDF asset</p>
            </div>
          }
        >
          {Array.from(new Array(numPages || 0), (el, index) => (
            <div key={`asset_page_${index + 1}`} className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-8 bg-white">
              <Page 
                pageNumber={index + 1} 
                scale={1.2}
                renderAnnotationLayer={true}
                renderTextLayer={true}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}
