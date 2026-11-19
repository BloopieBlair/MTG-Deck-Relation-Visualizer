import React, { useState, useCallback, useMemo } from 'react';
import type { KeywordStyle } from '../types';
import { PlusIcon, TrashIcon, EyeIcon, EyeSlashIcon } from './icons'; 
import { v4 as uuidv4 } from 'uuid';

const CARD_TYPE_KEYWORDS = new Set([
  'land',
  'creature',
  'artifact',
  'enchantment',
  'instant',
  'sorcery',
  'planeswalker',
  'legendary',
]);

const getKeywordCategory = (kw: KeywordStyle): 'type' | 'synergy' => {
  if (kw.category === 'type' || kw.category === 'synergy') {
    return kw.category;
  }
  return CARD_TYPE_KEYWORDS.has(kw.name.toLowerCase()) ? 'type' : 'synergy';
};

interface KeywordManagerProps {
  keywordStyles: KeywordStyle[];
  onKeywordStylesChange: (updatedStyles: KeywordStyle[]) => void;
}

export const KeywordManager: React.FC<KeywordManagerProps> = ({ keywordStyles, onKeywordStylesChange }) => {
  const [newKeywordName, setNewKeywordName] = useState('');
  const [newKeywordColor, setNewKeywordColor] = useState('#d4af37'); // Default Mythic Gold

  const { synergyKeywords, typeKeywords } = useMemo(() => {
    const synergy: KeywordStyle[] = [];
    const type: KeywordStyle[] = [];
    keywordStyles.forEach(kw => {
      if (getKeywordCategory(kw) === 'type') {
        type.push(kw);
      } else {
        synergy.push(kw);
      }
    });
    return { synergyKeywords: synergy, typeKeywords: type };
  }, [keywordStyles]);

  const isSynergyModeActive = useMemo(
    () =>
      synergyKeywords.length > 0 &&
      synergyKeywords.every(k => k.enabled) &&
      typeKeywords.every(k => !k.enabled),
    [synergyKeywords, typeKeywords]
  );

  const isTypeModeActive = useMemo(
    () =>
      typeKeywords.length > 0 &&
      typeKeywords.every(k => k.enabled) &&
      synergyKeywords.every(k => !k.enabled),
    [synergyKeywords, typeKeywords]
  );

  const isAllEnabled = useMemo(
    () => keywordStyles.length > 0 && keywordStyles.every(k => k.enabled),
    [keywordStyles]
  );

  const isNoneEnabled = useMemo(
    () => keywordStyles.length > 0 && keywordStyles.every(k => !k.enabled),
    [keywordStyles]
  );

  const handleApplyPreset = useCallback(
    (preset: 'synergy' | 'type' | 'all' | 'none') => {
      onKeywordStylesChange(
        keywordStyles.map(kw => {
          const category = getKeywordCategory(kw);
          let enabled = kw.enabled;
          if (preset === 'synergy') {
            enabled = category === 'synergy';
          } else if (preset === 'type') {
            enabled = category === 'type';
          } else if (preset === 'all') {
            enabled = true;
          } else if (preset === 'none') {
            enabled = false;
          }
          return { ...kw, category, enabled };
        })
      );
    },
    [keywordStyles, onKeywordStylesChange]
  );

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
      category: CARD_TYPE_KEYWORDS.has(trimmedName) ? 'type' : 'synergy',
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

  const renderKeywordRow = (kw: KeywordStyle) => {
    const category = getKeywordCategory(kw);
    return (
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
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider flex-shrink-0 border ${
            category === 'type'
              ? 'bg-sky-500/10 text-sky-300/80 border-sky-500/20'
              : 'bg-amber-500/10 text-amber-300/85 border-amber-500/20'
          }`}
          title={category === 'type' ? 'Card Type link' : 'Synergy Mechanic link'}
        >
          {category === 'type' ? 'Type' : 'Syn'}
        </span>
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
    );
  };

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

      {/* Quick Mode Preset Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 bg-zinc-900/70 rounded-lg border border-zinc-800/80">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleApplyPreset('synergy')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              isSynergyModeActive
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-sm'
                : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-700'
            }`}
            title="Enable mechanical synergy links only (hides card type hairballs)"
          >
            Synergy Mode
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('type')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
              isTypeModeActive
                ? 'bg-sky-500/20 text-sky-200 border border-sky-500/40 shadow-sm'
                : 'bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-700'
            }`}
            title="Enable card type links only (creatures, lands, artifacts, etc.)"
          >
            Type Mode
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleApplyPreset('all')}
            className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
              isAllEnabled
                ? 'bg-zinc-700/80 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70'
            }`}
            title="Enable all links"
          >
            All
          </button>
          <span className="text-zinc-700 text-[10px]">/</span>
          <button
            type="button"
            onClick={() => handleApplyPreset('none')}
            className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
              isNoneEnabled
                ? 'bg-zinc-700/80 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70'
            }`}
            title="Disable all links"
          >
            None
          </button>
        </div>
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
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
          {synergyKeywords.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
                  Synergy Mechanics
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {synergyKeywords.filter(k => k.enabled).length}/{synergyKeywords.length}
                </span>
              </div>
              {synergyKeywords.map(renderKeywordRow)}
            </div>
          )}

          {typeKeywords.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1 pt-1 border-t border-zinc-800/60">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400/80">
                  Card Types
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {typeKeywords.filter(k => k.enabled).length}/{typeKeywords.length}
                </span>
              </div>
              {typeKeywords.map(renderKeywordRow)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};