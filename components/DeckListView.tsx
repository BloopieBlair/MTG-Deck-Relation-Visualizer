import React from 'react';
import type { ProcessedDeckCard } from '../types';
import { ManaCostDisplay } from './ManaCostDisplay';
import { TrashIcon } from './icons';

interface DeckListViewProps {
  cards: ProcessedDeckCard[];
  onCardHover: (card: ProcessedDeckCard) => void;
  onCardLeave: () => void;
  onCardSelect: (cardId: string) => void;
  selectedCardId: string | null;
  onCardDelete: (cardId: string) => void;
  commanderId: string | null;
}

const getCardColorIdentity = (card: ProcessedDeckCard): string[] => {
  if (card.colorIdentity && card.colorIdentity.length > 0) return card.colorIdentity;
  
  const identity = new Set<string>();
  if (card.colors) {
    card.colors.forEach(c => identity.add(c));
  }
  if (card.manaCostString) {
    const matches = card.manaCostString.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach(m => {
        const clean = m.replace(/[{}]/g, '').toUpperCase();
        const parts = clean.split('/');
        parts.forEach(p => {
          if (['W', 'U', 'B', 'R', 'G'].includes(p)) {
            identity.add(p);
          }
        });
      });
    }
  }
  
  if (card.text) {
    const cleanText = card.text.replace(/\([^)]*\)/g, '');
    const matches = cleanText.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach(m => {
        const clean = m.replace(/[{}]/g, '').toUpperCase();
        const parts = clean.split('/');
        parts.forEach(p => {
          if (['W', 'U', 'B', 'R', 'G'].includes(p)) {
            identity.add(p);
          }
        });
      });
    }
  }

  const typeLineLower = (card.typeLine || '').toLowerCase();
  const nameLower = card.name.toLowerCase();
  if (typeLineLower.includes('basic') && typeLineLower.includes('land')) {
    if (typeLineLower.includes('plains') || nameLower.startsWith('plains')) identity.add('W');
    else if (typeLineLower.includes('island') || nameLower.startsWith('island')) identity.add('U');
    else if (typeLineLower.includes('swamp') || nameLower.startsWith('swamp')) identity.add('B');
    else if (typeLineLower.includes('mountain') || nameLower.startsWith('mountain')) identity.add('R');
    else if (typeLineLower.includes('forest') || nameLower.startsWith('forest')) identity.add('G');
  }

  return Array.from(identity);
};

export const DeckListView: React.FC<DeckListViewProps> = ({ 
  cards, 
  onCardHover, 
  onCardLeave, 
  onCardSelect, 
  selectedCardId, 
  onCardDelete,
  commanderId
}) => {
  if (!cards || cards.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-zinc-500 p-4 text-center h-full">
        <p className="text-xs font-medium text-zinc-400">No Deck Loaded</p>
        <p className="text-[11px] mt-1 text-zinc-600">Import a deck file or select a preset on the left.</p>
      </div>
    );
  }

  const commanderCard = cards.find(c => c.id === commanderId) || null;
  const commanderIdentity = commanderCard ? new Set(getCardColorIdentity(commanderCard)) : new Set<string>();
  
  const nonCommanderCards = cards.filter(c => c.id !== commanderId);
  const sortedCards = [...nonCommanderCards].sort((a, b) => a.name.localeCompare(b.name));

  const isCardInvalid = (card: ProcessedDeckCard): boolean => {
    if (!commanderCard || card.id === commanderId) return false;
    const cardIden = getCardColorIdentity(card);
    return cardIden.some(c => !commanderIdentity.has(c));
  };

  const renderCardItem = (card: ProcessedDeckCard, isCommanderSection: boolean) => {
    const invalid = isCardInvalid(card);
    const cardIden = getCardColorIdentity(card);
    const isSelected = selectedCardId === card.id;
    
    return (
      <li
        key={card.id}
        onMouseEnter={() => onCardHover(card)}
        onMouseLeave={onCardLeave}
        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md border transition-all duration-150 ${
          isSelected
            ? 'bg-amber-500/15 border-amber-500/50 shadow-sm'
            : isCommanderSection
              ? 'bg-amber-950/20 border-amber-500/30 hover:bg-amber-950/35'
              : 'bg-zinc-900/50 border-zinc-800/60 hover:bg-zinc-800/70 hover:border-zinc-700'
        } ${invalid ? 'ring-1 ring-rose-500/80 border-rose-500/60' : ''}`}
      >
        <div 
          className="flex items-center overflow-hidden flex-grow cursor-pointer"
          onClick={() => onCardSelect(card.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onCardSelect(card.id);
            }
          }}
          aria-current={isSelected ? "true" : undefined}
          title={invalid 
            ? `COLOR WARNING: Color identity (${cardIden.join(', ') || 'Colorless'}) is outside commander's identity (${Array.from(commanderIdentity).join(', ') || 'Colorless'})`
            : `Select ${card.name}`}
        >
          <span className={`mr-2 font-mono text-[11px] w-6 text-right shrink-0 ${
            isSelected ? 'text-amber-300 font-semibold' : 'text-zinc-500'
          }`}>
            {isCommanderSection ? '1x' : `${card.quantity}x`}
          </span>
          <span className={`truncate text-xs ${
            isSelected ? 'text-amber-100 font-semibold' : isCommanderSection ? 'text-amber-200 font-medium' : 'text-zinc-200'
          } flex items-center gap-1`} title={card.name}>
            {card.name}
            {invalid && (
              <span 
                className="text-rose-400 font-bold ml-1 text-[10px]" 
                title={`Card color identity (${cardIden.join(', ') || 'Colorless'}) does not match commander's identity`}
              >
                ⚠️
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center flex-shrink-0 ml-2">
          <ManaCostDisplay manaCostString={card.manaCostString} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCardDelete(card.id);
            }}
            className="ml-1.5 p-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 rounded transition-all"
            title={`Remove ${card.name}`}
            aria-label={`Remove ${card.name}`}
          >
            <TrashIcon className="w-3 h-3" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {commanderCard && (
        <div className="mb-3 flex-shrink-0">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/90 flex items-center gap-1.5">
              <span>👑 Commander</span>
            </h3>
          </div>
          <ul className="space-y-1">
            {renderCardItem(commanderCard, true)}
          </ul>
        </div>
      )}
      
      <div className="flex items-center justify-between px-1 mb-1.5 flex-shrink-0">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Mainboard
        </h3>
        <span className="text-[10px] font-mono text-zinc-500">
          {nonCommanderCards.reduce((sum, card) => sum + card.quantity, 0)} cards
        </span>
      </div>
      <div className="overflow-y-auto custom-scrollbar flex-grow pr-1">
        <ul className="space-y-1">
          {sortedCards.map((card) => renderCardItem(card, false))}
        </ul>
      </div>
    </div>
  );
};