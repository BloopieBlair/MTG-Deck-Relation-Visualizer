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
  W: { name: 'White', icon: ManaWIcon, colorClass: 'text-yellow-200' },
  U: { name: 'Blue', icon: ManaUIcon, colorClass: 'text-blue-300' },
  B: { name: 'Black', icon: ManaBIcon, colorClass: 'text-gray-400' },
  R: { name: 'Red', icon: ManaRIcon, colorClass: 'text-red-400' },
  G: { name: 'Green', icon: ManaGIcon, colorClass: 'text-green-400' },
  C: { name: 'Colorless', icon: ManaCIcon, colorClass: 'text-gray-300' },
  X: { name: 'X Cost', icon: ManaXIcon, colorClass: 'text-purple-400' },
  Generic: { name: 'Generic', icon: ManaGenericIcon, colorClass: 'text-gray-200' },
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
    <div className="absolute bottom-2 left-2 bg-gray-800/90 text-gray-300 p-6 rounded-lg shadow-xl border border-cyan-700/50 backdrop-blur-sm max-w-4xl">
      <h4 className="text-xl font-bold text-cyan-400 mb-3 border-b border-cyan-700/30 pb-2 flex items-center justify-between">
        <span>Mana Analysis</span>
        {highlightedColors.size > 0 && (
          <span className="text-xs font-normal text-cyan-500 animate-pulse">
            Active Filter ({highlightedColors.size} selected)
          </span>
        )}
      </h4>
      <div className="space-y-2">
        {DISPLAY_ORDER.map(symbol => {
          const pipInfo = ManaSymbolMap[symbol];
          const required = pipsRequired[symbol] || 0;
          const sources = manaSources[symbol] || 0;

          if (required === 0 && sources === 0 && (symbol === 'X' || (symbol === 'Generic' && !pipsRequired.Generic))) {
             return null;
          }
          
          const isSourceClickable = ACTUAL_MANA_COLORS.includes(symbol);
          const isHighlightable = ACTUAL_MANA_COLORS.includes(symbol);
          const isHighlighted = highlightedColors.has(symbol);

          return (
            <div key={symbol} className="flex items-center justify-between text-sm py-0.5">
              <div className="flex items-center">
                {isHighlightable ? (
                  <div 
                    onClick={() => onColorHighlightToggle(symbol)}
                    className={`flex items-center cursor-pointer transition-all rounded px-2 py-1 select-none mr-2
                                ${isHighlighted 
                                  ? 'bg-cyan-950/80 border border-cyan-500 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]' 
                                  : 'border border-transparent hover:text-cyan-300'}`}
                    title={`Toggle ${pipInfo.name} highlight on graph`}
                  >
                    <pipInfo.icon className={`w-5 h-5 mr-2 ${pipInfo.colorClass}`} />
                    <span className="font-semibold">{pipInfo.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center px-2 py-1 mr-2">
                    <pipInfo.icon className={`w-5 h-5 mr-2 ${pipInfo.colorClass}`} />
                    <span className="font-semibold text-gray-400">{pipInfo.name}</span>
                  </div>
                )}
                
                {!isHighlightable && (
                  <button
                    onClick={() => handleStatClick(symbol, 'pipsRequired')}
                    className="text-left font-medium hover:text-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Cards requiring ${pipInfo.name} pips: ${required}`}
                    disabled={!onStatClick || required === 0}
                  >
                    :
                  </button>
                )}
              </div>
              
              <div className="flex items-center ml-2.5 space-x-1.5 font-mono">
                <button
                  onClick={() => handleStatClick(symbol, 'pipsRequired')}
                  className="text-gray-200 hover:text-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-1.5 py-0.5 bg-gray-900/40 rounded border border-gray-700/30"
                  title={`Cards requiring ${pipInfo.name} pips: ${required}`}
                  disabled={!onStatClick || required === 0}
                >
                  {required}
                </button>
                {(symbol !== 'X' && symbol !== 'Generic') && (
                  <>
                    <span className="text-gray-600">/</span>
                    <button
                      onClick={() => isSourceClickable && handleStatClick(symbol, 'manaSources')}
                      className={`${sources < required ? 'text-red-400 font-semibold animate-pulse' : 'text-green-400'} 
                                   ${isSourceClickable && onStatClick && sources > 0 ? 'hover:text-cyan-300 transition-colors' : ''}
                                   disabled:opacity-50 disabled:cursor-not-allowed px-1.5 py-0.5 bg-gray-900/40 rounded border border-gray-700/30`}
                      title={`Sources of ${pipInfo.name} mana: ${sources}`}
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