import type { ProcessedDeckCard, SavedDeck } from '../types';

export const AUTOSAVE_STORAGE_KEY = 'aethergraph_autosave_v1';
export const DECK_LIBRARY_STORAGE_KEY = 'aethergraph_deck_library_v1';

export type ShareDeckZone = 'commander' | 'mainboard' | 'sideboard' | 'considering';

export interface AutoSavedDeckState {
  cards: ProcessedDeckCard[];
  commanderId: string | null;
  activeDeckId: string | null;
  activeDeckName: string;
  updatedAt: number;
}

export interface SaveDeckInput {
  id?: string;
  name: string;
  commanderId: string | null;
  cards: ProcessedDeckCard[];
  createdAt?: number;
  updatedAt?: number;
  format?: string;
}

export interface DecodedSharedDeck {
  deckName?: string;
  commanderName?: string;
  cards: Array<{
    name: string;
    quantity: number;
    zone?: ShareDeckZone;
  }>;
}

const VALID_ZONES = new Set<ShareDeckZone>([
  'commander',
  'mainboard',
  'sideboard',
  'considering',
]);

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeGetItem(key: string): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch (err) {
    console.warn(`[deckStorageService] Failed to read "${key}" from localStorage:`, err);
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[deckStorageService] Failed to write "${key}" to localStorage (possible quota exceeded):`, err);
    return false;
  }
}

function safeRemoveItem(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch (err) {
    console.warn(`[deckStorageService] Failed to remove "${key}" from localStorage:`, err);
  }
}

function generateDeckId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `deck_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Auto-Save Active Working Deck
// ---------------------------------------------------------------------------

export function saveAutoSavedDeck(state: {
  cards: ProcessedDeckCard[];
  commanderId: string | null;
  activeDeckId: string | null;
  activeDeckName: string;
}): boolean {
  const payload: AutoSavedDeckState = {
    cards: state.cards,
    commanderId: state.commanderId,
    activeDeckId: state.activeDeckId,
    activeDeckName: state.activeDeckName,
    updatedAt: Date.now(),
  };

  try {
    return safeSetItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[deckStorageService] Failed to serialize autosave state:', err);
    return false;
  }
}

export function loadAutoSavedDeck(): AutoSavedDeckState | null {
  const raw = safeGetItem(AUTOSAVE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.cards)) {
      return null;
    }

    return {
      cards: parsed.cards as ProcessedDeckCard[],
      commanderId: typeof parsed.commanderId === 'string' ? parsed.commanderId : null,
      activeDeckId: typeof parsed.activeDeckId === 'string' ? parsed.activeDeckId : null,
      activeDeckName: typeof parsed.activeDeckName === 'string' ? parsed.activeDeckName : 'Untitled Deck',
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch (err) {
    console.warn('[deckStorageService] Failed to parse autosaved deck JSON:', err);
    return null;
  }
}

export function clearAutoSavedDeck(): void {
  safeRemoveItem(AUTOSAVE_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Local Deck Library CRUD
// ---------------------------------------------------------------------------

function writeDeckLibrary(decks: SavedDeck[]): boolean {
  try {
    return safeSetItem(DECK_LIBRARY_STORAGE_KEY, JSON.stringify(decks));
  } catch (err) {
    console.warn('[deckStorageService] Failed to serialize deck library:', err);
    return false;
  }
}

export function listSavedDecks(): SavedDeck[] {
  const raw = safeGetItem(DECK_LIBRARY_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const validDecks: SavedDeck[] = parsed.filter(
      (item): item is SavedDeck =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        Array.isArray(item.cards)
    );

    return validDecks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err) {
    console.warn('[deckStorageService] Failed to parse deck library JSON:', err);
    return [];
  }
}

export function saveDeck(deck: SaveDeckInput): SavedDeck | null {
  const existingDecks = listSavedDecks();
  const now = Date.now();
  const cleanName = deck.name.trim() || 'Untitled Deck';

  const existingIndex = deck.id
    ? existingDecks.findIndex((d) => d.id === deck.id)
    : -1;

  let saved: SavedDeck;
  let updatedDecks: SavedDeck[];

  if (existingIndex >= 0) {
    const prev = existingDecks[existingIndex];
    saved = {
      ...prev,
      name: cleanName,
      commanderId: deck.commanderId,
      cards: deck.cards,
      format: deck.format ?? prev.format,
      updatedAt: now,
    };
    updatedDecks = [...existingDecks];
    updatedDecks[existingIndex] = saved;
  } else {
    saved = {
      id: deck.id || generateDeckId(),
      name: cleanName,
      commanderId: deck.commanderId,
      cards: deck.cards,
      createdAt: deck.createdAt ?? now,
      updatedAt: deck.updatedAt ?? now,
      ...(deck.format ? { format: deck.format } : {}),
    };
    updatedDecks = [saved, ...existingDecks];
  }

  updatedDecks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (!writeDeckLibrary(updatedDecks)) {
    return null;
  }
  return saved;
}

export function deleteSavedDeck(id: string): SavedDeck[] {
  const existingDecks = listSavedDecks();
  const updatedDecks = existingDecks.filter((d) => d.id !== id);
  writeDeckLibrary(updatedDecks);
  return updatedDecks;
}

export function renameSavedDeck(id: string, name: string): SavedDeck[] {
  const cleanName = name.trim();
  const existingDecks = listSavedDecks();
  if (!cleanName) return existingDecks;

  const now = Date.now();
  const updatedDecks = existingDecks
    .map((d) => (d.id === id ? { ...d, name: cleanName, updatedAt: now } : d))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  writeDeckLibrary(updatedDecks);
  return updatedDecks;
}

export function duplicateSavedDeck(id: string): SavedDeck | null {
  const existingDecks = listSavedDecks();
  const source = existingDecks.find((d) => d.id === id);
  if (!source) return null;

  const now = Date.now();
  const duplicated: SavedDeck = {
    ...source,
    id: generateDeckId(),
    name: `${source.name} (Copy)`,
    cards: source.cards.map((card) => ({ ...card })),
    createdAt: now,
    updatedAt: now,
  };

  const updatedDecks = [duplicated, ...existingDecks];
  if (!writeDeckLibrary(updatedDecks)) {
    return null;
  }
  return duplicated;
}

// ---------------------------------------------------------------------------
// Shareable URL-Hash Encoder & Decoder (UTF-8 safe Base64URL)
// ---------------------------------------------------------------------------

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const paddingNeeded = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(paddingNeeded);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function sanitizeLineValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function encodeDeckToShareUrl(
  cards: ProcessedDeckCard[],
  commanderId: string | null,
  deckName?: string
): string {
  const lines: string[] = [];

  const cleanDeckName = deckName ? sanitizeLineValue(deckName) : '';
  if (cleanDeckName) {
    lines.push(`N:${cleanDeckName}`);
  }

  const commanderCard = commanderId
    ? cards.find((c) => c.id === commanderId) || null
    : null;

  if (commanderCard) {
    lines.push(`C:${sanitizeLineValue(commanderCard.name)}`);
  }

  for (const card of cards) {
    const qty = Math.max(1, Math.floor(card.quantity || 1));
    const name = sanitizeLineValue(card.name);
    if (!name) continue;

    const rawZone =
      card.id === commanderId
        ? 'commander'
        : card.zone && VALID_ZONES.has(card.zone)
          ? card.zone
          : 'mainboard';

    lines.push(`${qty}|${name}|${rawZone}`);
  }

  const encoded = toBase64Url(lines.join('\n'));
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';

  return `${baseUrl}#deck=${encoded}`;
}

function parseZone(raw?: string): ShareDeckZone | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (VALID_ZONES.has(normalized as ShareDeckZone)) {
    return normalized as ShareDeckZone;
  }
  if (normalized === 'cmd' || normalized === 'cmdr') return 'commander';
  if (normalized === 'main' || normalized === 'mb') return 'mainboard';
  if (normalized === 'sb' || normalized === 'side') return 'sideboard';
  if (normalized === 'con' || normalized === 'maybe' || normalized === 'maybeboard') {
    return 'considering';
  }
  return undefined;
}

export function decodeDeckFromHash(hash: string): DecodedSharedDeck | null {
  if (!hash || typeof hash !== 'string') return null;

  const markerIndex = hash.indexOf('#deck=');
  let rawEncoded = '';
  if (markerIndex >= 0) {
    rawEncoded = hash.slice(markerIndex + '#deck='.length);
  } else if (hash.startsWith('deck=')) {
    rawEncoded = hash.slice('deck='.length);
  } else {
    return null;
  }

  // Strip any trailing hash params if present
  const ampIndex = rawEncoded.indexOf('&');
  if (ampIndex >= 0) {
    rawEncoded = rawEncoded.slice(0, ampIndex);
  }

  rawEncoded = rawEncoded.trim();
  if (!rawEncoded) return null;

  try {
    const maybeDecodedUri = rawEncoded.includes('%')
      ? decodeURIComponent(rawEncoded)
      : rawEncoded;
    const text = fromBase64Url(maybeDecodedUri);
    const lines = text.split(/\r?\n/);

    let deckName: string | undefined;
    let commanderName: string | undefined;
    const cards: DecodedSharedDeck['cards'] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.startsWith('N:')) {
        const parsedName = line.slice(2).trim();
        if (parsedName) deckName = parsedName;
        continue;
      }

      if (line.startsWith('C:')) {
        const parsedCommander = line.slice(2).trim();
        if (parsedCommander) commanderName = parsedCommander;
        continue;
      }

      const firstSep = line.indexOf('|');
      if (firstSep <= 0) continue;

      const qtyStr = line.slice(0, firstSep).trim();
      const qty = parseInt(qtyStr, 10);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const rest = line.slice(firstSep + 1);
      const lastSep = rest.lastIndexOf('|');

      let name = rest.trim();
      let zone: ShareDeckZone | undefined;

      if (lastSep > 0) {
        const possibleZone = parseZone(rest.slice(lastSep + 1));
        if (possibleZone) {
          zone = possibleZone;
          name = rest.slice(0, lastSep).trim();
        }
      }

      if (!name) continue;

      cards.push({
        name,
        quantity: qty,
        ...(zone ? { zone } : {}),
      });
    }

    if (cards.length === 0) return null;

    if (!commanderName) {
      const cmdCard = cards.find((c) => c.zone === 'commander');
      if (cmdCard) {
        commanderName = cmdCard.name;
      }
    }

    return {
      ...(deckName ? { deckName } : {}),
      ...(commanderName ? { commanderName } : {}),
      cards,
    };
  } catch (err) {
    console.warn('[deckStorageService] Failed to decode deck from URL hash:', err);
    return null;
  }
}
