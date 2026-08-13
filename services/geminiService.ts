import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type { RawDeckCard, ProcessedDeckCard, AiClient } from '../types';

/**
 * Helper to call Ollama's local API.
 */
async function callOllama(ai: AiClient, prompt: string, options?: { json?: boolean }): Promise<string> {
  const host = (ai.localHost || 'http://localhost:11434').replace(/\/$/, '');
  const model = ai.localModel || 'llama3';

  const body: any = {
    model: model,
    prompt: prompt,
    stream: false,
    options: {
      temperature: 0.1
    }
  };

  if (options?.json) {
    body.format = 'json';
  }

  const response = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Ollama connection error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  return data.response || '';
}

/**
 * Strips think blocks (<think>...</think>) from a model's response.
 */
export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Helper to strip reasoning tokens and parse JSON returned from a local AI.
 */
export function cleanThinkAndParseJson(text: string): any {
  let cleaned = stripThink(text);
  
  // Extract JSON blocks if present
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = cleaned.match(jsonBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON directly, trying fuzzy cleanup. Text:", cleaned);
    
    // Fuzzy search for brackets to recover from extra wrapper text
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
      } catch (innerErr) {
        console.error("Fuzzy bracket array recovery failed:", innerErr);
      }
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (innerErr) {
        console.error("Fuzzy bracket object recovery failed:", innerErr);
      }
    }

    throw e;
  }
}

/**
 * Robustly parses a decklist string into a structured array of cards.
 * Supports both local AI (Ollama) and Google Gemini API.
 */
export async function parseDecklistWithGemini(ai: AiClient, decklistText: string): Promise<RawDeckCard[]> {
  if (!ai) {
    throw new Error("AI client not initialized for decklist parsing.");
  }
  if (!decklistText.trim()) {
    return []; 
  }

  if (ai.type === 'local') {
    try {
      const prompt = `Parse this Magic: The Gathering decklist into a JSON array of objects. 
Each object must have exactly two properties: "name" (string) and "quantity" (integer).
Strip set codes and collector numbers (e.g. convert "Enduring Sliver (MH1) 6" to "Enduring Sliver").
Skip comments, section headers like "Deck" or "Commander", and sideboard indicators.

Format the output strictly as a JSON array of objects. Do not wrap in anything else except a JSON block. Example:
[{"name": "Lightning Bolt", "quantity": 4}, {"name": "Mountain", "quantity": 20}]

Decklist to parse:
${decklistText}`;

      const text = await callOllama(ai, prompt, { json: true });
      const parsedData = cleanThinkAndParseJson(text);

      if (!Array.isArray(parsedData)) {
        return [];
      }

      return parsedData.map(item => ({
        name: String(item.name || "").trim(),
        quantity: Number(item.quantity) || 1
      })).filter(item => item.name !== "");
    } catch (error) {
      console.error("Critical error in local decklist parsing:", error);
      throw error;
    }
  }

  // Gemini API fallback
  const gemini = ai.geminiClient as GoogleGenAI;
  if (!gemini) {
    throw new Error("Gemini API client not initialized.");
  }

  const model = "gemini-3-flash-preview";
  
  try {
    const response: GenerateContentResponse = await gemini.models.generateContent({
      model: model,
      contents: `Parse this Magic: The Gathering decklist into a JSON array. Extract card names and their quantities. Strip set codes and collector numbers (e.g., convert "Enduring Sliver (MH1) 6" to "Enduring Sliver"). Skip comments, section headers like "Deck" or "Commander", and sideboard indicators. Decklist: ${decklistText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'The exact name of the card.',
              },
              quantity: {
                type: Type.INTEGER,
                description: 'The number of copies of the card.',
              },
            },
            required: ["name", "quantity"],
          },
        },
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini.");
    }

    const parsedData = JSON.parse(text);

    if (!Array.isArray(parsedData)) {
      return [];
    }

    return parsedData.map(item => ({
      name: String(item.name || "").trim(),
      quantity: Number(item.quantity) || 1
    })).filter(item => item.name !== "");

  } catch (error) {
    console.error("Critical error in Gemini decklist parsing:", error);
    throw error;
  }
}

/**
 * Analyzes a card name to extract primary MTG gameplay keywords.
 */
export async function fetchCardKeywordsWithGemini(ai: AiClient, cardName: string): Promise<string[]> {
  if (!ai) {
    throw new Error("AI client not initialized for keyword analysis.");
  }
  if (!cardName.trim()) {
    return [];
  }

  if (ai.type === 'local') {
    try {
      const prompt = `Identify the primary MTG gameplay mechanics (keywords) for "${cardName}". 
Focus on abilities like Flying, Trample, Removal, Card Draw, Counterspell, Board Wipe, Ramp, Haste, Vigilance, Lifelink, Deathtouch, Defender, Flash, Double Strike, First Strike, Menace, Reach, Scry, Token Creation. 
Return strictly a JSON array of strings. Example:
["flying", "card draw", "removal"]`;

      const text = await callOllama(ai, prompt, { json: true });
      const keywords = cleanThinkAndParseJson(text);
      return Array.isArray(keywords) ? keywords.map(kw => String(kw).toLowerCase().trim()) : [];
    } catch (error) {
      console.error(`Local keyword analysis failed for "${cardName}":`, error);
      return [];
    }
  }

  const gemini = ai.geminiClient as GoogleGenAI;
  if (!gemini) {
    throw new Error("Gemini client not initialized.");
  }

  const model = "gemini-3-flash-preview";

  try {
    const response: GenerateContentResponse = await gemini.models.generateContent({
      model: model,
      contents: `Identify the primary MTG gameplay mechanics (keywords) for "${cardName}". Focus on abilities like Flying, Trample, Removal, Card Draw, etc. Return as a simple array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) return [];

    const keywords = JSON.parse(text);
    return Array.isArray(keywords) ? keywords.map(kw => String(kw).toLowerCase().trim()) : [];

  } catch (error) {
    console.error(`Gemini keyword analysis failed for "${cardName}":`, error);
    return []; 
  }
}

/**
 * Suggests replacements for a specific card in a deck context.
 */
export async function suggestCardReplacements(ai: AiClient, targetCard: ProcessedDeckCard, deckContext: string[]): Promise<string[]> {
  if (!ai) return [];

  const targetCardDetails = `Name: ${targetCard.name}
Type: ${targetCard.typeLine || 'Unknown'}
Cost: ${targetCard.manaCostString || 'N/A'}
Rules Text: ${targetCard.text || 'No rules text.'}`;

  if (ai.type === 'local') {
    try {
      const prompt = `Suggest exactly 3 strictly better or high-synergy alternative Magic: The Gathering cards for this card:
${targetCardDetails}

In a deck that also contains: ${deckContext.slice(0, 30).join(', ')}. 

Return strictly a JSON array of 3 card names (strings). Example:
["Counterspell", "Mana Drain", "Force of Will"]`;

      const text = await callOllama(ai, prompt, { json: true });
      const suggestions = cleanThinkAndParseJson(text);
      return Array.isArray(suggestions) ? suggestions.map(String) : [];
    } catch (e) {
      console.error("Local card replacement suggestion failed:", e);
      return [];
    }
  }

  const gemini = ai.geminiClient as GoogleGenAI;
  if (!gemini) return [];

  const model = "gemini-3-flash-preview";

  try {
    const response: GenerateContentResponse = await gemini.models.generateContent({
      model: model,
      contents: `Suggest 3 strictly better or high-synergy alternative Magic: The Gathering cards for this card:
${targetCardDetails}

In a deck that also contains: ${deckContext.slice(0, 30).join(', ')}. Return only an array of card names.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });
    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (e) {
    console.error("Card replacement suggestion failed:", e);
    return [];
  }
}

/**
 * Analyzes the entire deck to provide insights on power level, archetypes, and improvements.
 */
export async function analyzeDeckWithGemini(ai: AiClient, deckCards: ProcessedDeckCard[], commanderId?: string | null): Promise<string> {
  if (!ai) return "AI Client not initialized.";

  // Format cards with rules text to provide full context
  const cardDetailsString = deckCards.map(c => {
    const isCmd = c.id === commanderId;
    return `[${isCmd ? 'COMMANDER' : 'CARD'}] Name: ${c.name} | Type: ${c.typeLine || 'Unknown'} | Cost: ${c.manaCostString || 'N/A'} | Color Identity: ${c.colorIdentity?.join('') || 'Colorless'}
Text: ${c.text || 'No rules text.'}`;
  }).join('\n\n');

  if (ai.type === 'local') {
    try {
      const prompt = `Analyze this Magic: The Gathering decklist. Each card's oracle rules text, type, cost, and commander status are provided below.

Please use the rules text and color identity to analyze synergy, deck legality, and power level correctly.

Provide a structured report covering:
1. **Deck Archetype & Power Level**: What is this deck trying to do? (Casual/Competitive/High Power)
2. **Win Conditions**: How does it win?
3. **Key Synergies**: What are the main engines or combos?
4. **Weaknesses**: What is it vulnerable to?
5. **Suggestions**: 3-5 concrete card additions or cuts to improve consistency. Make sure suggested additions strictly match the commander's color identity.

Format the output in clean Markdown.

Decklist with Rules Text:
${cardDetailsString}`;

      const text = await callOllama(ai, prompt);
      return stripThink(text);
    } catch (e: any) {
      console.error("Local deck analysis failed:", e);
      return `Failed to analyze deck locally: ${e.message}`;
    }
  }

  const gemini = ai.geminiClient as GoogleGenAI;
  if (!gemini) return "AI Client not initialized.";

  const model = "gemini-3-flash-preview";

  try {
    const response: GenerateContentResponse = await gemini.models.generateContent({
      model: model,
      contents: `Analyze this Magic: The Gathering decklist. Each card's oracle rules text, type, cost, and commander status are provided below.

Provide a structured report covering:
1. **Deck Archetype & Power Level**: What is this deck trying to do? (Casual/Competitive/High Power)
2. **Win Conditions**: How does it win?
3. **Key Synergies**: What are the main engines or combos?
4. **Weaknesses**: What is it vulnerable to?
5. **Suggestions**: 3-5 concrete card additions or cuts to improve consistency. Make sure suggested additions strictly match the commander's color identity.

Format the output in clean Markdown.

Decklist with Rules Text:
${cardDetailsString}`,
      config: {
        temperature: 0.2,
      },
    });

    return response.text || "No analysis generated.";
  } catch (e: any) {
    console.error("Deck analysis failed:", e);
    return `Failed to analyze deck: ${e.message}`;
  }
}
