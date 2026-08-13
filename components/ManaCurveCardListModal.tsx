
import React from 'react';
import type { ProcessedDeckCard } from '../types';
import { XMarkIcon } from './icons';

interface ManaCurveCardListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  cards: ProcessedDeckCard[];
  onCardClick: (card: ProcessedDeckCard) => void; 
}

import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';

const PLACEHOLDER_IMAGE_URL = PLACEHOLDER_CARD_IMAGE_URL;


export const ManaCurveCardListModal: React.FC<ManaCurveCardListModalProps> = ({
  isOpen,
  onClose,
  title,
  cards,
  onCardClick 
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mana-curve-card-list-modal-title"
    >
      <div
        className="bg-gray-800 p-4 md:p-5 rounded-lg shadow-xl w-full max-w-xl md:max-w-4xl lg:max-w-7xl xl:max-w-[1650px] max-h-[85vh] flex flex-col border border-cyan-600"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3 pb-3 border-b border-cyan-700/50">
          <h3 id="mana-curve-card-list-modal-title" className="text-lg md:text-xl font-semibold text-cyan-400 truncate pr-2">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-cyan-300 transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {cards.length > 0 ? (
          <div className="overflow-y-auto custom-scrollbar pr-2 flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 justify-items-center">
              {cards.map((card) => (
                <div 
                  key={card.id + '-' + card.name} 
                  className="bg-gray-700/50 p-1.5 rounded-md flex flex-col items-center text-center group cursor-pointer w-96"
                  onClick={() => onCardClick(card)} 
                  title={`Click to enlarge ${card.name}`}
                >
                  <img
                    src={card.imageUrl || PLACEHOLDER_IMAGE_URL}
                    alt={`Image of ${card.name}`}
                    className="w-full aspect-[63/88] object-contain rounded border border-gray-600 mb-1 group-hover:shadow-cyan-400/30 transition-shadow"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (target.src !== PLACEHOLDER_IMAGE_URL) {
                        target.src = PLACEHOLDER_IMAGE_URL;
                        target.alt = `${card.name} (Image Load Error)`;
                      }
                    }}
                  />
                  <p className="text-xs font-medium text-gray-200 leading-tight line-clamp-2" title={card.name}>
                    {card.quantity > 1 ? `${card.quantity}x ` : ''}{card.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8 flex-grow flex items-center justify-center">
            No cards match this criterion in your deck.
          </p>
        )}
      </div>
    </div>
  );
};
