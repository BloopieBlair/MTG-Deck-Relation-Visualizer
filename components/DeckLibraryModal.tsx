import React, { useState, useEffect, useMemo } from 'react';
import type { ProcessedDeckCard, SavedDeck } from '../types';
import { encodeDeckToShareUrl } from '../services/deckStorageService';
import {
  XMarkIcon,
  TrashIcon,
  CrownIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from './icons';

export interface DeckLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedDecks: SavedDeck[];
  activeDeckId: string | null;
  currentDeckName: string;
  currentCards: ProcessedDeckCard[];
  currentCommanderId: string | null;
  onLoadDeck: (deck: SavedDeck) => void;
  onSaveCurrentDeck: (name: string) => void;
  onDeleteDeck: (id: string) => void;
  onRenameDeck: (id: string, newName: string) => void;
  onNewEmptyDeck: () => void;
}

const LibraryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className || 'w-5 h-5'}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
    />
  </svg>
);

const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className || 'w-4 h-4'}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
    />
  </svg>
);

const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className || 'w-4 h-4'}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
    />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className={className || 'w-4 h-4'}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);

function getDeckCardCount(cards: ProcessedDeckCard[]): number {
  return cards.reduce((sum, card) => sum + (card.quantity || 1), 0);
}

function getDeckCommanderName(
  cards: ProcessedDeckCard[],
  commanderId: string | null
): string | null {
  if (commanderId) {
    const byId = cards.find((c) => c.id === commanderId);
    if (byId) return byId.name;
  }
  const byZone = cards.find((c) => c.zone === 'commander');
  return byZone ? byZone.name : null;
}

function getEstimatedUsdPrice(cards: ProcessedDeckCard[]): number | null {
  let total = 0;
  let hasAnyPrice = false;

  for (const card of cards) {
    const raw = card.prices?.usd ?? card.prices?.usd_foil;
    if (!raw) continue;
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      total += parsed * (card.quantity || 1);
      hasAnyPrice = true;
    }
  }

  return hasAnyPrice ? total : null;
}

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUpdatedAt(timestamp: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) return 'Unknown';
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  try {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: diffDays > 300 ? 'numeric' : undefined,
    });
  } catch {
    return 'Saved';
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export const DeckLibraryModal: React.FC<DeckLibraryModalProps> = ({
  isOpen,
  onClose,
  savedDecks,
  activeDeckId,
  currentDeckName,
  currentCards,
  currentCommanderId,
  onLoadDeck,
  onSaveCurrentDeck,
  onDeleteDeck,
  onRenameDeck,
  onNewEmptyDeck,
}) => {
  const [deckNameInput, setDeckNameInput] = useState(currentDeckName || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDeckNameInput(currentDeckName || '');
      setRenamingId(null);
      setRenameDraft('');
      setSearchQuery('');
      setJustSaved(false);
    }
  }, [isOpen, currentDeckName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (renamingId) {
          setRenamingId(null);
          setRenameDraft('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, renamingId, onClose]);

  const currentStats = useMemo(() => {
    return {
      cardCount: getDeckCardCount(currentCards),
      commanderName: getDeckCommanderName(currentCards, currentCommanderId),
      estimatedPrice: getEstimatedUsdPrice(currentCards),
    };
  }, [currentCards, currentCommanderId]);

  const filteredDecks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return savedDecks;
    return savedDecks.filter((deck) => {
      if (deck.name.toLowerCase().includes(q)) return true;
      const cmd = getDeckCommanderName(deck.cards, deck.commanderId);
      return cmd ? cmd.toLowerCase().includes(q) : false;
    });
  }, [savedDecks, searchQuery]);

  if (!isOpen) return null;

  const handleSaveCurrent = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = deckNameInput.trim() || currentStats.commanderName || 'Untitled Deck';
    onSaveCurrentDeck(trimmed);
    setDeckNameInput(trimmed);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleCopyShareLink = async (
    key: string,
    cards: ProcessedDeckCard[],
    commanderId: string | null,
    name?: string
  ) => {
    if (cards.length === 0) return;
    const url = encodeDeckToShareUrl(cards, commanderId, name);
    const copied = await copyTextToClipboard(url);
    if (copied) {
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    }
  };

  const startRenaming = (deck: SavedDeck) => {
    setRenamingId(deck.id);
    setRenameDraft(deck.name);
  };

  const commitRename = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) {
      onRenameDeck(id, trimmed);
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 backdrop-blur-md p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0d0d10] border border-white/[0.1] rounded-xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden max-h-[88vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/[0.06] bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/25">
              <LibraryIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-zinc-100 tracking-wide">
                Deck Library
              </h2>
              <p className="text-[11px] font-mono text-zinc-500">
                {savedDecks.length} saved {savedDecks.length === 1 ? 'deck' : 'decks'} • Local browser storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1"
            aria-label="Close Deck Library"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col space-y-5 overflow-hidden bg-[#09090b] flex-1">
          {/* Save Current Deck Section */}
          <div className="bg-[#0d0d10] border border-white/[0.08] rounded-lg p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
                Current Workspace
              </span>
              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                <span>{currentStats.cardCount} cards</span>
                {currentStats.commanderName && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="inline-flex items-center gap-1 text-amber-300/90 max-w-[200px] truncate">
                      <CrownIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{currentStats.commanderName}</span>
                    </span>
                  </>
                )}
                {currentStats.estimatedPrice !== null && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-emerald-400/90">
                      {formatUsd(currentStats.estimatedPrice)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveCurrent} className="flex items-center gap-2">
              <input
                type="text"
                value={deckNameInput}
                onChange={(e) => setDeckNameInput(e.target.value)}
                placeholder="Enter deck name..."
                className="flex-1 bg-zinc-950 border border-white/[0.08] rounded-md px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={currentCards.length === 0}
                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  justSaved
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : currentCards.length === 0
                      ? 'bg-zinc-900 text-zinc-600 border border-white/[0.05] cursor-not-allowed'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40'
                }`}
              >
                {justSaved ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : activeDeckId ? (
                  'Save Changes'
                ) : (
                  'Save Deck'
                )}
              </button>
              <button
                type="button"
                disabled={currentCards.length === 0}
                onClick={() =>
                  handleCopyShareLink(
                    '__current__',
                    currentCards,
                    currentCommanderId,
                    deckNameInput.trim() || currentDeckName
                  )
                }
                title="Copy shareable URL for current deck"
                className={`px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  copiedKey === '__current__'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : currentCards.length === 0
                      ? 'bg-zinc-900 text-zinc-600 border border-white/[0.05] cursor-not-allowed'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-white/[0.08]'
                }`}
              >
                {copiedKey === '__current__' ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5" />
                    Link Copied
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3.5 h-3.5" />
                    Copy Shareable Link
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Saved Decks Header + Search */}
          <div className="flex items-center justify-between gap-3 shrink-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Saved Decks
            </h3>
            {savedDecks.length > 3 && (
              <div className="relative w-56">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter decks..."
                  className="w-full bg-zinc-950 border border-white/[0.08] rounded-md pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            )}
          </div>

          {/* Saved Decks List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-[160px]">
            {savedDecks.length === 0 ? (
              <div className="border border-dashed border-white/[0.08] rounded-lg p-8 text-center bg-zinc-950/40">
                <p className="text-xs text-zinc-400 font-medium">
                  No saved decks yet.
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Name your current deck above and click Save Deck to store it in your browser library.
                </p>
              </div>
            ) : filteredDecks.length === 0 ? (
              <div className="border border-white/[0.06] rounded-lg p-6 text-center bg-zinc-950/40">
                <p className="text-xs text-zinc-500">
                  No saved decks match &ldquo;{searchQuery}&rdquo;.
                </p>
              </div>
            ) : (
              filteredDecks.map((deck) => {
                const isActive = deck.id === activeDeckId;
                const isRenaming = renamingId === deck.id;
                const cardCount = getDeckCardCount(deck.cards);
                const commanderName = getDeckCommanderName(deck.cards, deck.commanderId);
                const estimatedPrice = getEstimatedUsdPrice(deck.cards);
                const isLinkCopied = copiedKey === deck.id;

                return (
                  <div
                    key={deck.id}
                    className={`rounded-lg border p-3.5 transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-amber-500/[0.06] border-amber-500/35'
                        : 'bg-[#0d0d10] border-white/[0.07] hover:border-white/[0.14]'
                    }`}
                  >
                    {/* Deck Info */}
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitRename(deck.id);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                            className="flex-1 bg-zinc-950 border border-amber-500/50 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => commitRename(deck.id)}
                            className="px-2 py-1 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40 text-[11px] font-medium hover:bg-amber-500/30"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            className="px-2 py-1 rounded bg-zinc-900 text-zinc-400 border border-white/[0.08] text-[11px] hover:text-zinc-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-zinc-100 truncate">
                            {deck.name}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 mt-1 text-[11px] font-mono text-zinc-400">
                        <span>{cardCount} cards</span>
                        {commanderName && (
                          <>
                            <span className="text-zinc-700">•</span>
                            <span className="inline-flex items-center gap-1 text-amber-300/85 max-w-[200px] truncate">
                              <CrownIcon className="w-3 h-3 shrink-0" />
                              <span className="truncate">{commanderName}</span>
                            </span>
                          </>
                        )}
                        {estimatedPrice !== null && (
                          <>
                            <span className="text-zinc-700">•</span>
                            <span className="text-emerald-400/85">
                              {formatUsd(estimatedPrice)}
                            </span>
                          </>
                        )}
                        <span className="text-zinc-700">•</span>
                        <span className="text-zinc-500">
                          Updated {formatUpdatedAt(deck.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isRenaming && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onLoadDeck(deck)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-zinc-900 hover:bg-zinc-800 text-amber-200 border border-amber-500/30'
                              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/35'
                          }`}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyShareLink(
                              deck.id,
                              deck.cards,
                              deck.commanderId,
                              deck.name
                            )
                          }
                          title="Copy shareable link"
                          className={`p-1.5 rounded-md border transition-all ${
                            isLinkCopied
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border-white/[0.08]'
                          }`}
                        >
                          {isLinkCopied ? (
                            <CheckIcon className="w-3.5 h-3.5" />
                          ) : (
                            <LinkIcon className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => startRenaming(deck)}
                          title="Rename deck"
                          className="p-1.5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-white/[0.08] transition-all"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDeck(deck.id)}
                          title="Delete deck"
                          className="p-1.5 rounded-md bg-zinc-900/90 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-white/[0.08] hover:border-rose-500/35 transition-all"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.06] bg-zinc-950/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onNewEmptyDeck();
              onClose();
            }}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-white/[0.08] rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Empty Deck
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-white/[0.08] rounded-md text-xs font-medium transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
