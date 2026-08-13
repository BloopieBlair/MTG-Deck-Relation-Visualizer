
import React from 'react';
import type { KeywordStyle } from '../types';

interface LegendProps {
  keywordStyles: KeywordStyle[];
  highlightedKeywords?: string[] | null;
}

export const Legend: React.FC<LegendProps> = ({ keywordStyles, highlightedKeywords }) => {
  const highlightedSet = new Set(highlightedKeywords?.map(kw => kw.toLowerCase()));

  return (
    <div className="mt-4 p-3 bg-gray-800/80 rounded-md border border-cyan-700/20">
      {keywordStyles.length > 0 && (
        <>
          <h4 className="text-base font-bold text-cyan-400 mb-2.5">Active Keyword Legend:</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-4">
            {keywordStyles.map(kw => {
              const isHighlighted = highlightedSet.has(kw.name.toLowerCase());
              return (
                <div 
                  key={kw.id} 
                  className={`flex items-center p-1 rounded transition-all duration-150 ease-in-out
                              ${isHighlighted ? 'bg-cyan-700/50 ring-1 ring-cyan-400' : ''}`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full mr-2 inline-block flex-shrink-0"
                    style={{ backgroundColor: kw.color }}
                  ></span>
                  <span className={`truncate ${isHighlighted ? 'text-yellow-300 font-semibold' : 'text-gray-300'}`}>
                    {kw.name}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
      
      <h4 className={`text-base font-bold text-cyan-400 mb-2.5 ${keywordStyles.length > 0 ? 'pt-2.5 border-t border-cyan-700/20' : ''}`}>Special Graph Indicators:</h4>
      <div className="space-y-2 text-sm text-gray-300">
        <div className="flex items-center">
          <span className="w-3.5 h-3.5 rounded-full mr-2 inline-block border-2 border-yellow-400 bg-transparent flex-shrink-0" />
          <span>Deck Commander (Crown Icon)</span>
        </div>
        <div className="flex items-center">
          <span className="w-3.5 h-3.5 rounded-full mr-2 inline-block border-2 border-white bg-transparent flex-shrink-0" />
          <span>In Drawn Hand (White Highlight)</span>
        </div>
        <div className="flex items-center">
          <span className="w-3.5 h-3.5 rounded-full mr-2 inline-block border-2 border-red-500 bg-transparent flex-shrink-0" />
          <span>Orphan Node (Weakly Connected)</span>
        </div>
      </div>

      {highlightedKeywords && highlightedKeywords.length > 0 && (
        <p className="text-xs text-gray-400 mt-2.5 pt-2 border-t border-cyan-700/20">
            Selected card has highlighted keywords.
        </p>
      )}
    </div>
  );
};
