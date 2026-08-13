
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
      setCardName(''); // Reset card name on open
      // Focus the input field when the modal opens
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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-card-modal-title"
    >
      <div
        className="bg-gray-800 p-5 md:p-6 rounded-lg shadow-xl w-full max-w-md border border-cyan-600"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="add-card-modal-title" className="text-lg font-semibold text-cyan-400">
            Add New Card to Graph
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-cyan-300 transition-colors"
            aria-label="Close add card modal"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label htmlFor="card-name-input" className="block text-sm font-medium text-gray-300 mb-1.5">
            Card Name:
          </label>
          <input
            id="card-name-input"
            ref={inputRef}
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., Sol Ring"
            className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            aria-describedby="card-name-help"
          />
          <p id="card-name-help" className="text-xs text-gray-400 mt-1.5">
            Enter the full name of the card. The system will try to fetch its data from Scryfall.
          </p>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            type="button"
            disabled={!cardName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center"
          >
            <PlusIcon className="w-4 h-4 mr-1.5" />
            Add Card
          </button>
        </div>
      </div>
    </div>
  );
};
