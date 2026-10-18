import React from 'react';
import type { KeywordStyle } from '../types';

interface LegendProps {
  keywordStyles: KeywordStyle[];
  highlightedKeywords?: string[] | null;
}

export const Legend: React.FC<LegendProps> = ({ keywordStyles, highlightedKeywords }) => {
  const highlightedSet = new Set(highlightedKeywords?.map(kw => kw.toLowerCase()));

  return (
    <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/80 space-y-3">
      {keywordStyles.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
            Active Link Legend
          </h4>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {keywordStyles.map(kw => {
              const isHighlighted = highlightedSet.has(kw.name.toLowerCase());
              return (
                <div 
                  key={kw.id} 
                  className={`flex items-center px-1.5 py-0.5 rounded transition-all ${
                    isHighlighted ? 'bg-amber-500/15 ring-1 ring-amber-500/40' : ''
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mr-2 inline-block flex-shrink-0"
                    style={{ backgroundColor: kw.color }}
                  />
                  <span className={`truncate capitalize text-[11px] ${
                    isHighlighted ? 'text-amber-200 font-semibold' : 'text-zinc-400'
                  }`}>
                    {kw.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <div className={keywordStyles.length > 0 ? 'pt-2.5 border-t border-zinc-800/80' : ''}>
        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
          Node Indicators
        </h4>
        <div className="space-y-1.5 text-[11px] text-zinc-400">
          <div className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full mr-2 inline-block border-2 border-amber-400 bg-transparent flex-shrink-0" />
            <span>Commander (Crowned Center)</span>
          </div>
          <div className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full mr-2 inline-block border-2 border-white bg-transparent flex-shrink-0" />
            <span>In Drawn Opening Hand</span>
          </div>
          <div className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full mr-2 inline-block border-2 border-rose-500 bg-transparent flex-shrink-0" />
            <span>Isolated / Orphan Node</span>
          </div>
        </div>
      </div>
    </div>
  );
};
