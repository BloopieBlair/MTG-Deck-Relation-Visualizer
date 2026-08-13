

import { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

export type ManaSymbol = 'W' | 'U' | 'B' | 'R' | 'G' | 'C' | 'X' | 'Generic';
export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'; // For sources

export interface ParsedManaCost {
  [key: string]: number | undefined;
  W?: number;
  U?: number;
  B?: number;
  R?: number;
  G?: number;
  C?: number; // Colorless
  X?: number; // Cost X
  Generic?: number; // Numeric generic mana, e.g., {2}
}

export interface RawDeckCard {
  name: string;
  quantity: number;
}

export interface CardGameData {
  nameScryfall?: string; 
  keywords: string[];
  text?: string;
  imageUrl?: string;
  manaCostString?: string; 
  producesMana?: ManaSymbol[]; 
  colors?: string[];
  typeLine?: string;
  colorIdentity?: string[];
}

export interface ProcessedDeckCard extends CardGameData {
  id: string; 
  name: string; 
  quantity: number;
  parsedManaCost?: ParsedManaCost;
}

export interface KeywordStyle {
  id: string; 
  name: string;
  color: string;
  enabled: boolean;
  glowEnabled?: boolean; // Added for per-keyword glow
}

export interface ManaAnalysisData {
  pipsRequired: ParsedManaCost;
  manaSources: ParsedManaCost; 
}


export interface D3Node extends ProcessedDeckCard, SimulationNodeDatum {
  // Explicitly redeclare properties from SimulationNodeDatum to resolve potential TS issues.
  // These should be inherited, but making them explicit can help if `extends` is misbehaving
  // in the user's environment or due to complex type interactions.
  index?: number | undefined;
  x?: number | undefined;
  y?: number | undefined;
  vx?: number | undefined;
  vy?: number | undefined;
  fx?: number | null | undefined;
  fy?: number | null | undefined;
  
  isWeaklyConnected?: boolean; 
}

export interface D3Link extends SimulationLinkDatum<D3Node> {
  source: string | D3Node; 
  target: string | D3Node; 
  keyword: string;
  color: string;
  linkNum?: number; 
  totalLinksInGroup?: number; 
  glowEnabled?: boolean;
}

export interface PinnedSearch {
  id: string; // Unique ID for the pinned search item
  term: string;
  cardIds: Set<string>;
  color: string; // Color assigned to this pinned search (e.g., gold, green, blue)
  pinOrder: number; // 0, 1, or 2, indicating which pin slot it is
}

export interface OrphanClusterInfo {
  id: string; // Unique identifier for the cluster (e.g., component index)
  nodeIds: string[]; // Array of node IDs belonging to this cluster
}

// --- Game Simulation Types ---

export type GamePhase = 'Untap' | 'Draw' | 'Main' | 'End';

export interface GameState {
  turn: number;
  phase: GamePhase;
  hand: ProcessedDeckCard[];
  library: ProcessedDeckCard[]; // Remaining cards to draw
  battlefield: ProcessedDeckCard[];
  landsPlayedThisTurn: number; // Usually 0 or 1
  availableMana: Record<string, number>; // { W: 1, G: 0, ... } - simplistic pool representation
  tappedCards: Set<string>; // IDs of cards on battlefield that are tapped
  history: string[]; // Log of actions taken to reach this state
}

export type ActionType = 'PLAY_LAND' | 'CAST_SPELL' | 'PASS_TURN';

export interface GameAction {
  type: ActionType;
  card?: ProcessedDeckCard; // The card involved (if any)
  description: string;
  costPaid?: Record<string, number>; // How much mana was spent
}

export interface SimulationNode {
  id: string;
  parentId: string | null;
  state: GameState;
  actionTaken: GameAction | null; // The action that led to this state
  children: SimulationNode[];
  depth: number;
}

export interface AiClient {
  type: 'gemini' | 'local';
  geminiClient?: any;
  localHost?: string;
  localModel?: string;
}

export interface MtgaCardItem {
  grpId: number;
  title: string;
  typeText: string;
  primaryType: string;
  typeRank: number;
  setCode: string;
  rarity: number;
  power: string;
  toughness: string;
  colors: string[];
  colorIdentity?: string[];
  colorGroup: 'W' | 'U' | 'B' | 'R' | 'G' | 'Multicolor' | 'Colorless' | 'Land';
  manaCost: string;
  cmc: number;
  collectorNumber: string;
  quantity: number;
  imageUrl: string;
  cardText?: string;
  text?: string;
}



