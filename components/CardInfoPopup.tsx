
import React, { useRef, useState, useCallback, useMemo } from 'react';
import type { D3Node, KeywordStyle, AiClient } from '../types';
import { XMarkIcon, PlusIcon, TrashIcon, SparklesIcon } from './icons'; 
import { LoadingSpinner } from './LoadingSpinner';
import { suggestCardReplacements } from '../services/geminiService';

interface CardInfoPopupProps {
  node: D3Node;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdateKeywords: (cardId: string, updatedKeywords: string[]) => void;
  allKeywordStyles: KeywordStyle[];
  onImageClick: (card: D3Node) => void; 
  onDeleteNode: (cardId: string) => void;
  aiClient?: AiClient | null;
  allCardNames?: string[];
}

import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';

const PLACEHOLDER_IMAGE_URL = PLACEHOLDER_CARD_IMAGE_URL;


export const CardInfoPopup: React.FC<CardInfoPopupProps> = ({ 
    node, 
    position, 
    onClose, 
    onUpdateKeywords, 
    allKeywordStyles,
    onImageClick,
    onDeleteNode,
    aiClient,
    allCardNames = []
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleRemoveKeyword = useCallback((keywordToRemove: string) => {
    const lowerKeywordToRemove = keywordToRemove.toLowerCase();
    const updatedKeywords = (node.keywords || []).filter(kw => kw.toLowerCase() !== lowerKeywordToRemove);
    onUpdateKeywords(node.id, updatedKeywords);
  }, [node.id, node.keywords, onUpdateKeywords]);

  const handleAddKeyword = useCallback(() => {
    const trimmedKeyword = newKeywordInput.trim().toLowerCase();
    if (trimmedKeyword === '') return;

    const currentKeywordsLower = (node.keywords || []).map(kw => kw.toLowerCase());
    if (!currentKeywordsLower.includes(trimmedKeyword)) {
      const updatedKeywords = [...(node.keywords || []), trimmedKeyword];
      onUpdateKeywords(node.id, updatedKeywords);
    }
    setNewKeywordInput('');
  }, [newKeywordInput, node.id, node.keywords, onUpdateKeywords]);

  const handleSuggest = async () => {
    if (!aiClient) return;
    setIsSuggesting(true);
    try {
        const results = await suggestCardReplacements(aiClient, node, allCardNames);
        setSuggestions(results);
    } finally {
        setIsSuggesting(false);
    }
  };

  const handleBackgroundClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.target === event.currentTarget) {
        onClose();
    }
  };

  const handleDeleteClick = () => {
    onDeleteNode(node.id);
    onClose(); 
  };

  if (!node) return null;

  return (
    <div
      ref={popupRef}
      className="absolute bg-gray-800/95 border-2 border-cyan-500 rounded-lg shadow-2xl p-2.5 text-gray-200 z-20 w-80 max-h-[calc(100vh-4rem)] flex flex-col" 
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={handleBackgroundClick} 
      role="dialog"
    >
      <div className="flex justify-between items-start mb-1.5"> 
        <h3 className="text-sm font-semibold text-cyan-400 truncate pr-1.5" title={node.name}> 
          {node.name} <span className="text-xs text-gray-400">(x{node.quantity})</span>
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-cyan-300 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
      </div>

      <img
        src={node.imageUrl || PLACEHOLDER_IMAGE_URL}
        className="w-full aspect-[63/88] object-contain rounded border border-gray-700 mb-1.5 cursor-pointer" 
        onClick={() => onImageClick(node)}
      />
      
      <div className="overflow-y-auto custom-scrollbar pr-1 mb-1.5 space-y-2 flex-grow min-h-0"> 
        <div>
            <p className="text-xs font-semibold text-gray-400 mb-0.5">Keywords:</p> 
            <ul className="text-xs space-y-0.5"> 
                {node.keywords.map((kw, index) => (
                    <li key={index} className="flex items-center justify-between bg-gray-700/70 pl-1.5 pr-0.5 py-0.5 rounded-sm text-gray-300 capitalize"> 
                        <span className="truncate flex-grow text-[1rem]">{kw}</span> 
                        <button onClick={() => handleRemoveKeyword(kw)} className="ml-1 p-0.5 text-red-400 hover:text-red-300 rounded-full hover:bg-red-500/20"><TrashIcon className="w-2.5 h-2.5" /></button>
                    </li>
                ))}
            </ul>
        </div>

        {aiClient && (
            <div className="pt-2 border-t border-gray-700">
                <button 
                    onClick={handleSuggest} 
                    disabled={isSuggesting}
                    className="flex items-center gap-1.5 text-[1rem] font-bold text-purple-400 hover:text-purple-300 disabled:opacity-50"
                >
                    <SparklesIcon className="w-3.5 h-3.5" /> {isSuggesting ? 'Thinking...' : 'AI Suggestions'}
                </button>
                {suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {suggestions.map((s, i) => (
                            <div key={i} className="text-[0.9rem] text-zinc-400 p-1.5 bg-purple-900/10 border border-purple-500/20 rounded truncate">{s}</div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="mt-auto pt-1.5 border-t border-cyan-700/30 space-y-2"> 
        <div className="flex items-center gap-1.5"> 
            <input
              type="text"
              value={newKeywordInput}
              onChange={(e) => setNewKeywordInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleAddKeyword(); }}
              placeholder="Add keyword..."
              className="flex-grow bg-gray-700 border-gray-600 rounded-md py-1 px-1.5 text-xs text-gray-200 outline-none" 
            />
            <button onClick={handleAddKeyword} className="p-1 bg-cyan-600 hover:bg-cyan-500 rounded-md"><PlusIcon className="w-3.5 h-3.5" /></button>
        </div>
        <button onClick={handleDeleteClick} className="w-full flex items-center justify-center px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-md text-xs"><TrashIcon className="w-3 h-3 mr-1.5" /> Remove Card</button>
      </div>
    </div>
  );
};
