

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
  
  // Extract from rules text, ignoring reminder text in parentheses
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

  // Basic lands type line or name check
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
      <div className="flex-grow flex flex-col items-center justify-center text-gray-400 p-4 text-center h-full">
        <h2 className="text-xl font-medium text-gray-300">Deck List Empty</h2>
        <p className="text-sm mt-1 text-gray-400">Upload a decklist or add cards to see them here.</p>
      </div>
    );
  }

  // Find commander card
  const commanderCard = cards.find(c => c.id === commanderId) || null;
  // Get commander's color identity
  const commanderIdentity = commanderCard ? new Set(getCardColorIdentity(commanderCard)) : new Set<string>();
  
  // Filter out the commander from the main deck list
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
    
    return (
      <li
        key={card.id}
        onMouseEnter={() => onCardHover(card)}
        onMouseLeave={onCardLeave}
        className={`flex items-center justify-between p-2 rounded-md transition-all duration-150 ease-in-out
                    ${selectedCardId === card.id 
                      ? 'bg-cyan-700/60 ring-1 ring-white shadow-md' 
                      : 'bg-gray-700/40 hover:bg-gray-700/70'}
                    ${invalid ? 'ring-2 ring-red-500 shadow-red-500/20' : ''}`}
      >
        <div 
            className="flex items-center overflow-hidden flex-grow cursor-pointer"
            onClick={() => onCardSelect(card.id)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    onCardSelect(card.id);
                }
            }}
            aria-current={selectedCardId === card.id ? "true" : undefined}
            title={invalid 
              ? `COLOR WARNING: Color identity (${cardIden.join(', ') || 'Colorless'}) is outside commander's identity (${Array.from(commanderIdentity).join(', ') || 'Colorless'})`
              : `Highlight ${card.name}`}
        >
          <span className={`mr-2 font-medium text-sm w-8 text-right ${selectedCardId === card.id ? 'text-yellow-300' : 'text-gray-300'}`}>
            {isCommanderSection ? '1x' : `${card.quantity}x`}
          </span>
          <span className={`truncate text-sm ${selectedCardId === card.id ? 'text-white font-semibold' : 'text-gray-200'} flex items-center gap-1`} title={card.name}>
            {card.name}
            {invalid && (
              <span 
                className="text-red-500 font-bold ml-1" 
                title={`Card color identity (${cardIden.join(', ') || 'Colorless'}) does not match commander's identity (${Array.from(commanderIdentity).join(', ') || 'Colorless'})`}
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
                className="ml-2 p-1 text-red-400 hover:text-red-300 rounded-full hover:bg-red-500/20 transition-colors"
                title={`Delete ${card.name} from deck`}
                aria-label={`Delete ${card.name} from deck`}
            >
                <TrashIcon className="w-3.5 h-3.5" />
            </button>
        </div>
      </li>
    );
  };

  return (
    <div className="bg-gray-850 rounded-lg h-full overflow-hidden flex flex-col">
      {commanderCard && (
        <div className="mb-4 flex-shrink-0">
          <h3 className="text-base font-bold text-yellow-400 mb-2 px-1 border-b border-yellow-700/60 pb-1.5 flex items-center gap-1.5">
             👑 Commander
          </h3>
          <ul className="space-y-1">
             {renderCardItem(commanderCard, true)}
          </ul>
        </div>
      )}
      
      <h3 className="text-base font-semibold text-cyan-400 mb-2 px-1 border-b border-gray-700/60 pb-1.5 flex-shrink-0">
        Full Deck List ({nonCommanderCards.reduce((sum, card) => sum + card.quantity, 0)} cards)
      </h3>
      <div className="overflow-y-auto custom-scrollbar flex-grow pr-1.5">
        <ul className="space-y-1">
          {sortedCards.map((card) => renderCardItem(card, false))}
        </ul>
      </div>
    </div>
  );
};