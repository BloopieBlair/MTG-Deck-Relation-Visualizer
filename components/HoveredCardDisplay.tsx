import React, { useState, useEffect, useMemo } from 'react';
import type { ProcessedDeckCard } from '../types';
import { PLACEHOLDER_CARD_IMAGE_URL } from '../constants';
import { ArrowPathIcon } from './icons';

interface HoveredCardDisplayProps {
  card: ProcessedDeckCard | null;
  deckCards?: ProcessedDeckCard[];
}

const PLACEHOLDER_IMAGE_URL = PLACEHOLDER_CARD_IMAGE_URL;

export const HoveredCardDisplay: React.FC<HoveredCardDisplayProps> = ({ card, deckCards = [] }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isLoadingImg, setIsLoadingImg] = useState<boolean>(false);
  const [retryStage, setRetryStage] = useState<number>(0);

  const bestInitialImageUrl = useMemo(() => {
    if (!card) return null;

    if (deckCards && deckCards.length > 0) {
      const normName = card.name.toLowerCase().trim();
      const inDeck = deckCards.find(c => c.name.toLowerCase().trim() === normName || c.id === card.id);
      if (inDeck && inDeck.imageUrl && inDeck.imageUrl.includes('cards.scryfall.io')) {
        return inDeck.imageUrl;
      }
    }

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
      setRetryStage(1);
      setImgSrc(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.name)}&format=image`);
    } else if (retryStage === 1) {
      setRetryStage(2);
      setIsLoadingImg(false);
      setImgSrc(PLACEHOLDER_IMAGE_URL);
    }
  };

  return (
    <div className="bg-zinc-900/60 rounded-xl p-2 border border-zinc-800/90 shadow-inner flex items-center justify-center text-center flex-shrink-0 mx-auto transition-all w-[250px] h-[340px] relative overflow-hidden">
      {card && imgSrc ? (
        <>
          {isLoadingImg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-xs z-10 space-y-2">
              <ArrowPathIcon className="w-5 h-5 text-amber-400 animate-spin" />
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Fetching Scryfall Art...</span>
            </div>
          )}
          <img
            src={imgSrc}
            alt={`Image of ${card.name}`}
            className="w-full h-full object-contain rounded-lg drop-shadow-2xl"
            key={`${card.id}-${retryStage}`}
            onLoad={() => setIsLoadingImg(false)}
            onError={handleImageError}
          />
        </>
      ) : (
        <div className="text-zinc-500 text-xs px-5 py-2 leading-relaxed flex flex-col items-center justify-center space-y-2">
          <div className="w-10 h-14 rounded border border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 font-display text-sm">
            M
          </div>
          <span className="text-zinc-400 font-medium text-xs">Card Inspector</span>
          <span className="text-[11px] text-zinc-600">
            {card ? `Artwork for "${card.name}" unavailable.` : 'Hover or select any card node to inspect oracle art.'}
          </span>
        </div>
      )}
    </div>
  );
};
