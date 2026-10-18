import React, { useRef, useState, useCallback } from 'react';
import type { D3Node, KeywordStyle, AiClient } from '../types';
import { XMarkIcon, PlusIcon, TrashIcon, SparklesIcon } from './icons'; 
import { suggestCardReplacements } from '../services/geminiService';
import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';

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

const PLACEHOLDER_IMAGE_URL = PLACEHOLDER_CARD_IMAGE_URL;

export const CardInfoPopup: React.FC<CardInfoPopupProps> = ({ 
    node, 
    position, 
    onClose, 
    onUpdateKeywords, 
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
      className="absolute bg-[#0d0d10]/95 backdrop-blur-xl border border-amber-500/40 rounded-xl shadow-2xl p-3 text-zinc-200 z-20 w-72 max-h-[calc(100vh-4rem)] flex flex-col" 
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={handleBackgroundClick} 
      role="dialog"
    >
      <div className="flex justify-between items-start mb-2 pb-1.5 border-b border-white/[0.06]"> 
        <h3 className="text-xs font-semibold text-amber-300 truncate pr-1.5" title={node.name}> 
          {node.name} <span className="text-[11px] font-mono text-zinc-500">(x{node.quantity})</span>
        </h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
      </div>

      <img
        src={node.imageUrl || PLACEHOLDER_IMAGE_URL}
        className="w-full aspect-[63/88] object-contain rounded-lg border border-white/[0.08] mb-2 cursor-pointer" 
        onClick={() => onImageClick(node)}
      />
      
      <div className="overflow-y-auto custom-scrollbar pr-1 mb-2 space-y-2 flex-grow min-h-0"> 
        <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Synergy Tags</p> 
            <ul className="text-xs space-y-1"> 
                {node.keywords.map((kw, index) => (
                    <li key={index} className="flex items-center justify-between bg-zinc-900/90 border border-white/[0.05] px-2 py-1 rounded text-zinc-300 capitalize"> 
                        <span className="truncate flex-grow text-xs">{kw}</span> 
                        <button onClick={() => handleRemoveKeyword(kw)} className="ml-1 p-0.5 text-zinc-500 hover:text-red-400 rounded"><TrashIcon className="w-3 h-3" /></button>
                    </li>
                ))}
            </ul>
        </div>

        {aiClient && (
            <div className="pt-2 border-t border-white/[0.06]">
                <button 
                    onClick={handleSuggest} 
                    disabled={isSuggesting}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 disabled:opacity-50"
                >
                    <SparklesIcon className="w-3.5 h-3.5 text-amber-400" /> {isSuggesting ? 'Consulting AI...' : 'Suggest Upgrades'}
                </button>
                {suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {suggestions.map((s, i) => (
                            <div key={i} className="text-xs text-zinc-300 p-1.5 bg-amber-500/10 border border-amber-500/20 rounded truncate">{s}</div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="mt-auto pt-2 border-t border-white/[0.06] space-y-2"> 
        <div className="flex items-center gap-1.5"> 
            <input
              type="text"
              value={newKeywordInput}
              onChange={(e) => setNewKeywordInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleAddKeyword(); }}
              placeholder="Add tag..."
              className="flex-grow bg-zinc-900 border border-white/[0.08] rounded-md py-1 px-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 outline-none" 
            />
            <button onClick={handleAddKeyword} className="p-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 rounded-md"><PlusIcon className="w-3.5 h-3.5" /></button>
        </div>
        <button onClick={handleDeleteClick} className="w-full flex items-center justify-center px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-semibold rounded-md text-xs transition-colors"><TrashIcon className="w-3 h-3 mr-1.5" /> Remove Card</button>
      </div>
    </div>
  );
};
