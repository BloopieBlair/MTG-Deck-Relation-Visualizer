import type { ProcessedDeckCard, ParsedManaCost, ManaSymbol } from '../types';

export interface CompiledCard {
  id: string;
  name: string;
  imageUrl?: string;
  parsedManaCost: ParsedManaCost;
  cmc: number;
  typeLine: string;
  oracleText: string;
  
  isLand: boolean;
  isCreature: boolean;
  isArtifact: boolean;
  isEnchantment: boolean;
  isSpell: boolean; // Instant / Sorcery
  
  entersTapped: boolean;
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
}

export interface TappingOption {
  basicsTapped: Record<string, number>;
  specialsTapped: string[];
}

// --- Card Compiler ---

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

export function compileCard(card: ProcessedDeckCard, commanderColors: string[]): CompiledCard {
  const typeLineLower = (card.typeLine || '').toLowerCase();
  const textLower = (card.text || '').toLowerCase();
  const nameLower = card.name.toLowerCase();
  
  const isLand = typeLineLower.includes('land');
  const isCreature = typeLineLower.includes('creature');
  const isArtifact = typeLineLower.includes('artifact');
  const isEnchantment = typeLineLower.includes('enchantment');
  const isSpell = typeLineLower.includes('instant') || typeLineLower.includes('sorcery');
  
  const entersTapped = textLower.includes('enters the battlefield tapped') || textLower.includes('enters tapped');
  
  // Parse colors produced
  const produces = card.producesMana ? [...card.producesMana] : [];
  
  // Simple check for command tower / any color
  const producesAnyColor = textLower.includes('any color') || textLower.includes('mana of any color') || nameLower === 'command tower' || nameLower === 'exotic orchard';
  
  let manaProductionAmount = 1;
  if (textLower.includes('add {c}{c}{c}') || textLower.includes('add {g}{g}{g}') || textLower.includes('add 3')) {
    manaProductionAmount = 3;
  } else if (textLower.includes('add {c}{c}') || textLower.includes('add {g}{g}') || textLower.includes('add 2')) {
    manaProductionAmount = 2;
  }

  // Detect Ramp Spells
  const isRampSpell = isSpell && 
    textLower.includes('search') && 
    textLower.includes('library') && 
    textLower.includes('land') && 
    (textLower.includes('battlefield') || textLower.includes('put'));
    
  let rampLandEntersTapped = textLower.includes('tapped');
  // Specific exceptions (Nature's Lore / Three Visits put them untapped)
  if (nameLower.includes("nature's lore") || nameLower.includes("three visits")) {
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
  const isLandAura = isEnchantment && textLower.includes('enchant land') && (textLower.includes('tapped for additional') || textLower.includes('produces') || textLower.includes('tapped for mana'));

  // Detect Mana Rocks/Dorks
  const hasManaProduction = produces.length > 0 || producesAnyColor || textLower.includes('add {');
  const isManaRock = isArtifact && hasManaProduction && !isLand;
  const isManaDork = isCreature && hasManaProduction;
  
  const isExtraLandDropSpell = textLower.includes('additional land') || nameLower === 'explore' || nameLower === 'growth spiral';

  return {
    id: card.id,
    name: card.name,
    imageUrl: card.imageUrl,
    parsedManaCost: card.parsedManaCost || {},
    cmc: getCMC(card.parsedManaCost),
    typeLine: card.typeLine || '',
    oracleText: card.text || '',
    isLand,
    isCreature,
    isArtifact,
    isEnchantment,
    isSpell,
    entersTapped,
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
    keywords: card.keywords || []
  };
}

// --- Dumb Autotapper ---

function getSpecialSourceMana(s: SpecialSource, commanderColors: string[]): { colors: string[][]; amount: number } {
  let baseColors = s.producesAnyColor ? (commanderColors.length > 0 ? commanderColors : ['W','U','B','R','G']) : [...s.produces];
  if (baseColors.length === 0) {
    baseColors = ['C']; // default colorless
  }

  // If there are enchantments like Wild Growth
  let enchantBonus: string[] = [];
  s.enchantments.forEach(e => {
    let eColors = e.producesAnyColor ? (commanderColors.length > 0 ? commanderColors : ['W','U','B','R','G']) : [...e.produces];
    if (eColors.length === 0) eColors = ['G']; // default wild growth
    enchantBonus.push(...eColors);
  });

  return {
    colors: [baseColors, ...s.enchantments.map(e => e.producesAnyColor ? (commanderColors.length > 0 ? commanderColors : ['W','U','B','R','G']) : [...e.produces])],
    amount: s.manaProductionAmount + s.enchantments.length
  };
}

export function findTappingOptions(
  cost: ParsedManaCost,
  basics: Record<string, { total: number; tapped: number }>,
  specialSources: SpecialSource[],
  commanderColors: string[]
): TappingOption[] {
  const pips: string[] = [];
  const costKeys = ['W', 'U', 'B', 'R', 'G', 'C'];
  costKeys.forEach(k => {
    const amt = cost[k] || 0;
    for (let i = 0; i < amt; i++) pips.push(k);
  });
  
  const genericCost = cost.Generic || 0;
  
  const basicPool: { type: string; id: string }[] = [];
  Object.entries(basics).forEach(([type, count]) => {
    const untapped = count.total - count.tapped;
    let col = 'C';
    if (type.toLowerCase().includes('forest')) col = 'G';
    else if (type.toLowerCase().includes('island')) col = 'U';
    else if (type.toLowerCase().includes('swamp')) col = 'B';
    else if (type.toLowerCase().includes('mountain')) col = 'R';
    else if (type.toLowerCase().includes('plains')) col = 'W';
    
    for (let i = 0; i < untapped; i++) {
      basicPool.push({ type, id: `${type}_${i}` });
    }
  });

  const specialPool = specialSources.filter(s => !s.tapped && (!s.isCreature || !s.hasSummoningSickness));
  
  const results: TappingOption[] = [];
  const visitedOptionKeys = new Set<string>();

  function solve(
    pipIdx: number,
    tappedBasics: Record<string, number>,
    tappedSpecials: string[],
    usedBasicIndices: Set<number>,
    usedSpecialIndices: Set<number>
  ) {
    if (pipIdx === pips.length) {
      payGeneric(genericCost, tappedBasics, tappedSpecials, usedBasicIndices, usedSpecialIndices);
      return;
    }
    
    const requiredPip = pips[pipIdx];
    
    for (let i = 0; i < basicPool.length; i++) {
      if (usedBasicIndices.has(i)) continue;
      
      const basic = basicPool[i];
      let basicColor = 'C';
      if (basic.type.toLowerCase().includes('forest')) basicColor = 'G';
      else if (basic.type.toLowerCase().includes('island')) basicColor = 'U';
      else if (basic.type.toLowerCase().includes('swamp')) basicColor = 'B';
      else if (basic.type.toLowerCase().includes('mountain')) basicColor = 'R';
      else if (basic.type.toLowerCase().includes('plains')) basicColor = 'W';
      
      if (basicColor === requiredPip) {
        usedBasicIndices.add(i);
        tappedBasics[basic.type] = (tappedBasics[basic.type] || 0) + 1;
        
        solve(pipIdx + 1, tappedBasics, tappedSpecials, usedBasicIndices, usedSpecialIndices);
        
        tappedBasics[basic.type]--;
        if (tappedBasics[basic.type] === 0) delete tappedBasics[basic.type];
        usedBasicIndices.delete(i);
      }
    }
    
    for (let i = 0; i < specialPool.length; i++) {
      if (usedSpecialIndices.has(i)) continue;
      
      const spec = specialPool[i];
      const specMana = getSpecialSourceMana(spec, commanderColors);
      
      const canProduceColor = specMana.colors.some(colList => colList.includes(requiredPip));
      if (canProduceColor) {
        usedSpecialIndices.add(i);
        tappedSpecials.push(spec.id);
        
        solve(pipIdx + 1, tappedBasics, tappedSpecials, usedBasicIndices, usedSpecialIndices);
        
        tappedSpecials.pop();
        usedSpecialIndices.delete(i);
      }
    }
  }

  function payGeneric(
    remainingGeneric: number,
    tappedBasics: Record<string, number>,
    tappedSpecials: string[],
    usedBasicIndices: Set<number>,
    usedSpecialIndices: Set<number>
  ) {
    if (remainingGeneric <= 0) {
      const serialized = serializeOption(tappedBasics, tappedSpecials);
      if (!visitedOptionKeys.has(serialized)) {
        visitedOptionKeys.add(serialized);
        results.push({
          basicsTapped: { ...tappedBasics },
          specialsTapped: [...tappedSpecials]
        });
      }
      return;
    }
    
    for (let i = 0; i < basicPool.length; i++) {
      if (usedBasicIndices.has(i)) continue;
      
      const basic = basicPool[i];
      usedBasicIndices.add(i);
      tappedBasics[basic.type] = (tappedBasics[basic.type] || 0) + 1;
      
      payGeneric(remainingGeneric - 1, tappedBasics, tappedSpecials, usedBasicIndices, usedSpecialIndices);
      
      tappedBasics[basic.type]--;
      if (tappedBasics[basic.type] === 0) delete tappedBasics[basic.type];
      usedBasicIndices.delete(i);
    }
    
    for (let i = 0; i < specialPool.length; i++) {
      if (usedSpecialIndices.has(i)) continue;
      
      const spec = specialPool[i];
      const specMana = getSpecialSourceMana(spec, commanderColors);
      const totalAmount = specMana.amount;
      
      usedSpecialIndices.add(i);
      tappedSpecials.push(spec.id);
      
      payGeneric(remainingGeneric - totalAmount, tappedBasics, tappedSpecials, usedBasicIndices, usedSpecialIndices);
      
      tappedSpecials.pop();
      usedSpecialIndices.delete(i);
    }
  }

  function serializeOption(basics: Record<string, number>, specials: string[]): string {
    const basicStr = Object.entries(basics).sort().map(e => `${e[0]}:${e[1]}`).join(',');
    const specialStr = [...specials].sort().join(',');
    return `${basicStr}|${specialStr}`;
  }

  solve(0, {}, [], new Set(), new Set());
  return results;
}

// --- State Fingerprint Generator ---

export function getFingerprint(state: SimState): string {
  const handStr = state.hand.map(c => c.name).sort().join(',');
  const basicStr = Object.entries(state.basics)
    .sort()
    .map(([k, v]) => `${k}:${v.total - v.tapped}/${v.total}`)
    .join(',');
  const specialStr = state.specialSources
    .map(s => `${s.name}:${s.tapped ? 'T' : 'U'}:${s.hasSummoningSickness ? 'S' : 'R'}:${s.enchantments.map(e => e.name).sort().join('+')}`)
    .sort()
    .join(',');
  const hasLandDrop = state.landsPlayed < (1 + state.additionalLandDropsAllowed);
  return `T:${state.turn} | H:[${handStr}] | B:[${basicStr}] | S:[${specialStr}] | LD:${hasLandDrop} | C:${state.commanderCast}`;
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
    enchantments: s.enchantments.map(e => ({ ...e, produces: [...e.produces] }))
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
    history: [...state.history]
  };
}

export function getNextMoves(state: SimState, commander: CompiledCard, commanderColors: string[]): SimState[] {
  const branches: SimState[] = [];
  
  if (state.commanderCast) return branches;

  // 1. Can we cast the Commander?
  const commanderTapping = findTappingOptions(commander.parsedManaCost, state.basics, state.specialSources, commanderColors);
  if (commanderTapping.length > 0) {
    const opt = commanderTapping[0];
    const newState = cloneState(state);
    
    Object.entries(opt.basicsTapped).forEach(([type, count]) => {
      newState.basics[type].tapped += count;
    });
    opt.specialsTapped.forEach(id => {
      const s = newState.specialSources.find(x => x.id === id);
      if (s) s.tapped = true;
    });
    
    newState.commanderCast = true;
    newState.history.push(`Turn ${state.turn}: Cast Commander ${commander.name}!`);
    return [newState]; // Direct cast is always optimal
  }

  // 2. Play Land from Hand
  const canPlayLand = state.landsPlayed < (1 + state.additionalLandDropsAllowed);
  if (canPlayLand) {
    const landsInHand = state.hand.filter(c => c.isLand);
    const seenLands = new Set<string>();
    
    landsInHand.forEach(land => {
      if (seenLands.has(land.name)) return;
      seenLands.add(land.name);
      
      const newState = cloneState(state);
      newState.hand = newState.hand.filter(c => c.name !== land.name || c.id !== land.id);
      newState.landsPlayed++;
      
      const nameLower = land.name.toLowerCase();
      const typeLineLower = (land.typeLine || '').toLowerCase();
      const isBasic = (typeLineLower.includes('basic') || land.keywords.includes('basic')) &&
        (nameLower.includes('forest') || nameLower.includes('island') || nameLower.includes('swamp') || nameLower.includes('mountain') || nameLower.includes('plains') ||
         typeLineLower.includes('forest') || typeLineLower.includes('island') || typeLineLower.includes('swamp') || typeLineLower.includes('mountain') || typeLineLower.includes('plains'));
      
      if (isBasic) {
        let type = 'Forest';
        if (nameLower.includes('island') || typeLineLower.includes('island')) type = 'Island';
        else if (nameLower.includes('swamp') || typeLineLower.includes('swamp')) type = 'Swamp';
        else if (nameLower.includes('mountain') || typeLineLower.includes('mountain')) type = 'Mountain';
        else if (nameLower.includes('plains') || typeLineLower.includes('plains')) type = 'Plains';
        
        if (!newState.basics[type]) {
          newState.basics[type] = { total: 0, tapped: 0 };
        }
        newState.basics[type].total++;
        newState.history.push(`Turn ${state.turn}: Play basic ${type}`);
      } else {
        newState.specialSources.push({
          id: `special_${land.name}_${Math.random().toString(36).substring(2, 9)}`,
          name: land.name,
          cardId: land.id,
          imageUrl: land.imageUrl,
          produces: [...land.produces],
          producesAnyColor: land.producesAnyColor,
          manaProductionAmount: land.manaProductionAmount,
          tapped: land.entersTapped,
          hasSummoningSickness: false,
          isCreature: false,
          isArtifact: false,
          isEnchantment: false,
          enchantments: []
        });
        newState.history.push(`Turn ${state.turn}: Play ${land.name}${land.entersTapped ? ' (tapped)' : ''}`);
      }
      branches.push(newState);
    });
  }

  // 3. Cast Spells from Hand
  const castableSpells = state.hand.filter(c => !c.isLand && (c.isManaRock || c.isManaDork || c.isRampSpell || c.isLandAura || c.isExtraLandDropSpell));
  const seenSpells = new Set<string>();

  castableSpells.forEach(spell => {
    if (seenSpells.has(spell.name)) return;
    seenSpells.add(spell.name);
    
    const payOptions = findTappingOptions(spell.parsedManaCost, state.basics, state.specialSources, commanderColors);
    payOptions.forEach(opt => {
      const newState = cloneState(state);
      
      Object.entries(opt.basicsTapped).forEach(([type, count]) => {
        newState.basics[type].tapped += count;
      });
      opt.specialsTapped.forEach(id => {
        const s = newState.specialSources.find(x => x.id === id);
        if (s) s.tapped = true;
      });
      
      newState.hand = newState.hand.filter(c => c.id !== spell.id);
      
      if (spell.isManaRock) {
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
          enchantments: []
        });
        newState.history.push(`Turn ${state.turn}: Cast ${spell.name}`);
      } 
      else if (spell.isManaDork) {
        newState.specialSources.push({
          id: `dork_${spell.name}_${Math.random().toString(36).substring(2, 9)}`,
          name: spell.name,
          cardId: spell.id,
          imageUrl: spell.imageUrl,
          produces: [...spell.produces],
          producesAnyColor: spell.producesAnyColor,
          manaProductionAmount: spell.manaProductionAmount,
          tapped: false,
          hasSummoningSickness: true,
          isCreature: true,
          isArtifact: false,
          isEnchantment: false,
          enchantments: []
        });
        newState.history.push(`Turn ${state.turn}: Cast ${spell.name} (summoning sickness)`);
      }
      else if (spell.isLandAura) {
        let enchanted = false;
        const basicTypes = Object.keys(newState.basics);
        for (const type of basicTypes) {
          const untapped = newState.basics[type].total - newState.basics[type].tapped;
          if (untapped > 0) {
            newState.basics[type].total--;
            
            let color = 'C';
            if (type.toLowerCase().includes('forest')) color = 'G';
            else if (type.toLowerCase().includes('island')) color = 'U';
            else if (type.toLowerCase().includes('swamp')) color = 'B';
            else if (type.toLowerCase().includes('mountain')) color = 'R';
            else if (type.toLowerCase().includes('plains')) color = 'W';

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
              enchantments: [{
                name: spell.name,
                produces: spell.produces.length > 0 ? spell.produces : ['G'],
                producesAnyColor: spell.producesAnyColor
              }]
            });
            
            enchanted = true;
            newState.history.push(`Turn ${state.turn}: Cast ${spell.name} on ${type}`);
            break;
          }
        }
        
        if (!enchanted && newState.specialSources.length > 0) {
          const targetLand = newState.specialSources.find(s => !s.tapped && !s.isCreature && !s.isArtifact && !s.isEnchantment);
          if (targetLand) {
            targetLand.enchantments.push({
              name: spell.name,
              produces: spell.produces.length > 0 ? spell.produces : ['G'],
              producesAnyColor: spell.producesAnyColor
            });
            newState.history.push(`Turn ${state.turn}: Cast ${spell.name} on ${targetLand.name}`);
            enchanted = true;
          }
        }
        
        if (!enchanted) return;
      }
      else if (spell.isRampSpell) {
        let landsFetched = 0;
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
            foundIdx = libraryBasics.findIndex(x => {
              const nameL = x.name.toLowerCase();
              const typeL = (x.typeLine || '').toLowerCase();
              return nameL.includes('forest') || nameL.includes('island') || nameL.includes('swamp') || nameL.includes('mountain') || nameL.includes('plains') ||
                     typeL.includes('forest') || typeL.includes('island') || typeL.includes('swamp') || typeL.includes('mountain') || typeL.includes('plains') || x.produces.length > 0;
            });
          }
          
          if (foundIdx !== -1) {
            const landToFetch = libraryBasics[foundIdx];
            newState.library = newState.library.filter(x => x.id !== landToFetch.id);
            libraryBasics.splice(foundIdx, 1);
            
            const nameL = landToFetch.name.toLowerCase();
            const typeL = (landToFetch.typeLine || '').toLowerCase();
            const isBasic = (typeL.includes('basic') || landToFetch.keywords.includes('basic'));
            
            if (isBasic) {
              let type = 'Forest';
              if (nameL.includes('island') || typeL.includes('island')) type = 'Island';
              else if (nameL.includes('swamp') || typeL.includes('swamp')) type = 'Swamp';
              else if (nameL.includes('mountain') || typeL.includes('mountain')) type = 'Mountain';
              else if (nameL.includes('plains') || typeL.includes('plains')) type = 'Plains';
              
              if (!newState.basics[type]) {
                newState.basics[type] = { total: 0, tapped: 0 };
              }
              newState.basics[type].total++;
              if (spell.rampLandEntersTapped) {
                newState.basics[type].tapped++;
              }
              landsFetched++;
              newState.history.push(`Turn ${state.turn}: Resolve ${spell.name} -> basic ${type} ${spell.rampLandEntersTapped ? 'tapped' : 'untapped'}`);
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
                enchantments: []
              });
              landsFetched++;
              newState.history.push(`Turn ${state.turn}: Resolve ${spell.name} -> ${landToFetch.name} ${(spell.rampLandEntersTapped || landToFetch.entersTapped) ? 'tapped' : 'untapped'}`);
            }
          }
        }
        
        if (spell.rampIntoHandCount > 0 && libraryBasics.length > 0) {
          const landToHand = libraryBasics[0];
          newState.library = newState.library.filter(x => x.id !== landToHand.id);
          newState.hand.push(landToHand);
          newState.history.push(`Turn ${state.turn}: Put ${landToHand.name} into hand from ${spell.name}`);
        }
      }
      else if (spell.isExtraLandDropSpell) {
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

  // Shuffle the library so that each pathfinder run explores a new random library sequence
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
    library: library,
    commanderCast: false,
    history: []
  };

  interface PathNode {
    id: string;
    state: SimState;
    parent: PathNode | null;
    actionTaken: string;
    depth: number;
  }

  let nodeCounter = 0;
  const allNodes: PathNode[] = [];

  const initialStateNode: PathNode = {
    id: `node-${nodeCounter++}`,
    state: initialState,
    parent: null,
    actionTaken: "Start Game",
    depth: 0
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
    for (const next of nextStates) {
      const actionTaken = next.history[next.history.length - 1] 
        ? next.history[next.history.length - 1].replace(/^Turn \d+: /, '') 
        : "Action";
        
      const childNode: PathNode = {
        id: `node-${nodeCounter++}`,
        state: next,
        parent: currNode,
        actionTaken,
        depth: currNode.depth + 1
      };
      
      if (allNodes.length < 800) {
        allNodes.push(childNode);
      }
      
      queue.push(childNode);
    }
  }

  if (!bestFinishedNode) return null;

  // Reconstruct path
  const path: SimState[] = [];
  const optimalNodeIds = new Set<string>();
  let trace: PathNode | null = bestFinishedNode;
  
  while (trace !== null) {
    path.unshift(trace.state);
    optimalNodeIds.add(trace.id);
    
    // Ensure optimal path nodes are always in allNodes
    if (!allNodes.some(n => n.id === trace!.id)) {
      allNodes.push(trace);
    }
    
    trace = trace.parent;
  }

  // Compile visual tree nodes: start with the optimal path nodes,
  // then layer-by-level add alternative branches down to the same depth.
  const visualNodesSet = new Set<PathNode>();
  
  // Group all nodes by parent ID for quick lookup
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

  // Always include the optimal path nodes
  allNodes.forEach(n => {
    if (optimalNodeIds.has(n.id)) {
      visualNodesSet.add(n);
    }
  });

  const maxDepth = bestFinishedNode.depth;

  // Add alternative branches down to the same depth
  for (let d = 0; d < maxDepth; d++) {
    const parentNodesAtDepth = Array.from(visualNodesSet).filter(n => n.depth === d);
    let altsAddedAtDepth = 0;

    parentNodesAtDepth.forEach(parent => {
      const children = childrenByParent.get(parent.id) || [];
      for (const child of children) {
        if (!visualNodesSet.has(child)) {
          // Limit alternative nodes width per depth to prevent horizontal clutter
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
    state: n.state
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
}

export function runMonteCarlo(
  deck: ProcessedDeckCard[],
  commanderCard: ProcessedDeckCard,
  runs: number = 300,
  maxTurnDepth: number = 7
): MonteCarloResult {
  const commanderColors = commanderCard.colorIdentity || [];
  
  const flatDeck: ProcessedDeckCard[] = [];
  deck.forEach(c => {
    if (c.id === commanderCard.id) return;
    for (let i = 0; i < c.quantity; i++) {
      flatDeck.push(c);
    }
  });

  const turnCounts: Record<number, number> = {};
  for (let i = 1; i <= maxTurnDepth; i++) {
    turnCounts[i] = 0;
  }
  turnCounts[maxTurnDepth + 1] = 0;
  
  let totalCastTurns = 0;
  let successCount = 0;

  for (let r = 0; r < runs; r++) {
    const shuffled = [...flatDeck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const openingHand = shuffled.slice(0, 7);
    const library = shuffled.slice(7);
    
    const handCompiled = openingHand.map((c, idx) => ({ ...compileCard(c, commanderColors), id: `${c.id}_hand_${idx}` }));
    const libraryCompiled = library.map((c, idx) => ({ ...compileCard(c, commanderColors), id: `${c.id}_lib_${idx}` }));
    
    const initialState: SimState = {
      turn: 1,
      hand: handCompiled,
      basics: {},
      specialSources: [],
      landsPlayed: 0,
      additionalLandDropsAllowed: 0,
      library: libraryCompiled,
      commanderCast: false,
      history: []
    };

    const visited = new Set<string>();
    const queue: SimState[] = [initialState];
    let castTurn = maxTurnDepth + 1;
    const compiledCommander = compileCard(commanderCard, commanderColors);
    
    while (queue.length > 0) {
      const curr = queue.shift()!;
      
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
  }

  const averageTurn = successCount > 0 ? totalCastTurns / successCount : maxTurnDepth + 1;
  const successRate = successCount / runs;

  return {
    averageTurn,
    distribution: turnCounts,
    totalRuns: runs,
    successRate
  };
}
