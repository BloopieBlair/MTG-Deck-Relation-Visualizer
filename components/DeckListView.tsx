import React, { useState, useMemo } from 'react';
import type { ProcessedDeckCard, DeckZone } from '../types';
import { ManaCostDisplay } from './ManaCostDisplay';
import { TrashIcon, CrownIcon, ShieldCheckIcon } from './icons';

type GroupingMode = 'type' | 'cmc' | 'role' | 'az';
type ActiveZoneTab = 'mainboard' | 'considering';

interface DeckListViewProps {
  cards: ProcessedDeckCard[];
  onCardHover: (card: ProcessedDeckCard) => void;
  onCardLeave: () => void;
  onCardSelect: (cardId: string) => void;
  selectedCardId: string | null;
  onCardDelete: (cardId: string) => void;
  commanderId: string | null;
  onQuantityChange?: (cardId: string, delta: number) => void;
  onSetCommander?: (cardId: string) => void;
  onMoveZone?: (cardId: string, zone: DeckZone) => void;
}

const getCardColorIdentity = (card: ProcessedDeckCard): string[] => {
  if (card.colorIdentity && card.colorIdentity.length > 0) return card.colorIdentity;

  const identity = new Set<string>();
  if (card.colors) {
    card.colors.forEach((c) => identity.add(c));
  }
  if (card.manaCostString) {
    const matches = card.manaCostString.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach((m) => {
        const clean = m.replace(/[{}]/g, '').toUpperCase();
        clean.split('/').forEach((p) => {
          if (['W', 'U', 'B', 'R', 'G'].includes(p)) {
            identity.add(p);
          }
        });
      });
    }
  }

  if (card.text) {
    const cleanText = card.text.replace(/\([^)]*\)/g, '');
    const matches = cleanText.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach((m) => {
        const clean = m.replace(/[{}]/g, '').toUpperCase();
        clean.split('/').forEach((p) => {
          if (['W', 'U', 'B', 'R', 'G'].includes(p)) {
            identity.add(p);
          }
        });
      });
    }
  }

  const typeLineLower = (card.typeLine || '').toLowerCase();
  const nameLower = card.name.toLowerCase();
  if (typeLineLower.includes('basic') && typeLineLower.includes('land')) {
    if (typeLineLower.includes('plains') || nameLower.startsWith('plains')) identity.add('W');
    else if (typeLineLower.includes('island') || nameLower.startsWith('island')) identity.add('U');
    else if (typeLineLower.includes('swamp') || nameLower.startsWith('swamp')) identity.add('B');
    else if (typeLineLower.includes('mountain') || nameLower.startsWith('mountain')) identity.add('R');
    else if (typeLineLower.includes('forest') || nameLower.startsWith('forest')) identity.add('G');
  }

  return Array.from(identity);
};

const getFrontTypeLine = (card: ProcessedDeckCard): string => {
  const tl = card.typeLine || '';
  return tl.split('//')[0].trim().toLowerCase();
};

const isLandCard = (card: ProcessedDeckCard): boolean => {
  const front = getFrontTypeLine(card);
  if (front) return front.includes('land');
  return card.keywords?.includes('land') ?? false;
};

const isBasicLand = (card: ProcessedDeckCard): boolean => {
  const tl = (card.typeLine || '').toLowerCase();
  if (tl.includes('basic') && tl.includes('land')) return true;
  const nameLower = card.name.toLowerCase();
  return ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes',
    'snow-covered plains', 'snow-covered island', 'snow-covered swamp',
    'snow-covered mountain', 'snow-covered forest', 'snow-covered wastes'].includes(nameLower);
};

const allowsMultipleCopies = (card: ProcessedDeckCard): boolean => {
  if (isBasicLand(card)) return true;
  const textLower = (card.text || '').toLowerCase();
  return textLower.includes('a deck can have any number of cards named');
};

const canBeCommander = (card: ProcessedDeckCard): boolean => {
  const front = getFrontTypeLine(card);
  const textLower = (card.text || '').toLowerCase();
  if (textLower.includes('can be your commander')) return true;
  return front.includes('legendary') && (front.includes('creature') || front.includes('planeswalker'));
};

const getCardCmc = (card: ProcessedDeckCard): number => {
  if (typeof card.cmc === 'number' && !Number.isNaN(card.cmc)) {
    return card.cmc;
  }
  if (!card.parsedManaCost) return 0;
  let total = 0;
  for (const [key, val] of Object.entries(card.parsedManaCost)) {
    if (key === 'X' || typeof val !== 'number') continue;
    total += val;
  }
  return total;
};

const TYPE_GROUP_ORDER = [
  'Creatures',
  'Instants',
  'Sorceries',
  'Artifacts',
  'Enchantments',
  'Planeswalkers',
  'Lands',
  'Other',
];

const getTypeGroup = (card: ProcessedDeckCard): string => {
  const front = getFrontTypeLine(card);
  if (front.includes('creature')) return 'Creatures';
  if (front.includes('instant')) return 'Instants';
  if (front.includes('sorcery')) return 'Sorceries';
  if (front.includes('land')) return 'Lands';
  if (front.includes('artifact')) return 'Artifacts';
  if (front.includes('enchantment')) return 'Enchantments';
  if (front.includes('planeswalker')) return 'Planeswalkers';
  // Fallback to keywords if typeLine missing
  const kws = card.keywords || [];
  if (kws.includes('creature')) return 'Creatures';
  if (kws.includes('instant')) return 'Instants';
  if (kws.includes('sorcery')) return 'Sorceries';
  if (kws.includes('land')) return 'Lands';
  if (kws.includes('artifact')) return 'Artifacts';
  if (kws.includes('enchantment')) return 'Enchantments';
  if (kws.includes('planeswalker')) return 'Planeswalkers';
  return 'Other';
};

const CMC_GROUP_ORDER = ['0', '1', '2', '3', '4', '5', '6+', 'Lands'];

const getCmcGroup = (card: ProcessedDeckCard): string => {
  if (isLandCard(card)) return 'Lands';
  const cmc = Math.floor(getCardCmc(card));
  if (cmc <= 0) return '0';
  if (cmc >= 6) return '6+';
  return String(cmc);
};

const ROLE_GROUP_ORDER = [
  'Ramp',
  'Draw',
  'Removal',
  'Board Wipes',
  'Synergy / Other',
  'Lands',
];

const getRoleGroup = (card: ProcessedDeckCard): string => {
  if (isLandCard(card)) return 'Lands';
  const kws = new Set((card.keywords || []).map((k) => k.toLowerCase()));
  const textLower = (card.text || '').toLowerCase();

  if (
    kws.has('board wipe') ||
    /\b(destroy all|exile all|each creature gets -|all creatures get -)\b/i.test(textLower)
  ) {
    return 'Board Wipes';
  }
  if (kws.has('removal') || kws.has('counter')) {
    return 'Removal';
  }
  if (
    kws.has('mana ramp') ||
    kws.has('treasure') ||
    kws.has('cost reduction') ||
    (card.producesMana && card.producesMana.length > 0)
  ) {
    return 'Ramp';
  }
  if (kws.has('card draw') || kws.has('tutor')) {
    return 'Draw';
  }
  return 'Synergy / Other';
};

const isConsideringZone = (zone?: DeckZone): boolean =>
  zone === 'considering' || zone === 'sideboard';

export const DeckListView: React.FC<DeckListViewProps> = ({
  cards,
  onCardHover,
  onCardLeave,
  onCardSelect,
  selectedCardId,
  onCardDelete,
  commanderId,
  onQuantityChange,
  onSetCommander,
  onMoveZone,
}) => {
  const [groupBy, setGroupBy] = useState<GroupingMode>('type');
  const [activeTab, setActiveTab] = useState<ActiveZoneTab>('mainboard');
  const [showLegalityDetails, setShowLegalityDetails] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const commanderCard = useMemo(
    () => cards.find((c) => c.id === commanderId) || null,
    [cards, commanderId]
  );

  const commanderIdentity = useMemo(
    () => (commanderCard ? new Set(getCardColorIdentity(commanderCard)) : new Set<string>()),
    [commanderCard]
  );

  const { mainboardCards, consideringCards } = useMemo(() => {
    const main: ProcessedDeckCard[] = [];
    const cons: ProcessedDeckCard[] = [];
    for (const card of cards) {
      if (card.id === commanderId) continue;
      if (isConsideringZone(card.zone)) {
        cons.push(card);
      } else {
        main.push(card);
      }
    }
    return { mainboardCards: main, consideringCards: cons };
  }, [cards, commanderId]);

  const activeDeckCards = useMemo(
    () => (commanderCard ? [commanderCard, ...mainboardCards] : mainboardCards),
    [commanderCard, mainboardCards]
  );

  const totalMainboardCount = useMemo(
    () => activeDeckCards.reduce((sum, c) => sum + c.quantity, 0),
    [activeDeckCards]
  );

  const totalConsideringCount = useMemo(
    () => consideringCards.reduce((sum, c) => sum + c.quantity, 0),
    [consideringCards]
  );

  const { totalUsdPrice, hasAnyPrice } = useMemo(() => {
    let total = 0;
    let foundPrice = false;
    for (const card of activeDeckCards) {
      const parsed = card.prices?.usd ? parseFloat(card.prices.usd) : NaN;
      if (!Number.isNaN(parsed)) {
        total += parsed * card.quantity;
        foundPrice = true;
      }
    }
    return { totalUsdPrice: total, hasAnyPrice: foundPrice };
  }, [activeDeckCards]);

  const isColorIdentityInvalid = (card: ProcessedDeckCard): boolean => {
    if (!commanderCard || card.id === commanderId) return false;
    const cardIden = getCardColorIdentity(card);
    return cardIden.some((c) => !commanderIdentity.has(c));
  };

  const getCommanderLegalityStatus = (card: ProcessedDeckCard): 'banned' | 'not_legal' | null => {
    const status = card.legalities?.commander;
    if (status === 'banned') return 'banned';
    if (status === 'not_legal') return 'not_legal';
    return null;
  };

  const legalityIssues = useMemo(() => {
    const issues: string[] = [];

    if (totalMainboardCount !== 100) {
      issues.push(`Deck has ${totalMainboardCount}/100 cards`);
    }

    for (const card of activeDeckCards) {
      if (card.quantity > 1 && !allowsMultipleCopies(card)) {
        issues.push(`Singleton violation: ${card.name} (${card.quantity}x)`);
      }
      if (isColorIdentityInvalid(card)) {
        const cardIden = getCardColorIdentity(card);
        issues.push(
          `Color identity: ${card.name} (${cardIden.join('') || 'C'}) outside commander (${
            Array.from(commanderIdentity).join('') || 'C'
          })`
        );
      }
      const legStatus = getCommanderLegalityStatus(card);
      if (legStatus === 'banned') {
        issues.push(`Banned in Commander: ${card.name}`);
      } else if (legStatus === 'not_legal') {
        issues.push(`Not legal in Commander: ${card.name}`);
      }
    }

    return issues;
  }, [activeDeckCards, totalMainboardCount, commanderCard, commanderIdentity]);

  const displayedCards = activeTab === 'mainboard' ? mainboardCards : consideringCards;

  const groupedCards = useMemo(() => {
    const sorted = [...displayedCards].sort((a, b) => a.name.localeCompare(b.name));

    if (groupBy === 'az') {
      return [{ label: activeTab === 'mainboard' ? 'All Cards' : 'Considering', cards: sorted }];
    }

    const map = new Map<string, ProcessedDeckCard[]>();
    const order =
      groupBy === 'type'
        ? TYPE_GROUP_ORDER
        : groupBy === 'cmc'
          ? CMC_GROUP_ORDER
          : ROLE_GROUP_ORDER;

    for (const key of order) {
      map.set(key, []);
    }

    for (const card of sorted) {
      const bucket =
        groupBy === 'type'
          ? getTypeGroup(card)
          : groupBy === 'cmc'
            ? getCmcGroup(card)
            : getRoleGroup(card);
      const list = map.get(bucket);
      if (list) {
        list.push(card);
      } else {
        map.set(bucket, [card]);
      }
    }

    const sections: { label: string; cards: ProcessedDeckCard[] }[] = [];
    for (const [label, list] of map.entries()) {
      if (list.length > 0) {
        sections.push({
          label: groupBy === 'cmc' && label !== 'Lands' ? `CMC ${label}` : label,
          cards: list,
        });
      }
    }
    return sections;
  }, [displayedCards, groupBy, activeTab]);

  if (!cards || cards.length === 0) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center text-zinc-500 p-4 text-center h-full">
        <p className="text-xs font-medium text-zinc-400">No Deck Loaded</p>
        <p className="text-[11px] mt-1 text-zinc-600">
          Import a deck file or select a preset on the left.
        </p>
      </div>
    );
  }

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const renderCardItem = (card: ProcessedDeckCard, isCommanderSection: boolean) => {
    const colorInvalid = isColorIdentityInvalid(card);
    const legStatus = getCommanderLegalityStatus(card);
    const singletonViolation =
      !isCommanderSection &&
      !isConsideringZone(card.zone) &&
      card.quantity > 1 &&
      !allowsMultipleCopies(card);
    const hasWarning = colorInvalid || legStatus !== null || singletonViolation;

    const cardIden = getCardColorIdentity(card);
    const isSelected = selectedCardId === card.id;
    const eligibleCommander = !isCommanderSection && canBeCommander(card);
    const inConsidering = isConsideringZone(card.zone);

    const unitPrice = card.prices?.usd ? parseFloat(card.prices.usd) : NaN;
    const hasPrice = !Number.isNaN(unitPrice);
    const linePrice = hasPrice ? unitPrice * card.quantity : 0;

    const warningMessages: string[] = [];
    if (legStatus === 'banned') warningMessages.push('Banned in Commander');
    if (legStatus === 'not_legal') warningMessages.push('Not legal in Commander');
    if (colorInvalid) {
      warningMessages.push(
        `Color identity (${cardIden.join(', ') || 'Colorless'}) outside commander's identity (${
          Array.from(commanderIdentity).join(', ') || 'Colorless'
        })`
      );
    }
    if (singletonViolation) {
      warningMessages.push(`Singleton violation (${card.quantity} copies)`);
    }

    return (
      <li
        key={card.id}
        onMouseEnter={() => onCardHover(card)}
        onMouseLeave={onCardLeave}
        className={`group flex items-center justify-between px-2 py-1.5 rounded-md border transition-all duration-150 ${
          isSelected
            ? 'bg-amber-500/15 border-amber-500/50 shadow-sm'
            : isCommanderSection
              ? 'bg-amber-950/20 border-amber-500/30 hover:bg-amber-950/35'
              : 'bg-zinc-900/50 border-zinc-800/60 hover:bg-zinc-800/70 hover:border-zinc-700'
        } ${hasWarning ? 'ring-1 ring-rose-500/70 border-rose-500/50' : ''}`}
      >
        {/* Left: Quantity controls + Name + Warning badge */}
        <div
          className="flex items-center overflow-hidden flex-grow cursor-pointer min-w-0"
          onClick={() => onCardSelect(card.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onCardSelect(card.id);
            }
          }}
          aria-current={isSelected ? 'true' : undefined}
          title={hasWarning ? warningMessages.join(' • ') : `Select ${card.name}`}
        >
          {/* Quantity + inline -/+ on hover */}
          <div
            className="flex items-center mr-1.5 flex-shrink-0"
            onClick={(e) => {
              if (onQuantityChange && !isCommanderSection) e.stopPropagation();
            }}
          >
            {onQuantityChange && !isCommanderSection && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuantityChange(card.id, -1);
                }}
                className="w-4 h-4 hidden group-hover:flex items-center justify-center rounded text-[11px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/80"
                title={`Decrease quantity of ${card.name}`}
                aria-label={`Decrease quantity of ${card.name}`}
              >
                -
              </button>
            )}
            <span
              className={`font-mono text-[11px] w-5 text-right shrink-0 ${
                isSelected
                  ? 'text-amber-300 font-semibold'
                  : singletonViolation
                    ? 'text-rose-400 font-semibold'
                    : 'text-zinc-500'
              }`}
            >
              {isCommanderSection ? '1x' : `${card.quantity}x`}
            </span>
            {onQuantityChange && !isCommanderSection && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuantityChange(card.id, 1);
                }}
                className="w-4 h-4 hidden group-hover:flex items-center justify-center rounded text-[11px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/80"
                title={`Increase quantity of ${card.name}`}
                aria-label={`Increase quantity of ${card.name}`}
              >
                +
              </button>
            )}
          </div>

          <span
            className={`truncate text-xs ${
              isSelected
                ? 'text-amber-100 font-semibold'
                : isCommanderSection
                  ? 'text-amber-200 font-medium'
                  : 'text-zinc-200'
            }`}
            title={card.name}
          >
            {card.name}
          </span>

          {legStatus && (
            <span
              className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-rose-500/20 text-rose-300 border border-rose-500/40 flex-shrink-0"
              title={warningMessages.join(' • ')}
            >
              {legStatus === 'banned' ? 'Banned' : 'Illegal'}
            </span>
          )}
          {!legStatus && (colorInvalid || singletonViolation) && (
            <span
              className="text-rose-400 font-bold ml-1 text-[10px] flex-shrink-0"
              title={warningMessages.join(' • ')}
            >
              ⚠️
            </span>
          )}
        </div>

        {/* Right: Price + Mana Cost (hidden on hover when actions appear) + Hover Actions */}
        <div className="flex items-center flex-shrink-0 ml-1.5 gap-1">
          <div className="flex items-center gap-1.5 group-hover:hidden">
            {hasPrice && (
              <span
                className="text-[10px] font-mono text-zinc-500 hidden sm:inline"
                title={
                  card.quantity > 1
                    ? `$${unitPrice.toFixed(2)} each ($${linePrice.toFixed(2)} total)`
                    : `$${unitPrice.toFixed(2)}`
                }
              >
                ${linePrice.toFixed(2)}
              </span>
            )}

            <ManaCostDisplay manaCostString={card.manaCostString} iconSizeClass="w-3 h-3" />
          </div>

          {/* Hover Actions */}
          <div className="hidden group-hover:flex items-center gap-0.5">
            {onSetCommander && eligibleCommander && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetCommander(card.id);
                }}
                className="p-1 text-zinc-500 hover:text-amber-400 rounded transition-colors"
                title={`Set ${card.name} as Commander`}
                aria-label={`Set ${card.name} as Commander`}
              >
                <CrownIcon className="w-3 h-3" />
              </button>
            )}

            {onMoveZone && !isCommanderSection && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveZone(card.id, inConsidering ? 'mainboard' : 'considering');
                }}
                className="px-1 py-0.5 text-[9px] font-medium text-zinc-400 hover:text-amber-300 hover:bg-zinc-700/70 rounded transition-colors"
                title={
                  inConsidering
                    ? `Move ${card.name} to Mainboard`
                    : `Move ${card.name} to Considering`
                }
                aria-label={
                  inConsidering
                    ? `Move ${card.name} to Mainboard`
                    : `Move ${card.name} to Considering`
                }
              >
                {inConsidering ? 'Main' : 'Cons'}
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCardDelete(card.id);
              }}
              className="p-1 text-zinc-600 hover:text-rose-400 rounded transition-colors"
              title={`Remove ${card.name}`}
              aria-label={`Remove ${card.name}`}
            >
              <TrashIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 space-y-2 mb-2.5 pb-2 border-b border-white/[0.06]">
        {/* Deck Summary Strip */}
        <div className="flex items-center justify-between gap-1.5 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-mono font-semibold text-zinc-200">
              {totalMainboardCount}{' '}
              <span className="text-zinc-500 font-normal">cards</span>
            </span>
            {hasAnyPrice && (
              <span
                className="text-[11px] font-mono text-emerald-400/90"
                title="Estimated total Mainboard + Commander value (TCG USD)"
              >
                ${totalUsdPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* Commander Legality Pill */}
          <button
            type="button"
            onClick={() => setShowLegalityDetails((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
              legalityIssues.length === 0
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/35 hover:bg-rose-500/20'
            }`}
            title={
              legalityIssues.length === 0
                ? 'Deck passes Commander legality checks'
                : legalityIssues.join('\n')
            }
          >
            <ShieldCheckIcon className="w-3 h-3" />
            {legalityIssues.length === 0
              ? 'Legal'
              : `${legalityIssues.length} ${legalityIssues.length === 1 ? 'Issue' : 'Issues'}`}
          </button>
        </div>

        {/* Expandable Legality Issues Panel */}
        {showLegalityDetails && (
          <div
            className={`px-2.5 py-2 rounded-md border text-[11px] ${
              legalityIssues.length === 0
                ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-300'
                : 'bg-rose-950/25 border-rose-500/30 text-rose-200'
            }`}
          >
            {legalityIssues.length === 0 ? (
              <p className="text-[11px]">
                All Commander checks passed (100 cards, singleton, color identity, banlist).
              </p>
            ) : (
              <ul className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                {legalityIssues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-[10px] leading-snug">
                    <span className="text-rose-400 flex-shrink-0">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Zone Tab Switcher + Grouping Toggle (stacked so neither clips in narrow sidebars) */}
        <div className="flex flex-col gap-1.5">
          {/* Mainboard / Considering Tabs */}
          <div className="flex w-full rounded-md bg-zinc-900/90 border border-white/[0.06] p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('mainboard')}
              className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded transition-colors ${
                activeTab === 'mainboard'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              Mainboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('considering')}
              className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded transition-colors flex items-center justify-center gap-1 ${
                activeTab === 'considering'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              <span>Considering</span>
              {totalConsideringCount > 0 && (
                <span className="px-1 rounded-full bg-zinc-800 text-[9px] font-mono text-zinc-300">
                  {totalConsideringCount}
                </span>
              )}
            </button>
          </div>

          {/* Grouping Toggle */}
          <div
            className="flex w-full rounded-md bg-zinc-900/90 border border-white/[0.06] p-0.5"
            role="group"
            aria-label="Group cards by"
          >
            {(
              [
                { id: 'type', label: 'Type' },
                { id: 'cmc', label: 'CMC' },
                { id: 'role', label: 'Role' },
                { id: 'az', label: 'A-Z' },
              ] as { id: GroupingMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setGroupBy(opt.id)}
                className={`flex-1 px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors text-center ${
                  groupBy === opt.id
                    ? 'bg-zinc-800 text-amber-300'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pinned Commander Section (shown on Mainboard tab) */}
      {activeTab === 'mainboard' && commanderCard && (
        <div className="mb-2.5 flex-shrink-0">
          <div className="flex items-center justify-between px-1 mb-1">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/90 flex items-center gap-1.5">
              <CrownIcon className="w-3 h-3 text-amber-400" />
              <span>Commander</span>
            </h3>
          </div>
          <ul className="space-y-1">{renderCardItem(commanderCard, true)}</ul>
        </div>
      )}

      {/* Card List */}
      <div className="overflow-y-auto custom-scrollbar flex-grow pr-1">
        {displayedCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8 px-3 text-zinc-500">
            <p className="text-xs text-zinc-400">
              {activeTab === 'considering'
                ? 'No cards in Considering'
                : 'No cards in Mainboard'}
            </p>
            <p className="text-[11px] text-zinc-600 mt-1">
              {activeTab === 'considering'
                ? 'Hover any card and click "Cons" or add cards to Considering.'
                : 'Add cards to start building your deck.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedCards.map((section) => {
              const sectionCount = section.cards.reduce((sum, c) => sum + c.quantity, 0);
              const isCollapsed = !!collapsedGroups[section.label];

              return (
                <div key={section.label}>
                  {groupBy !== 'az' && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(section.label)}
                      className="w-full flex items-center justify-between px-1 mb-1 text-left group/hdr"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 group-hover/hdr:text-zinc-200 transition-colors flex items-center gap-1">
                        <span className="text-[9px] text-zinc-600">
                          {isCollapsed ? '▸' : '▾'}
                        </span>
                        {section.label}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {sectionCount}
                      </span>
                    </button>
                  )}

                  {!isCollapsed && (
                    <ul className="space-y-1">
                      {section.cards.map((card) => renderCardItem(card, false))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
