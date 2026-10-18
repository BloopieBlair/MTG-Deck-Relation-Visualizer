import React from 'react';
import type { ProcessedDeckCard } from '../types';
import { SparklesIcon } from './icons';

interface FooterBannerProps {
  commanderCard: ProcessedDeckCard | null;
  deckCount: number;
  onOpenAiSetup: () => void;
}

export const FooterBanner: React.FC<FooterBannerProps> = ({
  commanderCard,
  deckCount,
  onOpenAiSetup,
}) => {
  const searchQuery = commanderCard
    ? encodeURIComponent(commanderCard.name)
    : 'Sol+Ring';

  const cardmarketUrl = `https://www.cardmarket.com/en/Magic/Products/Search?searchString=${searchQuery}`;
  const tcgplayerUrl = `https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${searchQuery}&view=grid`;

  return (
    <footer className="w-full bg-[#09090b] border-t border-zinc-800/80 px-6 py-8 text-xs text-zinc-400 select-text">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Single Respectful Below-the-Fold Sponsor / Marketplace Banner Slot */}
        <div className="relative rounded-xl bg-zinc-900/70 border border-zinc-800/90 p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-3.5">
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest bg-zinc-950 text-amber-400/90 rounded border border-amber-500/25 shrink-0">
              Partner
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                {commanderCard
                  ? `Upgrading your ${commanderCard.name} Deck?`
                  : 'Tuning your next Commander or 60-card list?'}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                Compare singles prices &amp; pick up missing synergy pieces from trusted marketplaces, or tip £1 to keep this indie tool ad-light and free.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href={cardmarketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-600 text-zinc-200 font-medium text-xs transition-all"
            >
              🇬🇧🇪🇺 Cardmarket Singles &rarr;
            </a>
            <a
              href={tcgplayerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-600 text-zinc-200 font-medium text-xs transition-all"
            >
              🇺🇸 TCGplayer Singles &rarr;
            </a>
            <a
              href="https://ko-fi.com/bloopieblair"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-semibold text-xs shadow transition-all flex items-center gap-1.5"
            >
              <span>☕ Tip £1 on Ko-fi</span>
            </a>
          </div>
        </div>

        {/* Indie Transparency & Footer Links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-zinc-500 pt-1">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-zinc-300 tracking-wide">AETHERGRAPH</span>
            <span>•</span>
            <span>100% Client-Side &amp; Privacy-First (Zero Popups, Zero Tracking)</span>
            {deckCount > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-400/90 font-mono">{deckCount} unique cards active</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenAiSetup}
              className="text-amber-400/90 hover:text-amber-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Configure Free OpenRouter / Gemini AI</span>
            </button>
            <a
              href="https://ko-fi.com/bloopieblair"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              Support Indie Dev
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
