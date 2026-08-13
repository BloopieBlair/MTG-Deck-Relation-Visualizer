import React, { useState, useMemo, useRef, useCallback } from 'react';
import { MtgaCardItem, ProcessedDeckCard } from '../types';
import { PlusIcon, XMarkIcon, SparklesIcon, ArrowPathIcon, MagnifyingGlassIcon, CrownIcon } from './icons';
import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';


interface MtgaCollectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cards: MtgaCardItem[];
  isLoading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onAddCardToDeck: (card: MtgaCardItem) => void;
  onCardHover?: (card: MtgaCardItem | null) => void;
  commanderCard?: ProcessedDeckCard | null;
  embedded?: boolean;
  deckCards?: ProcessedDeckCard[];
}

type ColorTab = 'ALL' | 'W' | 'U' | 'B' | 'R' | 'G' | 'Multicolor' | 'Colorless' | 'Land';

export const MtgaCollectionDrawer: React.FC<MtgaCollectionDrawerProps> = ({
  isOpen,
  onClose,
  cards,
  isLoading,
  error,
  onRefresh,
  onAddCardToDeck,
  onCardHover,
  commanderCard,
  embedded = false,
  deckCards = []
}) => {
  const [activeColorTab, setActiveColorTab] = useState<ColorTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCmc, setSelectedCmc] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'type_cost' | 'cost_type' | 'title'>('type_cost');
  const [hoveredCard, setHoveredCard] = useState<MtgaCardItem | null>(null);
  const [onlyCommanderLegal, setOnlyCommanderLegal] = useState<boolean>(false);
  const [displayLimit, setDisplayLimit] = useState<number>(80);

  // Reset pagination limit when filters change
  React.useEffect(() => {
    setDisplayLimit(80);
  }, [activeColorTab, searchQuery, selectedCmc, sortBy, onlyCommanderLegal]);

  // Map of deck card titles to quantity for in-deck status badges
  const deckQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!deckCards || deckCards.length === 0) return map;
    deckCards.forEach(c => {
      map.set(c.name.toLowerCase(), c.quantity);
    });
    return map;
  }, [deckCards]);

  // Compute Commander Color Identity Set
  const commanderColorSet = useMemo(() => {
    if (!commanderCard) return null;
    const set = new Set<string>();
    if (commanderCard.colorIdentity && commanderCard.colorIdentity.length > 0) {
      commanderCard.colorIdentity.forEach(c => set.add(c.toUpperCase()));
    }
    if (commanderCard.colors && commanderCard.colors.length > 0) {
      commanderCard.colors.forEach(c => set.add(c.toUpperCase()));
    }
    if (commanderCard.parsedManaCost) {
      ['W', 'U', 'B', 'R', 'G'].forEach(color => {
        if ((commanderCard.parsedManaCost as any)[color]) {
          set.add(color);
        }
      });
    }
    return set;
  }, [commanderCard]);

  const colorTabs: { id: ColorTab; label: string; bg: string; text: string; border: string }[] = [
    { id: 'ALL', label: 'All', bg: 'bg-gray-800', text: 'text-gray-200', border: 'border-gray-700' },
    { id: 'W', label: 'White', bg: 'bg-amber-100/10', text: 'text-amber-200', border: 'border-amber-400/40' },
    { id: 'U', label: 'Blue', bg: 'bg-blue-900/40', text: 'text-blue-300', border: 'border-blue-500/40' },
    { id: 'B', label: 'Black', bg: 'bg-purple-950/50', text: 'text-purple-300', border: 'border-purple-500/40' },
    { id: 'R', label: 'Red', bg: 'bg-red-950/50', text: 'text-red-300', border: 'border-red-500/40' },
    { id: 'G', label: 'Green', bg: 'bg-emerald-950/50', text: 'text-emerald-300', border: 'border-emerald-500/40' },
    { id: 'Multicolor', label: 'Multi', bg: 'bg-yellow-950/50', text: 'text-yellow-300', border: 'border-yellow-500/40' },
    { id: 'Colorless', label: 'Colorless', bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-600' },
    { id: 'Land', label: 'Lands', bg: 'bg-stone-800', text: 'text-amber-100', border: 'border-amber-700' },
  ];

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // Commander Legal Filter
      if (onlyCommanderLegal) {
        if (!commanderColorSet) {
          // If commander legal is toggled on but no commander is set, suppress non-matching
          return false;
        }
        const cardIdentity = (card.colorIdentity && card.colorIdentity.length > 0)
          ? card.colorIdentity
          : card.colors;

        if (cardIdentity && cardIdentity.length > 0) {
          const isLegal = cardIdentity.every(c => commanderColorSet.has(c.toUpperCase()));
          if (!isLegal) return false;
        }
      }

      // Color tab filter
      if (activeColorTab !== 'ALL' && card.colorGroup !== activeColorTab) {
        return false;
      }
      // CMC filter
      if (selectedCmc !== null) {
        if (selectedCmc === 7 ? card.cmc < 7 : card.cmc !== selectedCmc) {
          return false;
        }
      }
      // Search query filter (title, oracle text, type, set)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(query);
        const matchesType = card.typeText.toLowerCase().includes(query);
        const matchesSet = card.setCode.toLowerCase().includes(query);
        const matchesText = (card.cardText || card.text || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesType && !matchesSet && !matchesText) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'type_cost') {
        if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank;
        if (a.cmc !== b.cmc) return a.cmc - b.cmc;
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'cost_type') {
        if (a.cmc !== b.cmc) return a.cmc - b.cmc;
        if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank;
        return a.title.localeCompare(b.title);
      } else {
        return a.title.localeCompare(b.title);
      }
    });
  }, [cards, activeColorTab, selectedCmc, searchQuery, sortBy, onlyCommanderLegal, commanderColorSet]);


  const paginatedCards = useMemo(() => {
    return filteredCards.slice(0, displayLimit);
  }, [filteredCards, displayLimit]);

  // Group cards by type if sorting by type_cost
  const groupedCards = useMemo(() => {
    if (sortBy !== 'type_cost') {
      return [{ category: 'Cards', items: paginatedCards }];
    }
    const groups: { [key: string]: MtgaCardItem[] } = {};
    const typeOrder = ['Land', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Battle', 'Other'];
    
    paginatedCards.forEach(c => {
      const cat = c.primaryType || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(c);
    });

    return typeOrder
      .filter(cat => groups[cat] && groups[cat].length > 0)
      .map(cat => ({ category: cat, items: groups[cat] }));
  }, [paginatedCards, sortBy]);

  if (!isOpen && !embedded) return null;

  return (
    <div className={embedded
      ? "flex-1 flex flex-col min-h-0 bg-gray-950 overflow-hidden text-gray-100 border-t border-gray-800/80"
      : "fixed inset-y-0 right-0 w-full sm:w-[460px] lg:w-[520px] bg-gray-950 border-l border-cyan-800/60 shadow-2xl z-50 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-300"
    }>
      {/* Header */}
      {!embedded ? (
        <div className="p-4 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-600/30">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 tracking-tight flex items-center gap-2">
                MTG Arena Collection
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-900/80 text-cyan-300 font-mono border border-cyan-700">
                  {cards.length} Cards
                </span>
              </h2>
              <p className="text-xs text-gray-400">Drag any card directly onto the visualizer graph</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-cyan-400 rounded-md border border-gray-700 transition-all active:scale-95 disabled:opacity-50"
              title="Re-scan MTG Arena Player.log"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md border border-gray-700 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-gray-200">Arena Collection</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
              {filteredCards.length} Cards
            </span>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-cyan-400 hover:text-cyan-300 rounded border border-gray-700 text-[11px] font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            title="Re-scan MTG Arena Player.log"
          >
            <ArrowPathIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Rescan Log</span>
          </button>
        </div>
      )}

      {/* Color Filter Tabs */}
      <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-800/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {colorTabs.map(tab => {
          const isActive = activeColorTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveColorTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all border ${
                isActive
                  ? `${tab.bg} ${tab.text} ${tab.border} ring-1 ring-cyan-500/50 shadow-md`
                  : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search & Sort Controls */}
      <div className="p-3 bg-gray-900/30 border-b border-gray-800 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search MTGA cards by title, text (+1/+1, counter...), type, set..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-gray-600"
            />
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-500 absolute left-2.5 top-2" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-gray-500 hover:text-gray-300"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setOnlyCommanderLegal(prev => !prev)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all border shrink-0 ${
              onlyCommanderLegal
                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white border-amber-400 shadow-md shadow-amber-900/40 ring-1 ring-amber-400'
                : 'bg-gray-900 text-gray-400 hover:text-amber-300 border-gray-800 hover:bg-gray-800'
            }`}
            title="Filter cards to only those legal in your Commander's Color Identity"
          >
            <CrownIcon className="w-3.5 h-3.5 text-amber-300" />
            <span>Commander Valid</span>
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-gray-900 border border-gray-800 rounded-md px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-cyan-500"
          >
            <option value="type_cost">Lands First → Type → Cost</option>
            <option value="cost_type">Mana Cost → Type</option>
            <option value="title">Title A-Z</option>
          </select>
        </div>

        {/* Commander Identity Info Banner when Commander Legal Filter is Active */}
        {onlyCommanderLegal && (
          <div className="p-2 rounded-md bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex items-center justify-between">
            {commanderCard ? (
              <div className="flex items-center gap-2">
                <CrownIcon className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Filtering for Commander: <strong className="text-amber-100">{commanderCard.name}</strong>
                </span>
                <div className="flex items-center gap-1 ml-1 font-mono text-[10px]">
                  {Array.from(commanderColorSet || []).map(color => (
                    <span key={color} className="px-1.5 py-0.2 rounded bg-amber-900/80 text-amber-200 border border-amber-600 font-bold">
                      {color}
                    </span>
                  ))}
                  {(!commanderColorSet || commanderColorSet.size === 0) && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">Colorless</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-300 font-medium">
                <CrownIcon className="w-4 h-4 text-amber-400 shrink-0" />
                <span>No Commander set yet! Use "Set Commander" in sidebar to activate color identity filter.</span>
              </div>
            )}
          </div>
        )}


        {/* Mana Cost Filter Buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mr-1">CMC:</span>
          <button
            onClick={() => setSelectedCmc(null)}
            className={`px-2 py-0.5 rounded text-xs font-mono ${
              selectedCmc === null ? 'bg-cyan-600 text-white font-bold' : 'bg-gray-900 text-gray-400 hover:text-gray-200'
            }`}
          >
            All
          </button>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(cmc => (
            <button
              key={cmc}
              onClick={() => setSelectedCmc(selectedCmc === cmc ? null : cmc)}
              className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${
                selectedCmc === cmc
                  ? 'bg-cyan-600 text-white font-bold ring-1 ring-cyan-400'
                  : 'bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {cmc === 7 ? '7+' : cmc}
            </button>
          ))}
        </div>
      </div>

      {/* Card List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-3">
            <ArrowPathIcon className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-xs font-mono text-cyan-400">Scanning MTG Arena Player.log & SQLite DB...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 space-y-2">
            <p className="font-bold text-red-200">Could not load MTG Arena logs:</p>
            <p className="font-mono text-[11px] text-red-400">{error}</p>
            <p className="text-gray-400 pt-1">
              Ensure MTG Arena plugin logging is enabled: <strong>Settings &gt; Account &gt; Detailed Logs (Plugin Support)</strong>.
            </p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500 space-y-2">
            <p className="text-sm font-semibold">No MTGA cards match current filters</p>
            <button
              onClick={() => { setActiveColorTab('ALL'); setSelectedCmc(null); setSearchQuery(''); }}
              className="text-xs text-cyan-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {groupedCards.map(group => (
              <div key={group.category} className="space-y-2">
                {sortBy === 'type_cost' && (
                  <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-md py-1 px-2 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      {group.category}s
                    </h3>
                    <span className="text-[10px] font-mono text-gray-500">{group.items.length}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-1.5">
                  {group.items.map((card) => {
                    const inDeckQty = deckQuantityMap.get(card.title.toLowerCase()) || 0;
                    return (
                      <div
                        key={`${card.grpId}-${card.title}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', card.title);
                          e.dataTransfer.setData('application/json', JSON.stringify(card));
                        }}
                        onMouseEnter={() => {
                          setHoveredCard(card);
                          if (onCardHover) onCardHover(card);
                        }}
                        onMouseLeave={() => {
                          setHoveredCard(null);
                          if (onCardHover) onCardHover(null);
                        }}

                        className="group flex items-center justify-between p-2 rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-800/80 hover:border-cyan-500/50 transition-all cursor-grab active:cursor-grabbing shadow-sm hover:shadow-cyan-900/20"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Set Code Badge */}
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-800 text-cyan-300 border border-gray-700 uppercase shrink-0">
                            {card.setCode || 'MTGA'}
                          </span>

                          {/* Card Title & Type */}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-200 group-hover:text-cyan-300 transition-colors truncate flex items-center gap-1.5">
                              <span className="truncate">{card.title}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 truncate flex items-center gap-2">
                              <span>{card.typeText}</span>
                              {card.power && card.toughness && (
                                <span className="font-mono text-amber-300/80">[{card.power}/{card.toughness}]</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Cost, Quantity, In-Deck Badge, and Add Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {inDeckQty > 0 && (
                            <span 
                              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-700/60 shadow-sm"
                              title={`Card is currently in deck: ${inDeckQty} copy${inDeckQty > 1 ? 'ies' : ''}`}
                            >
                              In Deck x{inDeckQty}
                            </span>
                          )}
                          {card.primaryType !== 'Land' && (
                            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                              {card.cmc} CMC
                            </span>
                          )}
                          {card.quantity > 1 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                              x{card.quantity}
                            </span>
                          )}
                          <button
                            onClick={() => onAddCardToDeck(card)}
                            className="p-1.5 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white rounded transition-all active:scale-95 border border-cyan-500/40"
                            title={`Add "${card.title}" to visualizer`}
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredCards.length > displayLimit && (
              <div className="pt-2 pb-4 text-center">
                <button
                  onClick={() => setDisplayLimit(prev => prev + 100)}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-900/80 to-blue-900/80 hover:from-cyan-800 hover:to-blue-800 text-cyan-300 hover:text-white rounded-lg border border-cyan-700/60 text-xs font-bold shadow-lg transition-all active:scale-95"
                >
                  Load More Cards ({filteredCards.length - displayLimit} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

