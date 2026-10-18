import React, { useCallback, useRef, useState } from 'react';
import { SparklesIcon } from './icons';

interface FileUploadProps {
  onFileUpload: (content: string, file: File) => void;
  onLoadSampleDeck?: (sampleType: 'animPakal' | 'slivers') => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, onLoadSampleDeck, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onFileUpload(text, file);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    }
  }, [onFileUpload]);

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) return;
    const virtualFile = new File([pastedText], 'pasted-deck.txt', { type: 'text/plain' });
    onFileUpload(pastedText, virtualFile);
    setShowPasteBox(false);
  };

  return (
    <div className="space-y-3 bg-zinc-900/50 p-3.5 rounded-lg border border-zinc-800/80 shadow-inner">
      <div className="flex items-center justify-between">
        <label htmlFor="decklist-upload" className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          Deck Source
        </label>
        <button
          type="button"
          onClick={() => setShowPasteBox(prev => !prev)}
          disabled={disabled}
          className="text-[11px] font-medium text-amber-400/90 hover:text-amber-300 transition-colors"
        >
          {showPasteBox ? '← Upload File' : 'Paste Text List'}
        </button>
      </div>

      {showPasteBox ? (
        <div className="space-y-2">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={"Commander\n1 Anim Pakal, Thousandth Moon\n\nDeck\n1 Sol Ring\n1 Arcane Signet..."}
            rows={5}
            disabled={disabled}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 font-mono custom-scrollbar"
          />
          <button
            type="button"
            onClick={handlePasteSubmit}
            disabled={disabled || !pastedText.trim()}
            className="w-full py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-semibold rounded-md text-xs transition-all disabled:opacity-40"
          >
            Load Pasted Deck
          </button>
        </div>
      ) : (
        <div>
          <input
            id="decklist-upload"
            type="file"
            accept=".txt,.csv"
            onChange={handleFileChange}
            ref={fileInputRef}
            disabled={disabled}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-700/80 hover:border-zinc-600 rounded-md text-xs font-medium text-zinc-200 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-amber-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Import Deck File (.txt / .csv)</span>
          </button>
        </div>
      )}

      {onLoadSampleDeck && (
        <div className="pt-2.5 border-t border-zinc-800/70 space-y-1.5">
          <span className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500">
            Sample Presets
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onLoadSampleDeck('animPakal')}
              disabled={disabled}
              className="py-1.5 px-2.5 bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/30 rounded text-[11px] font-medium text-zinc-300 hover:text-amber-200 transition-all flex items-center justify-center gap-1.5 truncate disabled:opacity-50"
              title="Load Boros Anim Pakal Commander Deck"
            >
              <SparklesIcon className="w-3 h-3 text-amber-400/80 shrink-0" />
              <span>Anim Pakal</span>
            </button>
            <button
              type="button"
              onClick={() => onLoadSampleDeck('slivers')}
              disabled={disabled}
              className="py-1.5 px-2.5 bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/30 rounded text-[11px] font-medium text-zinc-300 hover:text-amber-200 transition-all flex items-center justify-center gap-1.5 truncate disabled:opacity-50"
              title="Load 5-Color Sliver Overlord Commander Deck"
            >
              <SparklesIcon className="w-3 h-3 text-amber-400/80 shrink-0" />
              <span>Slivers 5C</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
