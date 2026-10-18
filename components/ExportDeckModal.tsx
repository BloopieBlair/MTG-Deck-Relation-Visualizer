import React, { useState, useMemo } from 'react';
import type { ProcessedDeckCard } from '../types';
import { XMarkIcon, DocumentIcon } from './icons';

interface ExportDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: ProcessedDeckCard[];
  commanderId: string | null;
}

export const ExportDeckModal: React.FC<ExportDeckModalProps> = ({
  isOpen,
  onClose,
  deck,
  commanderId
}) => {
  const [format, setFormat] = useState<'arena' | 'moxfield' | 'plain'>('arena');
  const [copied, setCopied] = useState(false);

  const commanderCard = useMemo(() => {
    return deck.find(c => c.id === commanderId) || null;
  }, [deck, commanderId]);

  const nonCommanderCards = useMemo(() => {
    return deck.filter(c => c.id !== commanderId);
  }, [deck, commanderId]);

  const exportText = useMemo(() => {
    if (deck.length === 0) return '';

    if (format === 'arena') {
      const lines: string[] = [];
      if (commanderCard) {
        lines.push('Commander');
        lines.push(`1 ${commanderCard.name}`);
        lines.push('');
        lines.push('Deck');
      } else {
        lines.push('Deck');
      }

      nonCommanderCards.forEach(c => {
        lines.push(`${c.quantity || 1} ${c.name}`);
      });

      return lines.join('\n');
    }

    if (format === 'moxfield') {
      const lines: string[] = [];
      if (commanderCard) {
        lines.push(`1 ${commanderCard.name} *CMDR*`);
      }
      nonCommanderCards.forEach(c => {
        lines.push(`${c.quantity || 1} ${c.name}`);
      });
      return lines.join('\n');
    }

    // Plain text format
    const lines: string[] = [];
    if (commanderCard) {
      lines.push(`1 ${commanderCard.name}`);
    }
    nonCommanderCards.forEach(c => {
      lines.push(`${c.quantity || 1} ${c.name}`);
    });
    return lines.join('\n');
  }, [deck, commanderCard, nonCommanderCards, format]);

  const totalCardsCount = useMemo(() => {
    return deck.reduce((sum, c) => sum + (c.quantity || 1), 0);
  }, [deck]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy to clipboard', e);
    }
  };

  const handleDownload = () => {
    const filename = commanderCard ? `${commanderCard.name.replace(/[^a-zA-Z0-9]/g, '_')}_deck.txt` : 'decklist.txt';
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-[#0d0d10] border border-white/[0.1] rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/[0.06] bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/25">
              <DocumentIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-zinc-100 tracking-wide">Export Decklist</h2>
              <p className="text-[11px] font-mono text-zinc-500">
                {totalCardsCount} cards ({deck.length} unique) {commanderCard ? `• Commander: ${commanderCard.name}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col space-y-4 overflow-hidden bg-[#09090b]">
          {/* Format Tabs */}
          <div className="flex gap-1.5 bg-zinc-900/80 p-1 rounded-lg border border-white/[0.06] shrink-0">
            <button
              onClick={() => setFormat('arena')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                format === 'arena'
                  ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              MTG Arena
            </button>
            <button
              onClick={() => setFormat('moxfield')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                format === 'moxfield'
                  ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Moxfield / Archidekt
            </button>
            <button
              onClick={() => setFormat('plain')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                format === 'plain'
                  ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Plain Text
            </button>
          </div>

          {/* Text Area */}
          <textarea
            readOnly
            value={exportText}
            rows={14}
            className="w-full bg-zinc-950 border border-white/[0.08] rounded-lg p-3.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500/50 select-all custom-scrollbar resize-none"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.06] bg-zinc-950/80 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            Ready to import into Arena, Moxfield, or tabletop apps.
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-white/[0.08] rounded-md text-xs font-medium transition-all"
            >
              Download .txt
            </button>
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40'
              }`}
            >
              {copied ? '✓ Copied to Clipboard' : 'Copy to Clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
