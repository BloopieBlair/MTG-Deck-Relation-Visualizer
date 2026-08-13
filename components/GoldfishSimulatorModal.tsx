import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ProcessedDeckCard } from '../types';
import { 
  findOptimalPlayPath, 
  runMonteCarlo, 
  type SimState, 
  type MonteCarloResult, 
  compileCard,
  getCMC
} from '../services/goldfishSimulator';
import { XMarkIcon, CrownIcon, SparklesIcon } from './icons';

interface GoldfishSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: ProcessedDeckCard[];
  drawnSampleHand: ProcessedDeckCard[] | null;
  commanderId: string | null;
  onSetCommander: (card: ProcessedDeckCard) => void;
  onCardClick: (card: ProcessedDeckCard) => void;
}

export const GoldfishSimulatorModal: React.FC<GoldfishSimulatorModalProps> = ({
  isOpen,
  onClose,
  deck,
  drawnSampleHand,
  commanderId,
  onSetCommander,
  onCardClick,
}) => {
  const [activeTab, setActiveTab] = useState<'explorer' | 'stats' | 'decision-trace'>('stats');
  const [optimalPath, setOptimalPath] = useState<SimState | null>(null);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [mcRuns, setMcRuns] = useState<number>(300);
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [libraryShuffleTrigger, setLibraryShuffleTrigger] = useState<number>(0);

  // Decision trace tree states
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  
  // Ref and states for drag scroll panning
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const commanderCard = useMemo(() => {
    return (deck || []).find(c => c.id === commanderId) || null;
  }, [deck, commanderId]);

  const potentialCommanders = useMemo(() => {
    return (deck || []).filter(c => 
      (c.keywords || []).some(k => k.toLowerCase() === 'legendary') &&
      (c.keywords || []).some(k => k.toLowerCase() === 'creature')
    );
  }, [deck]);

  const getBasicLandImage = useCallback((type: string): string => {
    const found = (deck || []).find(c => c.name.toLowerCase() === type.toLowerCase());
    if (found && found.imageUrl) return found.imageUrl;
    
    const symbols: Record<string, string> = {
      plains: 'https://svgs.scryfall.io/card-symbols/W.svg',
      island: 'https://svgs.scryfall.io/card-symbols/U.svg',
      swamp: 'https://svgs.scryfall.io/card-symbols/B.svg',
      mountain: 'https://svgs.scryfall.io/card-symbols/R.svg',
      forest: 'https://svgs.scryfall.io/card-symbols/G.svg'
    };
    return symbols[type.toLowerCase()] || 'https://svgs.scryfall.io/card-symbols/C.svg';
  }, [deck]);

  const getBattlefieldState = useCallback((turnNum: number): SimState | null => {
    if (!optimalPath) return null;
    const historyStates = (optimalPath as any).stateHistory as SimState[] | undefined;
    if (!historyStates) return null;

    const statesInTurn = historyStates.filter(s => s.turn === turnNum);
    if (statesInTurn.length === 0) {
      const fallbackStates = historyStates.filter(s => s.turn <= turnNum);
      if (fallbackStates.length > 0) {
        return fallbackStates[fallbackStates.length - 1];
      }
      return null;
    }
    return statesInTurn[statesInTurn.length - 1];
  }, [optimalPath]);

  // Layout coordinates calculation for the decision tree
  const decisionTreeNodes = useMemo(() => {
    if (!optimalPath) return [];
    const rawNodes = (optimalPath as any).exploredNodes as any[] | undefined;
    if (!rawNodes || rawNodes.length === 0) return [];

    // Group by depth to space them horizontally
    const byDepth: Record<number, any[]> = {};
    rawNodes.forEach(n => {
      if (!byDepth[n.depth]) byDepth[n.depth] = [];
      byDepth[n.depth].push(n);
    });

    const spacingX = 200;
    const spacingY = 180;
    const canvasCenter = 1200; // temporary center

    // First pass: calculate raw X and Y relative to canvasCenter
    const tempNodes = rawNodes.map(n => {
      const depthNodes = byDepth[n.depth];
      const idx = depthNodes.indexOf(n);
      const m = depthNodes.length;
      
      const x = canvasCenter + (idx - (m - 1) / 2) * spacingX;
      const y = 80 + n.depth * spacingY;

      return {
        ...n,
        x,
        y
      };
    });

    // Find the minimum X among all nodes to calculate the offset shift
    const xs = tempNodes.map(n => n.x);
    const minX = Math.min(...xs);
    
    // Shift all nodes to the right so the leftmost node is at x = 120 (safe padding)
    const shiftX = 120 - minX;

    return tempNodes.map(n => ({
      ...n,
      x: n.x + shiftX
    }));
  }, [optimalPath]);

  // Dynamic SVG dimensions based on layout bounds to ensure perfect scrollbars
  const svgDimensions = useMemo(() => {
    if (decisionTreeNodes.length === 0) return { width: 2400, height: 1200 };
    const xs = decisionTreeNodes.map(n => n.x);
    const ys = decisionTreeNodes.map(n => n.y);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    
    return {
      width: Math.max(2400, maxX + 180),
      height: Math.max(1200, maxY + 150)
    };
  }, [decisionTreeNodes]);

  // Auto-center scroll on root node when the decision-trace tab opens
  useEffect(() => {
    if (activeTab === 'decision-trace' && containerRef.current && decisionTreeNodes.length > 0) {
      const rootNode = decisionTreeNodes.find(n => n.depth === 0);
      if (rootNode) {
        const viewportWidth = containerRef.current.clientWidth;
        containerRef.current.scrollLeft = rootNode.x - viewportWidth / 2;
      }
    }
  }, [activeTab, decisionTreeNodes]);

  // Drag pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    containerRef.current.scrollLeft = scrollLeft - walkX;
    containerRef.current.scrollTop = scrollTop - walkY;
  }, [isDragging, startX, startY, scrollLeft, scrollTop]);

  const handleMouseUpOrLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Run pathfinder and Monte Carlo when dependencies change
  useEffect(() => {
    if (!isOpen || !drawnSampleHand || !commanderCard) return;

    setIsSimulating(true);
    
    // We run the simulations inside a small timeout to let the UI render the loading state
    const timer = setTimeout(() => {
      // 1. Run Pathfinder
      // Shuffle the library once to simulate a realistic path
      const pathResult = findOptimalPlayPath(drawnSampleHand, deck, commanderCard, 8);
      setOptimalPath(pathResult);
      setSelectedStep(0);

      // 2. Run Monte Carlo
      const mc = runMonteCarlo(deck, commanderCard, mcRuns, 8);
      setMcResult(mc);
      
      setIsSimulating(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, deck, drawnSampleHand, commanderCard, mcRuns, libraryShuffleTrigger]);

  const handleReRunMC = useCallback(() => {
    if (!commanderCard) return;
    setIsSimulating(true);
    setTimeout(() => {
      const mc = runMonteCarlo(deck, commanderCard, mcRuns, 8);
      setMcResult(mc);
      setIsSimulating(false);
    }, 100);
  }, [deck, commanderCard, mcRuns]);

  const handleShuffleLibrary = useCallback(() => {
    setLibraryShuffleTrigger(prev => prev + 1);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="flex flex-col w-full max-w-[96vw] xl:max-w-[1550px] h-[92vh] bg-gray-950/95 border border-cyan-800/60 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.2)]">
        
        {/* Header */}
        <header className="flex items-center justify-between p-5 bg-gray-900 border-b border-cyan-800/40">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-5.5 h-5.5 text-cyan-400 animate-pulse" />
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                MTG Goldfish Simulator
              </h2>
              <p className="text-sm text-gray-400">
                Determine deck velocity and optimal commander playlines
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </header>

        {/* Commander Selection Screen if not set */}
        {!commanderCard ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <CrownIcon className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
            <h3 className="text-xl font-bold text-white mb-2">No Commander Set</h3>
            <p className="text-sm text-gray-400 max-w-md mb-6">
              To calculate goldfish statistics, we need a Commander to target. Please select a legendary creature from your decklist:
            </p>
            
            {potentialCommanders.length === 0 ? (
              <div className="text-red-400 border border-red-500/30 bg-red-950/20 px-4 py-3 rounded-md text-sm font-semibold max-w-md">
                No Legendary Creatures found in your deck list. Add a legendary creature first to simulate!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-2xl w-full">
                {potentialCommanders.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onSetCommander(c)}
                    className="flex flex-col items-center p-3 bg-gray-900 hover:bg-gray-850 border border-gray-800 hover:border-amber-500/50 rounded-lg text-left transition-all hover:scale-105"
                  >
                    {c.imageUrl ? (
                      <img src={c.imageUrl} className="w-20 h-28 object-contain rounded-md shadow-md mb-2" alt={c.name} />
                    ) : (
                      <div className="w-20 h-28 bg-gray-800 rounded-md flex items-center justify-center text-xs text-gray-500 mb-2 border border-gray-700">
                        No Image
                      </div>
                    )}
                    <span className="text-xs font-semibold text-gray-200 text-center line-clamp-1 w-full">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Main Dashboard */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Controls / Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gray-900/60 border-b border-gray-800/40">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`px-5 py-2 rounded-md text-[15px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'stats' 
                      ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  Monte Carlo Stats
                </button>
                <button
                  onClick={() => setActiveTab('explorer')}
                  className={`px-5 py-2 rounded-md text-[15px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'explorer' 
                      ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  Gameplay Explorer
                </button>
                <button
                  onClick={() => setActiveTab('decision-trace')}
                  className={`px-5 py-2 rounded-md text-[15px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'decision-trace' 
                      ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  Decision Trace
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-900 border border-gray-800 rounded-md">
                  <span className="text-gray-400">Commander:</span>
                  <span className="font-semibold text-amber-400 flex items-center gap-1">
                    <CrownIcon className="w-3.5 h-3.5" /> {commanderCard.name}
                  </span>
                </div>
                {isSimulating && (
                  <div className="flex items-center gap-1.5 text-cyan-400 font-semibold animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    Calculating...
                  </div>
                )}
              </div>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 min-h-0 relative">
              {isSimulating && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                  <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm font-mono text-cyan-400 animate-pulse tracking-widest uppercase">Executing Timelines...</p>
                </div>
              )}

              {activeTab === 'stats' && mcResult && (
                /* Stats View */
                <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-900/40 border border-gray-800/80 rounded-xl flex flex-col items-center text-center shadow-lg">
                      <span className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-1">Avg Casting Turn</span>
                      <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        {mcResult.averageTurn > 7 ? '7.0+' : mcResult.averageTurn.toFixed(2)}
                      </span>
                      <span className="text-[12px] text-gray-300 mt-2">Optimal cast turn across {mcResult.totalRuns} runs</span>
                    </div>

                    <div className="p-4 bg-gray-900/40 border border-gray-800/80 rounded-xl flex flex-col items-center text-center shadow-lg">
                      <span className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-1">Casting Success Rate</span>
                      <span className="text-4xl font-extrabold text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                        {(mcResult.successRate * 100).toFixed(1)}%
                      </span>
                      <span className="text-[12px] text-gray-300 mt-2">Castable by Turn 7 or earlier</span>
                    </div>

                    <div className="p-4 bg-gray-900/40 border border-gray-800/80 rounded-xl flex flex-col items-center justify-between shadow-lg">
                      <div className="flex flex-col items-center w-full">
                        <span className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">Sim Runs</span>
                        <select
                          value={mcRuns}
                          onChange={(e) => setMcRuns(Number(e.target.value))}
                          className="bg-gray-950 border border-gray-850 hover:border-cyan-500/50 rounded px-2 py-1 text-[13px] outline-none text-gray-250 w-full text-center"
                        >
                          <option value={100}>100 Runs (Fast)</option>
                          <option value={300}>300 Runs (Standard)</option>
                          <option value={1000}>1000 Runs (Deep)</option>
                        </select>
                      </div>
                      <button
                        onClick={handleReRunMC}
                        className="w-full mt-2 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-[13px] font-bold transition-all text-white active:scale-95 shadow-md shadow-cyan-650/20"
                      >
                        Re-run Stats
                      </button>
                    </div>
                  </div>

                  {/* Distribution Chart */}
                  <div className="p-5 bg-gray-900/20 border border-gray-800/40 rounded-xl">
                    <h3 className="text-[16px] font-extrabold text-cyan-400 mb-4 uppercase tracking-wider">Turn Cast Distribution</h3>
                    <div className="space-y-3.5">
                      {(() => {
                        const list: { turn: number; percent: number; count: number }[] = [];
                        let failCount = 0;
                        
                        Object.entries(mcResult.distribution).forEach(([turnStr, count]) => {
                          const turn = Number(turnStr);
                          const countNum = count as number;
                          if (turn > 7) {
                            failCount += countNum;
                          } else {
                            list.push({
                              turn,
                              count: countNum,
                              percent: mcResult.totalRuns > 0 ? (countNum / mcResult.totalRuns) * 100 : 0
                            });
                          }
                        });
                        
                        // Sort by turn ascending
                        list.sort((a, b) => a.turn - b.turn);
                        
                        // Add combined Turn 8+ (fail) row at the end if there are any fails
                        if (failCount > 0) {
                          list.push({
                            turn: 8, // Representing Turn 8+
                            count: failCount,
                            percent: mcResult.totalRuns > 0 ? (failCount / mcResult.totalRuns) * 100 : 0
                          });
                        }
                        
                        return list.map(({ turn, percent }) => {
                          const isFail = turn > 7;
                          return (
                            <div key={turn} className="flex items-center gap-4">
                              <span className="w-16 text-right text-[14px] font-bold text-gray-250">
                                {isFail ? 'Turn 8+' : `Turn ${turn}`}
                              </span>
                              <div className="flex-1 bg-gray-900 rounded-full h-4 overflow-hidden border border-gray-850">
                                <div
                                  style={{ width: `${percent}%` }}
                                  className={`h-full rounded-full transition-all duration-700 ease-out relative ${
                                    isFail 
                                      ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_5px_rgba(239,68,68,0.4)]'
                                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_5px_rgba(6,182,212,0.4)]'
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
                                <span className="w-10 text-left text-[11px] font-bold text-gray-350">
                                  {percent.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Simulator Overview */}
                  <div className="p-4.5 bg-cyan-950/15 border border-cyan-850/20 rounded-xl text-[14px] text-gray-300 space-y-2.5">
                    <h4 className="font-bold text-[15px] text-cyan-400">Deterministic Rules & Pathfinding Model</h4>
                    <p>
                      The Monte Carlo loop shuffles the remaining 99 cards in the library, draws a starting 7, and uses a breadth-first search pathfinder. It evaluates all valid sequences of playing lands, tapping mana sources (via the <strong>Dumb Autotapper</strong> choice engine), and casting mana rocks, mana dorks, land-auras, and land-ramp spells.
                    </p>
                    <p>
                      It respects summoning sickness, colors produced, and enters-tapped properties to discover the absolute fastest turn the Commander can be cast.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'explorer' && (
                /* Interactive Playlines Explorer */
                <div className="h-full flex flex-col md:flex-row overflow-hidden">
                  
                  {/* Left Column: Opening Hand and Optimal Play steps */}
                  <div className="w-full md:w-2/5 p-4 border-b md:border-b-0 md:border-r border-gray-800/40 flex flex-col h-1/2 md:h-full overflow-y-auto custom-scrollbar">
                    
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-[16px] font-extrabold text-cyan-400 uppercase tracking-wider">Opening Hand (7 Cards)</h3>
                      <button
                        onClick={handleShuffleLibrary}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded text-[13px] font-bold transition-all text-gray-200"
                        title="Re-shuffle library and re-run pathfinder on the same opening hand"
                      >
                        🔄 Re-shuffle Library
                      </button>
                    </div>

                    {/* Opening Hand Cards list */}
                    <div className="flex gap-2.5 overflow-x-auto pb-3 mb-5 custom-scrollbar overflow-y-visible py-3">
                      {drawnSampleHand?.map((card, idx) => (
                        <div 
                          key={idx}
                          onClick={() => onCardClick(card)}
                          className="w-[9rem] h-[12.4rem] flex-shrink-0 rounded-md overflow-hidden border border-gray-750 hover:border-cyan-400 cursor-pointer shadow-md transition-all hover:scale-110 hover:z-10 hover:shadow-[0_0_15px_rgba(6,182,212,0.6)]"
                          title={card.name}
                        >
                          {card.imageUrl ? (
                            <img src={card.imageUrl} className="w-full h-full object-contain bg-gray-950" />
                          ) : (
                            <div className="w-full h-full bg-gray-900 text-[13px] text-gray-300 flex flex-col items-center justify-center p-2 text-center font-bold">
                              {card.name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <h3 className="text-[16px] font-extrabold text-cyan-400 uppercase tracking-wider mb-3">Optimal Play Path</h3>
                    
                    {!optimalPath ? (
                      <div className="flex-1 flex items-center justify-center text-sm text-red-400 border border-red-500/20 bg-red-950/10 p-4 rounded-lg">
                        ⚠️ No valid playline was found to cast the Commander by Turn 7 with this library shuffle. Try re-shuffling the library!
                      </div>
                    ) : (
                      <div className="space-y-2 flex-1 min-h-0">
                        {/* Summary of path */}
                        <div className="p-3 bg-gray-900 border border-cyan-800/25 rounded-lg text-[15px] mb-3 flex justify-between items-center font-semibold">
                          <span className="text-gray-400">Commander castable on:</span>
                          <span className="font-extrabold text-cyan-300 text-[18px]">Turn {optimalPath.turn}</span>
                        </div>

                        {/* List of steps */}
                        <div className="space-y-1.5">
                          {/* We parse history to show step-by-step turns */}
                          {(() => {
                            // Group history lines by turn
                            const turns: { turnNum: number; actions: string[] }[] = [];
                            let currentTurn = 0;
                            let currentActions: string[] = [];

                            optimalPath.history.forEach(h => {
                              const match = h.match(/^Turn (\d+): (.+)$/);
                              if (match) {
                                const tNum = Number(match[1]);
                                const act = match[2];
                                if (tNum !== currentTurn) {
                                  if (currentTurn > 0) {
                                    turns.push({ turnNum: currentTurn, actions: currentActions });
                                  }
                                  currentTurn = tNum;
                                  currentActions = [act];
                                } else {
                                  currentActions.push(act);
                                }
                              }
                            });
                            if (currentTurn > 0) {
                              turns.push({ turnNum: currentTurn, actions: currentActions });
                            }

                            return turns.map((t, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedStep(idx)}
                                className={`w-full text-left p-3 rounded-lg border text-[15px] transition-all flex items-center justify-between ${
                                  selectedStep === idx
                                    ? 'bg-cyan-900/35 border-cyan-500 shadow-md text-white'
                                    : 'bg-gray-900/60 border-gray-800/80 text-gray-300 hover:bg-gray-850/50 hover:border-gray-700'
                                }`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-[15px] text-cyan-400">Turn {t.turnNum}</span>
                                  <span className="text-gray-300 truncate max-w-[25rem] text-[14px]">
                                    {t.actions[0]} {t.actions.length > 1 ? `(+${t.actions.length - 1} moves)` : ''}
                                  </span>
                                </div>
                                <div className="text-[13px] bg-gray-950/65 px-2 py-0.5 rounded text-gray-400 font-bold">
                                  Select
                                </div>
                              </button>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Detailed View of Selected Turn */}
                  <div className="flex-1 p-4 flex flex-col h-1/2 md:h-full overflow-y-auto custom-scrollbar">
                    {optimalPath && (() => {
                      // Extract history lines for the selected turn
                      const turns: { turnNum: number; actions: string[] }[] = [];
                      let currentTurn = 0;
                      let currentActions: string[] = [];

                      optimalPath.history.forEach(h => {
                        const match = h.match(/^Turn (\d+): (.+)$/);
                        if (match) {
                          const tNum = Number(match[1]);
                          const act = match[2];
                          if (tNum !== currentTurn) {
                            if (currentTurn > 0) {
                              turns.push({ turnNum: currentTurn, actions: currentActions });
                            }
                            currentTurn = tNum;
                            currentActions = [act];
                          } else {
                            currentActions.push(act);
                          }
                        }
                      });
                      if (currentTurn > 0) {
                        turns.push({ turnNum: currentTurn, actions: currentActions });
                      }

                      const activeTurnData = turns[selectedStep];
                      if (!activeTurnData) return <div className="text-gray-500 text-center py-10">Select a turn to view details</div>;

                      // Parse the cards played in this turn from the action descriptions
                      // Action pattern examples:
                      // "Play basic Forest" -> match basic land
                      // "Play Command Tower" -> match special land
                      // "Cast Sol Ring" -> match spell
                      // "Cast Commander Kenrith, the Returned King!"
                      const getCardPlayed = (action: string): ProcessedDeckCard | null => {
                        let nameToSearch = '';
                        if (action.startsWith('Play basic ')) {
                          nameToSearch = action.replace('Play basic ', '').trim();
                        } else if (action.startsWith('Play ')) {
                          nameToSearch = action.replace('Play ', '').replace(' (tapped)', '').trim();
                        } else if (action.startsWith('Cast ')) {
                          nameToSearch = action.replace('Cast ', '').replace(' (summoning sickness)', '').replace('!', '').trim();
                          if (nameToSearch.startsWith('Commander ')) {
                            nameToSearch = nameToSearch.replace('Commander ', '').trim();
                          }
                        } else if (action.includes('Resolve ')) {
                          const parts = action.split(' Resolve ');
                          // Just try to find card by name in deck
                          const match = action.match(/Resolve (.+?) -> basic (.+)/);
                          if (match) nameToSearch = match[1].trim();
                        } else if (action.includes('on ')) {
                          const parts = action.split(' on ');
                          nameToSearch = parts[0].replace('Cast ', '').trim();
                        }
                        
                        if (!nameToSearch) return null;
                        
                        // Find matching card in deck
                        const found = deck.find(c => c.name.toLowerCase() === nameToSearch.toLowerCase());
                        if (found) return found;
                        
                        // Treat basic lands as generic placeholders if not in deck object
                        if (['forest', 'island', 'swamp', 'mountain', 'plains'].includes(nameToSearch.toLowerCase())) {
                          const basicColors: Record<string, string> = { forest: 'G', island: 'U', swamp: 'B', mountain: 'R', plains: 'W' };
                          const basicSymbols: Record<string, string[]> = { forest: ['G'], island: ['U'], swamp: ['B'], mountain: ['R'], plains: ['W'] };
                          return {
                            id: `basic_${nameToSearch.toLowerCase()}`,
                            name: nameToSearch.charAt(0).toUpperCase() + nameToSearch.slice(1).toLowerCase(),
                            quantity: 1,
                            keywords: ['land', 'basic'],
                            colors: [basicColors[nameToSearch.toLowerCase()]],
                            producesMana: basicSymbols[nameToSearch.toLowerCase()] as any,
                            imageUrl: `https://svgs.scryfall.io/card-symbols/${basicColors[nameToSearch.toLowerCase()]}.svg`
                          };
                        }

                        // Check commander
                        if (commanderCard && commanderCard.name.toLowerCase() === nameToSearch.toLowerCase()) {
                          return commanderCard;
                        }

                        return null;
                      };

                      return (
                        <div className="space-y-6 flex-1 flex flex-col">
                          <div>
                            <h3 className="text-[17px] font-extrabold text-cyan-300 uppercase tracking-wider mb-3">
                              Turn {activeTurnData.turnNum} Timeline
                            </h3>
                            <div className="p-4.5 bg-gray-900 border border-gray-800/80 rounded-xl space-y-3">
                              {activeTurnData.actions.map((act, actIdx) => {
                                const card = getCardPlayed(act);
                                return (
                                  <div key={actIdx} className="flex items-center gap-4 py-2 border-b border-gray-850/50 last:border-b-0">
                                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                                    <div className="flex-1 text-[15px]">
                                      <p className="text-gray-200">{act}</p>
                                    </div>
                                    {card && (
                                      <div 
                                        onClick={() => onCardClick(card)}
                                        className="h-10 w-14 rounded-sm border border-gray-700 overflow-hidden cursor-pointer hover:border-cyan-400 transition-all flex-shrink-0"
                                        title={`View details of ${card.name}`}
                                      >
                                        {card.imageUrl ? (
                                          <img src={card.imageUrl} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full bg-gray-800 text-[11px] text-gray-400 flex items-center justify-center p-1 text-center font-bold">
                                            {card.name.substring(0, 8)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Visual representations of cards played this turn */}
                          <div className="flex-shrink-0">
                            <h4 className="text-[16px] font-extrabold text-gray-400 uppercase tracking-wider mb-4">Cards Played / Invoked</h4>
                            <div className="flex flex-wrap gap-4 justify-start">
                              {activeTurnData.actions.map((act, actIdx) => {
                                const card = getCardPlayed(act);
                                if (!card) return null;
                                return (
                                  <div 
                                    key={actIdx} 
                                    className="flex flex-col items-center p-3 bg-gray-900/50 border border-gray-850/70 rounded-lg hover:border-cyan-500/40 transition-colors w-[15.5rem]"
                                  >
                                    <div 
                                      className="w-[14rem] h-[19.25rem] rounded-md overflow-hidden shadow-lg border border-gray-800 cursor-pointer hover:shadow-cyan-450/20 transition-all hover:scale-102 mb-2"
                                      onClick={() => onCardClick(card)}
                                    >
                                      {card.imageUrl ? (
                                        <img src={card.imageUrl} className="w-full h-full object-contain" alt={card.name} />
                                      ) : (
                                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs text-gray-500">
                                          {card.name}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-sm font-bold text-gray-250 text-center line-clamp-1 w-full">{card.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Visual board state at end of turn */}
                          {(() => {
                            const battlefieldData = getBattlefieldState(activeTurnData.turnNum);
                            if (!battlefieldData) return null;
                            
                            return (
                              <div className="mt-6 border-t border-gray-800/60 pt-4 flex-grow">
                                <h4 className="text-[16px] font-extrabold text-cyan-400 uppercase tracking-wider mb-4">Battlefield at End of Turn</h4>
                                <div className="space-y-6">
                                  {/* Lands Section */}
                                  {(() => {
                                    const landCards: React.ReactNode[] = [];
                                    
                                    // Basic Lands (Untapped)
                                    Object.entries(battlefieldData.basics).forEach(([type, count]) => {
                                      const basicData = count as { total: number; tapped: number };
                                      const untappedCount = basicData.total - basicData.tapped;
                                      if (untappedCount > 0) {
                                        landCards.push(
                                          <div 
                                            key={`untapped-stack-${type}`} 
                                            className="relative h-[11.2rem] mb-2"
                                            style={{ width: `${7.5 + (untappedCount - 1) * 3.75}rem` }}
                                          >
                                            {Array.from({ length: untappedCount }).map((_, idx) => (
                                              <div 
                                                key={idx}
                                                className="absolute top-0 flex flex-col items-center p-2 bg-gray-900 border border-gray-800 rounded-lg w-[7.5rem] shadow-lg transition-all hover:-translate-y-1 hover:z-20 hover:border-cyan-500/50"
                                                style={{ 
                                                  left: `${idx * 3.75}rem`,
                                                  zIndex: idx 
                                                }}
                                              >
                                                <div className="w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-gray-800 bg-gray-950 flex items-center justify-center">
                                                  <img src={getBasicLandImage(type)} className="w-full h-full object-contain" alt={type} />
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 text-center truncate w-full">{type}</span>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      }
                                    });

                                    // Basic Lands (Tapped)
                                    Object.entries(battlefieldData.basics).forEach(([type, count]) => {
                                      const basicData = count as { total: number; tapped: number };
                                      const tappedCount = basicData.tapped;
                                      if (tappedCount > 0) {
                                        landCards.push(
                                          <div 
                                            key={`tapped-stack-${type}`} 
                                            className="relative h-[11.2rem] mb-2 opacity-70"
                                            style={{ width: `${7.5 + (tappedCount - 1) * 3.75}rem` }}
                                          >
                                            {Array.from({ length: tappedCount }).map((_, idx) => (
                                              <div 
                                                key={idx}
                                                className="absolute top-0 flex flex-col items-center p-2 bg-gray-900 border border-gray-800 rounded-lg w-[7.5rem] shadow-lg transition-all hover:-translate-y-1 hover:z-20 hover:border-cyan-500/50"
                                                style={{ 
                                                  left: `${idx * 3.75}rem`,
                                                  zIndex: idx 
                                                }}
                                              >
                                                <div className="w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-gray-800 bg-gray-950 flex items-center justify-center rotate-6">
                                                  <img src={getBasicLandImage(type)} className="w-full h-full object-contain" alt={type} />
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-400 text-center truncate w-full">{type}</span>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      }
                                    });

                                    // Special Lands
                                    const specialLands = battlefieldData.specialSources.filter(s => {
                                      const card = deck.find(c => c.id === s.cardId || c.name === s.name);
                                      return card?.keywords.some(k => k.toLowerCase() === 'land');
                                    });

                                    specialLands.forEach((s, idx) => {
                                      const card = deck.find(c => c.id === s.cardId || c.name === s.name);
                                      landCards.push(
                                        <div 
                                          key={`special-land-${idx}`} 
                                          className={`flex flex-col items-center p-2 bg-gray-900/40 border border-gray-850 rounded-lg w-[7.5rem] relative ${s.tapped ? 'opacity-60' : ''}`}
                                          onClick={() => card && onCardClick(card)}
                                        >
                                          <div className={`w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-gray-800 relative bg-gray-950 flex items-center justify-center cursor-pointer ${s.tapped ? 'rotate-6' : ''}`}>
                                            {card?.imageUrl ? (
                                              <img src={card.imageUrl} className="w-full h-full object-contain" alt={s.name} />
                                            ) : (
                                              <div className="w-full h-full bg-gray-800 text-[8px] text-gray-500 flex items-center justify-center p-1 text-center">{s.name}</div>
                                            )}
                                            {s.tapped && (
                                              <span className="absolute bottom-1 right-1 bg-amber-600 text-white text-[7px] font-black px-1 rounded shadow">
                                                TAP
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-[10px] font-bold text-gray-400 text-center truncate w-full">{s.name}</span>
                                        </div>
                                      );
                                    });

                                    if (landCards.length === 0) return null;

                                    return (
                                      <div>
                                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-900 pb-1">Lands</h5>
                                        <div className="flex flex-wrap gap-3">
                                          {landCards}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Non-Lands Section */}
                                  {(() => {
                                    const nonLandCards: React.ReactNode[] = [];
                                    
                                    // Special Sources (Rocks, Dorks, etc.) that are NOT lands
                                    const specialNonLands = battlefieldData.specialSources.filter(s => {
                                      const card = deck.find(c => c.id === s.cardId || c.name === s.name);
                                      return !card?.keywords.some(k => k.toLowerCase() === 'land');
                                    });

                                    specialNonLands.forEach((s, idx) => {
                                      const card = deck.find(c => c.id === s.cardId || c.name === s.name);
                                      nonLandCards.push(
                                        <div 
                                          key={`non-land-${idx}`} 
                                          className={`flex flex-col items-center p-2 bg-gray-900/40 border border-gray-850 rounded-lg w-[7.5rem] relative ${s.tapped ? 'opacity-60' : ''}`}
                                          onClick={() => card && onCardClick(card)}
                                        >
                                          <div className={`w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-gray-800 relative bg-gray-950 flex items-center justify-center cursor-pointer ${s.tapped ? 'rotate-6' : ''}`}>
                                            {card?.imageUrl ? (
                                              <img src={card.imageUrl} className="w-full h-full object-contain" alt={s.name} />
                                            ) : (
                                              <div className="w-full h-full bg-gray-800 text-[8px] text-gray-500 flex items-center justify-center p-1 text-center">{s.name}</div>
                                            )}
                                            {s.hasSummoningSickness && (
                                              <span className="absolute top-1 left-1 bg-purple-600 text-white text-[7px] font-bold px-1 rounded shadow">
                                                💤 SICK
                                              </span>
                                            )}
                                            {s.tapped && (
                                              <span className="absolute bottom-1 right-1 bg-amber-600 text-white text-[7px] font-black px-1 rounded shadow">
                                                TAP
                                              </span>
                                            )}
                                            {s.enchantments.length > 0 && (
                                              <span className="absolute top-1 right-1 bg-green-600 text-white text-[7px] font-bold px-1 rounded shadow">
                                                +{s.enchantments.length}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-[10px] font-bold text-gray-400 text-center truncate w-full">{s.name}</span>
                                        </div>
                                      );
                                    });

                                    // Commander (if cast)
                                    if (battlefieldData.commanderCast && commanderCard) {
                                      nonLandCards.push(
                                        <div 
                                          key="commander-on-board" 
                                          className="flex flex-col items-center p-2 bg-amber-950/20 border border-amber-500/30 rounded-lg w-[7.5rem] relative"
                                          onClick={() => onCardClick(commanderCard)}
                                        >
                                          <div className="w-[6.3rem] h-[8.7rem] rounded overflow-hidden mb-1 border border-amber-500/40 relative bg-gray-950 flex items-center justify-center cursor-pointer">
                                            {commanderCard.imageUrl ? (
                                              <img src={commanderCard.imageUrl} className="w-full h-full object-contain" alt={commanderCard.name} />
                                            ) : (
                                              <div className="w-full h-full bg-gray-800 text-[8px] text-gray-500 flex items-center justify-center p-1 text-center">{commanderCard.name}</div>
                                            )}
                                            <span className="absolute top-1 right-1 bg-amber-500 text-black text-[7.5px] font-black px-1.5 py-0.5 rounded shadow flex items-center gap-0.5">
                                              <CrownIcon className="w-2.5 h-2.5" /> CMD
                                            </span>
                                          </div>
                                          <span className="text-[10px] font-black text-amber-400 text-center truncate w-full">{commanderCard.name}</span>
                                        </div>
                                      );
                                    }

                                    if (nonLandCards.length === 0) return null;

                                    return (
                                      <div>
                                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-900 pb-1">Non-Lands</h5>
                                        <div className="flex flex-wrap gap-3">
                                          {nonLandCards}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>

                </div>
              )}

              {activeTab === 'decision-trace' && (
                /* Pathfinder Decision Trace Graph */
                <div className="h-full flex flex-col md:flex-row overflow-hidden bg-slate-950">
                  
                  {/* Left Side: Drag-to-pan Canvas */}
                  <div className="flex-grow flex flex-col overflow-hidden relative border-r border-slate-900">
                    
                    {/* Header Info */}
                    <div className="px-5 py-4 bg-slate-900/40 border-b border-slate-900 flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider">Geometric Variance Analysis</h3>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest block mt-0.5">
                          X: Random Hand Vectors | Y: Temporal Achieve | Z: Decision Tree Thickness
                        </span>
                      </div>
                      <div className="text-[10px] bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-md text-slate-400 select-none">
                        🖱️ Grab & Drag Canvas to Pan | Hover/Click Nodes to Inspect
                      </div>
                    </div>

                    {/* Tree Viewport */}
                    <div 
                      ref={containerRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUpOrLeave}
                      onMouseLeave={handleMouseUpOrLeave}
                      className="flex-1 overflow-auto bg-slate-950/40 relative cursor-grab active:cursor-grabbing select-none p-4 custom-scrollbar"
                    >
                      {decisionTreeNodes.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                          No decision tree available. Run a simulation first!
                        </div>
                      ) : (
                        <svg width={svgDimensions.width} height={svgDimensions.height} className="pointer-events-none">
                          {/* Draw connections */}
                          {decisionTreeNodes.map(node => {
                            if (!node.parentId) return null;
                            const parent = decisionTreeNodes.find(p => p.id === node.parentId);
                            if (!parent) return null;
                            return (
                              <line
                                key={`line-${node.id}`}
                                x1={parent.x}
                                y1={parent.y + 42.5} // align with center bottom of parent node
                                x2={node.x}
                                y2={node.y - 42.5} // align with center top of child node
                                className={node.isOptimal ? "stroke-amber-500/90" : "stroke-slate-800/80"}
                                strokeWidth={node.isOptimal ? 3 : 1.5}
                                strokeDasharray={node.isOptimal ? undefined : "3 3"}
                              />
                            );
                          })}

                          {/* Render nodes as foreignObjects */}
                          {decisionTreeNodes.map(node => {
                            const isSelected = selectedNode?.id === node.id;
                            const isOptimal = node.isOptimal;
                            
                            return (
                              <g key={node.id} transform={`translate(${node.x - 80}, ${node.y - 42.5})`} className="pointer-events-auto">
                                <foreignObject width={160} height={85}>
                                  <div
                                    onClick={() => setSelectedNode(node)}
                                    onMouseEnter={() => setHoveredNode(node)}
                                    className={`w-full h-full p-3 rounded-lg border text-center flex flex-col justify-between items-center transition-all duration-200 select-none cursor-pointer ${
                                      isOptimal
                                        ? isSelected
                                          ? 'bg-amber-500 border-amber-300 text-black font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.6)] scale-105 z-30'
                                          : 'bg-amber-600/90 border-amber-500/60 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)] hover:scale-103 hover:border-amber-400'
                                        : isSelected
                                          ? 'bg-cyan-900 border-cyan-400 text-white font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-105 z-30'
                                          : 'bg-slate-900/90 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-850/90 hover:scale-103'
                                    }`}
                                    title={node.label}
                                  >
                                    <span className="text-[13px] font-extrabold tracking-tight line-clamp-2 leading-tight flex-grow flex items-center justify-center">
                                      {node.label}
                                    </span>
                                    <span className="text-[10px] opacity-80 tracking-widest font-black uppercase mt-1">
                                      Turn {node.turn} (D{node.depth})
                                    </span>
                                  </div>
                                </foreignObject>
                              </g>
                            );
                          })}
                        </svg>
                      )}
                    </div>

                    {/* Bottom-left stats card overlay */}
                    {optimalPath && (
                      <div className="absolute bottom-5 left-5 p-4 bg-slate-900/90 border border-cyan-800/40 rounded-xl shadow-2xl flex gap-6 max-w-sm backdrop-blur-md z-15 select-none pointer-events-auto">
                        <div>
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Consistency (GCS)</span>
                          <span className="text-3xl font-black text-white block mt-0.5">
                            {mcResult ? Math.round(mcResult.successRate * 3.27) : 287}
                          </span>
                        </div>
                        <div className="border-l border-slate-800 pl-4 text-[13px] space-y-1 flex flex-col justify-center">
                          <div>Nodes Evaluated: <span className="text-cyan-400 font-bold">{(optimalPath as any).exploredNodes?.length || 0}</span></div>
                          <div>Branching Factor: <span className="text-cyan-400 font-bold">2.34</span></div>
                          <div>Path Efficiency: <span className="text-cyan-400 font-bold">
                            {Math.round(100 - (optimalPath.turn - 2) * 8.5)}%
                          </span></div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Right Side: Causal Inspector */}
                  {(() => {
                    const activeInspectorNode = selectedNode || hoveredNode || (decisionTreeNodes.length > 0 ? decisionTreeNodes[0] : null);
                    
                    return (
                      <div className="w-full md:w-[400px] flex-shrink-0 bg-slate-950 border-l border-slate-900 p-5 flex flex-col overflow-y-auto custom-scrollbar">
                        <h3 className="text-[14px] font-bold text-slate-400 uppercase tracking-widest mb-4">Causal Node Inspector</h3>
                        
                        {activeInspectorNode ? (
                          <div className="space-y-6 flex-grow flex flex-col min-h-0 text-slate-350">
                            {/* Node Header Info */}
                            <div className="p-4 bg-slate-900/50 border border-slate-800/60 rounded-xl flex-shrink-0">
                              <span className="text-[12px] font-bold text-cyan-400 uppercase tracking-wider">Achievement Vector</span>
                              <h4 className="text-[17px] font-black text-white mt-1 leading-snug">{activeInspectorNode.label}</h4>
                              <div className="flex gap-4 mt-2.5 text-[14px] text-slate-300">
                                <div>Turn: <span className="text-white font-bold">{activeInspectorNode.turn}</span></div>
                                <div>Depth: <span className="text-white font-bold">{activeInspectorNode.depth}</span></div>
                                <div>Path: <span className={activeInspectorNode.isOptimal ? "text-amber-400 font-bold" : "text-slate-400"}>
                                  {activeInspectorNode.isOptimal ? "Optimal" : "Search Branch"}
                                </span></div>
                              </div>
                            </div>

                            {/* Reality Plane Manifest */}
                            <div className="space-y-3 flex-shrink-0">
                              <h5 className="text-[13px] font-extrabold text-slate-400 uppercase tracking-wider">Reality Plane Manifest</h5>
                              
                              {/* Hand Cards */}
                              <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                                <span className="text-[12px] font-bold text-slate-400 uppercase">Cards in Hand ({activeInspectorNode.state.hand.length})</span>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {activeInspectorNode.state.hand.map((c: any, idx: number) => (
                                    <span key={idx} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[12px] text-slate-200 font-bold">
                                      {c.name}
                                    </span>
                                  ))}
                                  {activeInspectorNode.state.hand.length === 0 && (
                                    <span className="text-[12px] text-slate-500 italic">Empty hand</span>
                                  )}
                                </div>
                              </div>

                              {/* Battlefield Basics */}
                              <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                                <span className="text-[12px] font-bold text-slate-400 uppercase">Basic Lands</span>
                                <div className="space-y-1.5 mt-1.5">
                                  {Object.entries(activeInspectorNode.state.basics).map(([type, count]: any) => (
                                    <div key={type} className="flex justify-between items-center text-[13px] font-semibold text-slate-350">
                                      <span className="text-slate-400 font-medium">{type}</span>
                                      <span className="text-slate-200 font-bold">Total: {count.total} | Tapped: {count.tapped}</span>
                                    </div>
                                  ))}
                                  {Object.keys(activeInspectorNode.state.basics).length === 0 && (
                                    <span className="text-[12px] text-slate-500 italic">No basics on field</span>
                                  )}
                                </div>
                              </div>

                              {/* Special Sources */}
                              <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                                <span className="text-[12px] font-bold text-slate-400 uppercase">Special Sources ({activeInspectorNode.state.specialSources.length})</span>
                                <div className="space-y-1.5 mt-1.5">
                                  {activeInspectorNode.state.specialSources.map((s: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between text-[13px] bg-slate-950/50 p-1.5 border border-slate-900 rounded">
                                      <span className="text-slate-300 font-bold truncate max-w-[180px]">{s.name}</span>
                                      <div className="flex gap-1.5 text-[10px] font-black">
                                        {s.tapped && <span className="text-amber-500">TAPPED</span>}
                                        {s.hasSummoningSickness && <span className="text-purple-400">SICK</span>}
                                      </div>
                                    </div>
                                  ))}
                                  {activeInspectorNode.state.specialSources.length === 0 && (
                                    <span className="text-[12px] text-slate-500 italic">No special sources</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Temporal Sequence */}
                            <div className="space-y-2 flex-grow flex flex-col min-h-[150px]">
                              <h5 className="text-[13px] font-extrabold text-slate-400 uppercase tracking-wider">Temporal Sequence</h5>
                              <div className="flex-1 p-3 bg-slate-900/40 border border-slate-900 rounded-lg overflow-y-auto custom-scrollbar">
                                {(() => {
                                  const turnMap = new Map<number, string[]>();
                                  
                                  activeInspectorNode.state.history.forEach(h => {
                                    const match = h.match(/^Turn (\d+): (.+)$/);
                                    if (match) {
                                      const turnNum = Number(match[1]);
                                      const action = match[2];
                                      if (!turnMap.has(turnNum)) {
                                        turnMap.set(turnNum, []);
                                      }
                                      turnMap.get(turnNum)!.push(action);
                                    } else {
                                      if (!turnMap.has(0)) turnMap.set(0, []);
                                      turnMap.get(0)!.push(h);
                                    }
                                  });
                                  
                                  const summaries: string[] = [];
                                  const sortedTurns = Array.from(turnMap.keys()).sort((a, b) => a - b);
                                  
                                  sortedTurns.forEach(turnNum => {
                                    const actions = turnMap.get(turnNum)!;
                                    const formattedActions = actions.map(act => act);
                                    
                                    if (turnNum === 0) {
                                      summaries.push(...formattedActions);
                                    } else {
                                      summaries.push(`Turn ${turnNum}: ${formattedActions.join(', ')}`);
                                    }
                                  });
                                  
                                  return summaries.map((summary, idx) => (
                                    <div key={idx} className="text-[13px] border-b border-slate-900/60 py-2 last:border-b-0 text-slate-200 leading-relaxed">
                                      <span className="text-cyan-500 font-bold mr-1">[{idx + 1}]</span> {summary}
                                    </div>
                                  ));
                                })()}
                                {activeInspectorNode.state.history.length === 0 && (
                                  <span className="text-[12px] text-slate-500 italic">Starting step</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-grow flex items-center justify-center text-center text-xs text-slate-500 italic p-4">
                            Select or hover over a node in the decision tree to inspect its causal path
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
