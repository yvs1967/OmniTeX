import React from 'react';
import { ImageIcon } from 'lucide-react';

interface ImageViewerProps {
  filePath: string;
}

export default function ImageViewer({ filePath }: ImageViewerProps) {
  const assetUrl = `/api/fs/asset?path=${encodeURIComponent(filePath)}`;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-200 overflow-hidden">
      <div className="h-10 bg-zinc-50 border-b border-zinc-300 flex items-center px-4 shrink-0 shadow-sm">
        <span className="text-xs font-medium text-zinc-500 truncate">{filePath}</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        <div className="relative shadow-2xl bg-white p-2 rounded-sm border border-zinc-400">
          <img 
            src={assetUrl} 
            alt="Preview" 
            className="max-w-full max-h-[calc(100vh-160px)] object-contain"
          />
        </div>
      </div>
    </div>
  );
}
