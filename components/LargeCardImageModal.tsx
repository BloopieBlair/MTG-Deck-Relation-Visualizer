import React from 'react';
import type { ProcessedDeckCard } from '../types';
import { XMarkIcon } from './icons';
import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';

interface LargeCardImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: ProcessedDeckCard | null;
}

const MODAL_PLACEHOLDER_IMAGE_URL = PLACEHOLDER_CARD_IMAGE_URL;

export const LargeCardImageModal: React.FC<LargeCardImageModalProps> = ({
  isOpen,
  onClose,
  card
}) => {
  if (!isOpen || !card) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 backdrop-blur-md p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="large-card-image-modal-title"
    >
      <div
        className="bg-[#0d0d10] p-3 md:p-4 rounded-xl shadow-2xl w-auto max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col border border-amber-500/40 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
            onClick={onClose}
            className="absolute top-2.5 right-2.5 p-1.5 bg-black/70 hover:bg-zinc-800 border border-white/[0.1] rounded-full text-zinc-300 hover:text-amber-300 transition-colors z-10"
            aria-label="Close large card image"
        >
            <XMarkIcon className="w-4 h-4" />
        </button>
        
        <img
            src={card.imageUrl || MODAL_PLACEHOLDER_IMAGE_URL}
            alt={`Image of ${card.name}`}
            className="w-full h-auto max-h-[80vh] object-contain rounded-lg shadow-lg"
            onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (target.src !== MODAL_PLACEHOLDER_IMAGE_URL) {
                target.src = MODAL_PLACEHOLDER_IMAGE_URL;
                target.alt = `${card.name} (Image Load Error)`;
                }
            }}
        />
        <h3 id="large-card-image-modal-title" className="font-display text-sm font-bold text-amber-300 mt-2.5 text-center truncate" title={card.name}>
          {card.name}
        </h3>
      </div>
    </div>
  );
};
