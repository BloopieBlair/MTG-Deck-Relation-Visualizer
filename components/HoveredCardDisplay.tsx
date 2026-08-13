
import React, { useState, useEffect, useMemo } from 'react';
import type { ProcessedDeckCard } from '../types';
import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';
import { ArrowPathIcon } from './icons';

interface HoveredCardDisplayProps {
  card: ProcessedDeckCard | null;
  deckCards?: ProcessedDeckCard[];
}

const PLACEHOLDER_TEXT = "Hover over a card in the list to see it here.";
const PLACEHOLDER_IMAGE_URL = PLACEHOLDER_CARD_IMAGE_URL;

export const HoveredCardDisplay: React.FC<HoveredCardDisplayProps> = ({ card, deckCards = [] }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isLoadingImg, setIsLoadingImg] = useState<boolean>(false);
  const [retryStage, setRetryStage] = useState<number>(0);

  // Determine the best initial image URL from deckCards, localStorage cache, or card.imageUrl
  const bestInitialImageUrl = useMemo(() => {
    if (!card) return null;

    // 1. Direct hit from deckCards if present
    if (deckCards && deckCards.length > 0) {
      const normName = card.name.toLowerCase().trim();
      const inDeck = deckCards.find(c => c.name.toLowerCase().trim() === normName || c.id === card.id);
      if (inDeck && inDeck.imageUrl && inDeck.imageUrl.includes('cards.scryfall.io')) {
        return inDeck.imageUrl;
      }
    }

    // 2. Direct hit from Scryfall localStorage cache
    try {
      const cacheKey = `scryfall_cache_${card.name.toLowerCase().trim()}`;
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (parsed && parsed.imageUrl) {
          return parsed.imageUrl;
        }
      }
    } catch {}

    // 3. Original card imageUrl
    return card.imageUrl || null;
  }, [card, deckCards]);

  useEffect(() => {
    setImgSrc(bestInitialImageUrl);
    setIsLoadingImg(Boolean(bestInitialImageUrl && bestInitialImageUrl !== PLACEHOLDER_IMAGE_URL));
    setRetryStage(0);
  }, [card?.id, card?.name, bestInitialImageUrl]);

  const handleImageError = () => {
    if (!card) return;
    if (retryStage === 0) {
      // Retry 1: Try fuzzy Scryfall named image URL
      setRetryStage(1);
      setImgSrc(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.name)}&format=image`);
    } else if (retryStage === 1) {
      // Retry 2: Give up and show placeholder
      setRetryStage(2);
      setIsLoadingImg(false);
      setImgSrc(PLACEHOLDER_IMAGE_URL);
    }
  };

  return (
    <div className="bg-gray-900/80 rounded-xl p-2 border-2 border-cyan-800/60 shadow-xl flex items-center justify-center text-center flex-shrink-0 mx-auto transition-all w-[270px] h-[360px] relative overflow-hidden">
      {card && imgSrc ? (
        <>
          {isLoadingImg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 backdrop-blur-xs z-10 space-y-2">
              <ArrowPathIcon className="w-6 h-6 text-cyan-400 animate-spin" />
              <span className="text-[11px] font-mono text-cyan-300">Loading Card Art...</span>
            </div>
          )}
          <img
            src={imgSrc}
            alt={`Image of ${card.name}`}
            className="w-full h-full object-contain rounded drop-shadow-lg"
            key={`${card.id}-${retryStage}`}
            onLoad={() => setIsLoadingImg(false)}
            onError={handleImageError}
          />
        </>
      ) : (
        <div className="text-gray-400 text-xs px-4 py-2 leading-relaxed flex flex-col items-center justify-center space-y-2">
          <span className="text-cyan-400 font-bold text-sm">Card Preview</span>
          <span>{card ? `Image for "${card.name}" not available.` : PLACEHOLDER_TEXT}</span>
        </div>
      )}
    </div>
  );
};
