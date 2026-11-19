import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { DeckZone } from '../types';
import { searchScryfallCards, type ScryfallSearchResult } from '../services/scryfallService';
import { ManaCostDisplay } from './ManaCostDisplay';
import { XMarkIcon, PlusIcon, MagnifyingGlassIcon } from './icons';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmAdd: (cardName: string, zone?: DeckZone) => void;
  commanderColorIdentity?: string[];
}

export const AddCardModal: React.FC<AddCardModalProps> = ({
  isOpen,
  onClose,
  onConfirmAdd,
  commanderColorIdentity,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScryfallSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [zone, setZone] = useState<DeckZone>('mainboard');
  const [commanderLegalOnly, setCommanderLegalOnly] = useState<boolean>(
    commanderColorIdentity !== undefined
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const requestIdRef = useRef(0);

  const hasCommanderIdentity = commanderColorIdentity !== undefined;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      setSelectedIndex(-1);
      setHoveredIndex(null);
      setZone('mainboard');
      setCommanderLegalOnly(commanderColorIdentity !== undefined);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, commanderColorIdentity]);

  // Debounced live Scryfall search (250ms)
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      setSelectedIndex(-1);
      setHoveredIndex(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const searchResults = await searchScryfallCards(trimmed, {
          colorIdentity:
            hasCommanderIdentity && commanderLegalOnly
              ? commanderColorIdentity
              : undefined,
          limit: 12,
        });
        if (requestIdRef.current !== currentRequestId) return;
        setResults(searchResults);
        setHasSearched(true);
        setSelectedIndex(-1);
        setHoveredIndex(null);
      } catch (err) {
        if (requestIdRef.current !== currentRequestId) return;
        console.error('Scryfall search error:', err);
        setResults([]);
        setHasSearched(true);
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen, hasCommanderIdentity, commanderLegalOnly, commanderColorIdentity]);

  // Scroll highlighted result into view on keyboard navigation
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const previewCard = useMemo<ScryfallSearchResult | null>(() => {
    if (hoveredIndex !== null && results[hoveredIndex]) {
      return results[hoveredIndex];
    }
    if (selectedIndex >= 0 && results[selectedIndex]) {
      return results[selectedIndex];
    }
    return results[0] ?? null;
  }, [hoveredIndex, selectedIndex, results]);

  const handleConfirm = (cardName: string) => {
    const trimmed = cardName.trim();
    if (!trimmed) return;
    onConfirmAdd(trimmed, zone);
  };

  const handleSubmit = () => {
    if (selectedIndex >= 0 && results[selectedIndex]) {
      handleConfirm(results[selectedIndex].name);
    } else if (query.trim()) {
      handleConfirm(query.trim());
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const formatPrice = (usd?: string | null): string | null => {
    if (!usd) return null;
    const num = parseFloat(usd);
    if (Number.isNaN(num)) return null;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-card-modal-title"
    >
      <div
        className="bg-[#0d0d10] p-5 md:p-6 rounded-xl shadow-2xl w-full max-w-3xl border border-white/[0.1] flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <h3 id="add-card-modal-title" className="font-display text-base font-bold text-zinc-100">
              Add Card to Deck
            </h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Search Scryfall live or press Enter to add an exact card name.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded"
            aria-label="Close add card modal"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input + Controls */}
        <div className="flex-shrink-0 space-y-2.5 mb-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="card-name-input"
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search cards... e.g., Sol Ring, Rhystic Study, t:artifact"
              className="w-full bg-zinc-900 border border-white/[0.08] rounded-md py-2 pl-9 pr-20 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
              aria-label="Search card name"
              autoComplete="off"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-amber-400/90 animate-pulse">
                Searching...
              </span>
            )}
            {!isSearching && query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Zone Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Zone
              </span>
              <div className="inline-flex rounded-md bg-zinc-900 border border-white/[0.08] p-0.5">
                <button
                  type="button"
                  onClick={() => setZone('mainboard')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    zone === 'mainboard'
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  Mainboard
                </button>
                <button
                  type="button"
                  onClick={() => setZone('considering')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    zone === 'considering'
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  Considering
                </button>
              </div>
            </div>

            {/* Commander Legal Only Checkbox */}
            {hasCommanderIdentity && (
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[11px] text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={commanderLegalOnly}
                  onChange={(e) => setCommanderLegalOnly(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500/40 focus:ring-offset-0"
                />
                <span>
                  Commander Legal Only
                  <span className="ml-1.5 font-mono text-[10px] text-zinc-500">
                    ({commanderColorIdentity.length > 0 ? commanderColorIdentity.join('') : 'C'})
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Main Content: Results List + Preview Pane */}
        <div className="flex-grow min-h-0 flex gap-4 overflow-hidden border-t border-white/[0.06] pt-3">
          {/* Results Column */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {query.trim().length < 2 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center py-10 px-4 text-zinc-500 border border-dashed border-white/[0.06] rounded-lg">
                <MagnifyingGlassIcon className="w-6 h-6 text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-400">Type at least 2 characters to search Scryfall</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Use <span className="font-mono text-zinc-400">↑</span> / <span className="font-mono text-zinc-400">↓</span> to browse and <span className="font-mono text-zinc-400">Enter</span> to add
                </p>
              </div>
            ) : isSearching && results.length === 0 ? (
              <div className="flex-grow flex items-center justify-center py-10 text-xs text-zinc-400">
                Searching Scryfall...
              </div>
            ) : hasSearched && results.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center py-10 px-4 text-zinc-500 border border-dashed border-white/[0.06] rounded-lg">
                <p className="text-xs text-zinc-300">No Scryfall matches for &ldquo;{query.trim()}&rdquo;</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Press <span className="font-mono text-amber-300">Enter</span> or click Add Card to fetch by exact name anyway.
                </p>
              </div>
            ) : (
              <ul
                ref={listRef}
                role="listbox"
                aria-label="Search results"
                className="overflow-y-auto custom-scrollbar space-y-1 pr-1 flex-grow"
              >
                {results.map((card, idx) => {
                  const isHighlighted = selectedIndex === idx;
                  const priceLabel = formatPrice(card.prices?.usd);
                  return (
                    <li
                      key={`${card.name}-${idx}`}
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => handleConfirm(card.name)}
                      className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border cursor-pointer transition-colors ${
                        isHighlighted
                          ? 'bg-amber-500/15 border-amber-500/50'
                          : 'bg-zinc-900/50 border-white/[0.05] hover:bg-zinc-800/70 hover:border-zinc-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-medium truncate ${
                              isHighlighted ? 'text-amber-100' : 'text-zinc-100'
                            }`}
                          >
                            {card.name}
                          </span>
                          {priceLabel && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/90 text-emerald-400/90 border border-white/[0.06] flex-shrink-0">
                              {priceLabel}
                            </span>
                          )}
                        </div>
                        {card.typeLine && (
                          <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                            {card.typeLine}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ManaCostDisplay manaCostString={card.manaCostString} iconSizeClass="w-3.5 h-3.5" />
                        <span className="p-1 rounded bg-amber-500/10 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlusIcon className="w-3 h-3" />
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right Preview Pane (md+) */}
          <div className="hidden md:flex w-52 flex-shrink-0 flex-col items-center justify-start bg-zinc-950/60 border border-white/[0.06] rounded-lg p-2.5">
            {previewCard?.imageUrl ? (
              <>
                <img
                  src={previewCard.imageUrl}
                  alt={previewCard.name}
                  className="w-full rounded-lg shadow-lg border border-white/[0.08] object-contain"
                />
                <div className="w-full mt-2 text-center">
                  <p className="text-[11px] font-medium text-zinc-200 truncate" title={previewCard.name}>
                    {previewCard.name}
                  </p>
                  {formatPrice(previewCard.prices?.usd) && (
                    <p className="text-[10px] font-mono text-emerald-400/80 mt-0.5">
                      TCG Market ~ {formatPrice(previewCard.prices?.usd)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center text-center text-zinc-600 px-3 py-12">
                <div className="w-28 h-40 rounded-lg border border-dashed border-zinc-800 flex items-center justify-center mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-700">Preview</span>
                </div>
                <p className="text-[10px] text-zinc-600">
                  Hover or select a card to preview artwork
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2 flex-shrink-0">
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            {selectedIndex >= 0 && results[selectedIndex]
              ? `Selected: ${results[selectedIndex].name}`
              : query.trim()
                ? `Press Enter to add "${query.trim()}"`
                : 'Powered by Scryfall'}
          </span>
          <div className="flex items-center space-x-2.5 ml-auto">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              type="button"
              disabled={!query.trim() && selectedIndex < 0}
              className="px-4 py-2 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
            >
              <PlusIcon className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              {zone === 'considering' ? 'Add to Considering' : 'Add Card'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
