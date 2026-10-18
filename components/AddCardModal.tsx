import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PlusIcon } from './icons';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmAdd: (cardName: string) => void;
}

export const AddCardModal: React.FC<AddCardModalProps> = ({ isOpen, onClose, onConfirmAdd }) => {
  const [cardName, setCardName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCardName('');
      setTimeout(() => inputRef.current?.focus(), 0); 
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (cardName.trim()) {
      onConfirmAdd(cardName.trim());
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };
  
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
        onClose();
    }
  };

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-card-modal-title"
    >
      <div
        className="bg-[#0d0d10] p-5 md:p-6 rounded-xl shadow-2xl w-full max-w-md border border-white/[0.1]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.06]">
          <h3 id="add-card-modal-title" className="font-display text-base font-bold text-zinc-100">
            Add Card to Deck
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label="Close add card modal"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label htmlFor="card-name-input" className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            Card Name
          </label>
          <input
            id="card-name-input"
            ref={inputRef}
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., Sol Ring"
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md py-2 px-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
            aria-describedby="card-name-help"
          />
          <p id="card-name-help" className="text-[11px] text-zinc-500 mt-1.5">
            Enter the exact card name to fetch Oracle text &amp; synergies from Scryfall.
          </p>
        </div>

        <div className="mt-6 flex justify-end space-x-2.5">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            type="button"
            disabled={!cardName.trim()}
            className="px-4 py-2 text-xs font-semibold text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center"
          >
            <PlusIcon className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            Add Card
          </button>
        </div>
      </div>
    </div>
  );
};
