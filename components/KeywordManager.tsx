
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
  const [newKeywordColor, setNewKeywordColor] = useState('#06b6d4'); // Default Cyan

  const handleAddKeyword = useCallback(() => {
    const trimmedName = newKeywordName.trim().toLowerCase();
    if (trimmedName === '') {
      alert('Keyword name cannot be empty.');
      return;
    }
    if (keywordStyles.some(kw => kw.name.toLowerCase() === trimmedName)) {
      alert('Keyword already exists (case-insensitive).');
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
    setNewKeywordColor('#06b6d4'); 
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
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-cyan-400">Keyword Configuration</h3>
      <p className="text-xs text-gray-400 mb-2.5">
        Define custom keywords to analyze your deck. Add keywords, assign a color, and toggle their visibility.
      </p>
      
      <div className="flex items-end gap-2 p-3 bg-gray-800/80 rounded-md border border-cyan-700/20">
        <div className="flex-grow">
          <label htmlFor="new-keyword-name" className="block text-xs font-medium text-gray-300">New Keyword Name</label>
          <input
            id="new-keyword-name"
            type="text"
            value={newKeywordName}
            onChange={(e) => setNewKeywordName(e.target.value)}
            placeholder="e.g., Flying"
            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm text-gray-200 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
          />
        </div>
        <div>
          <label htmlFor="new-keyword-color" className="block text-xs font-medium text-gray-300">Color</label>
          <input
            id="new-keyword-color"
            type="color"
            value={newKeywordColor}
            onChange={(e) => setNewKeywordColor(e.target.value)}
            className="mt-1 block w-full h-10 rounded-md border-gray-600 cursor-pointer bg-gray-700"
          />
        </div>
        <button
          onClick={handleAddKeyword}
          className="p-2 bg-cyan-600 hover:bg-cyan-500 rounded-md text-white transition-colors h-10"
          title="Add Keyword"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {keywordStyles.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {keywordStyles.map(kw => (
            <div key={kw.id} className="flex items-center gap-2 p-2 bg-gray-700/60 hover:bg-gray-700/80 transition-colors rounded">
              <input
                type="color"
                value={kw.color}
                onChange={(e) => handleUpdateKeyword(kw.id, 'color', e.target.value)}
                className="w-8 h-8 rounded border-gray-500 cursor-pointer bg-transparent flex-shrink-0"
                title="Change keyword color"
              />
              <input
                type="text"
                value={kw.name} 
                onBlur={(e) => { // Save on blur
                    const newName = e.target.value.trim().toLowerCase();
                    if (newName && !keywordStyles.some(k => k.id !== kw.id && k.name === newName)) {
                         handleUpdateKeyword(kw.id, 'name', newName);
                    } else if (newName === "") {
                         alert("Keyword name cannot be empty. Reverting.");
                         e.target.value = kw.name; // Revert if empty
                    } else if (keywordStyles.some(k => k.id !== kw.id && k.name === newName)) {
                         alert("Keyword name already exists. Reverting.");
                         e.target.value = kw.name; // Revert if duplicate
                    }
                }}
                onChange={(e) => { 
                    handleUpdateKeyword(kw.id, 'name', e.target.value);
                }}
                className="flex-grow w-full min-w-0 bg-transparent border-none p-1 rounded text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                title="Edit keyword name (saved on blur)"
              />
              <button
                onClick={() => handleUpdateKeyword(kw.id, 'enabled', !kw.enabled)}
                className={`p-1 rounded flex-shrink-0 ${kw.enabled ? 'text-teal-400 hover:text-teal-300' : 'text-gray-500 hover:text-gray-400'} transition-colors`}
                title={kw.enabled ? "Disable Keyword Visibility" : "Enable Keyword Visibility"}
              >
                {kw.enabled ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => handleRemoveKeyword(kw.id)}
                className="p-1 text-red-400 hover:text-red-300 rounded flex-shrink-0 transition-colors"
                title="Remove Keyword"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
       {keywordStyles.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">No keywords configured. Add some above to see relations!</p>
       )}
    </div>
  );
};