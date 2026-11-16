import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ProcessedDeckCard } from '../types';
import {
  runMonteCarlo,
  compileCard,
  getExampleSpotlightHand,
  generateParallelUniverses,
  type SimState,
  type MonteCarloResult,
  type CompiledCard,
  type ParallelUniverse,
  type ParallelTurnStep,
  type ParallelAction,
  type ParallelUniversesAnalysis,
} from '../services/goldfishSimulator';
import { XMarkIcon, CrownIcon, SparklesIcon } from './icons';

export interface GoldfishSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: ProcessedDeckCard[];
  drawnSampleHand: ProcessedDeckCard[] | null;
  commanderId: string | null;
  onSetCommander: (card: ProcessedDeckCard) => void;
  onCardClick: (card: ProcessedDeckCard) => void;
  onUpdateSampleHand?: (newHand: ProcessedDeckCard[]) => void;
  onDrawRandomHand?: () => void;
  initialUniverseId?: string | null;
}

const UNIVERSE_ACCENT_STYLES: Record<
  ParallelUniverse['accentColor'],
  {
    border: string;
    activeBg: string;
    badge: string;
    text: string;
    ring: string;
    dot: string;
  }
> = {
  amber: {
    border: 'border-amber-500/60',
    activeBg: 'bg-amber-950/35 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    text: 'text-amber-300',
    ring: 'ring-amber-400',
    dot: 'bg-amber-400',
  },
  emerald: {
    border: 'border-emerald-500/60',
    activeBg: 'bg-emerald-950/35 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    text: 'text-emerald-300',
    ring: 'ring-emerald-400',
    dot: 'bg-emerald-400',
  },
  sky: {
    border: 'border-sky-500/60',
    activeBg: 'bg-sky-950/35 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.2)]',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    text: 'text-sky-300',
    ring: 'ring-sky-400',
    dot: 'bg-sky-400',
  },
  purple: {
    border: 'border-purple-500/60',
    activeBg: 'bg-purple-950/35 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    text: 'text-purple-300',
    ring: 'ring-purple-400',
    dot: 'bg-purple-400',
  },
  rose: {
    border: 'border-rose-500/60',
    activeBg: 'bg-rose-950/35 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    text: 'text-rose-300',
    ring: 'ring-rose-400',
    dot: 'bg-rose-400',
  },
};

const GRADE_STYLES: Record<ParallelUniversesAnalysis['handGrade'], string> = {
  S: 'bg-gradient-to-br from-amber-400 to-yellow-600 text-black border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.45)]',
  A: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-black border-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.35)]',
  B: 'bg-gradient-to-br from-sky-400 to-blue-600 text-white border-sky-300',
  C: 'bg-zinc-800 text-zinc-200 border-zinc-600',
  Mulligan: 'bg-rose-950 text-rose-300 border-rose-500/60',
};

function getCardRoleBadge(compiled: CompiledCard): { label: string; className: string } {
  if (compiled.isFetchLand) {
    return { label: '🔗 Fetch', className: 'bg-cyan-950/90 text-cyan-300 border-cyan-500/40' };
  }
  if (compiled.isLand) {
    if (compiled.producesAnyColor || compiled.produces.length > 1) {
      return {
        label: `🌈 ${compiled.producesAnyColor ? 'Any' : compiled.produces.join('/')} Land`,
        className: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40',
      };
    }
    const col = compiled.produces[0] || 'C';
    const icon = col === 'R' ? '🏔️' : col === 'W' ? '☀️' : col === 'U' ? '💧' : col === 'B' ? '💀' : col === 'G' ? '🌲' : '💎';
    return {
      label: `${icon} {${col}} Land`,
      className: 'bg-zinc-900/95 text-zinc-200 border-zinc-600/60',
    };
  }
  if (compiled.createsTreasureCount > 0 || compiled.attackCreatesTreasureCount > 0 || compiled.synergyRole === 'treasure-accel') {
    return {
      label: compiled.cmc <= 1 ? '🪙 T1 Treasure' : '🪙 Treasure',
      className: 'bg-amber-950/95 text-amber-300 border-amber-500/50',
    };
  }
  if (compiled.synergyRole === 'attacker-1drop' || (compiled.isCreature && compiled.cmc <= 1)) {
    return { label: '⚔️ 1-Drop', className: 'bg-orange-950/90 text-orange-300 border-orange-500/40' };
  }
  if (compiled.synergyRole === 'counter-engine' || compiled.synergyRole === 'lifegain-sister' || compiled.synergyRole === 'artifact-ping') {
    return { label: '📈 Engine', className: 'bg-purple-950/90 text-purple-300 border-purple-500/40' };
  }
  if (compiled.isManaRock || compiled.isManaDork || compiled.isRampSpell || compiled.isLandAura) {
    return { label: '⚡ Ramp', className: 'bg-lime-950/90 text-lime-300 border-lime-500/40' };
  }
  return { label: `✨ ${compiled.cmc} CMC`, className: 'bg-zinc-900/95 text-zinc-300 border-zinc-700/60' };
}

const TreasureTokenCard: React.FC<{ count: number; tapped?: boolean }> = ({ count, tapped }) => (
  <div
    className={`flex flex-col items-center p-2 bg-gradient-to-b from-amber-950/70 to-zinc-950 border border-amber-500/50 rounded-lg w-[7.5rem] relative shadow-[0_0_15px_rgba(245,158,11,0.18)] ${
      tapped ? 'opacity-65' : ''
    }`}
  >
    <div
      className={`w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-amber-500/40 relative bg-gradient-to-br from-amber-900/40 via-zinc-950 to-yellow-950/40 flex flex-col items-center justify-center p-2 ${
        tapped ? 'rotate-6' : ''
      }`}
    >
      <svg viewBox="0 0 64 64" className="w-12 h-12 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
        <defs>
          <linearGradient id="treasureGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <path
          d="M12 24 L20 14 H44 L52 24 V48 C52 50 50 52 48 52 H16 C14 52 12 50 12 48 Z"
          fill="url(#treasureGold)"
          stroke="#fef3c7"
          strokeWidth="2"
        />
        <path d="M12 24 H52" stroke="#78350f" strokeWidth="2.5" />
        <circle cx="32" cy="34" r="6" fill="#fef3c7" stroke="#92400e" strokeWidth="2" />
        <rect x="29.5" y="34" width="5" height="6" rx="1" fill="#78350f" />
      </svg>
      <span className="mt-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300 text-center">
        Artifact Token
      </span>
      <span className="text-[9px] text-amber-200/80 text-center leading-tight mt-0.5">
        Sac: Add 1 mana
      </span>
      <span className="absolute top-1 right-1 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded shadow">
        x{count}
      </span>
    </div>
    <span className="text-[10px] font-bold text-amber-300 text-center truncate w-full">
      Treasure Token
    </span>
  </div>
);

const GnomeTokenCard: React.FC<{ count: number }> = ({ count }) => (
  <div className="flex flex-col items-center p-2 bg-gradient-to-b from-slate-900/80 to-zinc-950 border border-sky-500/40 rounded-lg w-[7.5rem] relative shadow-[0_0_12px_rgba(56,189,248,0.15)]">
    <div className="w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-sky-500/35 relative bg-gradient-to-br from-slate-800/40 via-zinc-950 to-sky-950/40 flex flex-col items-center justify-center p-2">
      <svg viewBox="0 0 64 64" className="w-11 h-11 text-sky-300">
        <circle cx="32" cy="24" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M22 20 L32 8 L42 20" fill="currentColor" opacity="0.35" stroke="currentColor" strokeWidth="2" />
        <path d="M18 52 C18 40 24 35 32 35 C40 35 46 40 46 52 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="28" cy="24" r="1.5" fill="currentColor" />
        <circle cx="36" cy="24" r="1.5" fill="currentColor" />
      </svg>
      <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-sky-300 text-center">
        1/1 Gnome
      </span>
      <span className="text-[9px] text-zinc-400 text-center leading-tight mt-0.5">
        Artifact Creature
      </span>
      <span className="absolute top-1 right-1 bg-sky-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded shadow">
        x{count}
      </span>
    </div>
    <span className="text-[10px] font-bold text-sky-300 text-center truncate w-full">
      Gnome Token (1/1)
    </span>
  </div>
);

export const GoldfishSimulatorModal: React.FC<GoldfishSimulatorModalProps> = ({
  isOpen,
  onClose,
  deck,
  drawnSampleHand,
  commanderId,
  onSetCommander,
  onCardClick,
  onUpdateSampleHand,
  onDrawRandomHand,
  initialUniverseId,
}) => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'stats'>(() =>
    drawnSampleHand && drawnSampleHand.length > 0 ? 'explorer' : 'stats'
  );
  const [localSampleHand, setLocalSampleHand] = useState<ProcessedDeckCard[]>(
    () => drawnSampleHand || []
  );
  const [allowLibraryDraws, setAllowLibraryDraws] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'parallel-grid' | 'turn-detail'>('parallel-grid');
  const [selectedUniverseId, setSelectedUniverseId] = useState<string>(
    initialUniverseId || 'alpha'
  );
  const [selectedTurnNum, setSelectedTurnNum] = useState<number>(1);
  const [swapSlotIdx, setSwapSlotIdx] = useState<number | null>(null);
  const [swapSearch, setSwapSearch] = useState<string>('');

  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [mcRuns, setMcRuns] = useState<number>(300);

  // Sync localSampleHand with incoming drawnSampleHand
  useEffect(() => {
    if (drawnSampleHand) {
      setLocalSampleHand(drawnSampleHand);
    }
  }, [drawnSampleHand]);

  // Default to explorer when opening with a sample hand or initialUniverseId
  useEffect(() => {
    if (isOpen) {
      if (initialUniverseId) {
        setActiveTab('explorer');
        setSelectedUniverseId(initialUniverseId);
      } else if (drawnSampleHand && drawnSampleHand.length > 0) {
        setActiveTab('explorer');
      }
    }
  }, [isOpen, initialUniverseId]);

  const effectiveHand = localSampleHand;

  const commanderCard = useMemo(() => {
    return (deck || []).find(c => c.id === commanderId) || null;
  }, [deck, commanderId]);

  // Requirement 1: Check both keywords and typeLine for legendary and (creature || planeswalker)
  const potentialCommanders = useMemo(() => {
    return (deck || []).filter(c => {
      const kws = (c.keywords || []).map(k => k.toLowerCase());
      const typeLower = (c.typeLine || '').toLowerCase();
      const isLegendary = kws.includes('legendary') || typeLower.includes('legendary');
      const isCreatureOrPW =
        kws.includes('creature') ||
        kws.includes('planeswalker') ||
        typeLower.includes('creature') ||
        typeLower.includes('planeswalker');
      return isLegendary && isCreatureOrPW;
    });
  }, [deck]);

  const commitHandUpdate = useCallback(
    (newHand: ProcessedDeckCard[]) => {
      setLocalSampleHand(newHand);
      if (onUpdateSampleHand) {
        onUpdateSampleHand(newHand);
      }
      setSwapSlotIdx(null);
      setSwapSearch('');
    },
    [onUpdateSampleHand]
  );

  const handleLoadExampleHand = useCallback(() => {
    const spotlight = getExampleSpotlightHand(deck, commanderCard);
    if (spotlight.length > 0) {
      commitHandUpdate(spotlight);
    }
  }, [deck, commanderCard, commitHandUpdate]);

  const handleDrawRandom7 = useCallback(() => {
    if (onDrawRandomHand) {
      onDrawRandomHand();
      setSwapSlotIdx(null);
      return;
    }
    const pool: ProcessedDeckCard[] = [];
    (deck || []).forEach(c => {
      if (commanderCard && c.name === commanderCard.name) return;
      const qty = Math.max(1, c.quantity || 1);
      for (let i = 0; i < qty; i++) {
        pool.push(c);
      }
    });
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    commitHandUpdate(pool.slice(0, 7));
  }, [onDrawRandomHand, deck, commanderCard, commitHandUpdate]);

  const handleSwapCard = useCallback(
    (slotIdx: number, replacement: ProcessedDeckCard) => {
      const next = [...effectiveHand];
      next[slotIdx] = replacement;
      commitHandUpdate(next);
    },
    [effectiveHand, commitHandUpdate]
  );

  // Parallel Universes Analysis
  const parallelAnalysis = useMemo<ParallelUniversesAnalysis | null>(() => {
    if (!commanderCard || effectiveHand.length === 0) return null;
    return generateParallelUniverses(effectiveHand, deck, commanderCard, {
      allowLibraryDraws,
      maxTurns: 4,
    });
  }, [effectiveHand, deck, commanderCard, allowLibraryDraws]);

  // Fallback validation: if selectedUniverseId is missing or no longer in universes, select the first available
  useEffect(() => {
    if (!parallelAnalysis || parallelAnalysis.universes.length === 0) return;
    if (
      !selectedUniverseId ||
      !parallelAnalysis.universes.some(u => u.id === selectedUniverseId)
    ) {
      setSelectedUniverseId(parallelAnalysis.universes[0].id);
    }
  }, [parallelAnalysis, selectedUniverseId]);

  const selectedUniverse = useMemo<ParallelUniverse | null>(() => {
    if (!parallelAnalysis || parallelAnalysis.universes.length === 0) return null;
    return (
      parallelAnalysis.universes.find(u => u.id === selectedUniverseId) ||
      parallelAnalysis.universes[0]
    );
  }, [parallelAnalysis, selectedUniverseId]);

  // Ensure selectedTurnNum is valid for selectedUniverse
  useEffect(() => {
    if (!selectedUniverse || selectedUniverse.turns.length === 0) return;
    if (!selectedUniverse.turns.some(t => t.turn === selectedTurnNum)) {
      setSelectedTurnNum(selectedUniverse.turns[0].turn);
    }
  }, [selectedUniverse, selectedTurnNum]);

  const selectedTurnStep = useMemo<ParallelTurnStep | null>(() => {
    if (!selectedUniverse || selectedUniverse.turns.length === 0) return null;
    return (
      selectedUniverse.turns.find(t => t.turn === selectedTurnNum) ||
      selectedUniverse.turns[0]
    );
  }, [selectedUniverse, selectedTurnNum]);

  // Cards used in Turns 1-2 of active universe (for highlight ring on Opening Hand)
  const earlyUsedCardNames = useMemo(() => {
    const names = new Set<string>();
    if (!selectedUniverse) return names;
    selectedUniverse.turns
      .filter(t => t.turn <= 2)
      .forEach(t => {
        t.actions.forEach(a => names.add(a.cardName.toLowerCase()));
      });
    return names;
  }, [selectedUniverse]);

  // Role badges for opening hand cards
  const compiledHandMap = useMemo(() => {
    const cmdColors = commanderCard?.colorIdentity || [];
    return effectiveHand.map(card => ({
      card,
      compiled: compileCard(card, cmdColors),
      role: getCardRoleBadge(compileCard(card, cmdColors)),
    }));
  }, [effectiveHand, commanderCard]);

  // Filtered deck cards for Swap dropdown
  const swappableDeckCards = useMemo(() => {
    const q = swapSearch.trim().toLowerCase();
    return (deck || [])
      .filter(c => !commanderCard || c.name !== commanderCard.name)
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .slice(0, 40);
  }, [deck, commanderCard, swapSearch]);

  const getBasicLandImage = useCallback(
    (type: string): string => {
      const found = (deck || []).find(
        c => c.name.toLowerCase() === type.toLowerCase()
      );
      if (found && found.imageUrl) return found.imageUrl;

      const symbols: Record<string, string> = {
        plains: 'https://svgs.scryfall.io/card-symbols/W.svg',
        island: 'https://svgs.scryfall.io/card-symbols/U.svg',
        swamp: 'https://svgs.scryfall.io/card-symbols/B.svg',
        mountain: 'https://svgs.scryfall.io/card-symbols/R.svg',
        forest: 'https://svgs.scryfall.io/card-symbols/G.svg',
      };
      return (
        symbols[type.toLowerCase()] ||
        'https://svgs.scryfall.io/card-symbols/C.svg'
      );
    },
    [deck]
  );

  const resolveCardForAction = useCallback(
    (action: ParallelAction): ProcessedDeckCard | null => {
      if (action.card) return action.card;
      const found = (deck || []).find(
        c => c.name.toLowerCase() === action.cardName.toLowerCase()
      );
      if (found) return found;
      if (
        commanderCard &&
        commanderCard.name.toLowerCase() === action.cardName.toLowerCase()
      ) {
        return commanderCard;
      }
      return null;
    },
    [deck, commanderCard]
  );

  // Run Monte Carlo when dependencies change
  useEffect(() => {
    if (!isOpen || !commanderCard) return;

    setIsSimulating(true);
    const timer = setTimeout(() => {
      const mc = runMonteCarlo(deck, commanderCard, mcRuns, 8);
      setMcResult(mc);

      setIsSimulating(false);
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, deck, commanderCard, mcRuns]);

  const handleReRunMC = useCallback(() => {
    if (!commanderCard) return;
    setIsSimulating(true);
    setTimeout(() => {
      const mc = runMonteCarlo(deck, commanderCard, mcRuns, 8);
      setMcResult(mc);
      setIsSimulating(false);
    }, 60);
  }, [deck, commanderCard, mcRuns]);

  if (!isOpen) return null;

  const renderVisualBattlefield = (state: SimState, stepActions: ParallelAction[]) => {
    const sacrificedThisTurn = stepActions.flatMap(a => a.sacrificedTokens || []);

    // Separate specialSources into lands, treasure tokens, and non-land permanents
    const specialLands = state.specialSources.filter(s => {
      if (s.isToken || s.name === 'Treasure Token') return false;
      if (s.isLand) return true;
      const card = deck.find(c => c.id === s.cardId || c.name === s.name);
      return Boolean(
        card?.keywords?.some(k => k.toLowerCase() === 'land') ||
          card?.typeLine?.toLowerCase().includes('land')
      );
    });

    const treasureTokens = state.specialSources.filter(
      s => s.name === 'Treasure Token' || (s.isToken && s.sacrificeToActivate)
    );

    const specialNonLands = state.specialSources.filter(s => {
      if (s.name === 'Treasure Token' || s.isToken) return false;
      if (s.isLand) return false;
      const card = deck.find(c => c.id === s.cardId || c.name === s.name);
      const isLandCard = Boolean(
        card?.keywords?.some(k => k.toLowerCase() === 'land') ||
          card?.typeLine?.toLowerCase().includes('land')
      );
      return !isLandCard;
    });

    const hasAnyLands =
      Object.values(state.basics).some(b => b.total > 0) || specialLands.length > 0;
    const hasAnyNonLands =
      specialNonLands.length > 0 ||
      treasureTokens.length > 0 ||
      (state.gnomeTokens || 0) > 0 ||
      (state.commanderCast && Boolean(commanderCard));

    return (
      <div className="mt-5 border-t border-zinc-800/70 pt-4 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[15px] font-extrabold text-amber-400 uppercase tracking-wider">
            Visual Battlefield at End of Turn {state.turn}
          </h4>
          {sacrificedThisTurn.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-950/70 border border-amber-500/40 text-amber-300 text-xs font-bold">
              🪙 Sacrificed: {sacrificedThisTurn.length}x Treasure
            </span>
          )}
        </div>

        {!hasAnyLands && !hasAnyNonLands && (
          <div className="text-xs text-zinc-500 italic py-3">
            No permanents on the battlefield yet.
          </div>
        )}

        {/* Lands Section */}
        {hasAnyLands && (
          <div>
            <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 border-b border-zinc-900 pb-1">
              Lands
            </h5>
            <div className="flex flex-wrap gap-3">
              {/* Basic Lands (Untapped) */}
              {Object.entries(state.basics).map(([type, count]) => {
                const basicData = count as { total: number; tapped: number };
                const untappedCount = basicData.total - basicData.tapped;
                if (untappedCount <= 0) return null;
                return (
                  <div
                    key={`untapped-stack-${type}`}
                    className="relative h-[11.2rem] mb-1"
                    style={{ width: `${7.5 + (untappedCount - 1) * 3.2}rem` }}
                  >
                    {Array.from({ length: untappedCount }).map((_, idx) => (
                      <div
                        key={idx}
                        className="absolute top-0 flex flex-col items-center p-2 bg-zinc-900 border border-zinc-700/80 rounded-lg w-[7.5rem] shadow-lg transition-all hover:-translate-y-1 hover:z-20 hover:border-amber-500/50"
                        style={{ left: `${idx * 3.2}rem`, zIndex: idx }}
                      >
                        <div className="w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-zinc-800 bg-zinc-950 flex items-center justify-center">
                          <img
                            src={getBasicLandImage(type)}
                            className="w-full h-full object-contain"
                            alt={type}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-zinc-300 text-center truncate w-full">
                          {type}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Basic Lands (Tapped) */}
              {Object.entries(state.basics).map(([type, count]) => {
                const basicData = count as { total: number; tapped: number };
                const tappedCount = basicData.tapped;
                if (tappedCount <= 0) return null;
                return (
                  <div
                    key={`tapped-stack-${type}`}
                    className="relative h-[11.2rem] mb-1 opacity-65"
                    style={{ width: `${7.5 + (tappedCount - 1) * 3.2}rem` }}
                  >
                    {Array.from({ length: tappedCount }).map((_, idx) => (
                      <div
                        key={idx}
                        className="absolute top-0 flex flex-col items-center p-2 bg-zinc-900 border border-zinc-800 rounded-lg w-[7.5rem] shadow-lg transition-all hover:-translate-y-1 hover:z-20 hover:border-amber-500/50"
                        style={{ left: `${idx * 3.2}rem`, zIndex: idx }}
                      >
                        <div className="w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-zinc-800 bg-zinc-950 flex items-center justify-center rotate-6 relative">
                          <img
                            src={getBasicLandImage(type)}
                            className="w-full h-full object-contain"
                            alt={type}
                          />
                          <span className="absolute bottom-1 right-1 bg-amber-600 text-white text-[7px] font-black px-1 rounded shadow">
                            TAP
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 text-center truncate w-full">
                          {type}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Special Lands */}
              {specialLands.map((s, idx) => {
                const card = deck.find(c => c.id === s.cardId || c.name === s.name);
                return (
                  <div
                    key={`special-land-${idx}`}
                    className={`flex flex-col items-center p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg w-[7.5rem] relative ${
                      s.tapped ? 'opacity-65' : ''
                    }`}
                    onClick={() => card && onCardClick(card)}
                  >
                    <div
                      className={`w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-zinc-800 relative bg-zinc-950 flex items-center justify-center cursor-pointer ${
                        s.tapped ? 'rotate-6' : ''
                      }`}
                    >
                      {card?.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          className="w-full h-full object-contain"
                          alt={s.name}
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 text-[9px] text-zinc-400 flex items-center justify-center p-1 text-center font-semibold">
                          {s.name}
                        </div>
                      )}
                      {s.tapped && (
                        <span className="absolute bottom-1 right-1 bg-amber-600 text-white text-[7px] font-black px-1 rounded shadow">
                          TAP
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-300 text-center truncate w-full">
                      {s.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Artifacts, Tokens & Permanents Section */}
        {hasAnyNonLands && (
          <div>
            <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 border-b border-zinc-900 pb-1">
              Artifacts, Tokens & Permanents
            </h5>
            <div className="flex flex-wrap gap-3">
              {/* Commander */}
              {state.commanderCast && commanderCard && (
                <div
                  className="flex flex-col items-center p-2 bg-amber-950/25 border border-amber-500/50 rounded-lg w-[7.5rem] relative shadow-[0_0_15px_rgba(245,158,11,0.18)]"
                  onClick={() => onCardClick(commanderCard)}
                >
                  <div className="w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-amber-500/40 relative bg-zinc-950 flex items-center justify-center cursor-pointer">
                    {commanderCard.imageUrl ? (
                      <img
                        src={commanderCard.imageUrl}
                        className="w-full h-full object-contain"
                        alt={commanderCard.name}
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 text-[9px] text-zinc-400 flex items-center justify-center p-1 text-center">
                        {commanderCard.name}
                      </div>
                    )}
                    <span className="absolute top-1 right-1 bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded shadow flex items-center gap-0.5">
                      <CrownIcon className="w-2.5 h-2.5" /> CMD
                    </span>
                    {(state.commanderCounters || 0) > 0 && (
                      <span className="absolute bottom-1 left-1 bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                        +{state.commanderCounters}/+{state.commanderCounters}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-amber-400 text-center truncate w-full">
                    {commanderCard.name}
                  </span>
                </div>
              )}

              {/* Special Non-Lands (Creatures, Artifacts, Enchantments) */}
              {specialNonLands.map((s, idx) => {
                const card = deck.find(c => c.id === s.cardId || c.name === s.name);
                return (
                  <div
                    key={`non-land-${idx}`}
                    className={`flex flex-col items-center p-2 bg-zinc-900/60 border border-zinc-800 rounded-lg w-[7.5rem] relative ${
                      s.tapped ? 'opacity-65' : ''
                    }`}
                    onClick={() => card && onCardClick(card)}
                  >
                    <div
                      className={`w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-zinc-800 relative bg-zinc-950 flex items-center justify-center cursor-pointer ${
                        s.tapped ? 'rotate-6' : ''
                      }`}
                    >
                      {card?.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          className="w-full h-full object-contain"
                          alt={s.name}
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 text-[9px] text-zinc-400 flex items-center justify-center p-1 text-center font-semibold">
                          {s.name}
                        </div>
                      )}
                      {s.hasSummoningSickness && s.isCreature && (
                        <span className="absolute top-1 left-1 bg-purple-600 text-white text-[7.5px] font-bold px-1 rounded shadow">
                          💤 SICK
                        </span>
                      )}
                      {(s.counters || 0) > 0 && (
                        <span className="absolute bottom-1 left-1 bg-emerald-500 text-black text-[8.5px] font-black px-1.5 py-0.5 rounded shadow">
                          +{s.counters}/+{s.counters}
                        </span>
                      )}
                      {s.tapped && (
                        <span className="absolute bottom-1 right-1 bg-amber-600 text-white text-[7px] font-black px-1 rounded shadow">
                          TAP
                        </span>
                      )}
                      {s.enchantments.length > 0 && (
                        <span className="absolute top-1 right-1 bg-green-600 text-white text-[7.5px] font-bold px-1 rounded shadow">
                          +{s.enchantments.length}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-300 text-center truncate w-full">
                      {s.name}
                    </span>
                  </div>
                );
              })}

              {/* Treasure Tokens */}
              {treasureTokens.length > 0 && (
                <TreasureTokenCard
                  count={treasureTokens.length}
                  tapped={treasureTokens.every(t => t.tapped)}
                />
              )}

              {/* 1/1 Gnome Artifact Creature Tokens */}
              {(state.gnomeTokens || 0) > 0 && (
                <GnomeTokenCard count={state.gnomeTokens || 0} />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="flex flex-col w-full max-w-[96vw] xl:max-w-[1550px] h-[92vh] bg-zinc-950/95 border border-amber-800/60 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(212,175,55,0.2)]">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3.5 bg-zinc-950/90 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/25 shrink-0">
              <SparklesIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                MTG Goldfish Simulator
              </h2>
              <p className="text-xs text-zinc-400">
                Parallel Universes Timeline Explorer &amp; Monte Carlo Velocity Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
            aria-label="Close simulator"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </header>

        {/* Commander Selection Screen if not set */}
        {!commanderCard ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <CrownIcon className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-white mb-2">No Commander Set</h3>
            <p className="text-sm text-zinc-400 max-w-md mb-6">
              To calculate goldfish timelines and statistics, select a Legendary Creature or Planeswalker from your decklist:
            </p>

            {potentialCommanders.length === 0 ? (
              <div className="text-red-400 border border-red-500/30 bg-red-950/20 px-4 py-3 rounded-md text-sm font-semibold max-w-md">
                No Legendary Creatures or Planeswalkers found in your deck list. Add one first to simulate!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-2xl w-full">
                {potentialCommanders.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onSetCommander(c)}
                    className="flex flex-col items-center p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/50 rounded-lg text-left transition-all hover:scale-105"
                  >
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        className="w-20 h-28 object-contain rounded-md shadow-md mb-2"
                        alt={c.name}
                      />
                    ) : (
                      <div className="w-20 h-28 bg-zinc-800 rounded-md flex items-center justify-center text-xs text-zinc-500 mb-2 border border-zinc-700">
                        No Image
                      </div>
                    )}
                    <span className="text-xs font-semibold text-zinc-200 text-center line-clamp-1 w-full">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Main Dashboard */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Controls / Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-zinc-900/60 border-b border-zinc-800/60">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('explorer')}
                  className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'explorer'
                      ? 'bg-amber-600 text-white shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  Parallel Universes
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`px-4 py-2 rounded-md text-xs sm:text-sm font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'stats'
                      ? 'bg-amber-600 text-white shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  Monte Carlo Stats
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md">
                  <span className="text-zinc-400 text-xs">Commander:</span>
                  <span className="font-semibold text-amber-400 flex items-center gap-1 text-xs sm:text-sm">
                    <CrownIcon className="w-3.5 h-3.5" /> {commanderCard.name}
                  </span>
                </div>
                {isSimulating && (
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold animate-pulse text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Calculating...
                  </div>
                )}
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 min-h-0 relative">
              {isSimulating && (
                <div className="absolute inset-0 bg-black/55 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                  <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm font-mono text-amber-400 animate-pulse tracking-widest uppercase">
                    Executing Timelines...
                  </p>
                </div>
              )}

              {/* TAB 1: PARALLEL UNIVERSES EXPLORER */}
              {activeTab === 'explorer' && (
                <div className="h-full overflow-y-auto p-5 space-y-5 custom-scrollbar">
                  {/* Top Opening Hand Action Bar */}
                  <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider">
                          Opening Hand ({effectiveHand.length} Cards)
                        </h3>
                        <span className="text-xs text-zinc-500">
                          Click a card to inspect, or Swap ⇄ to test alternate 7-card hands
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleLoadExampleHand}
                          className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-md text-xs font-bold text-amber-300 transition-all"
                        >
                          ⚡ Example Hand: Strike It Rich (T2)
                        </button>
                        <button
                          onClick={handleDrawRandom7}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-xs font-bold text-zinc-200 transition-all"
                        >
                          🎲 Draw Random 7
                        </button>
                        <button
                          onClick={() => setAllowLibraryDraws(prev => !prev)}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
                            allowLibraryDraws
                              ? 'bg-sky-950/60 border-sky-500/50 text-sky-300'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                          }`}
                        >
                          {allowLibraryDraws
                            ? '🃏 + Simulated Draws'
                            : '🔒 Pure Opening 7 (Deterministic)'}
                        </button>
                        <button
                          onClick={() =>
                            setViewMode(prev =>
                              prev === 'parallel-grid' ? 'turn-detail' : 'parallel-grid'
                            )
                          }
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-xs font-bold text-zinc-200 transition-all"
                        >
                          {viewMode === 'parallel-grid'
                            ? '🌌 Parallel Matrix'
                            : '🔍 Turn-by-Turn Inspector'}
                        </button>
                      </div>
                    </div>

                    {effectiveHand.length === 0 ? (
                      <div className="py-8 text-center border border-dashed border-zinc-800 rounded-lg text-sm text-zinc-400">
                        No opening hand loaded yet. Click{' '}
                        <button
                          onClick={handleLoadExampleHand}
                          className="text-amber-400 underline font-semibold"
                        >
                          ⚡ Example Hand
                        </button>{' '}
                        or{' '}
                        <button
                          onClick={handleDrawRandom7}
                          className="text-amber-400 underline font-semibold"
                        >
                          🎲 Draw Random 7
                        </button>
                        .
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {compiledHandMap.map(({ card, role }, idx) => {
                          const isEarlyPlay = earlyUsedCardNames.has(
                            card.name.toLowerCase()
                          );
                          const isSwapping = swapSlotIdx === idx;
                          return (
                            <div
                              key={`${card.id}-${idx}`}
                              className="relative flex flex-col items-center bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-2"
                            >
                              {/* Role Badge */}
                              <span
                                className={`mb-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border truncate max-w-full ${role.className}`}
                              >
                                {role.label}
                              </span>

                              {/* Card Thumbnail */}
                              <div
                                onClick={() => onCardClick(card)}
                                className={`w-full aspect-[5/7] max-w-[115px] rounded-md overflow-hidden cursor-pointer transition-all hover:scale-105 ${
                                  isEarlyPlay
                                    ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.45)]'
                                    : 'border border-zinc-800 hover:border-zinc-600'
                                }`}
                                title={card.name}
                              >
                                {card.imageUrl ? (
                                  <img
                                    src={card.imageUrl}
                                    alt={card.name}
                                    className="w-full h-full object-contain bg-zinc-950"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-zinc-900 text-xs text-zinc-300 flex items-center justify-center p-2 text-center font-bold">
                                    {card.name}
                                  </div>
                                )}
                              </div>

                              <div className="mt-1.5 w-full flex items-center justify-between gap-1">
                                <span className="text-[11px] font-semibold text-zinc-300 truncate">
                                  {card.name}
                                </span>
                                <button
                                  onClick={() => {
                                    setSwapSlotIdx(isSwapping ? null : idx);
                                    setSwapSearch('');
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 border transition-colors ${
                                    isSwapping
                                      ? 'bg-amber-600 text-white border-amber-400'
                                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                                  }`}
                                >
                                  Swap ⇄
                                </button>
                              </div>

                              {/* Inline Searchable Swap Dropdown */}
                              {isSwapping && (
                                <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-zinc-950 border border-amber-500/60 rounded-lg shadow-2xl p-2 min-w-[210px]">
                                  <input
                                    type="text"
                                    value={swapSearch}
                                    onChange={e => setSwapSearch(e.target.value)}
                                    placeholder="Search deck card..."
                                    autoFocus
                                    className="w-full px-2 py-1 mb-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white outline-none focus:border-amber-400"
                                  />
                                  <div className="max-h-44 overflow-y-auto space-y-0.5 custom-scrollbar">
                                    {swappableDeckCards.map(deckCard => (
                                      <button
                                        key={deckCard.id}
                                        onClick={() => handleSwapCard(idx, deckCard)}
                                        className="w-full text-left px-2 py-1 rounded text-[11px] text-zinc-200 hover:bg-amber-600/30 hover:text-amber-200 truncate flex items-center justify-between"
                                      >
                                        <span className="truncate">{deckCard.name}</span>
                                        <span className="text-[9px] text-zinc-500 ml-1">
                                          {deckCard.manaCostString || ''}
                                        </span>
                                      </button>
                                    ))}
                                    {swappableDeckCards.length === 0 && (
                                      <div className="text-[11px] text-zinc-500 px-2 py-1">
                                        No matching cards
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Hand Verdict Strip */}
                  {parallelAnalysis && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-black flex-shrink-0 ${
                              GRADE_STYLES[parallelAnalysis.handGrade]
                            }`}
                          >
                            {parallelAnalysis.handGrade}
                          </div>
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                              Opening Hand Verdict
                            </div>
                            <div className="text-sm sm:text-base font-bold text-white">
                              {parallelAnalysis.handVerdict}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs">
                          <div className="px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-lg">
                            <span className="text-zinc-400 block">Fastest Commander</span>
                            <span className="text-amber-300 font-black text-sm">
                              {parallelAnalysis.fastestCommanderTurn
                                ? `Turn ${parallelAnalysis.fastestCommanderTurn}`
                                : 'Unreachable (T4)'}
                            </span>
                          </div>
                          <div className="px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-lg">
                            <span className="text-zinc-400 block">Natural Baseline</span>
                            <span className="text-purple-300 font-black text-sm">
                              {parallelAnalysis.naturalBaselineTurn
                                ? `Turn ${parallelAnalysis.naturalBaselineTurn}`
                                : 'T5+'}
                            </span>
                          </div>
                          <div className="px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-lg">
                            <span className="text-zinc-400 block">T2 Mana Ceiling</span>
                            <span className="text-emerald-300 font-black text-sm">
                              {parallelAnalysis.manaCeilingTurn2} Mana
                            </span>
                          </div>
                          <div className="px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-lg">
                            <span className="text-zinc-400 block">T3 Mana Ceiling</span>
                            <span className="text-sky-300 font-black text-sm">
                              {parallelAnalysis.manaCeilingTurn3} Mana
                            </span>
                          </div>
                        </div>
                      </div>

                      {parallelAnalysis.topdeckNote && (
                        <div className="px-4 py-2.5 bg-rose-950/35 border border-rose-500/40 rounded-lg text-xs sm:text-sm text-rose-200 flex items-center gap-2">
                          <span className="font-black text-rose-400">🎯 Topdeck Odds:</span>
                          <span>{parallelAnalysis.topdeckNote}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Universe Selector Cards */}
                  {parallelAnalysis && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      {parallelAnalysis.universes.map(u => {
                        const style = UNIVERSE_ACCENT_STYLES[u.accentColor];
                        const isSelected = selectedUniverse?.id === u.id;
                        return (
                          <button
                            key={u.id}
                            onClick={() => setSelectedUniverseId(u.id)}
                            className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                              isSelected
                                ? style.activeBg
                                : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${style.badge}`}
                                >
                                  {u.badge}
                                </span>
                                <span className="text-[11px] font-bold text-zinc-400">
                                  {u.commanderCastTurn
                                    ? `CMD T${u.commanderCastTurn}`
                                    : 'No CMD'}
                                </span>
                              </div>
                              <h4 className={`text-sm font-black ${style.text}`}>
                                {u.title}
                              </h4>
                              <p className="text-xs text-zinc-300 mt-0.5 line-clamp-2">
                                {u.subtitle}
                              </p>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-zinc-800/80 text-[11px]">
                              <div>
                                <span className="text-zinc-500 block">T3 Power</span>
                                <span className="font-bold text-white">
                                  {u.totalBoardPowerTurn3}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block">Treasures</span>
                                <span className="font-bold text-amber-300">
                                  {u.treasuresCreated}
                                </span>
                              </div>
                              <div>
                                <span className="text-zinc-500 block">Gnomes T3</span>
                                <span className="font-bold text-sky-300">
                                  {u.gnomeTokensTurn3}
                                </span>
                              </div>
                            </div>

                            <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">
                              {u.whyThisUniverseMatters}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Parallel Universe Matrix (when in parallel-grid mode) */}
                  {parallelAnalysis && viewMode === 'parallel-grid' && (
                    <div className="bg-zinc-900/35 border border-zinc-800/80 rounded-xl p-4 overflow-x-auto">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-extrabold text-amber-400 uppercase tracking-wider">
                          Parallel Universe Matrix (Turns 1–{Math.max(...parallelAnalysis.universes.map(u => u.turns.length), 3)})
                        </h3>
                        <span className="text-xs text-zinc-400">
                          Click any cell to inspect its causal chain &amp; end-of-turn battlefield below
                        </span>
                      </div>

                      <div className="min-w-[780px] space-y-2">
                        {/* Matrix Header */}
                        <div className="grid grid-cols-12 gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-2">
                          <div className="col-span-3">Universe Line</div>
                          {[1, 2, 3, 4].map(tNum => (
                            <div key={tNum} className="col-span-2">
                              Turn {tNum}
                            </div>
                          ))}
                          <div className="col-span-1 text-right">T3 Board</div>
                        </div>

                        {/* Matrix Rows */}
                        {parallelAnalysis.universes.map(u => {
                          const style = UNIVERSE_ACCENT_STYLES[u.accentColor];
                          const isRowSelected = selectedUniverse?.id === u.id;
                          return (
                            <div
                              key={u.id}
                              className={`grid grid-cols-12 gap-2 p-2 rounded-lg border transition-all ${
                                isRowSelected
                                  ? 'bg-zinc-900/90 border-amber-500/40'
                                  : 'bg-zinc-950/60 border-zinc-800/60'
                              }`}
                            >
                              <button
                                onClick={() => setSelectedUniverseId(u.id)}
                                className="col-span-3 text-left flex flex-col justify-center pr-2"
                              >
                                <span className={`text-xs font-extrabold ${style.text}`}>
                                  {u.title}
                                </span>
                                <span className="text-[11px] text-zinc-400 mt-0.5">
                                  {u.badge}
                                </span>
                              </button>

                              {[1, 2, 3, 4].map(tNum => {
                                const step = u.turns.find(t => t.turn === tNum);
                                const isCellActive =
                                  isRowSelected && selectedTurnNum === tNum;
                                return (
                                  <button
                                    key={tNum}
                                    onClick={() => {
                                      setSelectedUniverseId(u.id);
                                      if (step) setSelectedTurnNum(tNum);
                                    }}
                                    className={`col-span-2 text-left p-2 rounded-md border text-[11px] transition-all flex flex-col justify-between ${
                                      isCellActive
                                        ? 'bg-amber-950/50 border-amber-400 text-white'
                                        : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-600 text-zinc-300'
                                    }`}
                                  >
                                    {step ? (
                                      <>
                                        <div className="space-y-0.5">
                                          {step.actions.length > 0 ? (
                                            step.actions.slice(0, 3).map((a, aIdx) => (
                                              <div
                                                key={aIdx}
                                                className="truncate font-semibold"
                                              >
                                                • {a.headline}
                                              </div>
                                            ))
                                          ) : (
                                            <span className="text-zinc-500 italic">
                                              Pass turn
                                            </span>
                                          )}
                                          {step.actions.length > 3 && (
                                            <div className="text-[10px] text-zinc-400">
                                              +{step.actions.length - 3} more
                                            </div>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-zinc-400 mt-1 truncate block">
                                          {step.manaSummary}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-zinc-600 italic">—</span>
                                    )}
                                  </button>
                                );
                              })}

                              <div className="col-span-1 flex flex-col items-end justify-center text-xs font-bold">
                                <span className="text-white">
                                  {u.totalBoardPowerTurn3} Pwr
                                </span>
                                <span className="text-[10px] text-sky-300">
                                  {u.gnomeTokensTurn3} Gnm
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Selected Universe Turn-by-Turn Causal Breakdown & Visual Battlefield */}
                  {selectedUniverse && (
                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-extrabold border ${
                                UNIVERSE_ACCENT_STYLES[selectedUniverse.accentColor].badge
                              }`}
                            >
                              {selectedUniverse.badge}
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-white">
                              {selectedUniverse.title}
                            </h3>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">
                            {selectedUniverse.whyThisUniverseMatters}
                          </p>
                        </div>

                        {/* Turn Selector Tabs */}
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUniverse.turns.map(step => (
                            <button
                              key={step.turn}
                              onClick={() => setSelectedTurnNum(step.turn)}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                selectedTurnStep?.turn === step.turn
                                  ? 'bg-amber-600 border-amber-400 text-white shadow'
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                              }`}
                            >
                              Turn {step.turn}
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedTurnStep && (
                        <div className="space-y-4">
                          {/* Turn Takeaway & Mana Summary */}
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                                Turn {selectedTurnStep.turn} Takeaway
                              </span>
                              <span className="text-sm font-semibold text-zinc-100">
                                {selectedTurnStep.turnTakeaway}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                                Mana State
                              </span>
                              <span className="text-xs font-bold text-emerald-300">
                                {selectedTurnStep.manaSummary}
                              </span>
                            </div>
                          </div>

                          {/* Causal Actions List */}
                          <div className="space-y-2.5">
                            {selectedTurnStep.actions.length === 0 ? (
                              <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg text-sm text-zinc-500 italic">
                                No playable actions on Turn {selectedTurnStep.turn}.
                              </div>
                            ) : (
                              selectedTurnStep.actions.map((action, aIdx) => {
                                const card = resolveCardForAction(action);
                                const usedTreasure =
                                  (action.sacrificedTokens &&
                                    action.sacrificedTokens.length > 0) ||
                                  action.manaPayment.toLowerCase().includes('treasure');
                                return (
                                  <div
                                    key={aIdx}
                                    className="flex flex-col sm:flex-row sm:items-center gap-3.5 p-3.5 bg-zinc-950/80 border border-zinc-800/80 rounded-xl hover:border-amber-500/35 transition-colors"
                                  >
                                    {/* Thumbnail */}
                                    <div
                                      onClick={() => card && onCardClick(card)}
                                      className={`w-14 h-20 rounded overflow-hidden border border-zinc-700 flex-shrink-0 bg-zinc-900 flex items-center justify-center ${
                                        card ? 'cursor-pointer hover:border-amber-400' : ''
                                      }`}
                                      title={card ? `Inspect ${card.name}` : action.cardName}
                                    >
                                      {card?.imageUrl ? (
                                        <img
                                          src={card.imageUrl}
                                          alt={action.cardName}
                                          className="w-full h-full object-contain"
                                        />
                                      ) : (
                                        <span className="text-[10px] text-zinc-400 text-center p-1 font-bold">
                                          {action.cardName}
                                        </span>
                                      )}
                                    </div>

                                    {/* Causal Details */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-extrabold text-white">
                                          {action.headline}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                                          {action.outcomeBadge}
                                        </span>
                                        {usedTreasure && (
                                          <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-400/50 text-yellow-200 text-[11px] font-bold">
                                            🪙 Sacrificed Treasure
                                          </span>
                                        )}
                                      </div>

                                      <div className="text-xs text-zinc-300">
                                        <span className="text-zinc-500 font-semibold">
                                          Payment:{' '}
                                        </span>
                                        <span
                                          className={
                                            usedTreasure
                                              ? 'text-amber-300 font-semibold'
                                              : 'text-zinc-300'
                                          }
                                        >
                                          {action.manaPayment}
                                        </span>
                                      </div>

                                      <p className="text-xs text-zinc-400 leading-relaxed">
                                        <span className="text-sky-400 font-semibold">
                                          Why:{' '}
                                        </span>
                                        {action.causalWhy}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Visual Battlefield at End of Turn */}
                          {renderVisualBattlefield(
                            selectedTurnStep.stateAtEndOfTurn,
                            selectedTurnStep.actions
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MONTE CARLO STATS */}
              {activeTab === 'stats' && mcResult && (
                <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col items-center text-center shadow-lg">
                      <span className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Avg Casting Turn
                      </span>
                      <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                        {mcResult.averageTurn > 7
                          ? '7.0+'
                          : mcResult.averageTurn.toFixed(2)}
                      </span>
                      <span className="text-[12px] text-zinc-300 mt-2">
                        Optimal cast turn across {mcResult.totalRuns} runs
                      </span>
                    </div>

                    <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col items-center text-center shadow-lg">
                      <span className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Casting Success Rate
                      </span>
                      <span className="text-4xl font-extrabold text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                        {(mcResult.successRate * 100).toFixed(1)}%
                      </span>
                      <span className="text-[12px] text-zinc-300 mt-2">
                        Castable by Turn 7 or earlier
                      </span>
                    </div>

                    <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col items-center justify-between shadow-lg">
                      <div className="flex flex-col items-center w-full">
                        <span className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                          Sim Runs
                        </span>
                        <select
                          value={mcRuns}
                          onChange={e => setMcRuns(Number(e.target.value))}
                          className="bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 rounded px-2 py-1 text-[13px] outline-none text-zinc-200 w-full text-center"
                        >
                          <option value={100}>100 Runs (Fast)</option>
                          <option value={300}>300 Runs (Standard)</option>
                          <option value={1000}>1000 Runs (Deep)</option>
                        </select>
                      </div>
                      <button
                        onClick={handleReRunMC}
                        className="w-full mt-2 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-[13px] font-bold transition-all text-white active:scale-95 shadow-md"
                      >
                        Re-run Stats
                      </button>
                    </div>
                  </div>

                  {/* Distribution Chart */}
                  <div className="p-5 bg-zinc-900/20 border border-zinc-800/40 rounded-xl">
                    <h3 className="text-[16px] font-extrabold text-amber-400 mb-4 uppercase tracking-wider">
                      Turn Cast Distribution
                    </h3>
                    <div className="space-y-3.5">
                      {(() => {
                        const list: { turn: number; percent: number; count: number }[] = [];
                        let failCount = 0;

                        Object.entries(mcResult.distribution).forEach(
                          ([turnStr, count]) => {
                            const turn = Number(turnStr);
                            const countNum = count as number;
                            if (turn > 7) {
                              failCount += countNum;
                            } else {
                              list.push({
                                turn,
                                count: countNum,
                                percent:
                                  mcResult.totalRuns > 0
                                    ? (countNum / mcResult.totalRuns) * 100
                                    : 0,
                              });
                            }
                          }
                        );

                        list.sort((a, b) => a.turn - b.turn);

                        if (failCount > 0) {
                          list.push({
                            turn: 8,
                            count: failCount,
                            percent:
                              mcResult.totalRuns > 0
                                ? (failCount / mcResult.totalRuns) * 100
                                : 0,
                          });
                        }

                        return list.map(({ turn, percent }) => {
                          const isFail = turn > 7;
                          return (
                            <div key={turn} className="flex items-center gap-4">
                              <span className="w-16 text-right text-[14px] font-bold text-zinc-200">
                                {isFail ? 'Turn 8+' : `Turn ${turn}`}
                              </span>
                              <div className="flex-1 bg-zinc-900 rounded-full h-4 overflow-hidden border border-zinc-800">
                                <div
                                  style={{ width: `${percent}%` }}
                                  className={`h-full rounded-full transition-all duration-700 ease-out relative ${
                                    isFail
                                      ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_5px_rgba(239,68,68,0.4)]'
                                      : 'bg-gradient-to-r from-amber-500 to-amber-600 shadow-[0_0_5px_rgba(212,175,55,0.4)]'
                                  }`}
                                >
                                  {percent > 5 && (
                                    <span className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-black text-white">
                                      {percent.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              {percent <= 5 && (
                                <span className="w-12 text-left text-[11px] font-bold text-zinc-300">
                                  {percent.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Key Early Accelerators Impact */}
                  {mcResult.acceleratorStats && mcResult.acceleratorStats.length > 0 && (
                    <div className="p-5 bg-zinc-900/30 border border-zinc-800/60 rounded-xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[16px] font-extrabold text-amber-400 uppercase tracking-wider">
                          Key Early Accelerators Impact
                        </h3>
                        <span className="text-xs text-zinc-400">
                          Impact on Commander cast turn when present in opening 7
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {mcResult.acceleratorStats.map(stat => {
                          const delta = stat.baselineAvgTurn - stat.avgTurnWithCard;
                          const matchedCard = deck.find(
                            c => c.name.toLowerCase() === stat.cardName.toLowerCase()
                          );
                          return (
                            <div
                              key={stat.cardName}
                              onClick={() => matchedCard && onCardClick(matchedCard)}
                              className={`p-3.5 bg-zinc-950/75 border border-zinc-800 rounded-lg flex flex-col gap-2 ${
                                matchedCard
                                  ? 'cursor-pointer hover:border-amber-500/50 transition-colors'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-white truncate">
                                  {stat.cardName}
                                </span>
                                <span className="text-[11px] font-bold text-zinc-400 flex-shrink-0">
                                  {stat.handsWithCard} hands
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-zinc-500 block">Avg Turn</span>
                                  <span className="font-extrabold text-amber-300">
                                    T{stat.avgTurnWithCard.toFixed(2)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block">T2 Cast %</span>
                                  <span className="font-extrabold text-emerald-400">
                                    {(stat.turn2RateWithCard * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block">vs Baseline</span>
                                  <span
                                    className={`font-extrabold ${
                                      delta > 0 ? 'text-emerald-400' : 'text-zinc-400'
                                    }`}
                                  >
                                    {delta >= 0
                                      ? `-${delta.toFixed(2)}T`
                                      : `+${Math.abs(delta).toFixed(2)}T`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Simulator Overview */}
                  <div className="p-4 bg-amber-950/15 border border-amber-800/25 rounded-xl text-[13px] text-zinc-300 space-y-2">
                    <h4 className="font-bold text-[15px] text-amber-400">
                      Deterministic Rules &amp; Pathfinding Model
                    </h4>
                    <p>
                      The Monte Carlo loop shuffles the remaining 99 cards in the library, draws a starting 7, and uses a breadth-first search pathfinder across lands, Treasure acceleration, Dash/attack triggers, Flashback spells, mana rocks, mana dorks, and land-ramp spells.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
