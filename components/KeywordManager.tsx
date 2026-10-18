import React, { useState, useCallback } from 'react';
import type { KeywordStyle } from '../types';
import { PlusIcon, TrashIcon, EyeIcon, EyeSlashIcon } from './icons'; 
import { v4 as uuidv4 } from 'uuid';

interface KeywordManagerProps {
  keywordStyles: KeywordStyle[];
  onKeywordStylesChange: (updatedStyles: KeywordStyle[]) => void;
}

export const KeywordManager: React.FC<KeywordManagerProps> = ({ keywordStyles, onKeywordStylesChange }) => {
  const [newKeywordName, setNewKeywordName] = useState('');
  const [newKeywordColor, setNewKeywordColor] = useState('#d4af37'); // Default Mythic Gold

  const handleAddKeyword = useCallback(() => {
    const trimmedName = newKeywordName.trim().toLowerCase();
    if (trimmedName === '') {
      return;
    }
    if (keywordStyles.some(kw => kw.name.toLowerCase() === trimmedName)) {
      alert('Keyword already exists.');
      return;
    }
    const newKeyword: KeywordStyle = {
      id: uuidv4(),
      name: trimmedName,
      color: newKeywordColor,
      enabled: true,
    };
    onKeywordStylesChange([...keywordStyles, newKeyword]);
    setNewKeywordName('');
    setNewKeywordColor('#d4af37'); 
  }, [newKeywordName, newKeywordColor, keywordStyles, onKeywordStylesChange]);

  const handleUpdateKeyword = useCallback((id: string, field: keyof KeywordStyle, value: string | boolean) => {
    onKeywordStylesChange(
      keywordStyles.map(kw => {
        if (kw.id === id) {
          const updatedValue = field === 'name' && typeof value === 'string' ? value.toLowerCase() : value;
          return { ...kw, [field]: updatedValue };
        }
        return kw;
      })
    );
  }, [keywordStyles, onKeywordStylesChange]);

  const handleRemoveKeyword = useCallback((id: string) => {
    onKeywordStylesChange(keywordStyles.filter(kw => kw.id !== id));
  }, [keywordStyles, onKeywordStylesChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
          Synergy Mechanics
        </h3>
        <span className="text-[10px] font-mono text-zinc-500">
          {keywordStyles.filter(k => k.enabled).length}/{keywordStyles.length} active
        </span>
      </div>
      
      <div className="flex items-center gap-1.5 p-2 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
        <input
          id="new-keyword-name"
          type="text"
          value={newKeywordName}
          onChange={(e) => setNewKeywordName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddKeyword(); }}
          placeholder="Add mechanic (e.g. Token)..."
          className="flex-grow min-w-0 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
        />
        <input
          id="new-keyword-color"
          type="color"
          value={newKeywordColor}
          onChange={(e) => setNewKeywordColor(e.target.value)}
          className="w-7 h-7 rounded border border-zinc-700 cursor-pointer bg-zinc-950 shrink-0"
          title="Select link color"
        />
        <button
          onClick={handleAddKeyword}
          className="p-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-amber-300 transition-colors shrink-0"
          title="Add Keyword"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {keywordStyles.length > 0 && (
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
          {keywordStyles.map(kw => (
            <div
              key={kw.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all ${
                kw.enabled
                  ? 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700'
                  : 'bg-zinc-950/40 border-zinc-900 opacity-50'
              }`}
            >
              <input
                type="color"
                value={kw.color}
                onChange={(e) => handleUpdateKeyword(kw.id, 'color', e.target.value)}
                className="w-4 h-4 rounded-full border-0 cursor-pointer bg-transparent flex-shrink-0"
                title="Change keyword color"
              />
              <input
                type="text"
                value={kw.name} 
                onBlur={(e) => {
                  const newName = e.target.value.trim().toLowerCase();
                  if (newName && !keywordStyles.some(k => k.id !== kw.id && k.name === newName)) {
                    handleUpdateKeyword(kw.id, 'name', newName);
                  } else {
                    e.target.value = kw.name;
                  }
                }}
                onChange={(e) => handleUpdateKeyword(kw.id, 'name', e.target.value)}
                className="flex-grow w-full min-w-0 bg-transparent border-none px-1 py-0.5 rounded text-zinc-200 text-xs capitalize focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                title="Edit mechanic name"
              />
              <button
                onClick={() => handleUpdateKeyword(kw.id, 'enabled', !kw.enabled)}
                className={`p-1 rounded flex-shrink-0 transition-colors ${
                  kw.enabled ? 'text-amber-400/90 hover:text-amber-300' : 'text-zinc-600 hover:text-zinc-400'
                }`}
                title={kw.enabled ? "Hide mechanic links" : "Show mechanic links"}
              >
                {kw.enabled ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeSlashIcon className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => handleRemoveKeyword(kw.id)}
                className="p-1 text-zinc-600 hover:text-rose-400 rounded flex-shrink-0 transition-colors"
                title="Remove mechanic"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};