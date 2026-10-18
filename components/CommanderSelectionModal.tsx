import React from 'react';
import type { ProcessedDeckCard } from '../types';
import { XMarkIcon, CrownIcon } from './icons';
import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';

interface CommanderSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  potentialCommanders: ProcessedDeckCard[];
  currentCommanderId: string | null;
  onSetCommander: (card: ProcessedDeckCard) => void;
  onCardImageClick: (card: ProcessedDeckCard) => void;
}

const PLACEHOLDER_IMAGE_URL_COMMANDER = PLACEHOLDER_CARD_IMAGE_URL;

export const CommanderSelectionModal: React.FC<CommanderSelectionModalProps> = ({
  isOpen,
  onClose,
  potentialCommanders,
  currentCommanderId,
  onSetCommander,
  onCardImageClick,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="commander-selection-modal-title"
    >
      <div
        className="bg-[#0d0d10] p-6 rounded-xl shadow-2xl w-full max-w-4xl lg:max-w-6xl max-h-[90vh] flex flex-col border border-white/[0.1]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <CrownIcon className="w-5 h-5 text-amber-400" />
            <h3 id="commander-selection-modal-title" className="font-display text-lg font-bold text-zinc-100">
              Select Your Commander
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1"
            aria-label="Close commander selection modal"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {potentialCommanders.length > 0 ? (
          <div className="overflow-y-auto custom-scrollbar pr-2 flex-grow">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center">
              {potentialCommanders.map((card) => (
                <div
                  key={card.id}
                  className={`relative bg-zinc-900/70 p-2.5 rounded-lg flex flex-col items-center text-center group cursor-pointer w-full border transition-all
                              ${card.id === currentCommanderId ? 'border-amber-400 ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/10' : 'border-white/[0.06] hover:border-amber-500/40'}`}
                  onClick={() => onSetCommander(card)}
                  title={`Set ${card.name} as Commander`}
                >
                  {card.id === currentCommanderId && (
                    <CrownIcon className="absolute top-3 right-3 w-6 h-6 text-amber-400 bg-black/80 rounded-full p-1 border border-amber-400/40" />
                  )}
                  <img
                    src={card.imageUrl || PLACEHOLDER_IMAGE_URL_COMMANDER}
                    alt={`Image of ${card.name}`}
                    className="w-full aspect-[63/88] object-contain rounded border border-white/[0.08] mb-2 group-hover:shadow-lg transition-shadow"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (target.src !== PLACEHOLDER_IMAGE_URL_COMMANDER) {
                        target.src = PLACEHOLDER_IMAGE_URL_COMMANDER;
                        target.alt = `${card.name} (Image Load Error)`;
                      }
                    }}
                    onClick={(e) => { e.stopPropagation(); onCardImageClick(card); }}
                  />
                  <p className="text-xs font-semibold text-zinc-200 leading-tight line-clamp-2 min-h-[2rem] flex items-center justify-center mb-1.5" title={card.name}>
                    {card.name}
                  </p>
                  <button 
                    className="mt-auto w-full text-xs font-semibold py-1.5 px-3 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-200 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onSetCommander(card); }}
                  >
                    Set Commander
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-zinc-500 text-xs text-center py-10 flex-grow flex items-center justify-center">
            No legendary creatures found in your deck to set as Commander.
          </p>
        )}
      </div>
    </div>
  );
};
