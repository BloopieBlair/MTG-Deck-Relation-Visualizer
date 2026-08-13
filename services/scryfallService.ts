
import type { CardGameData, ParsedManaCost, ManaSymbol } from '../types';

const SCRYFALL_API_BASE_URL = "https://api.scryfall.com";
const SCRYFALL_REQUEST_DELAY_MS = 150; // 150ms delay to stay safely within Scryfall's rate limits (10 requests/sec)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

interface ScryfallCardFace {
  name: string;
  keywords?: string[];
  type_line?: string;
  oracle_text?: string;
  image_uris?: ScryfallImageUris;
  mana_cost?: string; // e.g. "{U}{B}"
  colors?: string[];
}

interface ScryfallCard {
  object: string;
  name: string;
  keywords?: string[];
  type_line?: string;
  oracle_text?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  mana_cost?: string; // e.g. "{2}{W}{W}"
  produced_mana?: ManaSymbol[]; // e.g. ["W", "U", "B", "R", "G"] for "mana of any color"
  colors?: string[];
  color_identity?: string[];
}

function extractKeywordsFromTypeLine(typeLine?: string): string[] {
  if (!typeLine) return [];
  const cleanedTypeLine = typeLine.replace(/—/g, ' '); 
  const parts = cleanedTypeLine.split(/\s+/);
  const commonNonKeywords = ["basic", "snow", "world", "ongoing"]; 
  return parts.map(part => part.toLowerCase().trim()).filter(part => part.length > 0 && !commonNonKeywords.includes(part));
}

function getImageUrl(imageUris?: ScryfallImageUris): string | undefined {
    if (!imageUris) return undefined;
    return imageUris.normal || imageUris.png || imageUris.large || imageUris.small;
}

export function parseScryfallManaCost(costString?: string): ParsedManaCost {
  const parsed: ParsedManaCost = {};
  if (!costString) return parsed;

  const symbols = costString.match(/\{([^}]+)\}/g);
  if (!symbols) return parsed;

  symbols.forEach(symbolWithBraces => {
    const symbol = symbolWithBraces.substring(1, symbolWithBraces.length - 1);
    const upperSymbol = symbol.toUpperCase();

    if (!isNaN(Number(symbol))) {
      parsed.Generic = (parsed.Generic || 0) + parseInt(symbol, 10);
    } else if (['W', 'U', 'B', 'R', 'G', 'C', 'X'].includes(upperSymbol)) {
      const key = upperSymbol as keyof ParsedManaCost;
      // @ts-ignore
      parsed[key] = (parsed[key] || 0) + 1;
    } else {
      const hybridParts = upperSymbol.split('/');
      if (hybridParts.length > 1) {
        hybridParts.forEach(part => {
          if (['W', 'U', 'B', 'R', 'G', 'C', 'X', 'P', 'S'].includes(part) || !isNaN(Number(part))) {
            if (!isNaN(Number(part))) {
               parsed.Generic = (parsed.Generic || 0) + parseInt(part, 10);
            } else if (['W', 'U', 'B', 'R', 'G', 'C', 'X'].includes(part)){
                 const key = part as keyof ParsedManaCost;
                 // @ts-ignore
                 parsed[key] = (parsed[key] || 0) + 1;
            }
          }
        });
      } else {
        console.warn(`Unrecognized mana symbol: {${symbol}} in cost: ${costString}`);
      }
    }
  });
  return parsed;
}

function parseOracleTextForKeywords(oracleText?: string): string[] {
  if (!oracleText) return [];
  const foundKeywords = new Set<string>();
  const textLower = oracleText.toLowerCase();

  if (/\b(destroy target|exile target|destroy all|exile all|target creature deals damage to itself equal to its power|target player sacrifices)\b/i.test(textLower)) {
    foundKeywords.add("removal");
  }
  if (/\b(return target .* to its owner's hand)\b/i.test(textLower) && !/\byou control\b/.test(textLower)) { 
    foundKeywords.add("removal");
  }
   if (/\b(counter target spell)\b/i.test(textLower)) {
    foundKeywords.add("removal"); 
    foundKeywords.add("counter"); 
  }

  if (/\bdeals \d+ damage to target creature\b/i.test(textLower) ||
      /\bdeals \d+ damage to any target\b/i.test(textLower) ||
      /\bdeals \d+ damage to target player\b/i.test(textLower) ||
      /\bdeals \w+ damage to target creature or planeswalker\b/i.test(textLower) || 
      /\bdeals damage to target creature equal to\b/i.test(textLower) || 
      /\bfight target creature\b/i.test(textLower)) { 
    foundKeywords.add("removal");
  }

  if (/\b(draw a card|draw two cards|draw three cards|draw X cards|target player draws .* card|look at the top .* cards of your library.*put .* into your hand)\b/i.test(textLower)) {
    foundKeywords.add("card draw");
  }

  if (/\b(search your library for .* card|search your library for up to .* cards)\b/i.test(textLower)) {
    foundKeywords.add("tutor");
  }

  return Array.from(foundKeywords);
}


export const normalizeCardName = (name: string | undefined): string => {
  if (typeof name !== 'string') return '';
  return name
    .replace(/’/g, "'")
    .replace(/´/g, "'")
    .replace(/`/g, "'")
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .toLowerCase()
    .trim();
};

export async function fetchCardsBatch(
  cardNames: string[],
  onProgressUpdate?: (message: string) => void
): Promise<Record<string, CardGameData>> {
  const results: Record<string, CardGameData> = {};
  if (cardNames.length === 0) return results;

  // Scryfall's collection endpoint accepts up to 75 identifiers per request
  const BATCH_SIZE = 75;
  const chunks: string[][] = [];
  for (let i = 0; i < cardNames.length; i += BATCH_SIZE) {
    chunks.push(cardNames.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    if (onProgressUpdate) onProgressUpdate(`Fetching batch of ${chunk.length} cards...`);
    
    try {
      const response = await fetch(`${SCRYFALL_API_BASE_URL}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifiers: chunk.map(name => ({ name }))
        })
      });

      if (!response.ok) {
        throw new Error(`Scryfall batch request failed with status ${response.status}`);
      }

      const data = await response.json();
      const cardList: ScryfallCard[] = data.data || [];
      const notFound: any[] = data.not_found || [];

      cardList.forEach(card => {
        results[normalizeCardName(card.name)] = processScryfallData(card);
      });

      // For cards not found in batch, we might want to try fuzzy search individually later
      // or just log them.
      if (notFound.length > 0) {
        console.warn(`Scryfall batch: ${notFound.length} cards not found.`, notFound);
      }

    } catch (error) {
      console.error("Scryfall batch error:", error);
      if (onProgressUpdate) onProgressUpdate(`Error in batch fetch. Some cards might be missing.`);
    }

    // Still respect rate limits between batches
    await delay(SCRYFALL_REQUEST_DELAY_MS);
  }

  return results;
}

export async function fetchCardDataFromScryfall(
  cardName: string,
  onProgressUpdate?: (message: string) => void
): Promise<CardGameData | null> {
  if (!cardName.trim()) {
    return null;
  }

  await delay(SCRYFALL_REQUEST_DELAY_MS);

  const encodedCardName = encodeURIComponent(cardName);
  const url = `${SCRYFALL_API_BASE_URL}/cards/named?exact=${encodedCardName}`;
  // console.log(`[ScryfallService] Fetching (exact): ${cardName} from ${url}`); // Original log

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        // console.log(`[ScryfallService] Exact match failed for "${cardName}". Fetching (fuzzy)...`); // Original log
        const fuzzyUrl = `${SCRYFALL_API_BASE_URL}/cards/named?fuzzy=${encodedCardName}`;
        const fuzzyResponse = await fetch(fuzzyUrl);
        if (!fuzzyResponse.ok) {
            if (fuzzyResponse.status === 404) {
                const notFoundMsg = `[ScryfallService] Card not found (exact/fuzzy): ${cardName}`;
                console.log(notFoundMsg);
                if (onProgressUpdate) onProgressUpdate(notFoundMsg);
            } else {
                const errorMsg = `[ScryfallService] Error fetching (fuzzy): ${cardName}. Status: ${fuzzyResponse.status}`;
                console.error(errorMsg, await fuzzyResponse.text());
                if (onProgressUpdate) onProgressUpdate(errorMsg);
            }
            return null;
        }
        const successFuzzyMsg = `[ScryfallService] Successfully fetched (fuzzy): ${cardName}`;
        console.log(successFuzzyMsg);
        if (onProgressUpdate) onProgressUpdate(successFuzzyMsg);
        const fuzzyData: ScryfallCard = await fuzzyResponse.json();
        return processScryfallData(fuzzyData);
      } else {
        const errorExactMsg = `[ScryfallService] Error fetching (exact): ${cardName}. Status: ${response.status}`;
        console.error(errorExactMsg, await response.text());
        if (onProgressUpdate) onProgressUpdate(errorExactMsg);
        return null;
      }
    }
    const successExactMsg = `[ScryfallService] Successfully fetched (exact): ${cardName}`;
    console.log(successExactMsg);
    if (onProgressUpdate) onProgressUpdate(successExactMsg);
    const data: ScryfallCard = await response.json();
    return processScryfallData(data);

  } catch (error) {
    const networkErrorMsg = `[ScryfallService] Network/parsing error for: ${cardName}`;
    console.error(networkErrorMsg, error);
    if (onProgressUpdate) onProgressUpdate(networkErrorMsg);
    return null;
  }
}

function processScryfallData(data: ScryfallCard): CardGameData {
    let collectedKeywords = new Set<string>();
    let imageUrl: string | undefined;
    let manaCostString: string | undefined;
    let oracleText: string | undefined;
    let producesMana: ManaSymbol[] | undefined = data.produced_mana?.filter(m => ['W','U','B','R','G','C'].includes(m)) as ManaSymbol[];
    
    let colors: string[] = data.colors || [];
    let typeLine: string | undefined = data.type_line;
    let colorIdentity: string[] = data.color_identity || [];

    if (data.card_faces && data.card_faces.length > 0) {
      const texts: string[] = [];
      data.card_faces.forEach((face, index) => {
        if (face.keywords) {
          face.keywords.forEach(kw => {
            const lowerKw = kw.toLowerCase().trim();
            if (lowerKw) collectedKeywords.add(lowerKw);
          });
        }
        extractKeywordsFromTypeLine(face.type_line).forEach(kw => collectedKeywords.add(kw));
        if (face.oracle_text) {
            texts.push(face.oracle_text);
            parseOracleTextForKeywords(face.oracle_text).forEach(kw => collectedKeywords.add(kw));
        }

        if (index === 0) { // Prioritize first face for image and cost
            imageUrl = getImageUrl(face.image_uris);
            manaCostString = face.mana_cost;
        } else if (!imageUrl && face.image_uris) { // Fallback to other faces if first had no image
             imageUrl = getImageUrl(face.image_uris);
        }
      });
      oracleText = texts.join("\n\n---\n\n"); // Concatenate oracle texts from all faces
      // Fallbacks for main card data if not found on first face (e.g. for MDFCs where cost might be on main card object)
      if (!imageUrl && data.image_uris) imageUrl = getImageUrl(data.image_uris);
      if (!manaCostString) manaCostString = data.mana_cost;

      if (colors.length === 0) {
        const faceColors = new Set<string>();
        data.card_faces.forEach(face => {
          if (face.colors) {
            face.colors.forEach(c => faceColors.add(c));
          }
        });
        colors = Array.from(faceColors);
      }
    } else { // Single-faced card
      if (data.keywords && data.keywords.length > 0) {
        data.keywords.forEach(kw => {
          const lowerKw = kw.toLowerCase().trim();
          if (lowerKw) collectedKeywords.add(lowerKw);
        });
      }
      extractKeywordsFromTypeLine(data.type_line).forEach(kw => collectedKeywords.add(kw));
      if (data.oracle_text) {
        parseOracleTextForKeywords(data.oracle_text).forEach(kw => collectedKeywords.add(kw));
      }
      imageUrl = getImageUrl(data.image_uris);
      manaCostString = data.mana_cost;
      oracleText = data.oracle_text;
    }
    
    // Auto-assign 'land' keyword if type_line indicates it and not already present
    if (data.type_line && data.type_line.toLowerCase().includes("land") && !collectedKeywords.has("land")) {
        collectedKeywords.add("land");
    }
    
    if ((!producesMana || producesMana.length === 0) && data.type_line) {
        const lowerTypeLine = data.type_line.toLowerCase();
        const cardNameLower = data.name.toLowerCase();

        if (lowerTypeLine.includes("basic") && lowerTypeLine.includes("land")) {
            if (lowerTypeLine.includes("plains") || cardNameLower.startsWith("plains")) producesMana = ['W'];
            else if (lowerTypeLine.includes("island") || cardNameLower.startsWith("island")) producesMana = ['U'];
            else if (lowerTypeLine.includes("swamp") || cardNameLower.startsWith("swamp")) producesMana = ['B'];
            else if (lowerTypeLine.includes("mountain") || cardNameLower.startsWith("mountain")) producesMana = ['R'];
            else if (lowerTypeLine.includes("forest") || cardNameLower.startsWith("forest")) producesMana = ['G'];
        }
    }

    return {
      nameScryfall: data.name, // Use the name from Scryfall
      keywords: Array.from(collectedKeywords),
      text: oracleText,
      imageUrl: imageUrl,
      manaCostString: manaCostString,
      producesMana: producesMana,
      colors: colors,
      typeLine: typeLine,
      colorIdentity: colorIdentity,
    };
}
