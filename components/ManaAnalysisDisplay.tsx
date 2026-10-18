import React from 'react';
import type { ManaAnalysisData, ManaSymbol } from '../types';
import { ManaWIcon, ManaUIcon, ManaBIcon, ManaRIcon, ManaGIcon, ManaCIcon, ManaXIcon, ManaGenericIcon } from './icons';

interface ManaAnalysisDisplayProps {
  analysisData: ManaAnalysisData | null;
  onStatClick?: (symbol: ManaSymbol, type: 'pipsRequired' | 'manaSources') => void;
  highlightedColors: Set<string>;
  onColorHighlightToggle: (color: string) => void;
}

const ManaSymbolMap: Record<ManaSymbol, { name: string; icon: React.FC<{className?: string}>; colorClass: string }> = {
  W: { name: 'White', icon: ManaWIcon, colorClass: 'text-amber-100' },
  U: { name: 'Blue', icon: ManaUIcon, colorClass: 'text-sky-400' },
  B: { name: 'Black', icon: ManaBIcon, colorClass: 'text-zinc-400' },
  R: { name: 'Red', icon: ManaRIcon, colorClass: 'text-rose-400' },
  G: { name: 'Green', icon: ManaGIcon, colorClass: 'text-emerald-400' },
  C: { name: 'Colorless', icon: ManaCIcon, colorClass: 'text-zinc-300' },
  X: { name: 'X Cost', icon: ManaXIcon, colorClass: 'text-purple-400' },
  Generic: { name: 'Generic', icon: ManaGenericIcon, colorClass: 'text-zinc-300' },
};

const DISPLAY_ORDER: ManaSymbol[] = ['W', 'U', 'B', 'R', 'G', 'C', 'X', 'Generic'];
const ACTUAL_MANA_COLORS: ManaSymbol[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export const ManaAnalysisDisplay: React.FC<ManaAnalysisDisplayProps> = ({ 
  analysisData, 
  onStatClick, 
  highlightedColors, 
  onColorHighlightToggle 
}) => {
  if (!analysisData) {
    return null;
  }

  const { pipsRequired, manaSources } = analysisData;

  const handleStatClick = (symbol: ManaSymbol, type: 'pipsRequired' | 'manaSources') => {
    if (onStatClick) {
      onStatClick(symbol, type);
    }
  };

  return (
    <div className="absolute bottom-3 left-3 bg-zinc-950/90 text-zinc-300 p-4 rounded-xl shadow-2xl border border-zinc-800/90 backdrop-blur-md min-w-[235px]">
      <div className="flex items-center justify-between mb-2.5 border-b border-zinc-800/80 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
          Mana Pips vs. Sources
        </span>
        {highlightedColors.size > 0 && (
          <span className="text-[10px] font-mono text-amber-400">
            {highlightedColors.size} filtered
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {DISPLAY_ORDER.map(symbol => {
          const pipInfo = ManaSymbolMap[symbol];
          const required = pipsRequired[symbol] || 0;
          const sources = manaSources[symbol] || 0;

          if (required === 0 && sources === 0) {
             return null;
          }
          
          const isSourceClickable = ACTUAL_MANA_COLORS.includes(symbol);
          const isHighlightable = ACTUAL_MANA_COLORS.includes(symbol);
          const isHighlighted = highlightedColors.has(symbol);

          return (
            <div key={symbol} className="flex items-center justify-between text-xs py-0.5">
              <div className="flex items-center">
                {isHighlightable ? (
                  <div 
                    onClick={() => onColorHighlightToggle(symbol)}
                    className={`flex items-center cursor-pointer transition-all rounded-md px-1.5 py-0.5 select-none mr-2 ${
                      isHighlighted 
                        ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200' 
                        : 'border border-transparent hover:text-zinc-100'
                    }`}
                    title={`Filter ${pipInfo.name} cards on graph`}
                  >
                    <pipInfo.icon className={`w-4 h-4 mr-2 ${pipInfo.colorClass}`} />
                    <span className="font-medium text-xs">{pipInfo.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center px-1.5 py-0.5 mr-2">
                    <pipInfo.icon className={`w-4 h-4 mr-2 ${pipInfo.colorClass}`} />
                    <span className="font-medium text-xs text-zinc-400">{pipInfo.name}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-1 font-mono text-[11px]">
                <button
                  onClick={() => handleStatClick(symbol, 'pipsRequired')}
                  className="text-zinc-200 hover:text-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed px-1.5 py-0.5 bg-zinc-900/80 rounded border border-zinc-800"
                  title={`Cards requiring ${pipInfo.name} pips: ${required}`}
                  disabled={!onStatClick || required === 0}
                >
                  {required}
                </button>
                {(symbol !== 'X' && symbol !== 'Generic') && (
                  <>
                    <span className="text-zinc-600">/</span>
                    <button
                      onClick={() => isSourceClickable && handleStatClick(symbol, 'manaSources')}
                      className={`${sources < required ? 'text-rose-400 font-semibold' : 'text-emerald-400'} 
                                   ${isSourceClickable && onStatClick && sources > 0 ? 'hover:text-amber-300 transition-colors' : ''}
                                   disabled:opacity-40 disabled:cursor-not-allowed px-1.5 py-0.5 bg-zinc-900/80 rounded border border-zinc-800`}
                      title={`Sources producing ${pipInfo.name} mana: ${sources}`}
                      disabled={!isSourceClickable || !onStatClick || sources === 0}
                    >
                      {sources}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};