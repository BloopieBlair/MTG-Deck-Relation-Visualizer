
import React from 'react';
import type { ProcessedDeckCard } from '../types';
import { XMarkIcon, CrownIcon } from './icons';

interface CommanderSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  potentialCommanders: ProcessedDeckCard[];
  currentCommanderId: string | null;
  onSetCommander: (card: ProcessedDeckCard) => void;
  onCardImageClick: (card: ProcessedDeckCard) => void; // For enlarging image
}

import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';

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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4"
      onClick={onClose} // Close if overlay is clicked
      role="dialog"
      aria-modal="true"
      aria-labelledby="commander-selection-modal-title"
    >
      <div
        className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl lg:max-w-6xl xl:max-w-7xl max-h-[90vh] flex flex-col border border-cyan-600"
        onClick={(e) => e.stopPropagation()} // Prevent close on modal content click
      >
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-cyan-700/50">
          <h3 id="commander-selection-modal-title" className="text-xl md:text-2xl font-bold text-cyan-400">
            Select Your Commander
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-cyan-300 transition-colors"
            aria-label="Close commander selection modal"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {potentialCommanders.length > 0 ? (
          <div className="overflow-y-auto custom-scrollbar pr-2 flex-grow">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 justify-items-center">
              {potentialCommanders.map((card) => (
                <div
                  key={card.id}
                  className={`relative bg-gray-700/50 p-2.5 rounded-md flex flex-col items-center text-center group cursor-pointer w-52 
                              ${card.id === currentCommanderId ? 'ring-2 ring-yellow-400 shadow-yellow-400/30' : 'hover:ring-2 hover:ring-cyan-400'}`}
                  onClick={() => onSetCommander(card)}
                  title={`Set ${card.name} as Commander`}
                >
                  {card.id === currentCommanderId && (
                    <CrownIcon className="absolute top-2 right-2 w-6 h-6 text-yellow-400 bg-black/50 rounded-full p-0.5" />
                  )}
                  <img
                    src={card.imageUrl || PLACEHOLDER_IMAGE_URL_COMMANDER}
                    alt={`Image of ${card.name}`}
                    className="w-full aspect-[63/88] object-contain rounded border border-gray-600 mb-2 group-hover:shadow-lg transition-shadow"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (target.src !== PLACEHOLDER_IMAGE_URL_COMMANDER) {
                        target.src = PLACEHOLDER_IMAGE_URL_COMMANDER;
                        target.alt = `${card.name} (Image Load Error)`;
                      }
                    }}
                    // Prevent setting commander if only clicking image to enlarge
                    onClick={(e) => { e.stopPropagation(); onCardImageClick(card); }}
                  />
                  <p className="text-sm font-semibold text-gray-200 leading-tight line-clamp-2 min-h-[2.5rem] flex items-center justify-center mb-1" title={card.name}>
                    {card.name}
                  </p>
                  <button 
                    className="mt-1 w-full text-sm font-bold py-1.5 px-3 rounded bg-teal-600 hover:bg-teal-500 text-white transition-colors"
                    onClick={(e) => { e.stopPropagation(); onSetCommander(card); }} // Ensure this click also sets commander
                  >
                    Set as Commander
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-base text-center py-10 flex-grow flex items-center justify-center">
            No legendary creatures found in your deck to set as Commander.
          </p>
        )}
      </div>
    </div>
  );
};
