import type { ProcessedDeckCard, ParsedManaCost } from '../types';

export type SynergyRole =
  | 'treasure-accel'
  | 'ramp'
  | 'attacker-1drop'
  | 'counter-engine'
  | 'lifegain-sister'
  | 'artifact-ping'
  | 'land-fixer'
  | 'commander'
  | 'other';

export interface CompiledCard {
  id: string;
  name: string;
  imageUrl?: string;
  parsedManaCost: ParsedManaCost;
  cmc: number;
  typeLine: string;
  oracleText: string;

  isLand: boolean;
  isBasicLand: boolean;
  isCreature: boolean;
  isArtifact: boolean;
  isEnchantment: boolean;
  isSpell: boolean; // Instant / Sorcery

  entersTapped: boolean;
  slowLandCondition: boolean;
  produces: string[]; // Colors it can produce
  producesAnyColor: boolean; // e.g. Command Tower
  manaProductionAmount: number; // e.g. 2 for Sol Ring, 1 otherwise

  // Ramp details
  isRampSpell: boolean; // searches for land
  rampLandEntersTapped: boolean;
  rampLandCount: number; // usually 1, or 2 for Cultivate/Skyshroud Claim
  rampIntoHandCount: number; // 1 for Cultivate

  isLandAura: boolean; // e.g. Wild Growth
  isManaRock: boolean; // e.g. Sol Ring
  isManaDork: boolean; // e.g. Llanowar Elves
  isExtraLandDropSpell: boolean; // e.g. Explore
  keywords: string[];

  // Treasure, Flashback, Dash, Fetchland, Legend & Synergy extensions
  createsTreasureCount: number;
  attackCreatesTreasureCount: number;
  hasFlashback: boolean;
  flashbackCost?: ParsedManaCost;
  hasDash: boolean;
  dashCost?: ParsedManaCost;
  isFetchLand: boolean;
  fetchLandEntersTapped: boolean;
  requiresLegendaryToTap: boolean;
  isLegendFilterLand: boolean;
  isLegendary: boolean;
  hasHaste: boolean;
  isProactivePayoffOrCreature: boolean;
  synergyRole: SynergyRole;
}

export interface SpecialSource {
  id: string;
  name: string;
  cardId: string;
  imageUrl?: string;
  produces: string[];
  producesAnyColor: boolean;
  manaProductionAmount: number;
  tapped: boolean;
  hasSummoningSickness: boolean;
  isCreature: boolean;
  isArtifact: boolean;
  isEnchantment: boolean;
  enchantments: { name: string; produces: string[]; producesAnyColor: boolean }[];

  // Extended state
  isLand?: boolean;
  isToken?: boolean;
  sacrificeToActivate?: boolean;
  isFetchLand?: boolean;
  fetchEntersTapped?: boolean;
  requiresLegendary?: boolean;
  isLegendFilterLand?: boolean;
  isLegendaryPermanent?: boolean;
  producesManaAbility?: boolean;
  attackCreatesTreasureCount?: number;
  counters?: number;
  isNonGnomeCreature?: boolean;
  powerValue?: number;
}

export interface SimState {
  turn: number;
  hand: CompiledCard[];
  basics: Record<string, { total: number; tapped: number }>; // e.g., { "Forest": { total: 3, tapped: 1 } }
  specialSources: SpecialSource[];
  landsPlayed: number;
  additionalLandDropsAllowed: number;
  library: CompiledCard[];
  commanderCast: boolean;
  history: string[];

  treasuresCreatedTotal?: number;
  treasuresSpentTotal?: number;
  gnomeTokens?: number;
  commanderCounters?: number;
  graveyard?: CompiledCard[];
}

export interface TappingOption {
  basicsTapped: Record<string, number>;
  specialsTapped: string[];
  legendFilterActivatedId?: string;
}

// --- Helpers & Card Compiler ---

const BASIC_LAND_EXACT_NAMES = new Set([
  'plains',
  'island',
  'swamp',
  'mountain',
  'forest',
  'wastes',
  'snow-covered plains',
  'snow-covered island',
  'snow-covered swamp',
  'snow-covered mountain',
  'snow-covered forest',
  'snow-covered wastes',
]);

export function isBasicLandCard(name: string, typeLine: string = '', keywords: string[] = []): boolean {
  const nameLower = (name || '').trim().toLowerCase();
  if (BASIC_LAND_EXACT_NAMES.has(nameLower)) return true;
  const typeLower = (typeLine || '').toLowerCase();
  const kwLower = (keywords || []).map(k => k.toLowerCase());
  return typeLower.includes('basic') || kwLower.includes('basic');
}

function getBasicLandCanonicalName(name: string, typeLine: string = ''): string {
  const nameLower = (name || '').toLowerCase();
  const typeLower = (typeLine || '').toLowerCase();
  if (nameLower.includes('plains') || typeLower.includes('plains')) return 'Plains';
  if (nameLower.includes('island') || typeLower.includes('island')) return 'Island';
  if (nameLower.includes('swamp') || typeLower.includes('swamp')) return 'Swamp';
  if (nameLower.includes('mountain') || typeLower.includes('mountain')) return 'Mountain';
  if (nameLower.includes('forest') || typeLower.includes('forest')) return 'Forest';
  if (nameLower.includes('wastes') || typeLower.includes('wastes')) return 'Wastes';
  return 'Forest';
}

function getBasicLandColor(basicType: string): string {
  const lower = basicType.toLowerCase();
  if (lower.includes('forest')) return 'G';
  if (lower.includes('island')) return 'U';
  if (lower.includes('swamp')) return 'B';
  if (lower.includes('mountain')) return 'R';
  if (lower.includes('plains')) return 'W';
  return 'C';
}

function parseManaCostString(costStr: string): ParsedManaCost {
  const parsed: ParsedManaCost = {};
  const matches = costStr.match(/\{([^}]+)\}/g);
  if (!matches) return parsed;
  for (const token of matches) {
    const sym = token.slice(1, -1).toUpperCase();
    if (sym === 'W' || sym === 'U' || sym === 'B' || sym === 'R' || sym === 'G' || sym === 'C' || sym === 'X') {
      parsed[sym] = (parsed[sym] || 0) + 1;
    } else if (/^\d+$/.test(sym)) {
      parsed.Generic = (parsed.Generic || 0) + parseInt(sym, 10);
    } else if (sym.includes('/')) {
      // Hybrid fallback: pick first color if colored
      const parts = sym.split('/');
      const first = parts[0];
      if (first === 'W' || first === 'U' || first === 'B' || first === 'R' || first === 'G') {
        parsed[first] = (parsed[first] || 0) + 1;
      } else {
        parsed.Generic = (parsed.Generic || 0) + 1;
      }
    }
  }
  return parsed;
}

function parseWordOrDigitCount(word: string): number {
  const w = word.toLowerCase();
  if (w === 'two' || w === '2') return 2;
  if (w === 'three' || w === '3') return 3;
  if (w === 'four' || w === '4') return 4;
  return 1;
}

function parseProducesFromOracle(textLower: string): string[] {
  const colors: string[] = [];
  const addSectionIdx = textLower.indexOf('add ');
  if (addSectionIdx === -1) return colors;
  const snippet = textLower.slice(addSectionIdx, addSectionIdx + 60);
  const syms = snippet.match(/\{([wubrgc])\}/gi) || [];
  for (const s of syms) {
    const c = s.slice(1, -1).toUpperCase();
    if (!colors.includes(c)) colors.push(c);
  }
  return colors;
}

function countLandsOnBoard(state: SimState): number {
  const basicCount = Object.values(state.basics).reduce((sum, b) => sum + b.total, 0);
  const specialLandCount = state.specialSources.filter(
    s => s.isLand || (!s.isCreature && !s.isArtifact && !s.isEnchantment && !s.isToken)
  ).length;
  return basicCount + specialLandCount;
}

export function getCMC(cost?: ParsedManaCost): number {
  if (!cost) return 0;
  let cmc = 0;
  if (cost.W) cmc += cost.W;
  if (cost.U) cmc += cost.U;
  if (cost.B) cmc += cost.B;
  if (cost.R) cmc += cost.R;
  if (cost.G) cmc += cost.G;
  if (cost.C) cmc += cost.C;
  if (cost.Generic) cmc += cost.Generic;
  return cmc;
}

export function compileCard(card: ProcessedDeckCard, _commanderColors: string[]): CompiledCard {
  const typeLineLower = (card.typeLine || '').toLowerCase();
  const textLower = (card.text || '').toLowerCase();
  const nameLower = card.name.toLowerCase();
  const keywords = card.keywords || [];
  const kwLower = keywords.map(k => k.toLowerCase());

  const isBasicLand = isBasicLandCard(card.name, card.typeLine || '', keywords);
  const isLand = typeLineLower.includes('land') || isBasicLand || kwLower.includes('land');
  const isCreature = typeLineLower.includes('creature') || kwLower.includes('creature');
  const isArtifact = typeLineLower.includes('artifact') || kwLower.includes('artifact');
  const isEnchantment = typeLineLower.includes('enchantment') || kwLower.includes('enchantment');
  const isSpell =
    typeLineLower.includes('instant') ||
    typeLineLower.includes('sorcery') ||
    kwLower.includes('instant') ||
    kwLower.includes('sorcery');

  const isLegendary = typeLineLower.includes('legendary') || kwLower.includes('legendary');
  const hasHaste = textLower.includes('haste') || kwLower.includes('haste');

  // Slowland / Shockland / Conditional tapped check
  const mentionsEntersTapped =
    textLower.includes('enters the battlefield tapped') || textLower.includes('enters tapped');
  const hasUnless = textLower.includes('unless');
  const hasPay2Life = textLower.includes('pay 2 life');
  const slowLandCondition =
    isLand &&
    mentionsEntersTapped &&
    hasUnless &&
    (textLower.includes('two or more other lands') || textLower.includes('two or more lands'));
  const entersTapped = mentionsEntersTapped && !hasUnless && !hasPay2Life;

  // Fetchland detection
  const isFetchLand =
    isLand &&
    (nameLower === 'terramorphic expanse' ||
      nameLower === 'evolving wilds' ||
      (textLower.includes('search your library') && textLower.includes('basic land')));
  const fetchLandEntersTapped =
    isFetchLand && (textLower.includes('tapped') || nameLower === 'terramorphic expanse' || nameLower === 'evolving wilds');

  // Legend filter & Mox Amber detection
  const requiresLegendaryToTap =
    nameLower === 'mox amber' || textLower.includes('among legendary creatures and planeswalkers you control');
  const isLegendFilterLand =
    nameLower === 'great hall of the citadel' || textLower.includes('spend this mana only to cast legendary spells');

  // Parse colors produced
  let produces: string[] = card.producesMana ? [...card.producesMana] : [];
  if (produces.length === 0 && isBasicLand) {
    produces = [getBasicLandColor(getBasicLandCanonicalName(card.name, card.typeLine || ''))];
  } else if (produces.length === 0 && isLand && !isFetchLand) {
    produces = parseProducesFromOracle(textLower);
  }

  const producesAnyColor =
    textLower.includes('any color') ||
    textLower.includes('mana of any color') ||
    nameLower === 'command tower' ||
    nameLower === 'exotic orchard';

  let manaProductionAmount = 1;
  if (textLower.includes('add {c}{c}{c}') || textLower.includes('add {g}{g}{g}') || textLower.includes('add 3')) {
    manaProductionAmount = 3;
  } else if (textLower.includes('add {c}{c}') || textLower.includes('add {g}{g}') || textLower.includes('add 2')) {
    manaProductionAmount = 2;
  }

  // Detect Ramp Spells
  const isRampSpell =
    isSpell &&
    textLower.includes('search') &&
    textLower.includes('library') &&
    textLower.includes('land') &&
    (textLower.includes('battlefield') || textLower.includes('put'));

  let rampLandEntersTapped = textLower.includes('tapped');
  if (nameLower.includes("nature's lore") || nameLower.includes('three visits')) {
    rampLandEntersTapped = false;
  }

  let rampLandCount = 1;
  let rampIntoHandCount = 0;
  if (isRampSpell) {
    if (nameLower === 'cultivate' || nameLower === "kodama's reach") {
      rampLandCount = 1;
      rampIntoHandCount = 1;
    } else if (nameLower === 'skyshroud claim' || nameLower === 'explosive vegetation' || nameLower === 'migration path') {
      rampLandCount = 2;
    }
  }

  // Detect Land Auras
  const isLandAura =
    isEnchantment &&
    textLower.includes('enchant land') &&
    (textLower.includes('tapped for additional') || textLower.includes('produces') || textLower.includes('tapped for mana'));

  // Detect Mana Rocks/Dorks
  const hasManaProduction = produces.length > 0 || producesAnyColor || textLower.includes('add {') || requiresLegendaryToTap;
  const isManaRock = isArtifact && hasManaProduction && !isLand;
  const isManaDork = isCreature && hasManaProduction;

  const isExtraLandDropSpell =
    textLower.includes('additional land') || nameLower === 'explore' || nameLower === 'growth spiral';

  // Treasure creation (spell/ETB vs attack/combat damage)
  let attackCreatesTreasureCount = 0;
  const attackTreasureMatch = textLower.match(
    /whenever[^.]*(?:attacks|deals combat damage)[^.]*create\s+(a|an|one|two|three|2|3)\s+treasure\s+token/i
  );
  if (
    attackTreasureMatch ||
    nameLower === 'ragavan, nimble pilferer' ||
    nameLower === 'diamond pick-axe' ||
    nameLower === 'sticky fingers'
  ) {
    attackCreatesTreasureCount = attackTreasureMatch ? parseWordOrDigitCount(attackTreasureMatch[1]) : 1;
  }

  let createsTreasureCount = 0;
  if (attackCreatesTreasureCount === 0) {
    const treasureMatch = textLower.match(/create\s+(a|an|one|two|three|2|3)\s+treasure\s+token/i);
    if (treasureMatch) {
      createsTreasureCount = parseWordOrDigitCount(treasureMatch[1]);
    } else if (nameLower === 'strike it rich') {
      createsTreasureCount = 1;
    }
  }

  // Flashback & Dash parsing
  const flashbackMatch = (card.text || '').match(/flashback\s+((?:\{[^}]+\})+)/i);
  const hasFlashback = Boolean(flashbackMatch) || kwLower.includes('flashback');
  const flashbackCost = flashbackMatch ? parseManaCostString(flashbackMatch[1]) : undefined;

  const dashMatch = (card.text || '').match(/dash\s+((?:\{[^}]+\})+)/i);
  const hasDash = Boolean(dashMatch) || kwLower.includes('dash');
  const dashCost = dashMatch ? parseManaCostString(dashMatch[1]) : undefined;

  const cmc = getCMC(card.parsedManaCost);
  const isProactivePayoffOrCreature =
    !isLand &&
    ((isCreature && cmc <= 3) ||
      (isArtifact && cmc <= 3) ||
      (isEnchantment && cmc <= 3));

  // Synergy Role classification
  let synergyRole: SynergyRole = 'other';
  if (createsTreasureCount > 0 || attackCreatesTreasureCount > 0) {
    synergyRole = 'treasure-accel';
  } else if (isFetchLand || isLegendFilterLand) {
    synergyRole = 'land-fixer';
  } else if (isRampSpell || isManaRock || isManaDork || isLandAura || isExtraLandDropSpell || requiresLegendaryToTap) {
    synergyRole = 'ramp';
  } else if (
    nameLower.includes('reckless fireweaver') ||
    nameLower.includes('impact tremors') ||
    nameLower.includes('altar of the brood') ||
    nameLower.includes("warleader's call") ||
    (textLower.includes('whenever an artifact') && textLower.includes('damage')) ||
    (textLower.includes('whenever a creature enters') && textLower.includes('damage'))
  ) {
    synergyRole = 'artifact-ping';
  } else if (
    nameLower.includes('soul warden') ||
    nameLower.includes('lunarch veteran') ||
    nameLower.includes('anointer priest') ||
    nameLower.includes('impassioned orator') ||
    nameLower.includes('kor celebrant') ||
    nameLower.includes("ajani's welcome") ||
    nameLower.includes('hinterland sanctifier') ||
    (textLower.includes('whenever another creature enters') && textLower.includes('gain 1 life'))
  ) {
    synergyRole = 'lifegain-sister';
  } else if (
    nameLower.includes('luminarch aspirant') ||
    nameLower.includes('hopeful initiate') ||
    nameLower.includes("ajani's pridemate") ||
    nameLower.includes('warden of the inner sky') ||
    nameLower.includes('kumano faces kakkazan') ||
    nameLower.includes('rosie cotton') ||
    nameLower.includes('serra redeemer') ||
    nameLower.includes('hallowed priest') ||
    textLower.includes('+1/+1 counter')
  ) {
    synergyRole = 'counter-engine';
  } else if (isCreature && cmc <= 1) {
    synergyRole = 'attacker-1drop';
  }

  return {
    id: card.id,
    name: card.name,
    imageUrl: card.imageUrl,
    parsedManaCost: card.parsedManaCost || {},
    cmc,
    typeLine: card.typeLine || '',
    oracleText: card.text || '',
    isLand,
    isBasicLand,
    isCreature,
    isArtifact,
    isEnchantment,
    isSpell,
    entersTapped,
    slowLandCondition,
    produces,
    producesAnyColor,
    manaProductionAmount,
    isRampSpell,
    rampLandEntersTapped,
    rampLandCount,
    rampIntoHandCount,
    isLandAura,
    isManaRock,
    isManaDork,
    isExtraLandDropSpell,
    keywords,
    createsTreasureCount,
    attackCreatesTreasureCount,
    hasFlashback,
    flashbackCost,
    hasDash,
    dashCost,
    isFetchLand,
    fetchLandEntersTapped,
    requiresLegendaryToTap,
    isLegendFilterLand,
    isLegendary,
    hasHaste,
    isProactivePayoffOrCreature,
    synergyRole,
  };
}

// --- Autotapper ---

function getSpecialSourceMana(
  s: SpecialSource,
  commanderColors: string[],
  options?: { hasLegendaryOnBoard?: boolean; isCastingLegendary?: boolean; legendaryColors?: string[] }
): { colors: string[][]; amount: number } {
  let baseColors: string[];
  if (s.requiresLegendary) {
    baseColors =
      options?.legendaryColors && options.legendaryColors.length > 0
        ? [...options.legendaryColors]
        : commanderColors.length > 0
          ? [...commanderColors]
          : ['W', 'U', 'B', 'R', 'G'];
  } else if (s.producesAnyColor) {
    baseColors = commanderColors.length > 0 ? [...commanderColors] : ['W', 'U', 'B', 'R', 'G'];
  } else {
    baseColors = [...s.produces];
  }

  if (baseColors.length === 0) {
    baseColors = ['C'];
  }

  return {
    colors: [
      baseColors,
      ...s.enchantments.map(e =>
        e.producesAnyColor ? (commanderColors.length > 0 ? commanderColors : ['W', 'U', 'B', 'R', 'G']) : [...e.produces]
      ),
    ],
    amount: s.manaProductionAmount + s.enchantments.length,
  };
}

export function findTappingOptions(
  cost: ParsedManaCost,
  basics: Record<string, { total: number; tapped: number }>,
  specialSources: SpecialSource[],
  commanderColors: string[],
  options?: {
    hasLegendaryOnBoard?: boolean;
    isCastingLegendary?: boolean;
    legendaryColors?: string[];
  }
): TappingOption[] {
  const pips: string[] = [];
  const costKeys = ['W', 'U', 'B', 'R', 'G', 'C'];
  costKeys.forEach(k => {
    const amt = cost[k] || 0;
    for (let i = 0; i < amt; i++) pips.push(k);
  });

  const genericCost = cost.Generic || 0;

  const basicPool: { type: string; id: string; color: string }[] = [];
  Object.entries(basics).forEach(([type, count]) => {
    const untapped = count.total - count.tapped;
    const col = getBasicLandColor(type);
    for (let i = 0; i < untapped; i++) {
      basicPool.push({ type, id: `${type}_${i}`, color: col });
    }
  });

  // Filter eligible special sources; put permanent sources BEFORE sacrificeToActivate (Treasures)
  const eligibleSpecials = specialSources.filter(s => {
    if (s.tapped) return false;
    if (s.isCreature && s.hasSummoningSickness) return false;
    if (s.producesManaAbility === false) return false;
    if (s.requiresLegendary && !options?.hasLegendaryOnBoard) return false;
    return true;
  });

  const specialPool = [
    ...eligibleSpecials.filter(s => !s.sacrificeToActivate),
    ...eligibleSpecials.filter(s => s.sacrificeToActivate),
  ];

  const sacIdSet = new Set(specialPool.filter(s => s.sacrificeToActivate).map(s => s.id));
  const legendFilterColors = commanderColors.length > 0 ? commanderColors : ['W', 'U', 'B', 'R', 'G'];

  const results: TappingOption[] = [];
  const visitedOptionKeys = new Set<string>();

  function serializeOption(basicsMap: Record<string, number>, specials: string[], filterId?: string): string {
    const basicStr = Object.entries(basicsMap)
      .sort()
      .map(e => `${e[0]}:${e[1]}`)
      .join(',');
    const specialStr = [...specials].sort().join(',');
    return `${basicStr}|${specialStr}|${filterId || ''}`;
  }

  function payGeneric(
    remainingGeneric: number,
    tappedBasics: Record<string, number>,
    tappedSpecials: string[],
    usedBasicIndices: Set<number>,
    usedSpecialIndices: Set<number>,
    legendFilterActivatedId?: string
  ) {
    if (remainingGeneric <= 0) {
      const serialized = serializeOption(tappedBasics, tappedSpecials, legendFilterActivatedId);
      if (!visitedOptionKeys.has(serialized)) {
        visitedOptionKeys.add(serialized);
        results.push({
          basicsTapped: { ...tappedBasics },
          specialsTapped: [...tappedSpecials],
          ...(legendFilterActivatedId ? { legendFilterActivatedId } : {}),
        });
      }
      return;
    }

    for (let i = 0; i < basicPool.length; i++) {
      if (usedBasicIndices.has(i)) continue;
      const basic = basicPool[i];
      usedBasicIndices.add(i);
      tappedBasics[basic.type] = (tappedBasics[basic.type] || 0) + 1;

      payGeneric(
        remainingGeneric - 1,
        tappedBasics,
        tappedSpecials,
        usedBasicIndices,
        usedSpecialIndices,
        legendFilterActivatedId
      );

      tappedBasics[basic.type]--;
      if (tappedBasics[basic.type] === 0) delete tappedBasics[basic.type];
      usedBasicIndices.delete(i);
    }

    for (let i = 0; i < specialPool.length; i++) {
      if (usedSpecialIndices.has(i)) continue;
      const spec = specialPool[i];
      const specMana = getSpecialSourceMana(spec, commanderColors, options);
      const totalAmount = specMana.amount;

      usedSpecialIndices.add(i);
      tappedSpecials.push(spec.id);

      payGeneric(
        remainingGeneric - totalAmount,
        tappedBasics,
        tappedSpecials,
        usedBasicIndices,
        usedSpecialIndices,
        legendFilterActivatedId
      );

      tappedSpecials.pop();
      usedSpecialIndices.delete(i);
    }
  }

  function solve(
    pipIdx: number,
    tappedBasics: Record<string, number>,
    tappedSpecials: string[],
    usedBasicIndices: Set<number>,
    usedSpecialIndices: Set<number>,
    extraGenericFromFilter: number,
    legendFilterActivatedId?: string
  ) {
    if (pipIdx === pips.length) {
      payGeneric(
        genericCost + extraGenericFromFilter,
        tappedBasics,
        tappedSpecials,
        usedBasicIndices,
        usedSpecialIndices,
        legendFilterActivatedId
      );
      return;
    }

    const requiredPip = pips[pipIdx];

    for (let i = 0; i < basicPool.length; i++) {
      if (usedBasicIndices.has(i)) continue;
      const basic = basicPool[i];
      if (basic.color === requiredPip) {
        usedBasicIndices.add(i);
        tappedBasics[basic.type] = (tappedBasics[basic.type] || 0) + 1;

        solve(
          pipIdx + 1,
          tappedBasics,
          tappedSpecials,
          usedBasicIndices,
          usedSpecialIndices,
          extraGenericFromFilter,
          legendFilterActivatedId
        );

        tappedBasics[basic.type]--;
        if (tappedBasics[basic.type] === 0) delete tappedBasics[basic.type];
        usedBasicIndices.delete(i);
      }
    }

    for (let i = 0; i < specialPool.length; i++) {
      if (usedSpecialIndices.has(i)) continue;
      const spec = specialPool[i];
      const specMana = getSpecialSourceMana(spec, commanderColors, options);

      // Normal mana ability
      const canProduceColor = specMana.colors.some(colList => colList.includes(requiredPip));
      if (canProduceColor) {
        usedSpecialIndices.add(i);
        tappedSpecials.push(spec.id);

        solve(
          pipIdx + 1,
          tappedBasics,
          tappedSpecials,
          usedBasicIndices,
          usedSpecialIndices,
          extraGenericFromFilter,
          legendFilterActivatedId
        );

        tappedSpecials.pop();
        usedSpecialIndices.delete(i);
      }

      // Great Hall of the Citadel legendary filter mode:
      // {1}, {T}: Add two mana in any combination of colors (spend only on legendary spells).
      if (
        spec.isLegendFilterLand &&
        options?.isCastingLegendary &&
        !legendFilterActivatedId &&
        legendFilterColors.includes(requiredPip)
      ) {
        usedSpecialIndices.add(i);
        tappedSpecials.push(spec.id);

        // It produces 2 colored mana of any combination, so it can satisfy requiredPip AND either:
        // (a) the next pip too (if pipIdx + 1 < pips.length and it's in legendFilterColors), OR
        // (b) 1 generic mana (net +0 extra generic since activation costs {1} and second mana pays {1}).
        if (pipIdx + 1 < pips.length && legendFilterColors.includes(pips[pipIdx + 1])) {
          solve(
            pipIdx + 2,
            tappedBasics,
            tappedSpecials,
            usedBasicIndices,
            usedSpecialIndices,
            extraGenericFromFilter + 1,
            spec.id
          );
        }
        // Second mana goes toward generic (cancels the +1 activation cost)
        solve(
          pipIdx + 1,
          tappedBasics,
          tappedSpecials,
          usedBasicIndices,
          usedSpecialIndices,
          extraGenericFromFilter,
          spec.id
        );

        tappedSpecials.pop();
        usedSpecialIndices.delete(i);
      }
    }
  }

  solve(0, {}, [], new Set(), new Set(), 0, undefined);

  // Sort results: fewest sacrificed sources first, then fewest total tapped sources
  results.sort((a, b) => {
    const sacA = a.specialsTapped.filter(id => sacIdSet.has(id)).length;
    const sacB = b.specialsTapped.filter(id => sacIdSet.has(id)).length;
    if (sacA !== sacB) return sacA - sacB;
    const totalA =
      Object.values(a.basicsTapped).reduce((s, n) => s + n, 0) + a.specialsTapped.length;
    const totalB =
      Object.values(b.basicsTapped).reduce((s, n) => s + n, 0) + b.specialsTapped.length;
    return totalA - totalB;
  });

  return results;
}

export function describeTappingOption(
  opt: TappingOption,
  _basics: Record<string, { total: number; tapped: number }>,
  specialSources: SpecialSource[],
  _cost: ParsedManaCost
): string {
  const permanentParts: string[] = [];
  const sacrificedParts: string[] = [];

  Object.entries(opt.basicsTapped).forEach(([type, count]) => {
    const color = getBasicLandColor(type);
    for (let i = 0; i < count; i++) {
      permanentParts.push(`${type} ({${color}})`);
    }
  });

  opt.specialsTapped.forEach(id => {
    const src = specialSources.find(s => s.id === id);
    if (!src) return;
    if (src.sacrificeToActivate) {
      sacrificedParts.push(`Sacrificed ${src.name} ({1})`);
    } else if (opt.legendFilterActivatedId === src.id) {
      permanentParts.push(`${src.name} (Legendary Filter {2})`);
    } else {
      const colStr =
        src.manaProductionAmount > 1
          ? `{${(src.produces[0] || 'C').repeat(src.manaProductionAmount)}}`
          : src.producesAnyColor
            ? '{Any}'
            : `{${src.produces[0] || 'C'}}`;
      permanentParts.push(`${src.name} (${colStr})`);
    }
  });

  if (permanentParts.length > 0 && sacrificedParts.length > 0) {
    return `${permanentParts.join(', ')} + ${sacrificedParts.join(', ')}`;
  }
  if (sacrificedParts.length > 0) {
    return sacrificedParts.join(', ');
  }
  return permanentParts.join(', ') || 'Free ({0})';
}

// --- State Fingerprint Generator ---

export function getFingerprint(state: SimState): string {
  const handStr = state.hand.map(c => c.name).sort().join(',');
  const basicStr = Object.entries(state.basics)
    .sort()
    .map(([k, v]) => `${k}:${v.total - v.tapped}/${v.total}`)
    .join(',');
  const specialStr = state.specialSources
    .map(
      s =>
        `${s.name}:${s.tapped ? 'T' : 'U'}:${s.hasSummoningSickness ? 'S' : 'R'}:${s.enchantments
          .map(e => e.name)
          .sort()
          .join('+')}`
    )
    .sort()
    .join(',');
  const gyStr = (state.graveyard || []).map(c => c.name).sort().join(',');
  const hasLandDrop = state.landsPlayed < 1 + state.additionalLandDropsAllowed;
  return `T:${state.turn} | H:[${handStr}] | B:[${basicStr}] | S:[${specialStr}] | G:[${gyStr}] | LD:${hasLandDrop} | C:${state.commanderCast}`;
}

// --- Simulator Rules & Branching engine ---

export function cloneState(state: SimState): SimState {
  const basicsClone: Record<string, { total: number; tapped: number }> = {};
  Object.entries(state.basics).forEach(([k, v]) => {
    basicsClone[k] = { ...v };
  });

  const specialsClone = state.specialSources.map(s => ({
    ...s,
    produces: [...s.produces],
    enchantments: s.enchantments.map(e => ({ ...e, produces: [...e.produces] })),
  }));

  return {
    turn: state.turn,
    hand: [...state.hand],
    basics: basicsClone,
    specialSources: specialsClone,
    landsPlayed: state.landsPlayed,
    additionalLandDropsAllowed: state.additionalLandDropsAllowed,
    library: [...state.library],
    commanderCast: state.commanderCast,
    history: [...state.history],
    treasuresCreatedTotal: state.treasuresCreatedTotal || 0,
    treasuresSpentTotal: state.treasuresSpentTotal || 0,
    gnomeTokens: state.gnomeTokens || 0,
    commanderCounters: state.commanderCounters || 0,
    graveyard: state.graveyard ? [...state.graveyard] : [],
  };
}

function getLegendaryContext(state: SimState, commanderColors: string[]) {
  const legendaries = state.specialSources.filter(s => s.isLegendaryPermanent);
  const hasLegendaryOnBoard = legendaries.length > 0;
  const legendaryColors: string[] = [];
  legendaries.forEach(l => {
    l.produces.forEach(c => {
      if (!legendaryColors.includes(c)) legendaryColors.push(c);
    });
  });
  return {
    hasLegendaryOnBoard,
    legendaryColors: legendaryColors.length > 0 ? legendaryColors : commanderColors,
  };
}

function applyTappingOptionToState(state: SimState, opt: TappingOption): void {
  Object.entries(opt.basicsTapped).forEach(([type, count]) => {
    if (state.basics[type]) {
      state.basics[type].tapped += count;
    }
  });
  const sacIds = new Set<string>();
  opt.specialsTapped.forEach(id => {
    const s = state.specialSources.find(x => x.id === id);
    if (s) {
      if (s.sacrificeToActivate) {
        sacIds.add(id);
        state.treasuresSpentTotal = (state.treasuresSpentTotal || 0) + 1;
      } else {
        s.tapped = true;
      }
    }
  });
  if (sacIds.size > 0) {
    state.specialSources = state.specialSources.filter(x => !sacIds.has(x.id));
  }
}

function addTreasureTokensToState(
  state: SimState,
  count: number,
  commanderColors: string[],
  sourceLabel: string
): void {
  for (let i = 0; i < count; i++) {
    state.specialSources.push({
      id: `treasure_${sourceLabel}_${Math.random().toString(36).substring(2, 9)}`,
      name: 'Treasure Token',
      cardId: 'treasure_token',
      produces: commanderColors.length > 0 ? [...commanderColors] : ['W', 'U', 'B', 'R', 'G'],
      producesAnyColor: true,
      manaProductionAmount: 1,
      tapped: false,
      hasSummoningSickness: false,
      isCreature: false,
      isArtifact: true,
      isEnchantment: false,
      enchantments: [],
      isToken: true,
      sacrificeToActivate: true,
      producesManaAbility: true,
    });
  }
  state.treasuresCreatedTotal = (state.treasuresCreatedTotal || 0) + count;
}

function resolveFetchFromLibrary(
  state: SimState,
  commanderColors: string[],
  entersTapped: boolean,
  sourceName: string
): void {
  const libraryLands = state.library.filter(c => c.isLand);
  // Determine which color we lack most on board
  const missingColors = commanderColors.filter(col => {
    const hasBasic = Object.keys(state.basics).some(
      b => state.basics[b].total > 0 && getBasicLandColor(b) === col
    );
    const hasSpecial = state.specialSources.some(
      s => s.producesManaAbility !== false && (s.producesAnyColor || s.produces.includes(col))
    );
    return !hasBasic && !hasSpecial;
  });
  const desiredColors = missingColors.length > 0 ? missingColors : commanderColors;

  let fetched: CompiledCard | null = null;
  for (const col of desiredColors) {
    const idx = libraryLands.findIndex(
      l => l.isBasicLand && getBasicLandColor(getBasicLandCanonicalName(l.name, l.typeLine)) === col
    );
    if (idx !== -1) {
      fetched = libraryLands[idx];
      break;
    }
  }
  if (!fetched) {
    const anyBasicIdx = libraryLands.findIndex(l => l.isBasicLand);
    if (anyBasicIdx !== -1) fetched = libraryLands[anyBasicIdx];
  }

  if (fetched) {
    state.library = state.library.filter(x => x.id !== fetched!.id);
    const canonical = getBasicLandCanonicalName(fetched.name, fetched.typeLine);
    if (!state.basics[canonical]) {
      state.basics[canonical] = { total: 0, tapped: 0 };
    }
    state.basics[canonical].total++;
    if (entersTapped) state.basics[canonical].tapped++;
    state.history.push(
      `Turn ${state.turn}: Crack ${sourceName} -> basic ${canonical} ${entersTapped ? '(tapped)' : '(untapped)'}`
    );
  } else {
    // Fallback synthesize a basic in desired color if library had none
    const col = desiredColors[0] || 'R';
    const canonical =
      col === 'W' ? 'Plains' : col === 'U' ? 'Island' : col === 'B' ? 'Swamp' : col === 'G' ? 'Forest' : 'Mountain';
    if (!state.basics[canonical]) {
      state.basics[canonical] = { total: 0, tapped: 0 };
    }
    state.basics[canonical].total++;
    if (entersTapped) state.basics[canonical].tapped++;
    state.history.push(
      `Turn ${state.turn}: Crack ${sourceName} -> basic ${canonical} ${entersTapped ? '(tapped)' : '(untapped)'}`
    );
  }
}

export function getNextMoves(state: SimState, commander: CompiledCard, commanderColors: string[]): SimState[] {
  const branches: SimState[] = [];

  if (state.commanderCast) return branches;

  const legCtx = getLegendaryContext(state, commanderColors);

  // 1. Can we cast the Commander?
  const commanderTapping = findTappingOptions(
    commander.parsedManaCost,
    state.basics,
    state.specialSources,
    commanderColors,
    {
      hasLegendaryOnBoard: legCtx.hasLegendaryOnBoard,
      isCastingLegendary: commander.isLegendary || true,
      legendaryColors: legCtx.legendaryColors,
    }
  );
  if (commanderTapping.length > 0) {
    const opt = commanderTapping[0];
    const newState = cloneState(state);
    applyTappingOptionToState(newState, opt);
    newState.commanderCast = true;
    newState.history.push(`Turn ${state.turn}: Cast Commander ${commander.name}!`);
    return [newState]; // Direct cast is always optimal
  }

  // 2. Play Land from Hand
  const canPlayLand = state.landsPlayed < 1 + state.additionalLandDropsAllowed;
  if (canPlayLand) {
    const landsInHand = state.hand.filter(c => c.isLand);
    const seenLands = new Set<string>();

    landsInHand.forEach(land => {
      if (seenLands.has(land.name)) return;
      seenLands.add(land.name);

      const newState = cloneState(state);
      newState.hand = newState.hand.filter(c => c.id !== land.id);
      newState.landsPlayed++;

      if (land.isBasicLand) {
        const type = getBasicLandCanonicalName(land.name, land.typeLine);
        if (!newState.basics[type]) {
          newState.basics[type] = { total: 0, tapped: 0 };
        }
        newState.basics[type].total++;
        newState.history.push(`Turn ${state.turn}: Play basic ${type}`);
      } else {
        const landsAlreadyOnBoard = countLandsOnBoard(state);
        const entersTappedNow = land.slowLandCondition
          ? landsAlreadyOnBoard < 2
          : land.entersTapped;

        newState.specialSources.push({
          id: `special_${land.name}_${Math.random().toString(36).substring(2, 9)}`,
          name: land.name,
          cardId: land.id,
          imageUrl: land.imageUrl,
          produces: [...land.produces],
          producesAnyColor: land.producesAnyColor,
          manaProductionAmount: land.manaProductionAmount,
          tapped: entersTappedNow,
          hasSummoningSickness: false,
          isCreature: false,
          isArtifact: false,
          isEnchantment: false,
          enchantments: [],
          isLand: true,
          isFetchLand: land.isFetchLand,
          fetchEntersTapped: land.fetchLandEntersTapped,
          isLegendFilterLand: land.isLegendFilterLand,
          producesManaAbility: !land.isFetchLand,
        });
        newState.history.push(
          `Turn ${state.turn}: Play ${land.name}${entersTappedNow ? ' (tapped)' : ''}`
        );
      }
      branches.push(newState);
    });
  }

  // 2b. Crack untapped Fetchlands on board
  const untappedFetches = state.specialSources.filter(s => s.isFetchLand && !s.tapped);
  untappedFetches.forEach(fetch => {
    const newState = cloneState(state);
    newState.specialSources = newState.specialSources.filter(s => s.id !== fetch.id);
    resolveFetchFromLibrary(newState, commanderColors, Boolean(fetch.fetchEntersTapped), fetch.name);
    branches.push(newState);
  });

  // 2c. Attack with non-summoning-sick Treasure-generating creatures (e.g. Ragavan)
  const attackTreasureCreatures = state.specialSources.filter(
    s => s.isCreature && !s.hasSummoningSickness && !s.tapped && (s.attackCreatesTreasureCount || 0) > 0
  );
  attackTreasureCreatures.forEach(attacker => {
    const newState = cloneState(state);
    const target = newState.specialSources.find(s => s.id === attacker.id);
    if (target) {
      target.tapped = true;
      const count = target.attackCreatesTreasureCount || 1;
      addTreasureTokensToState(newState, count, commanderColors, attacker.name);
      newState.history.push(
        `Turn ${state.turn}: Attack with ${attacker.name} -> Create ${count}x Treasure Token`
      );
      branches.push(newState);
    }
  });

  // 3. Cast Accelerators / Spells from Hand
  const castableSpells = state.hand.filter(
    c =>
      !c.isLand &&
      (c.isManaRock ||
        c.isManaDork ||
        c.isRampSpell ||
        c.isLandAura ||
        c.isExtraLandDropSpell ||
        c.createsTreasureCount > 0 ||
        c.attackCreatesTreasureCount > 0)
  );
  const seenSpells = new Set<string>();

  castableSpells.forEach(spell => {
    if (seenSpells.has(spell.name)) return;
    seenSpells.add(spell.name);

    const payOptions = findTappingOptions(
      spell.parsedManaCost,
      state.basics,
      state.specialSources,
      commanderColors,
      {
        hasLegendaryOnBoard: legCtx.hasLegendaryOnBoard,
        isCastingLegendary: spell.isLegendary,
        legendaryColors: legCtx.legendaryColors,
      }
    );

    payOptions.slice(0, 2).forEach(opt => {
      const newState = cloneState(state);
      applyTappingOptionToState(newState, opt);
      newState.hand = newState.hand.filter(c => c.id !== spell.id);

      if (spell.createsTreasureCount > 0) {
        addTreasureTokensToState(newState, spell.createsTreasureCount, commanderColors, spell.name);
        if (spell.hasFlashback) {
          newState.graveyard = [...(newState.graveyard || []), spell];
        }
        newState.history.push(
          `Turn ${state.turn}: Cast ${spell.name} -> Create ${spell.createsTreasureCount}x Treasure Token`
        );
      } else if (spell.attackCreatesTreasureCount > 0 && spell.isCreature) {
        newState.specialSources.push({
          id: `attacker_${spell.name}_${Math.random().toString(36).substring(2, 9)}`,
          name: spell.name,
          cardId: spell.id,
          imageUrl: spell.imageUrl,
          produces: [],
          producesAnyColor: false,
          manaProductionAmount: 0,
          tapped: false,
          hasSummoningSickness: !spell.hasHaste,
          isCreature: true,
          isArtifact: spell.isArtifact,
          isEnchantment: false,
          enchantments: [],
          isLegendaryPermanent: spell.isLegendary,
          producesManaAbility: false,
          attackCreatesTreasureCount: spell.attackCreatesTreasureCount,
          isNonGnomeCreature: true,
        });
        newState.history.push(`Turn ${state.turn}: Cast ${spell.name} (combat treasure engine)`);
      } else if (spell.isManaRock) {
        newState.specialSources.push({
          id: `rock_${spell.name}_${Math.random().toString(36).substring(2, 9)}`,
          name: spell.name,
          cardId: spell.id,
          imageUrl: spell.imageUrl,
          produces: [...spell.produces],
          producesAnyColor: spell.producesAnyColor,
          manaProductionAmount: spell.manaProductionAmount,
          tapped: spell.entersTapped,
          hasSummoningSickness: false,
          isCreature: false,
          isArtifact: true,
          isEnchantment: false,
          enchantments: [],
          requiresLegendary: spell.requiresLegendaryToTap,
          isLegendaryPermanent: spell.isLegendary,
          producesManaAbility: true,
        });
        newState.history.push(`Turn ${state.turn}: Cast ${spell.name}`);
      } else if (spell.isManaDork) {
        newState.specialSources.push({
          id: `dork_${spell.name}_${Math.random().toString(36).substring(2, 9)}`,
          name: spell.name,
          cardId: spell.id,
          imageUrl: spell.imageUrl,
          produces: [...spell.produces],
          producesAnyColor: spell.producesAnyColor,
          manaProductionAmount: spell.manaProductionAmount,
          tapped: false,
          hasSummoningSickness: !spell.hasHaste,
          isCreature: true,
          isArtifact: false,
          isEnchantment: false,
          enchantments: [],
          isLegendaryPermanent: spell.isLegendary,
          producesManaAbility: true,
          isNonGnomeCreature: true,
        });
        newState.history.push(`Turn ${state.turn}: Cast ${spell.name} (summoning sickness)`);
      } else if (spell.isLandAura) {
        let enchanted = false;
        const basicTypes = Object.keys(newState.basics);
        for (const type of basicTypes) {
          const untapped = newState.basics[type].total - newState.basics[type].tapped;
          if (untapped > 0) {
            newState.basics[type].total--;
            const color = getBasicLandColor(type);
            newState.specialSources.push({
              id: `enchanted_${type}_${Math.random().toString(36).substring(2, 9)}`,
              name: `Enchanted ${type}`,
              cardId: 'basic_land',
              produces: [color],
              producesAnyColor: false,
              manaProductionAmount: 1,
              tapped: false,
              hasSummoningSickness: false,
              isCreature: false,
              isArtifact: false,
              isEnchantment: false,
              isLand: true,
              producesManaAbility: true,
              enchantments: [
                {
                  name: spell.name,
                  produces: spell.produces.length > 0 ? spell.produces : ['G'],
                  producesAnyColor: spell.producesAnyColor,
                },
              ],
            });
            enchanted = true;
            newState.history.push(`Turn ${state.turn}: Cast ${spell.name} on ${type}`);
            break;
          }
        }

        if (!enchanted && newState.specialSources.length > 0) {
          const targetLand = newState.specialSources.find(
            s => !s.tapped && !s.isCreature && !s.isArtifact && !s.isEnchantment
          );
          if (targetLand) {
            targetLand.enchantments.push({
              name: spell.name,
              produces: spell.produces.length > 0 ? spell.produces : ['G'],
              producesAnyColor: spell.producesAnyColor,
            });
            newState.history.push(`Turn ${state.turn}: Cast ${spell.name} on ${targetLand.name}`);
            enchanted = true;
          }
        }
        if (!enchanted) return;
      } else if (spell.isRampSpell) {
        const libraryBasics = newState.library.filter(c => c.isLand);
        const targetColors = [...commanderColors];

        for (let j = 0; j < spell.rampLandCount; j++) {
          if (libraryBasics.length === 0) break;

          let foundIdx = -1;
          for (let cIdx = 0; cIdx < targetColors.length; cIdx++) {
            const desiredColor = targetColors[cIdx];
            foundIdx = libraryBasics.findIndex(x => {
              const nameL = x.name.toLowerCase();
              const typeL = (x.typeLine || '').toLowerCase();
              if (desiredColor === 'G' && (nameL.includes('forest') || typeL.includes('forest') || x.produces.includes('G'))) return true;
              if (desiredColor === 'U' && (nameL.includes('island') || typeL.includes('island') || x.produces.includes('U'))) return true;
              if (desiredColor === 'B' && (nameL.includes('swamp') || typeL.includes('swamp') || x.produces.includes('B'))) return true;
              if (desiredColor === 'R' && (nameL.includes('mountain') || typeL.includes('mountain') || x.produces.includes('R'))) return true;
              if (desiredColor === 'W' && (nameL.includes('plains') || typeL.includes('plains') || x.produces.includes('W'))) return true;
              return false;
            });
            if (foundIdx !== -1) {
              targetColors.splice(cIdx, 1);
              break;
            }
          }

          if (foundIdx === -1) {
            foundIdx = libraryBasics.findIndex(x => x.isBasicLand || x.produces.length > 0);
          }

          if (foundIdx !== -1) {
            const landToFetch = libraryBasics[foundIdx];
            newState.library = newState.library.filter(x => x.id !== landToFetch.id);
            libraryBasics.splice(foundIdx, 1);

            if (landToFetch.isBasicLand) {
              const type = getBasicLandCanonicalName(landToFetch.name, landToFetch.typeLine);
              if (!newState.basics[type]) {
                newState.basics[type] = { total: 0, tapped: 0 };
              }
              newState.basics[type].total++;
              if (spell.rampLandEntersTapped) newState.basics[type].tapped++;
              newState.history.push(
                `Turn ${state.turn}: Resolve ${spell.name} -> basic ${type} ${spell.rampLandEntersTapped ? 'tapped' : 'untapped'}`
              );
            } else {
              newState.specialSources.push({
                id: `special_${landToFetch.name}_${Math.random().toString(36).substring(2, 9)}`,
                name: landToFetch.name,
                cardId: landToFetch.id,
                imageUrl: landToFetch.imageUrl,
                produces: [...landToFetch.produces],
                producesAnyColor: landToFetch.producesAnyColor,
                manaProductionAmount: landToFetch.manaProductionAmount,
                tapped: spell.rampLandEntersTapped || landToFetch.entersTapped,
                hasSummoningSickness: false,
                isCreature: false,
                isArtifact: false,
                isEnchantment: false,
                enchantments: [],
                isLand: true,
                producesManaAbility: true,
              });
              newState.history.push(
                `Turn ${state.turn}: Resolve ${spell.name} -> ${landToFetch.name} ${spell.rampLandEntersTapped || landToFetch.entersTapped ? 'tapped' : 'untapped'}`
              );
            }
          }
        }

        if (spell.rampIntoHandCount > 0 && libraryBasics.length > 0) {
          const landToHand = libraryBasics[0];
          newState.library = newState.library.filter(x => x.id !== landToHand.id);
          newState.hand.push(landToHand);
          newState.history.push(`Turn ${state.turn}: Put ${landToHand.name} into hand from ${spell.name}`);
        }
      } else if (spell.isExtraLandDropSpell) {
        newState.additionalLandDropsAllowed++;
        if (newState.library.length > 0) {
          const drawn = newState.library.shift()!;
          newState.hand.push(drawn);
          newState.history.push(`Turn ${state.turn}: Cast ${spell.name} (+1 land drop, draw: ${drawn.name})`);
        } else {
          newState.history.push(`Turn ${state.turn}: Cast ${spell.name} (+1 land drop)`);
        }
      }

      branches.push(newState);
    });
  });

  // 3b. Flashback from Graveyard
  const flashbackCards = (state.graveyard || []).filter(c => c.hasFlashback && c.flashbackCost);
  flashbackCards.forEach(fbCard => {
    const payOptions = findTappingOptions(
      fbCard.flashbackCost!,
      state.basics,
      state.specialSources,
      commanderColors,
      {
        hasLegendaryOnBoard: legCtx.hasLegendaryOnBoard,
        isCastingLegendary: fbCard.isLegendary,
        legendaryColors: legCtx.legendaryColors,
      }
    );
    if (payOptions.length > 0) {
      const opt = payOptions[0];
      const newState = cloneState(state);
      applyTappingOptionToState(newState, opt);
      newState.graveyard = (newState.graveyard || []).filter(c => c.id !== fbCard.id);
      if (fbCard.createsTreasureCount > 0) {
        addTreasureTokensToState(newState, fbCard.createsTreasureCount, commanderColors, `${fbCard.name}_fb`);
        newState.history.push(
          `Turn ${state.turn}: Flashback ${fbCard.name} -> Create ${fbCard.createsTreasureCount}x Treasure Token`
        );
      } else {
        newState.history.push(`Turn ${state.turn}: Flashback ${fbCard.name}`);
      }
      branches.push(newState);
    }
  });

  // 4. Pass Turn
  const passState = cloneState(state);
  passState.turn++;
  passState.landsPlayed = 0;
  passState.additionalLandDropsAllowed = 0;

  Object.keys(passState.basics).forEach(k => {
    passState.basics[k].tapped = 0;
  });

  passState.specialSources.forEach(s => {
    s.tapped = false;
    s.hasSummoningSickness = false;
  });

  passState.history.push(`Turn ${state.turn}: Pass Turn`);
  if (passState.library.length > 0) {
    const drawn = passState.library.shift()!;
    passState.hand.push(drawn);
    passState.history.push(`Turn ${passState.turn}: Draw: ${drawn.name}`);
  } else {
    passState.history.push(`Turn ${passState.turn}: Library empty`);
  }

  branches.push(passState);

  return branches;
}

// --- Pathfinder Search Algorithm ---

export function findOptimalPlayPath(
  startingHand: ProcessedDeckCard[],
  deck: ProcessedDeckCard[],
  commanderCard: ProcessedDeckCard,
  maxTurnDepth: number = 7
): SimState | null {
  const commanderColors = commanderCard.colorIdentity || [];
  const compiledCommander = compileCard(commanderCard, commanderColors);

  const handCardNames = startingHand.map(c => c.name);

  const flatDeck: CompiledCard[] = [];
  deck.forEach(c => {
    if (c.name === commanderCard.name) return;
    const compiled = compileCard(c, commanderColors);
    for (let i = 0; i < c.quantity; i++) {
      flatDeck.push({ ...compiled, id: `${compiled.id}_lib_${i}` });
    }
  });

  const handCompiled: CompiledCard[] = [];
  handCardNames.forEach((name, hIdx) => {
    const idx = flatDeck.findIndex(c => c.name === name);
    if (idx !== -1) {
      handCompiled.push({ ...flatDeck[idx], id: `${flatDeck[idx].id}_hand_${hIdx}` });
      flatDeck.splice(idx, 1);
    } else {
      const foundProcessed = deck.find(c => c.name === name);
      if (foundProcessed) {
        handCompiled.push({ ...compileCard(foundProcessed, commanderColors), id: `${foundProcessed.id}_hand_${hIdx}` });
      }
    }
  });

  const library = [...flatDeck];
  for (let i = library.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [library[i], library[j]] = [library[j], library[i]];
  }

  const initialState: SimState = {
    turn: 1,
    hand: handCompiled,
    basics: {},
    specialSources: [],
    landsPlayed: 0,
    additionalLandDropsAllowed: 0,
    library,
    commanderCast: false,
    history: [],
    treasuresCreatedTotal: 0,
    treasuresSpentTotal: 0,
    gnomeTokens: 0,
    commanderCounters: 0,
    graveyard: [],
  };

  interface PathNode {
    id: string;
    state: SimState;
    parent: PathNode | null;
    actionTaken: string;
    depth: number;
    universeId: string;
    manaPayment?: string;
    causalWhy?: string;
    branchingFactor: number;
  }

  let nodeCounter = 0;
  const allNodes: PathNode[] = [];

  const initialStateNode: PathNode = {
    id: `node-${nodeCounter++}`,
    state: initialState,
    parent: null,
    actionTaken: 'Start Game',
    depth: 0,
    universeId: 'alpha',
    causalWhy: 'Opening 7-card hand ready',
    branchingFactor: 0,
  };
  allNodes.push(initialStateNode);

  const visited = new Set<string>();
  let bestFinishedNode: PathNode | null = null;
  let bestTurn = maxTurnDepth + 1;

  const queue: PathNode[] = [initialStateNode];

  while (queue.length > 0) {
    const currNode = queue.shift()!;
    const curr = currNode.state;

    if (curr.commanderCast) {
      if (curr.turn < bestTurn) {
        bestTurn = curr.turn;
        bestFinishedNode = currNode;
      }
      continue;
    }

    if (curr.turn >= bestTurn || curr.turn >= maxTurnDepth) {
      continue;
    }

    const fingerprint = getFingerprint(curr);
    if (visited.has(fingerprint)) {
      continue;
    }
    visited.add(fingerprint);

    const nextStates = getNextMoves(curr, compiledCommander, commanderColors);
    currNode.branchingFactor = nextStates.length;

    nextStates.forEach((next, branchIdx) => {
      const actionTaken = next.history[next.history.length - 1]
        ? next.history[next.history.length - 1].replace(/^Turn \d+: /, '')
        : 'Action';

      const childNode: PathNode = {
        id: `node-${nodeCounter++}`,
        state: next,
        parent: currNode,
        actionTaken,
        depth: currNode.depth + 1,
        universeId: branchIdx === 0 ? currNode.universeId : `branch-${currNode.depth + 1}-${branchIdx}`,
        manaPayment: next.treasuresSpentTotal && next.treasuresSpentTotal > (curr.treasuresSpentTotal || 0)
          ? 'Includes Treasure Token'
          : undefined,
        causalWhy: next.commanderCast
          ? `Summons ${commanderCard.name} on Turn ${next.turn}`
          : actionTaken.includes('Treasure')
            ? 'Generates burst mana for earlier Commander turn'
            : actionTaken.includes('Play')
              ? 'Develops mana base for turn curve'
              : 'Advances turn sequence',
        branchingFactor: 0,
      };

      if (allNodes.length < 800) {
        allNodes.push(childNode);
      }

      queue.push(childNode);
    });
  }

  if (!bestFinishedNode) return null;

  const path: SimState[] = [];
  const optimalNodeIds = new Set<string>();
  let trace: PathNode | null = bestFinishedNode;

  while (trace !== null) {
    path.unshift(trace.state);
    optimalNodeIds.add(trace.id);
    if (!allNodes.some(n => n.id === trace!.id)) {
      allNodes.push(trace);
    }
    trace = trace.parent;
  }

  const visualNodesSet = new Set<PathNode>();
  const childrenByParent = new Map<string, PathNode[]>();
  allNodes.forEach(n => {
    if (n.parent) {
      const pId = n.parent.id;
      if (!childrenByParent.has(pId)) {
        childrenByParent.set(pId, []);
      }
      childrenByParent.get(pId)!.push(n);
    }
  });

  allNodes.forEach(n => {
    if (optimalNodeIds.has(n.id)) {
      visualNodesSet.add(n);
    }
  });

  const maxDepth = bestFinishedNode.depth;

  for (let d = 0; d < maxDepth; d++) {
    const parentNodesAtDepth = Array.from(visualNodesSet).filter(n => n.depth === d);
    let altsAddedAtDepth = 0;

    parentNodesAtDepth.forEach(parent => {
      const children = childrenByParent.get(parent.id) || [];
      for (const child of children) {
        if (!visualNodesSet.has(child)) {
          if (altsAddedAtDepth < 4) {
            visualNodesSet.add(child);
            altsAddedAtDepth++;
          }
        }
      }
    });
  }

  const visualNodes = Array.from(visualNodesSet).map(n => ({
    id: n.id,
    parentId: n.parent ? n.parent.id : null,
    label: n.actionTaken,
    turn: n.state.turn,
    depth: n.depth,
    isOptimal: optimalNodeIds.has(n.id),
    universeId: n.universeId,
    manaPayment: n.manaPayment,
    causalWhy: n.causalWhy,
    branchingFactor: n.branchingFactor,
    state: n.state,
  }));

  const finalState = bestFinishedNode.state;
  (finalState as any).stateHistory = path;
  (finalState as any).exploredNodes = visualNodes;

  return finalState;
}

// --- Monte Carlo Simulation Loop ---

export interface MonteCarloResult {
  averageTurn: number;
  distribution: Record<number, number>;
  totalRuns: number;
  successRate: number;
  acceleratorStats?: Array<{
    cardName: string;
    handsWithCard: number;
    avgTurnWithCard: number;
    turn2RateWithCard: number;
    baselineAvgTurn: number;
  }>;
}

export function runMonteCarlo(
  deck: ProcessedDeckCard[],
  commanderCard: ProcessedDeckCard,
  runs: number = 300,
  maxTurnDepth: number = 7
): MonteCarloResult {
  const commanderColors = commanderCard.colorIdentity || [];
  const compiledCommander = compileCard(commanderCard, commanderColors);

  const flatDeck: CompiledCard[] = [];
  deck.forEach(c => {
    if (c.id === commanderCard.id || c.name === commanderCard.name) return;
    const compiled = compileCard(c, commanderColors);
    for (let i = 0; i < c.quantity; i++) {
      flatDeck.push({ ...compiled, id: `${compiled.id}_mc_${i}` });
    }
  });

  const turnCounts: Record<number, number> = {};
  for (let i = 1; i <= maxTurnDepth; i++) {
    turnCounts[i] = 0;
  }
  turnCounts[maxTurnDepth + 1] = 0;

  let totalCastTurns = 0;
  let successCount = 0;

  const accelTracker = new Map<string, { hands: number; turnSum: number; turn2Count: number }>();
  const runOutcomes: Array<{ castTurn: number; openingAccelNames: Set<string> }> = [];
  const MAX_STATES_PER_RUN = 1200;

  for (let r = 0; r < runs; r++) {
    const shuffled = [...flatDeck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const openingHand = shuffled.slice(0, 7);
    const library = shuffled.slice(7);

    const openingAccelNames = new Set<string>();
    openingHand.forEach(c => {
      if (
        c.createsTreasureCount > 0 ||
        c.attackCreatesTreasureCount > 0 ||
        c.isManaRock ||
        c.isManaDork ||
        c.isRampSpell ||
        c.isLandAura ||
        c.isExtraLandDropSpell ||
        c.requiresLegendaryToTap
      ) {
        openingAccelNames.add(c.name);
      }
    });

    const initialState: SimState = {
      turn: 1,
      hand: openingHand,
      basics: {},
      specialSources: [],
      landsPlayed: 0,
      additionalLandDropsAllowed: 0,
      library,
      commanderCast: false,
      history: [],
      treasuresCreatedTotal: 0,
      treasuresSpentTotal: 0,
      graveyard: [],
    };

    const visited = new Set<string>();
    const queue: SimState[] = [initialState];
    let head = 0;
    let castTurn = maxTurnDepth + 1;
    let statesExplored = 0;

    while (head < queue.length && statesExplored < MAX_STATES_PER_RUN) {
      const curr = queue[head++];
      statesExplored++;

      if (curr.commanderCast) {
        castTurn = curr.turn;
        break;
      }

      if (curr.turn >= castTurn || curr.turn >= maxTurnDepth) {
        continue;
      }

      const fp = getFingerprint(curr);
      if (visited.has(fp)) continue;
      visited.add(fp);

      const nextMoves = getNextMoves(curr, compiledCommander, commanderColors);
      for (const next of nextMoves) {
        queue.push(next);
      }
    }

    turnCounts[castTurn] = (turnCounts[castTurn] || 0) + 1;
    if (castTurn <= maxTurnDepth) {
      totalCastTurns += castTurn;
      successCount++;
    }

    runOutcomes.push({ castTurn, openingAccelNames });
    openingAccelNames.forEach(name => {
      const entry = accelTracker.get(name) || { hands: 0, turnSum: 0, turn2Count: 0 };
      entry.hands++;
      entry.turnSum += Math.min(castTurn, maxTurnDepth + 1);
      if (castTurn <= 2) entry.turn2Count++;
      accelTracker.set(name, entry);
    });
  }

  const averageTurn = successCount > 0 ? totalCastTurns / successCount : maxTurnDepth + 1;
  const successRate = runs > 0 ? successCount / runs : 0;

  const acceleratorStats = Array.from(accelTracker.entries())
    .map(([cardName, data]) => {
      const withoutRuns = runOutcomes.filter(o => !o.openingAccelNames.has(cardName));
      const baselineAvgTurn =
        withoutRuns.length > 0
          ? withoutRuns.reduce((s, o) => s + o.castTurn, 0) / withoutRuns.length
          : averageTurn;
      return {
        cardName,
        handsWithCard: data.hands,
        avgTurnWithCard: Number((data.turnSum / data.hands).toFixed(2)),
        turn2RateWithCard: Number((data.turn2Count / data.hands).toFixed(3)),
        baselineAvgTurn: Number(baselineAvgTurn.toFixed(2)),
      };
    })
    .sort((a, b) => a.avgTurnWithCard - b.avgTurnWithCard);

  return {
    averageTurn,
    distribution: turnCounts,
    totalRuns: runs,
    successRate,
    acceleratorStats,
  };
}

// --- Parallel Universes Engine & Spotlight Hand Builder ---

export interface ParallelAction {
  type: 'PLAY_LAND' | 'CAST_SPELL' | 'CAST_COMMANDER' | 'CRACK_FETCH' | 'COMBAT_TRIGGER' | 'FLASHBACK';
  cardName: string;
  card?: ProcessedDeckCard;
  headline: string;
  manaPayment: string;
  causalWhy: string;
  outcomeBadge: string;
  sacrificedTokens?: string[];
}

export interface ParallelTurnStep {
  turn: number;
  drawnCard?: ProcessedDeckCard | null;
  actions: ParallelAction[];
  manaSummary: string;
  turnTakeaway: string;
  stateAtEndOfTurn: SimState;
}

export interface ParallelUniverse {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  accentColor: 'amber' | 'emerald' | 'sky' | 'purple' | 'rose';
  commanderCastTurn: number | null;
  totalBoardPowerTurn3: number;
  treasuresCreated: number;
  gnomeTokensTurn3: number;
  synergyScore: number;
  whyThisUniverseMatters: string;
  causalChain: Array<{ stepLabel: string; cardName: string; turn: number; effect: string }>;
  turns: ParallelTurnStep[];
  finalState: SimState;
}

export interface ParallelUniversesAnalysis {
  universes: ParallelUniverse[];
  fastestCommanderTurn: number | null;
  naturalBaselineTurn: number | null;
  manaCeilingTurn2: number;
  manaCeilingTurn3: number;
  handGrade: 'S' | 'A' | 'B' | 'C' | 'Mulligan';
  handVerdict: string;
  topdeckNote: string | null;
}

export function getExampleSpotlightHand(
  deck: ProcessedDeckCard[],
  commanderCard: ProcessedDeckCard | null
): ProcessedDeckCard[] {
  const nonCommanderDeck = deck.filter(c => !commanderCard || c.name !== commanderCard.name);
  const byName = (target: string) =>
    nonCommanderDeck.find(c => c.name.toLowerCase() === target.toLowerCase());

  const hasStrikeItRich = Boolean(byName('Strike It Rich'));
  const picked: ProcessedDeckCard[] = [];
  const usedCounts = new Map<string, number>();

  const tryPick = (card: ProcessedDeckCard | undefined): boolean => {
    if (!card) return false;
    const count = usedCounts.get(card.name) || 0;
    if (count >= (card.quantity || 1)) return false;
    picked.push(card);
    usedCounts.set(card.name, count + 1);
    return true;
  };

  if (hasStrikeItRich) {
    // 1. Mountain
    tryPick(byName('Mountain'));
    // 2. Plains
    tryPick(byName('Plains'));
    // 3. Strike It Rich
    tryPick(byName('Strike It Rich'));
    // 4. 1-drop creature (prefer Soul Warden or Warden of the Inner Sky)
    const oneDrop =
      byName('Soul Warden') ||
      byName('Warden of the Inner Sky') ||
      nonCommanderDeck.find(c => {
        const comp = compileCard(c, commanderCard?.colorIdentity || []);
        return comp.isCreature && comp.cmc === 1;
      });
    tryPick(oneDrop);
    // 5. 2-drop creature/engine (prefer Luminarch Aspirant or Ajani's Pridemate)
    const twoDrop =
      byName('Luminarch Aspirant') ||
      byName("Ajani's Pridemate") ||
      nonCommanderDeck.find(c => {
        const comp = compileCard(c, commanderCard?.colorIdentity || []);
        return comp.isCreature && comp.cmc === 2 && !usedCounts.has(c.name);
      });
    tryPick(twoDrop);
    // 6. Payoff/synergy card (prefer Reckless Fireweaver, Kumano Faces Kakkazan, or Impact Tremors)
    const payoff =
      byName('Reckless Fireweaver') ||
      byName('Kumano Faces Kakkazan') ||
      byName('Impact Tremors') ||
      nonCommanderDeck.find(c => {
        const comp = compileCard(c, commanderCard?.colorIdentity || []);
        return comp.isProactivePayoffOrCreature && !usedCounts.has(c.name);
      });
    tryPick(payoff);
    // 7. 3rd land (prefer Battlefield Forge, Sundown Pass, or Mountain/Plains)
    const thirdLand =
      byName('Battlefield Forge') ||
      byName('Sundown Pass') ||
      byName('Mountain') ||
      byName('Plains') ||
      nonCommanderDeck.find(c => {
        const comp = compileCard(c, commanderCard?.colorIdentity || []);
        return comp.isLand && (usedCounts.get(c.name) || 0) < (c.quantity || 1);
      });
    tryPick(thirdLand);
  } else {
    // Generic showcase hand: 2-3 lands in commander colors + earliest ramp/accelerator + early curve plays
    const colors = commanderCard?.colorIdentity || [];
    const compiledAll = nonCommanderDeck.map(c => ({ raw: c, comp: compileCard(c, colors) }));
    const lands = compiledAll.filter(x => x.comp.isLand);
    const accels = compiledAll
      .filter(x => !x.comp.isLand && (x.comp.synergyRole === 'treasure-accel' || x.comp.synergyRole === 'ramp'))
      .sort((a, b) => a.comp.cmc - b.comp.cmc);
    const earlyPlays = compiledAll
      .filter(x => !x.comp.isLand && x.comp.cmc <= 3)
      .sort((a, b) => a.comp.cmc - b.comp.cmc);

    for (const l of lands) {
      if (picked.length >= 3) break;
      tryPick(l.raw);
    }
    for (const a of accels) {
      if (picked.length >= 5) break;
      tryPick(a.raw);
    }
    for (const p of earlyPlays) {
      if (picked.length >= 7) break;
      tryPick(p.raw);
    }
  }

  // Fill up to 7 if still short
  for (const c of nonCommanderDeck) {
    while (picked.length < 7 && (usedCounts.get(c.name) || 0) < (c.quantity || 1)) {
      tryPick(c);
    }
    if (picked.length >= 7) break;
  }

  return picked.slice(0, 7);
}

// --- Parallel Universe Simulation Helpers ---

function hypergeometricAtLeastOne(populationN: number, successesK: number, drawsN: number): number {
  if (successesK <= 0 || drawsN <= 0 || populationN <= 0) return 0;
  if (successesK >= populationN) return 1;
  if (drawsN > populationN) return 1;
  let probZero = 1;
  for (let i = 0; i < drawsN; i++) {
    probZero *= (populationN - successesK - i) / (populationN - i);
  }
  return Math.max(0, Math.min(1, 1 - probZero));
}

function getTotalUntappedManaCount(state: SimState): number {
  const basicMana = Object.values(state.basics).reduce((s, b) => s + (b.total - b.tapped), 0);
  const specialMana = state.specialSources
    .filter(s => !s.tapped && (!s.isCreature || !s.hasSummoningSickness) && s.producesManaAbility !== false)
    .reduce((s, src) => s + src.manaProductionAmount + src.enchantments.length, 0);
  return basicMana + specialMana;
}

function getBoardPower(state: SimState, commander: CompiledCard): number {
  let power = 0;
  if (state.commanderCast) {
    // Anim Pakal is 1/2 base + counters
    const baseCmdPower = commander.name.toLowerCase().includes('anim pakal') ? 1 : 2;
    power += baseCmdPower + (state.commanderCounters || 0);
  }
  power += state.gnomeTokens || 0;
  state.specialSources.forEach(s => {
    if (s.isCreature) {
      power += (s.powerValue ?? 1) + (s.counters || 0);
    }
  });
  return power;
}

type UniverseStrategy = 'turbo-commander' | 'attacker-first' | 'artifact-payoff' | 'natural-baseline';

function simulateUniverseLine(
  strategy: UniverseStrategy,
  startingHand: ProcessedDeckCard[],
  deck: ProcessedDeckCard[],
  commanderCard: ProcessedDeckCard,
  maxTurns: number,
  allowLibraryDraws: boolean
): {
  turns: ParallelTurnStep[];
  finalState: SimState;
  commanderCastTurn: number | null;
  powerTurn3: number;
  gnomesTurn3: number;
  treasuresCreated: number;
  causalChain: Array<{ stepLabel: string; cardName: string; turn: number; effect: string }>;
  synergyScore: number;
  trajectoryKey: string;
} {
  const commanderColors = commanderCard.colorIdentity || [];
  const compiledCommander = compileCard(commanderCard, commanderColors);
  const rawByName = new Map<string, ProcessedDeckCard>();
  deck.forEach(c => rawByName.set(c.name, c));
  rawByName.set(commanderCard.name, commanderCard);

  const handCompiled = startingHand.map((c, idx) => ({
    ...compileCard(c, commanderColors),
    id: `${c.id}_pu_${idx}`,
  }));

  // Build remaining library for optional draws & fetchlands
  const remainingCounts = new Map<string, number>();
  deck.forEach(c => {
    if (c.name !== commanderCard.name) {
      remainingCounts.set(c.name, (remainingCounts.get(c.name) || 0) + (c.quantity || 1));
    }
  });
  startingHand.forEach(c => {
    const cur = remainingCounts.get(c.name) || 0;
    if (cur > 0) remainingCounts.set(c.name, cur - 1);
  });

  const libraryCompiled: CompiledCard[] = [];
  remainingCounts.forEach((qty, name) => {
    const raw = rawByName.get(name);
    if (!raw) return;
    const comp = compileCard(raw, commanderColors);
    for (let i = 0; i < qty; i++) {
      libraryCompiled.push({ ...comp, id: `${comp.id}_pulib_${i}` });
    }
  });

  const state: SimState = {
    turn: 1,
    hand: handCompiled,
    basics: {},
    specialSources: [],
    landsPlayed: 0,
    additionalLandDropsAllowed: 0,
    library: libraryCompiled,
    commanderCast: false,
    history: [],
    treasuresCreatedTotal: 0,
    treasuresSpentTotal: 0,
    gnomeTokens: 0,
    commanderCounters: 0,
    graveyard: [],
  };

  const turns: ParallelTurnStep[] = [];
  const causalChain: Array<{ stepLabel: string; cardName: string; turn: number; effect: string }> = [];
  let commanderCastTurn: number | null = null;
  let commanderSummoningSick = false;
  let powerTurn3 = 0;
  let gnomesTurn3 = 0;
  const trajectoryTokens: string[] = [];

  const isAnimPakal = commanderCard.name.toLowerCase().includes('anim pakal');

  for (let t = 1; t <= maxTurns; t++) {
    state.turn = t;
    state.landsPlayed = 0;
    state.additionalLandDropsAllowed = 0;

    // Untap step
    Object.keys(state.basics).forEach(k => {
      state.basics[k].tapped = 0;
    });
    state.specialSources.forEach(s => {
      s.tapped = false;
      s.hasSummoningSickness = false;
    });
    commanderSummoningSick = false;

    let drawnCard: ProcessedDeckCard | null = null;
    if (t > 1 && allowLibraryDraws && state.library.length > 0) {
      const drawn = state.library.shift()!;
      state.hand.push(drawn);
      drawnCard = rawByName.get(drawn.name) || null;
    }

    const actions: ParallelAction[] = [];
    let createdTreasureThisTurn = false;

    // 1. Land drop selection
    const landsInHand = state.hand.filter(c => c.isLand);
    if (landsInHand.length > 0) {
      // Score lands based on strategy and needed colors
      const colorCountsOnBoard: Record<string, number> = {};
      Object.entries(state.basics).forEach(([b, info]) => {
        const col = getBasicLandColor(b);
        colorCountsOnBoard[col] = (colorCountsOnBoard[col] || 0) + info.total;
      });
      state.specialSources.forEach(s => {
        if (s.producesManaAbility !== false) {
          s.produces.forEach(c => {
            colorCountsOnBoard[c] = (colorCountsOnBoard[c] || 0) + 1;
          });
        }
      });

      const landsOnBoard = countLandsOnBoard(state);
      const sortedLands = [...landsInHand].sort((a, b) => {
        const aTapped = a.slowLandCondition ? landsOnBoard < 2 : a.entersTapped;
        const bTapped = b.slowLandCondition ? landsOnBoard < 2 : b.entersTapped;
        if (aTapped !== bTapped) return aTapped ? 1 : -1;

        // Prefer land that gives a color we don't have yet or matches Turn 1 play
        const aMissingColorScore = a.produces.some(c => !colorCountsOnBoard[c]) ? 2 : 0;
        const bMissingColorScore = b.produces.some(c => !colorCountsOnBoard[c]) ? 2 : 0;
        if (t === 1) {
          if (strategy === 'turbo-commander' && state.hand.some(c => c.name.toLowerCase() === 'strike it rich')) {
            const aRed = a.produces.includes('R') ? 5 : 0;
            const bRed = b.produces.includes('R') ? 5 : 0;
            if (aRed !== bRed) return bRed - aRed;
          }
          if (strategy === 'attacker-first') {
            const oneDrop = state.hand.find(c => c.isCreature && c.cmc === 1);
            if (oneDrop) {
              const needed = ['W', 'U', 'B', 'R', 'G'].find(col => (oneDrop.parsedManaCost[col] || 0) > 0);
              if (needed) {
                const aMatch = a.produces.includes(needed) ? 5 : 0;
                const bMatch = b.produces.includes(needed) ? 5 : 0;
                if (aMatch !== bMatch) return bMatch - aMatch;
              }
            }
          }
        }
        return bMissingColorScore - aMissingColorScore;
      });

      const chosenLand = sortedLands[0];
      state.hand = state.hand.filter(c => c.id !== chosenLand.id);
      state.landsPlayed++;

      if (chosenLand.isBasicLand) {
        const type = getBasicLandCanonicalName(chosenLand.name, chosenLand.typeLine);
        if (!state.basics[type]) state.basics[type] = { total: 0, tapped: 0 };
        state.basics[type].total++;
        actions.push({
          type: 'PLAY_LAND',
          cardName: chosenLand.name,
          card: rawByName.get(chosenLand.name),
          headline: `Play ${chosenLand.name}`,
          manaPayment: 'Land drop (0 mana)',
          causalWhy: `Adds {${getBasicLandColor(type)}} source to mana base`,
          outcomeBadge: `+1 {${getBasicLandColor(type)}} Land`,
        });
        trajectoryTokens.push(`T${t}:L:${chosenLand.name}`);
      } else {
        const entersTappedNow = chosenLand.slowLandCondition ? landsOnBoard < 2 : chosenLand.entersTapped;
        state.specialSources.push({
          id: `pu_land_${chosenLand.name}_${t}`,
          name: chosenLand.name,
          cardId: chosenLand.id,
          imageUrl: chosenLand.imageUrl,
          produces: [...chosenLand.produces],
          producesAnyColor: chosenLand.producesAnyColor,
          manaProductionAmount: chosenLand.manaProductionAmount,
          tapped: entersTappedNow,
          hasSummoningSickness: false,
          isCreature: false,
          isArtifact: false,
          isEnchantment: false,
          enchantments: [],
          isLand: true,
          isFetchLand: chosenLand.isFetchLand,
          fetchEntersTapped: chosenLand.fetchLandEntersTapped,
          isLegendFilterLand: chosenLand.isLegendFilterLand,
          producesManaAbility: !chosenLand.isFetchLand,
        });
        actions.push({
          type: 'PLAY_LAND',
          cardName: chosenLand.name,
          card: rawByName.get(chosenLand.name),
          headline: `Play ${chosenLand.name}${entersTappedNow ? ' (Tapped)' : ' (Untapped)'}`,
          manaPayment: 'Land drop (0 mana)',
          causalWhy: chosenLand.slowLandCondition
            ? entersTappedNow
              ? 'Fewer than 2 other lands on board — enters tapped'
              : '2+ other lands on board — slowland condition met, enters untapped!'
            : chosenLand.isFetchLand
              ? 'Fetchland ready to crack for needed basic color'
              : 'Develops multi-color mana base',
          outcomeBadge: entersTappedNow ? 'Tapped Land' : 'Untapped Land',
        });
        trajectoryTokens.push(`T${t}:L:${chosenLand.name}`);
      }
    }

    // 1b. Crack fetchland if on board
    const fetchOnBoard = state.specialSources.find(s => s.isFetchLand && !s.tapped);
    if (fetchOnBoard) {
      state.specialSources = state.specialSources.filter(s => s.id !== fetchOnBoard.id);
      const prevHistLen = state.history.length;
      resolveFetchFromLibrary(state, commanderColors, Boolean(fetchOnBoard.fetchEntersTapped), fetchOnBoard.name);
      const msg = state.history[prevHistLen] || `Crack ${fetchOnBoard.name}`;
      actions.push({
        type: 'CRACK_FETCH',
        cardName: fetchOnBoard.name,
        card: rawByName.get(fetchOnBoard.name),
        headline: msg.replace(/^Turn \d+: /, ''),
        manaPayment: 'Sacrifice Fetchland',
        causalWhy: 'Fixes missing color pip from library',
        outcomeBadge: 'Color Fixed',
      });
      trajectoryTokens.push(`T${t}:F:${fetchOnBoard.name}`);
    }

    // Helper to cast a spell from hand
    const tryCastSpell = (spell: CompiledCard): boolean => {
      const legCtx = getLegendaryContext(state, commanderColors);
      const opts = findTappingOptions(
        spell.parsedManaCost,
        state.basics,
        state.specialSources,
        commanderColors,
        {
          hasLegendaryOnBoard: legCtx.hasLegendaryOnBoard,
          isCastingLegendary: spell.isLegendary,
          legendaryColors: legCtx.legendaryColors,
        }
      );
      if (opts.length === 0) return false;
      const opt = opts[0];
      const usesSac = opt.specialsTapped.some(
        id => state.specialSources.find(s => s.id === id)?.sacrificeToActivate
      );
      // Never sacrifice Treasures for non-Commander spells in natural-baseline, before Commander is cast,
      // or on the same turn a Treasure-creating spell was cast.
      if (usesSac && (strategy === 'natural-baseline' || !state.commanderCast || createdTreasureThisTurn)) {
        return false;
      }

      const paymentStr = describeTappingOption(opt, state.basics, state.specialSources, spell.parsedManaCost);
      const sacNames = opt.specialsTapped
        .map(id => state.specialSources.find(s => s.id === id))
        .filter((s): s is SpecialSource => Boolean(s && s.sacrificeToActivate))
        .map(s => s.name);

      applyTappingOptionToState(state, opt);
      state.hand = state.hand.filter(c => c.id !== spell.id);

      let outcomeBadge = spell.isCreature ? 'Creature Deployed' : 'Spell Resolved';
      let causalWhy = 'Develops board presence and synergy';

      if (spell.createsTreasureCount > 0) {
        createdTreasureThisTurn = true;
        addTreasureTokensToState(state, spell.createsTreasureCount, commanderColors, spell.name);
        if (spell.hasFlashback) state.graveyard = [...(state.graveyard || []), spell];
        outcomeBadge = `+${spell.createsTreasureCount} Treasure`;
        causalWhy = `Banks +${spell.createsTreasureCount} Treasure mana for a faster Turn ${t + 1} burst`;
        causalChain.push({
          stepLabel: `T${t} Ramp`,
          cardName: spell.name,
          turn: t,
          effect: `Creates ${spell.createsTreasureCount} Treasure Token`,
        });
      } else if (spell.isManaRock || spell.isManaDork) {
        state.specialSources.push({
          id: `pu_ramp_${spell.name}_${t}`,
          name: spell.name,
          cardId: spell.id,
          imageUrl: spell.imageUrl,
          produces: [...spell.produces],
          producesAnyColor: spell.producesAnyColor,
          manaProductionAmount: spell.manaProductionAmount,
          tapped: spell.entersTapped,
          hasSummoningSickness: spell.isCreature && !spell.hasHaste,
          isCreature: spell.isCreature,
          isArtifact: spell.isArtifact,
          isEnchantment: false,
          enchantments: [],
          requiresLegendary: spell.requiresLegendaryToTap,
          isLegendaryPermanent: spell.isLegendary,
          producesManaAbility: true,
          isNonGnomeCreature: spell.isCreature,
          powerValue: spell.isCreature ? 1 : 0,
        });
        outcomeBadge = `+${spell.manaProductionAmount} Mana Source`;
        causalWhy = 'Accelerates mana curve for subsequent turns';
      } else if (spell.isCreature || spell.isArtifact || spell.isEnchantment) {
        state.specialSources.push({
          id: `pu_perm_${spell.name}_${t}`,
          name: spell.name,
          cardId: spell.id,
          imageUrl: spell.imageUrl,
          produces: [],
          producesAnyColor: false,
          manaProductionAmount: 0,
          tapped: false,
          hasSummoningSickness: spell.isCreature && !spell.hasHaste,
          isCreature: spell.isCreature,
          isArtifact: spell.isArtifact,
          isEnchantment: spell.isEnchantment,
          enchantments: [],
          isLegendaryPermanent: spell.isLegendary,
          producesManaAbility: false,
          attackCreatesTreasureCount: spell.attackCreatesTreasureCount,
          isNonGnomeCreature: spell.isCreature,
          powerValue: spell.cmc <= 1 ? 1 : 2,
          counters: 0,
        });
        if (spell.synergyRole === 'artifact-ping') {
          outcomeBadge = 'Artifact/ETB Ping Engine';
          causalWhy = 'Turns every Treasure and Gnome token into direct table damage';
        } else if (spell.synergyRole === 'lifegain-sister') {
          outcomeBadge = 'Lifegain Engine';
          causalWhy = 'Triggers life gain on every creature & Gnome token ETB';
        } else if (spell.synergyRole === 'counter-engine') {
          outcomeBadge = '+1/+1 Counter Engine';
          causalWhy = 'Scales board power and synergizes with Commander combat';
        } else if (spell.isCreature) {
          outcomeBadge = 'Non-Gnome Attacker';
          causalWhy = 'Can attack on following turn to trigger Anim Pakal immediately';
        }
      }

      actions.push({
        type: 'CAST_SPELL',
        cardName: spell.name,
        card: rawByName.get(spell.name),
        headline: `Cast ${spell.name}`,
        manaPayment: paymentStr,
        causalWhy,
        outcomeBadge,
        ...(sacNames.length > 0 ? { sacrificedTokens: sacNames } : {}),
      });
      trajectoryTokens.push(`T${t}:S:${spell.name}`);
      return true;
    };

    // Helper to cast Commander
    const tryCastCommander = (): boolean => {
      if (state.commanderCast) return false;
      const legCtx = getLegendaryContext(state, commanderColors);
      const opts = findTappingOptions(
        compiledCommander.parsedManaCost,
        state.basics,
        state.specialSources,
        commanderColors,
        {
          hasLegendaryOnBoard: legCtx.hasLegendaryOnBoard,
          isCastingLegendary: true,
          legendaryColors: legCtx.legendaryColors,
        }
      );
      if (opts.length === 0) return false;
      const opt = opts[0];
      const hasSac = opt.specialsTapped.some(
        id => state.specialSources.find(s => s.id === id)?.sacrificeToActivate
      );
      if (strategy === 'natural-baseline' && hasSac) {
        return false;
      }

      const paymentStr = describeTappingOption(opt, state.basics, state.specialSources, compiledCommander.parsedManaCost);
      const sacNames = opt.specialsTapped
        .map(id => state.specialSources.find(s => s.id === id))
        .filter((s): s is SpecialSource => Boolean(s && s.sacrificeToActivate))
        .map(s => s.name);

      applyTappingOptionToState(state, opt);
      state.commanderCast = true;
      commanderSummoningSick = !compiledCommander.hasHaste;
      commanderCastTurn = t;

      actions.push({
        type: 'CAST_COMMANDER',
        cardName: commanderCard.name,
        card: commanderCard,
        headline: `Summon ${commanderCard.name}`,
        manaPayment: paymentStr,
        causalWhy:
          sacNames.length > 0
            ? `Sacrificing ${sacNames.join(', ')} bridges the mana gap to cast ${commanderCard.name} on Turn ${t}!`
            : `Natural mana base casts ${commanderCard.name} on Turn ${t}`,
        outcomeBadge: `Turn ${t} Commander`,
        ...(sacNames.length > 0 ? { sacrificedTokens: sacNames } : {}),
      });
      causalChain.push({
        stepLabel: `T${t} Commander`,
        cardName: commanderCard.name,
        turn: t,
        effect: `Lands on Turn ${t}${sacNames.length > 0 ? ' via Treasure boost' : ''}`,
      });
      trajectoryTokens.push(`T${t}:CMD`);
      return true;
    };

    // 2. Main Phase 1 Sequencing by Strategy
    if (strategy === 'turbo-commander') {
      // Cast commander if possible
      tryCastCommander();
      const isAccelSpell = (c: CompiledCard) =>
        c.createsTreasureCount > 0 ||
        c.attackCreatesTreasureCount > 0 ||
        c.isManaRock ||
        c.isManaDork ||
        c.isRampSpell ||
        c.isLandAura ||
        c.isExtraLandDropSpell;

      // Before Commander is cast, only cast mana accelerators (preferring Treasure/color-fixing first)
      // so we never burn T1/T2 mana or Treasures on non-accelerator 1-drops before landing the Commander.
      const candidateSpells = state.hand
        .filter(c => !c.isLand && (state.commanderCast || isAccelSpell(c) || t > compiledCommander.cmc))
        .sort((a, b) => {
          const aTreasure = a.createsTreasureCount > 0 ? 0 : isAccelSpell(a) ? 1 : 2;
          const bTreasure = b.createsTreasureCount > 0 ? 0 : isAccelSpell(b) ? 1 : 2;
          if (aTreasure !== bTreasure) return aTreasure - bTreasure;
          return a.cmc - b.cmc;
        });
      for (const sp of candidateSpells) {
        tryCastSpell(sp);
        tryCastCommander();
      }
      // If Commander was just cast this turn, deploy any remaining affordable curve plays
      if (state.commanderCast) {
        const followUps = state.hand.filter(c => !c.isLand).sort((a, b) => a.cmc - b.cmc);
        for (const sp of followUps) {
          tryCastSpell(sp);
        }
      }
    } else if (strategy === 'attacker-first') {
      // Turn 1: prioritize 1-drop creature over Treasure spell if available
      if (t === 1) {
        const oneDrops = state.hand
          .filter(c => !c.isLand && c.isCreature && c.cmc <= 1)
          .sort((a, b) => a.cmc - b.cmc);
        for (const od of oneDrops) {
          if (tryCastSpell(od)) break;
        }
      }
      if (t === 2) {
        // Deploy 2-drop engine first using the 2 lands directly before Treasure setup; hold Commander for Turn 3 immediate attack trigger
        const engines = state.hand
          .filter(c => !c.isLand && (c.synergyRole === 'counter-engine' || c.createsTreasureCount > 0 || c.cmc <= 2))
          .sort((a, b) => {
            const aTreas = a.createsTreasureCount > 0 ? 1 : 0;
            const bTreas = b.createsTreasureCount > 0 ? 1 : 0;
            if (aTreas !== bTreas) return aTreas - bTreas;
            const aEngine = a.synergyRole === 'counter-engine' ? 0 : 1;
            const bEngine = b.synergyRole === 'counter-engine' ? 0 : 1;
            if (aEngine !== bEngine) return aEngine - bEngine;
            return b.cmc - a.cmc;
          });
        for (const eng of engines) {
          tryCastSpell(eng);
        }
      }
      if (t >= 3) {
        tryCastCommander();
        const rest = state.hand.filter(c => !c.isLand).sort((a, b) => a.cmc - b.cmc);
        for (const sp of rest) {
          tryCastSpell(sp);
          tryCastCommander();
        }
      }
    } else if (strategy === 'artifact-payoff') {
      // Prioritize artifact-ping / lifegain / counter payoffs before Treasure/Gnome generation, plus Flashback
      const ordered = state.hand
        .filter(c => !c.isLand)
        .sort((a, b) => {
          const score = (c: CompiledCard) =>
            c.synergyRole === 'artifact-ping'
              ? 0
              : c.synergyRole === 'lifegain-sister'
                ? 1
                : c.createsTreasureCount > 0
                  ? 2
                  : 3;
          if (score(a) !== score(b)) return score(a) - score(b);
          return a.cmc - b.cmc;
        });
      for (const sp of ordered) {
        if (sp.synergyRole === 'artifact-ping' || sp.synergyRole === 'lifegain-sister' || t === 1) {
          tryCastSpell(sp);
        }
      }
      tryCastCommander();
      // Flashback Strike It Rich if in graveyard and mana available
      for (const fb of [...(state.graveyard || [])]) {
        if (fb.hasFlashback && fb.flashbackCost) {
          const fbOpts = findTappingOptions(fb.flashbackCost, state.basics, state.specialSources, commanderColors);
          if (fbOpts.length > 0) {
            const opt = fbOpts[0];
            const paymentStr = describeTappingOption(opt, state.basics, state.specialSources, fb.flashbackCost);
            applyTappingOptionToState(state, opt);
            state.graveyard = (state.graveyard || []).filter(c => c.id !== fb.id);
            if (fb.createsTreasureCount > 0) {
              addTreasureTokensToState(state, fb.createsTreasureCount, commanderColors, `${fb.name}_fb`);
            }
            actions.push({
              type: 'FLASHBACK',
              cardName: fb.name,
              card: rawByName.get(fb.name),
              headline: `Flashback ${fb.name}`,
              manaPayment: paymentStr,
              causalWhy: 'Re-casts from graveyard for an extra Treasure & artifact ETB trigger',
              outcomeBadge: '+1 Treasure (Flashback)',
            });
            trajectoryTokens.push(`T${t}:FB:${fb.name}`);
          }
        }
      }
      for (const sp of state.hand.filter(c => !c.isLand)) {
        tryCastSpell(sp);
        tryCastCommander();
      }
    } else {
      // natural-baseline: do NOT cast treasure accel on T1, cast Commander naturally when lands allow
      tryCastCommander();
      const nonAccel = state.hand
        .filter(c => !c.isLand && c.createsTreasureCount === 0)
        .sort((a, b) => a.cmc - b.cmc);
      for (const sp of nonAccel) {
        tryCastSpell(sp);
        tryCastCommander();
      }
    }

    // 3. Combat Phase Simulation
    const readyAttackers = state.specialSources.filter(
      s => s.isCreature && !s.hasSummoningSickness && !s.tapped && s.isNonGnomeCreature
    );
    const commanderCanAttack = state.commanderCast && !commanderSummoningSick;

    if (readyAttackers.length > 0 || commanderCanAttack) {
      // Ragavan / attack-treasure triggers
      readyAttackers.forEach(att => {
        if ((att.attackCreatesTreasureCount || 0) > 0) {
          const cnt = att.attackCreatesTreasureCount || 1;
          addTreasureTokensToState(state, cnt, commanderColors, att.name);
          actions.push({
            type: 'COMBAT_TRIGGER',
            cardName: att.name,
            card: rawByName.get(att.name),
            headline: `Combat: ${att.name} attacks -> +${cnt} Treasure`,
            manaPayment: 'Combat Step',
            causalWhy: 'Combat damage generates Treasure mana for Main 2 or next turn',
            outcomeBadge: `+${cnt} Treasure`,
          });
        }
      });

      // Anim Pakal trigger: whenever you attack with one or more non-Gnome creatures, put a +1/+1 counter on Anim Pakal and create X 1/1 Gnome tokens!
      if (state.commanderCast && isAnimPakal && (readyAttackers.length > 0 || commanderCanAttack)) {
        state.commanderCounters = (state.commanderCounters || 0) + 1;
        const gnomesCreated = state.commanderCounters;
        state.gnomeTokens = (state.gnomeTokens || 0) + gnomesCreated;
        actions.push({
          type: 'COMBAT_TRIGGER',
          cardName: commanderCard.name,
          card: commanderCard,
          headline: `Combat Trigger: Anim Pakal (+1/+1 counter -> ${gnomesCreated}x 1/1 Gnome${gnomesCreated > 1 ? 's' : ''})`,
          manaPayment: 'Non-Gnome Attack Trigger',
          causalWhy: `Attacking with non-Gnome creature(s) scales Anim Pakal to ${1 + state.commanderCounters}/${2 + state.commanderCounters} and creates ${gnomesCreated} tapped & attacking Gnome token(s)`,
          outcomeBadge: `+${gnomesCreated} Gnome Token${gnomesCreated > 1 ? 's' : ''}`,
        });
        causalChain.push({
          stepLabel: `T${t} Combat`,
          cardName: commanderCard.name,
          turn: t,
          effect: `+1/+1 counter & ${gnomesCreated} Gnome token(s)`,
        });
        trajectoryTokens.push(`T${t}:AP:${gnomesCreated}`);
      }
    }

    if (t === 3) {
      powerTurn3 = getBoardPower(state, compiledCommander);
      gnomesTurn3 = state.gnomeTokens || 0;
    }

    const totalBoardLands = countLandsOnBoard(state);
    const treasuresOnBoard = state.specialSources.filter(s => s.sacrificeToActivate).length;
    const manaSummary = `${totalBoardLands} Land${totalBoardLands !== 1 ? 's' : ''}${treasuresOnBoard > 0 ? ` + ${treasuresOnBoard} Treasure` : ''}`;
    const turnTakeaway =
      actions.length > 0
        ? actions.map(a => a.headline).join(' -> ')
        : 'Develop mana / hold interaction';

    turns.push({
      turn: t,
      drawnCard,
      actions,
      manaSummary,
      turnTakeaway,
      stateAtEndOfTurn: cloneState(state),
    });
  }

  if (maxTurns < 3) {
    powerTurn3 = getBoardPower(state, compiledCommander);
    gnomesTurn3 = state.gnomeTokens || 0;
  }

  const synergyScore =
    (commanderCastTurn ? (5 - Math.min(commanderCastTurn, 4)) * 25 : 0) +
    powerTurn3 * 4 +
    (state.treasuresCreatedTotal || 0) * 8 +
    gnomesTurn3 * 10;

  return {
    turns,
    finalState: state,
    commanderCastTurn,
    powerTurn3,
    gnomesTurn3,
    treasuresCreated: state.treasuresCreatedTotal || 0,
    causalChain,
    synergyScore,
    trajectoryKey: trajectoryTokens.join('|'),
  };
}

export function generateParallelUniverses(
  startingHand: ProcessedDeckCard[],
  deck: ProcessedDeckCard[],
  commanderCard: ProcessedDeckCard,
  options?: { allowLibraryDraws?: boolean; maxTurns?: number }
): ParallelUniversesAnalysis {
  const allowLibraryDraws = options?.allowLibraryDraws ?? false;
  const maxTurns = options?.maxTurns ?? 4;
  const commanderColors = commanderCard.colorIdentity || [];
  const compiledCommander = compileCard(commanderCard, commanderColors);

  const alphaRes = simulateUniverseLine('turbo-commander', startingHand, deck, commanderCard, maxTurns, allowLibraryDraws);
  const betaRes = simulateUniverseLine('attacker-first', startingHand, deck, commanderCard, maxTurns, allowLibraryDraws);
  const gammaRes = simulateUniverseLine('artifact-payoff', startingHand, deck, commanderCard, maxTurns, allowLibraryDraws);
  const deltaRes = simulateUniverseLine('natural-baseline', startingHand, deck, commanderCard, maxTurns, allowLibraryDraws);

  const universes: ParallelUniverse[] = [];
  const seenKeys = new Set<string>();

  const pushIfUnique = (u: ParallelUniverse, key: string) => {
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    universes.push(u);
  };

  pushIfUnique(
    {
      id: 'alpha',
      title: 'Turbo Commander (Fastest Summon)',
      subtitle: alphaRes.commanderCastTurn
        ? `Casts ${commanderCard.name} on Turn ${alphaRes.commanderCastTurn}`
        : 'Cannot cast Commander within window',
      badge: alphaRes.commanderCastTurn ? `T${alphaRes.commanderCastTurn} Commander` : 'Mana Short',
      accentColor: 'amber',
      commanderCastTurn: alphaRes.commanderCastTurn,
      totalBoardPowerTurn3: alphaRes.powerTurn3,
      treasuresCreated: alphaRes.treasuresCreated,
      gnomeTokensTurn3: alphaRes.gnomesTurn3,
      synergyScore: alphaRes.synergyScore,
      whyThisUniverseMatters:
        alphaRes.treasuresCreated > 0
          ? `Prioritizes early Treasure acceleration to summon ${commanderCard.name} ahead of curve.`
          : `Maximizes mana efficiency to land ${commanderCard.name} as early as possible.`,
      causalChain: alphaRes.causalChain,
      turns: alphaRes.turns,
      finalState: alphaRes.finalState,
    },
    alphaRes.trajectoryKey
  );

  pushIfUnique(
    {
      id: 'beta',
      title: 'Attacker-First Synergy Curve-Out',
      subtitle: betaRes.commanderCastTurn
        ? `Turn 1 attacker -> T${betaRes.commanderCastTurn} ${commanderCard.name} + immediate combat trigger`
        : 'Develops early board presence first',
      badge: betaRes.gnomesTurn3 > 0 ? `${betaRes.gnomesTurn3} Gnomes T3` : 'Board Tempo',
      accentColor: 'emerald',
      commanderCastTurn: betaRes.commanderCastTurn,
      totalBoardPowerTurn3: betaRes.powerTurn3,
      treasuresCreated: betaRes.treasuresCreated,
      gnomeTokensTurn3: betaRes.gnomesTurn3,
      synergyScore: betaRes.synergyScore,
      whyThisUniverseMatters:
        'Deploys a Turn 1 non-Gnome attacker so it is free of summoning sickness the moment your Commander lands.',
      causalChain: betaRes.causalChain,
      turns: betaRes.turns,
      finalState: betaRes.finalState,
    },
    betaRes.trajectoryKey
  );

  pushIfUnique(
    {
      id: 'gamma',
      title: 'Color-Fix / Artifact Payoff & Flashback Line',
      subtitle: 'Sequences ETB payoffs & Flashback value before token generation',
      badge: gammaRes.treasuresCreated > 0 ? `${gammaRes.treasuresCreated} Treasures` : 'Payoff Line',
      accentColor: 'sky',
      commanderCastTurn: gammaRes.commanderCastTurn,
      totalBoardPowerTurn3: gammaRes.powerTurn3,
      treasuresCreated: gammaRes.treasuresCreated,
      gnomeTokensTurn3: gammaRes.gnomesTurn3,
      synergyScore: gammaRes.synergyScore,
      whyThisUniverseMatters:
        'Maximizes artifact-ETB triggers, color-fixing, and graveyard Flashback value across Turns 1-3.',
      causalChain: gammaRes.causalChain,
      turns: gammaRes.turns,
      finalState: gammaRes.finalState,
    },
    gammaRes.trajectoryKey
  );

  // Topdeck contingency diagnostic when opening 7 cannot cast Commander by Turn 4
  const compiledHand = startingHand.map(c => compileCard(c, commanderColors));
  const handLands = compiledHand.filter(c => c.isLand);
  const cmdCmc = compiledCommander.cmc;
  let topdeckNote: string | null = null;

  if (alphaRes.commanderCastTurn === null) {
    const remainingLibrarySize = Math.max(1, deck.reduce((s, c) => s + (c.quantity || 1), 0) - 1 - startingHand.length);
    const missingLandCount = Math.max(0, cmdCmc - handLands.length);
    const libraryLandCount = deck
      .filter(c => c.name !== commanderCard.name && compileCard(c, commanderColors).isLand)
      .reduce((s, c) => s + (c.quantity || 1), 0) - handLands.length;

    if (missingLandCount > 0 && libraryLandCount > 0) {
      const oddsT3 = hypergeometricAtLeastOne(remainingLibrarySize, libraryLandCount, 3);
      topdeckNote = `Opening 7 has ${handLands.length} land(s) for a ${cmdCmc}-CMC Commander. Exact odds of drawing a land by Turn 3 (3 draw steps): ${(oddsT3 * 100).toFixed(1)}%.`;
    } else {
      const missingColors = commanderColors.filter(
        col => !handLands.some(l => l.producesAnyColor || l.produces.includes(col))
      );
      if (missingColors.length > 0) {
        const fixingInLib = deck
          .filter(c => {
            if (c.name === commanderCard.name) return false;
            const comp = compileCard(c, commanderColors);
            return comp.isLand && (comp.producesAnyColor || missingColors.some(mc => comp.produces.includes(mc)));
          })
          .reduce((s, c) => s + (c.quantity || 1), 0);
        const oddsFix = hypergeometricAtLeastOne(remainingLibrarySize, Math.max(0, fixingInLib), 3);
        topdeckNote = `Missing {${missingColors.join('/')}} color source in opening 7. Odds of drawing fixing by Turn 3: ${(oddsFix * 100).toFixed(1)}%.`;
      }
    }
  }

  pushIfUnique(
    {
      id: 'delta',
      title: topdeckNote ? 'Topdeck Contingency Diagnostic' : 'Natural Baseline (No Early Accelerator)',
      subtitle: topdeckNote
        ? 'Requires library draw to hit Commander mana/colors'
        : deltaRes.commanderCastTurn
          ? `Natural curve casts ${commanderCard.name} on Turn ${deltaRes.commanderCastTurn}`
          : 'Cannot cast Commander naturally by Turn 4',
      badge: deltaRes.commanderCastTurn ? `T${deltaRes.commanderCastTurn} Natural` : 'Baseline',
      accentColor: topdeckNote ? 'rose' : 'purple',
      commanderCastTurn: deltaRes.commanderCastTurn,
      totalBoardPowerTurn3: deltaRes.powerTurn3,
      treasuresCreated: deltaRes.treasuresCreated,
      gnomeTokensTurn3: deltaRes.gnomesTurn3,
      synergyScore: deltaRes.synergyScore,
      whyThisUniverseMatters:
        topdeckNote ||
        `Shows the baseline turn-by-turn curve without spending early Treasure acceleration.`,
      causalChain: deltaRes.causalChain,
      turns: deltaRes.turns,
      finalState: deltaRes.finalState,
    },
    deltaRes.trajectoryKey + (topdeckNote ? ':diag' : ':base')
  );

  const castTurns = universes
    .map(u => u.commanderCastTurn)
    .filter((t): t is number => t !== null);
  const fastestCommanderTurn = castTurns.length > 0 ? Math.min(...castTurns) : null;
  const naturalBaselineTurn = deltaRes.commanderCastTurn;

  const manaCeilingTurn2 = Math.max(
    ...universes.map(u => (u.turns[1] ? getTotalUntappedManaCount(u.turns[1].stateAtEndOfTurn) + u.turns[1].actions.length : 0)),
    handLands.length >= 2 ? 2 : handLands.length
  );
  const manaCeilingTurn3 = Math.max(
    ...universes.map(u => (u.turns[2] ? getTotalUntappedManaCount(u.turns[2].stateAtEndOfTurn) + u.turns[2].actions.length : 0)),
    handLands.length >= 3 ? 3 : handLands.length
  );

  let handGrade: 'S' | 'A' | 'B' | 'C' | 'Mulligan' = 'C';
  let handVerdict = 'Playable opening hand with moderate curve.';
  if (fastestCommanderTurn !== null && fastestCommanderTurn <= 2) {
    handGrade = 'S';
    handVerdict = `Explosive Turn ${fastestCommanderTurn} ${commanderCard.name} start with ${universes.length} distinct strategic lines.`;
  } else if (fastestCommanderTurn === 3 && Math.max(...universes.map(u => u.totalBoardPowerTurn3)) >= 4) {
    handGrade = 'A';
    handVerdict = `Strong Turn 3 ${commanderCard.name} curve-out with immediate board synergy.`;
  } else if (fastestCommanderTurn !== null && fastestCommanderTurn <= 4) {
    handGrade = 'B';
    handVerdict = `Solid keepable hand: casts ${commanderCard.name} by Turn ${fastestCommanderTurn}.`;
  } else if (fastestCommanderTurn === null) {
    handGrade = 'Mulligan';
    handVerdict = topdeckNote || `Cannot cast ${commanderCard.name} within ${maxTurns} turns from opening 7.`;
  }

  return {
    universes: universes.slice(0, 4),
    fastestCommanderTurn,
    naturalBaselineTurn,
    manaCeilingTurn2,
    manaCeilingTurn3,
    handGrade,
    handVerdict,
    topdeckNote,
  };
}
