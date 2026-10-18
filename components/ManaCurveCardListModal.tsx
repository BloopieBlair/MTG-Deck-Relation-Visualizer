import React from 'react';
import type { ProcessedDeckCard } from '../types';
import { XMarkIcon } from './icons';
import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';

interface ManaCurveCardListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  cards: ProcessedDeckCard[];
  onCardClick: (card: ProcessedDeckCard) => void; 
}

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
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-40 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mana-curve-card-list-modal-title"
    >
      <div
        className="bg-[#0d0d10] p-4 md:p-6 rounded-xl shadow-2xl w-full max-w-xl md:max-w-4xl lg:max-w-6xl max-h-[85vh] flex flex-col border border-white/[0.1]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.06]">
          <h3 id="mana-curve-card-list-modal-title" className="font-display text-base md:text-lg font-bold text-amber-300 truncate pr-2">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1"
            aria-label="Close modal"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {cards.length > 0 ? (
          <div className="overflow-y-auto custom-scrollbar pr-2 flex-grow">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center">
              {cards.map((card) => (
                <div 
                  key={card.id + '-' + card.name} 
                  className="bg-zinc-900/70 p-2 rounded-lg border border-white/[0.06] hover:border-amber-500/40 flex flex-col items-center text-center group cursor-pointer w-full transition-all"
                  onClick={() => onCardClick(card)} 
                  title={`Click to enlarge ${card.name}`}
                >
                  <img
                    src={card.imageUrl || PLACEHOLDER_IMAGE_URL}
                    alt={`Image of ${card.name}`}
                    className="w-full aspect-[63/88] object-contain rounded border border-white/[0.08] mb-2 group-hover:shadow-lg transition-shadow"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (target.src !== PLACEHOLDER_IMAGE_URL) {
                        target.src = PLACEHOLDER_IMAGE_URL;
                        target.alt = `${card.name} (Image Load Error)`;
                      }
                    }}
                  />
                  <p className="text-xs font-medium text-zinc-200 leading-tight line-clamp-2" title={card.name}>
                    {card.quantity > 1 ? `${card.quantity}x ` : ''}{card.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-zinc-500 text-xs text-center py-8 flex-grow flex items-center justify-center">
            No cards match this criterion in your deck.
          </p>
        )}
      </div>
    </div>
  );
};
