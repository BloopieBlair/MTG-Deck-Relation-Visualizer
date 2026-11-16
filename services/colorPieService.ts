import type { ParsedManaCost, ProcessedDeckCard } from '../types';
import { normalizeCardName, parseScryfallManaCost } from './scryfallService';

export type WubrgColor = 'W' | 'U' | 'B' | 'R' | 'G';

export interface ColorPieVector {
  x: number;
  y: number;
}

export interface ColorPiePoint {
  x: number;
  y: number;
  radius: number;
  dominanceAngleDeg: number | null;
  shares: Record<WubrgColor, number>;
  pipCounts: Record<WubrgColor, number>;
  totalColoredPips: number;
}

export interface CardChangeItem {
  name: string;
  prevQty: number;
  nextQty: number;
  deltaQty: number;
  pipDelta: Record<WubrgColor, number>;
}

export interface DeckTrajectoryStep {
  index: number;
  timestamp?: number;
  label: string;
  point: ColorPiePoint;
  deltaShares?: Record<WubrgColor, number>;
  deltaPips?: Record<WubrgColor, number>;
  changesFromPrev: CardChangeItem[];
}

export interface ScryfallSymbolAsset {
  symbol: string;
  svgUri: string;
  english?: string;
}

export const WUBRG_ORDER: readonly WubrgColor[] = ['W', 'U', 'B', 'R', 'G'] as const;

/**
 * Exact 5-point WUBRG pentagon vertex angles in standard screen/SVG coordinates
 * (+x right, +y down):
 * - W (White): top (12 o'clock, -90 deg)
 * - U (Blue): top-right (2 o'clock, -18 deg)
 * - B (Black): bottom-right (4 o'clock, +54 deg)
 * - R (Red): bottom-left (8 o'clock, +126 deg)
 * - G (Green): top-left (10 o'clock, +198 deg / -162 deg)
 */
export const WUBRG_ANGLES_DEG: Record<WubrgColor, number> = {
  W: -90,
  U: -18,
  B: 54,
  R: 126,
  G: 198,
};

function degToUnitVector(angleDeg: number): ColorPieVector {
  const rad = (angleDeg * Math.PI) / 180;
  const rawX = Math.cos(rad);
  const rawY = Math.sin(rad);
  return {
    x: Math.abs(rawX) < 1e-12 ? 0 : rawX,
    y: Math.abs(rawY) < 1e-12 ? 0 : rawY,
  };
}

export const WUBRG_UNIT_VECTORS: Record<WubrgColor, ColorPieVector> = {
  W: degToUnitVector(WUBRG_ANGLES_DEG.W),
  U: degToUnitVector(WUBRG_ANGLES_DEG.U),
  B: degToUnitVector(WUBRG_ANGLES_DEG.B),
  R: degToUnitVector(WUBRG_ANGLES_DEG.R),
  G: degToUnitVector(WUBRG_ANGLES_DEG.G),
};

export const WUBRG_COLOR_META: Record<
  WubrgColor,
  { name: string; hex: string; glowHex: string; angleDeg: number }
> = {
  W: { name: 'White', hex: '#F8E7B9', glowHex: '#FEF3C7', angleDeg: WUBRG_ANGLES_DEG.W },
  U: { name: 'Blue', hex: '#38BDF8', glowHex: '#0EA5E9', angleDeg: WUBRG_ANGLES_DEG.U },
  B: { name: 'Black', hex: '#A78BFA', glowHex: '#7C3AED', angleDeg: WUBRG_ANGLES_DEG.B },
  R: { name: 'Red', hex: '#F87171', glowHex: '#EF4444', angleDeg: WUBRG_ANGLES_DEG.R },
  G: { name: 'Green', hex: '#34D399', glowHex: '#10B981', angleDeg: WUBRG_ANGLES_DEG.G },
};

export const DEFAULT_WUBRG_SYMBOLOGY: Record<WubrgColor, ScryfallSymbolAsset> = {
  W: {
    symbol: '{W}',
    svgUri: 'https://svgs.scryfall.io/card-symbols/W.svg',
    english: 'one white mana',
  },
  U: {
    symbol: '{U}',
    svgUri: 'https://svgs.scryfall.io/card-symbols/U.svg',
    english: 'one blue mana',
  },
  B: {
    symbol: '{B}',
    svgUri: 'https://svgs.scryfall.io/card-symbols/B.svg',
    english: 'one black mana',
  },
  R: {
    symbol: '{R}',
    svgUri: 'https://svgs.scryfall.io/card-symbols/R.svg',
    english: 'one red mana',
  },
  G: {
    symbol: '{G}',
    svgUri: 'https://svgs.scryfall.io/card-symbols/G.svg',
    english: 'one green mana',
  },
};

const SCRYFALL_SYMBOLOGY_URL = 'https://api.scryfall.com/symbology';
const SYMBOLOGY_CACHE_KEY = 'scryfall_wubrg_symbology_v1';
const SYMBOLOGY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let memorySymbologyCache: {
  cachedAt: number;
  data: Record<WubrgColor, ScryfallSymbolAsset>;
} | null = null;
let inFlightSymbologyPromise: Promise<Record<WubrgColor, ScryfallSymbolAsset>> | null = null;

function createZeroWubrgRecord(): Record<WubrgColor, number> {
  return { W: 0, U: 0, B: 0, R: 0, G: 0 };
}

/**
 * Parses either standard Scryfall mana strings (e.g. "{2}{W}{W}{R}")
 * or concise human pip shorthand (e.g. "2W 1R", "3W2R", "WWR").
 */
export function parseManaInputString(costString?: string): ParsedManaCost {
  if (!costString || !costString.trim()) return {};
  const trimmed = costString.trim();

  if (trimmed.includes('{') && trimmed.includes('}')) {
    return parseScryfallManaCost(trimmed);
  }

  const parsed: ParsedManaCost = {};
  const tokenRegex = /(\d+)\s*([WUBRGCX])|([WUBRGCX])|\b(\d+)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(trimmed)) !== null) {
    if (match[1] && match[2]) {
      const count = parseInt(match[1], 10);
      const color = match[2].toUpperCase() as keyof ParsedManaCost;
      parsed[color] = (parsed[color] || 0) + count;
    } else if (match[3]) {
      const color = match[3].toUpperCase() as keyof ParsedManaCost;
      parsed[color] = (parsed[color] || 0) + 1;
    } else if (match[4]) {
      const generic = parseInt(match[4], 10);
      parsed.Generic = (parsed.Generic || 0) + generic;
    }
  }

  return parsed;
}

function getCardParsedCost(card: Pick<ProcessedDeckCard, 'parsedManaCost' | 'manaCostString'>): ParsedManaCost {
  if (card.parsedManaCost && Object.keys(card.parsedManaCost).length > 0) {
    return card.parsedManaCost;
  }
  return parseManaInputString(card.manaCostString);
}

function extractWubrgPips(parsed: ParsedManaCost): Record<WubrgColor, number> {
  const pips = createZeroWubrgRecord();
  for (const color of WUBRG_ORDER) {
    const val = Number(parsed[color]);
    pips[color] = Number.isFinite(val) && val > 0 ? val : 0;
  }
  return pips;
}

/**
 * Computes the 2D Color Pie coordinate from raw WUBRG pip counts.
 */
export function calculatePointFromPipCounts(pipCounts: Record<WubrgColor, number>): ColorPiePoint {
  const sanitizedCounts = createZeroWubrgRecord();
  let totalColoredPips = 0;

  for (const color of WUBRG_ORDER) {
    const val = Number(pipCounts[color]);
    const clean = Number.isFinite(val) && val > 0 ? val : 0;
    sanitizedCounts[color] = clean;
    totalColoredPips += clean;
  }

  const shares = createZeroWubrgRecord();
  if (totalColoredPips <= 0) {
    return {
      x: 0,
      y: 0,
      radius: 0,
      dominanceAngleDeg: null,
      shares,
      pipCounts: sanitizedCounts,
      totalColoredPips: 0,
    };
  }

  let x = 0;
  let y = 0;
  for (const color of WUBRG_ORDER) {
    const share = sanitizedCounts[color] / totalColoredPips;
    shares[color] = share;
    x += share * WUBRG_UNIT_VECTORS[color].x;
    y += share * WUBRG_UNIT_VECTORS[color].y;
  }

  const cleanX = Math.abs(x) < 1e-12 ? 0 : x;
  const cleanY = Math.abs(y) < 1e-12 ? 0 : y;
  const radius = Math.min(1, Math.hypot(cleanX, cleanY));
  const dominanceAngleDeg =
    radius < 1e-9 ? null : (Math.atan2(cleanY, cleanX) * 180) / Math.PI;

  return {
    x: cleanX,
    y: cleanY,
    radius,
    dominanceAngleDeg,
    shares,
    pipCounts: sanitizedCounts,
    totalColoredPips,
  };
}

/**
 * Calculates a deck's normalized WUBRG pip shares and 2D Color Pie position.
 */
export function calculateDeckColorPiePoint(cards: ProcessedDeckCard[]): ColorPiePoint {
  const pipCounts = createZeroWubrgRecord();

  for (const card of cards) {
    const qty = Math.max(0, Number(card.quantity) || 0);
    if (qty === 0) continue;

    const cardPips = extractWubrgPips(getCardParsedCost(card));
    for (const color of WUBRG_ORDER) {
      pipCounts[color] += cardPips[color] * qty;
    }
  }

  return calculatePointFromPipCounts(pipCounts);
}

interface AggregatedCardEntry {
  key: string;
  name: string;
  quantity: number;
  totalPips: Record<WubrgColor, number>;
}

function aggregateDeckCards(cards: ProcessedDeckCard[]): Map<string, AggregatedCardEntry> {
  const map = new Map<string, AggregatedCardEntry>();

  for (const card of cards) {
    const qty = Math.max(0, Number(card.quantity) || 0);
    if (qty === 0) continue;

    const key = normalizeCardName(card.name) || card.id;
    const cardPips = extractWubrgPips(getCardParsedCost(card));
    const existing = map.get(key);

    if (existing) {
      existing.quantity += qty;
      for (const color of WUBRG_ORDER) {
        existing.totalPips[color] += cardPips[color] * qty;
      }
    } else {
      const totalPips = createZeroWubrgRecord();
      for (const color of WUBRG_ORDER) {
        totalPips[color] = cardPips[color] * qty;
      }
      map.set(key, {
        key,
        name: card.name,
        quantity: qty,
        totalPips,
      });
    }
  }

  return map;
}

/**
 * Computes per-card quantity and colored pip deltas between two deck snapshots.
 */
export function diffDeckSnapshots(
  prev: ProcessedDeckCard[],
  next: ProcessedDeckCard[]
): CardChangeItem[] {
  const prevMap = aggregateDeckCards(prev);
  const nextMap = aggregateDeckCards(next);
  const allKeys = new Set<string>([...prevMap.keys(), ...nextMap.keys()]);
  const changes: CardChangeItem[] = [];

  for (const key of allKeys) {
    const prevEntry = prevMap.get(key);
    const nextEntry = nextMap.get(key);
    const prevQty = prevEntry?.quantity ?? 0;
    const nextQty = nextEntry?.quantity ?? 0;
    const deltaQty = nextQty - prevQty;

    const pipDelta = createZeroWubrgRecord();
    let hasPipChange = false;
    for (const color of WUBRG_ORDER) {
      const delta = (nextEntry?.totalPips[color] ?? 0) - (prevEntry?.totalPips[color] ?? 0);
      pipDelta[color] = delta;
      if (delta !== 0) hasPipChange = true;
    }

    if (deltaQty !== 0 || hasPipChange) {
      changes.push({
        name: nextEntry?.name ?? prevEntry?.name ?? key,
        prevQty,
        nextQty,
        deltaQty,
        pipDelta,
      });
    }
  }

  // Order removals before additions, then by largest absolute quantity change, then alphabetically
  changes.sort((a, b) => {
    if (a.deltaQty < 0 && b.deltaQty >= 0) return -1;
    if (a.deltaQty >= 0 && b.deltaQty < 0) return 1;
    const absDiff = Math.abs(b.deltaQty) - Math.abs(a.deltaQty);
    if (absDiff !== 0) return absDiff;
    return a.name.localeCompare(b.name);
  });

  return changes;
}

function formatPipDeltaString(pipDelta: Record<WubrgColor, number>): string {
  const parts: string[] = [];
  for (const color of WUBRG_ORDER) {
    const val = pipDelta[color];
    if (val > 0) parts.push(`+${val}${color}`);
    else if (val < 0) parts.push(`${val}${color}`);
  }
  return parts.join(' ');
}

function formatDeckChangeLabel(changes: CardChangeItem[]): string {
  if (changes.length === 0) return 'No change';

  const removals = changes.filter(c => c.deltaQty < 0);
  const additions = changes.filter(c => c.deltaQty > 0);

  if (removals.length === 1 && additions.length === 1 && changes.length === 2) {
    const rem = removals[0];
    const add = additions[0];
    const remPips = formatPipDeltaString(rem.pipDelta);
    const addPips = formatPipDeltaString(add.pipDelta);
    const remPart = remPips ? `${rem.name} (${remPips})` : rem.name;
    const addPart = addPips ? `${add.name} (${addPips})` : add.name;
    return `Replaced ${remPart} -> ${addPart}`;
  }

  if (changes.length === 1) {
    const item = changes[0];
    const prefix = item.deltaQty > 0 ? `+${item.deltaQty}` : `${item.deltaQty}`;
    const pips = formatPipDeltaString(item.pipDelta);
    return pips ? `${prefix} ${item.name} (${pips})` : `${prefix} ${item.name}`;
  }

  if (changes.length === 2) {
    return changes
      .map(item => `${item.deltaQty > 0 ? '+' : ''}${item.deltaQty} ${item.name}`)
      .join(', ');
  }

  const totalAdded = additions.reduce((sum, item) => sum + item.deltaQty, 0);
  const totalRemoved = removals.reduce((sum, item) => sum + Math.abs(item.deltaQty), 0);
  const segments: string[] = [];
  if (totalAdded > 0) segments.push(`+${totalAdded}`);
  if (totalRemoved > 0) segments.push(`-${totalRemoved}`);
  return `Deck updated (${segments.join(' / ')} cards)`;
}

function computeShareDelta(
  prev: ColorPiePoint,
  next: ColorPiePoint
): Record<WubrgColor, number> {
  const delta = createZeroWubrgRecord();
  for (const color of WUBRG_ORDER) {
    delta[color] = next.shares[color] - prev.shares[color];
  }
  return delta;
}

function computePipDelta(
  prev: ColorPiePoint,
  next: ColorPiePoint
): Record<WubrgColor, number> {
  const delta = createZeroWubrgRecord();
  for (const color of WUBRG_ORDER) {
    delta[color] = next.pipCounts[color] - prev.pipCounts[color];
  }
  return delta;
}

/**
 * Builds a clean trajectory of Color Pie points and card diffs from deck snapshots.
 * Skips leading empty snapshots and consecutive duplicate snapshots.
 */
export function buildDeckTrajectory(
  snapshots: { cards: ProcessedDeckCard[]; timestamp?: number; label?: string }[]
): DeckTrajectoryStep[] {
  const steps: DeckTrajectoryStep[] = [];
  let prevCards: ProcessedDeckCard[] | null = null;
  let prevPoint: ColorPiePoint | null = null;

  for (const snapshot of snapshots) {
    const hasNonZeroCards = snapshot.cards.some(c => (Number(c.quantity) || 0) > 0);
    if (!prevCards && !hasNonZeroCards) {
      // Skip leading empty states (e.g. initial [] before a deck is loaded)
      continue;
    }

    if (prevCards === null) {
      const point = calculateDeckColorPiePoint(snapshot.cards);
      steps.push({
        index: 0,
        timestamp: snapshot.timestamp,
        label: snapshot.label?.trim() || 'Initial Deck',
        point,
        changesFromPrev: [],
      });
      prevCards = snapshot.cards;
      prevPoint = point;
      continue;
    }

    const changesFromPrev = diffDeckSnapshots(prevCards, snapshot.cards);
    if (changesFromPrev.length === 0) {
      // Skip consecutive duplicate snapshots
      continue;
    }

    const point = calculateDeckColorPiePoint(snapshot.cards);
    steps.push({
      index: steps.length,
      timestamp: snapshot.timestamp,
      label: snapshot.label?.trim() || formatDeckChangeLabel(changesFromPrev),
      point,
      deltaShares: prevPoint ? computeShareDelta(prevPoint, point) : undefined,
      deltaPips: prevPoint ? computePipDelta(prevPoint, point) : undefined,
      changesFromPrev,
    });

    prevCards = snapshot.cards;
    prevPoint = point;
  }

  return steps;
}

/**
 * Simulates removing one card (by ID or normalized name) and/or adding a card
 * (supporting both Scryfall costs like "{2}{W}{R}" and shorthand like "3W 2R")
 * to preview exact Color Pie drift before modifying the deck.
 */
export function simulateCardSwap(
  cards: ProcessedDeckCard[],
  removeCardId: string | null,
  addCard: { name: string; manaCostString: string; quantity?: number } | null,
  removeFallbackManaCostString?: string
): {
  before: ColorPiePoint;
  after: ColorPiePoint;
  deltaShares: Record<WubrgColor, number>;
  deltaPips: Record<WubrgColor, number>;
} {
  const before = calculateDeckColorPiePoint(cards);
  const simulatedPips: Record<WubrgColor, number> = { ...before.pipCounts };
  let removedExisting = false;

  if (removeCardId) {
    const targetNorm = normalizeCardName(removeCardId);
    const targetCard =
      cards.find(c => c.id === removeCardId && (Number(c.quantity) || 0) > 0) ||
      cards.find(c => normalizeCardName(c.name) === targetNorm && (Number(c.quantity) || 0) > 0);

    if (targetCard) {
      const removePips = extractWubrgPips(getCardParsedCost(targetCard));
      for (const color of WUBRG_ORDER) {
        simulatedPips[color] = Math.max(0, simulatedPips[color] - removePips[color]);
      }
      removedExisting = true;
    }
  }

  if (!removedExisting && removeFallbackManaCostString) {
    const fallbackRemovePips = extractWubrgPips(parseManaInputString(removeFallbackManaCostString));
    for (const color of WUBRG_ORDER) {
      simulatedPips[color] = Math.max(0, simulatedPips[color] - fallbackRemovePips[color]);
    }
  }

  if (addCard) {
    const addQty =
      addCard.quantity !== undefined ? Math.max(0, Number(addCard.quantity) || 0) : 1;
    if (addQty > 0) {
      const addPips = extractWubrgPips(parseManaInputString(addCard.manaCostString));
      for (const color of WUBRG_ORDER) {
        simulatedPips[color] += addPips[color] * addQty;
      }
    }
  }

  const after = calculatePointFromPipCounts(simulatedPips);
  return {
    before,
    after,
    deltaShares: computeShareDelta(before, after),
    deltaPips: computePipDelta(before, after),
  };
}

interface ScryfallSymbologyApiResponse {
  data?: Array<{
    symbol?: string;
    svg_uri?: string;
    english?: string;
  }>;
}

function readSymbologyFromStorage(): Record<WubrgColor, ScryfallSymbolAsset> | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SYMBOLOGY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      cachedAt?: number;
      data?: Partial<Record<WubrgColor, ScryfallSymbolAsset>>;
    };
    if (!parsed.cachedAt || !parsed.data) return null;
    if (Date.now() - parsed.cachedAt > SYMBOLOGY_TTL_MS) return null;

    const merged = { ...DEFAULT_WUBRG_SYMBOLOGY };
    for (const color of WUBRG_ORDER) {
      const entry = parsed.data[color];
      if (!entry || !entry.svgUri) return null;
      merged[color] = entry;
    }
    return merged;
  } catch {
    return null;
  }
}

function writeSymbologyToStorage(data: Record<WubrgColor, ScryfallSymbolAsset>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      SYMBOLOGY_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), data })
    );
  } catch {
    // Ignore storage quota/access errors
  }
}

/**
 * Fetches official WUBRG mana symbol SVGs from Scryfall's /symbology endpoint,
 * caching in memory and localStorage for 7 days and falling back gracefully
 * to svgs.scryfall.io URLs if offline or unavailable.
 */
export async function fetchWubrgSymbology(): Promise<Record<WubrgColor, ScryfallSymbolAsset>> {
  if (memorySymbologyCache && Date.now() - memorySymbologyCache.cachedAt <= SYMBOLOGY_TTL_MS) {
    return memorySymbologyCache.data;
  }

  const stored = readSymbologyFromStorage();
  if (stored) {
    memorySymbologyCache = { cachedAt: Date.now(), data: stored };
    return stored;
  }

  if (inFlightSymbologyPromise) {
    return inFlightSymbologyPromise;
  }

  inFlightSymbologyPromise = (async () => {
    const result: Record<WubrgColor, ScryfallSymbolAsset> = {
      W: { ...DEFAULT_WUBRG_SYMBOLOGY.W },
      U: { ...DEFAULT_WUBRG_SYMBOLOGY.U },
      B: { ...DEFAULT_WUBRG_SYMBOLOGY.B },
      R: { ...DEFAULT_WUBRG_SYMBOLOGY.R },
      G: { ...DEFAULT_WUBRG_SYMBOLOGY.G },
    };

    try {
      if (typeof fetch !== 'function') {
        return result;
      }

      const response = await fetch(SCRYFALL_SYMBOLOGY_URL);
      if (!response.ok) {
        return result;
      }

      const json = (await response.json()) as ScryfallSymbologyApiResponse;
      if (Array.isArray(json.data)) {
        const symbolToColor: Record<string, WubrgColor> = {
          '{W}': 'W',
          '{U}': 'U',
          '{B}': 'B',
          '{R}': 'R',
          '{G}': 'G',
        };

        for (const item of json.data) {
          const color = item.symbol ? symbolToColor[item.symbol.toUpperCase()] : undefined;
          if (color && item.svg_uri) {
            result[color] = {
              symbol: `{${color}}`,
              svgUri: item.svg_uri,
              english: item.english || DEFAULT_WUBRG_SYMBOLOGY[color].english,
            };
          }
        }
      }

      memorySymbologyCache = { cachedAt: Date.now(), data: result };
      writeSymbologyToStorage(result);
      return result;
    } catch {
      return result;
    } finally {
      inFlightSymbologyPromise = null;
    }
  })();

  return inFlightSymbologyPromise;
}
