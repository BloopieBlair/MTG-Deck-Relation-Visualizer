import React from 'react';

interface ManaCostDisplayProps {
  manaCostString?: string;
  iconSizeClass?: string;
}

export const ManaCostDisplay: React.FC<ManaCostDisplayProps> = ({ manaCostString, iconSizeClass = 'w-3.5 h-3.5' }) => {
  if (!manaCostString) {
    return null;
  }

  const manaSymbolRegex = /\{([^}]+)\}/g;
  const parts: React.ReactElement[] = [];
  let match;
  let keyIndex = 0;

  while ((match = manaSymbolRegex.exec(manaCostString)) !== null) {
    const symbolContent = match[1].toUpperCase();
    const cleanSymbol = symbolContent.replace(/\//g, '');
    keyIndex++;

    parts.push(
      <img
        key={`${cleanSymbol}-${keyIndex}`}
        src={`https://svgs.scryfall.io/card-symbols/${cleanSymbol}.svg`}
        className={`${iconSizeClass} inline-block mx-px align-middle`}
        alt={symbolContent}
        onError={(e) => {
          // Fallback: hide broken image, log error
          const target = e.currentTarget as HTMLImageElement;
          target.style.display = 'none';
        }}
      />
    );
  }
  
  if (parts.length === 0 && manaCostString.match(/^\d+$/)) {
     return (
        <img
          src={`https://svgs.scryfall.io/card-symbols/${manaCostString}.svg`}
          className={`${iconSizeClass} inline-block mx-px align-middle`}
          alt={manaCostString}
        />
     )
  }

  return <div className="inline-flex items-center space-x-px flex-shrink-0">{parts}</div>;
};
