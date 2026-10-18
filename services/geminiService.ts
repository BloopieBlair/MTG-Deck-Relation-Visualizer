import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type { RawDeckCard, ProcessedDeckCard, AiClient } from '../types';

export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-exp:free';

/**
 * Helper to call OpenRouter's OpenAI-compatible Chat Completions API.
 */
async function callOpenRouter(ai: AiClient, prompt: string, options?: { json?: boolean; temperature?: number }): Promise<string> {
  const apiKey = (ai.openRouterKey || '').trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key is missing. Connect OpenRouter or enter a key in AI Settings.");
  }

  const model = (ai.openRouterModel || DEFAULT_OPENROUTER_MODEL).trim();
  const body: Record<string, any> = {
    model,
    messages: [
      {
        role: 'system',
        content: options?.json
          ? 'You are an expert Magic: The Gathering rules and deckbuilding engine. Always respond with valid JSON matching the user request without extra markdown commentary.'
          : 'You are an expert Magic: The Gathering Commander and tournament deckbuilder. Provide clear, actionable, rules-accurate analysis.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: options?.temperature ?? 0.2,
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      'X-Title': 'MTG Deck Relation Visualizer',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errDetail = `${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errDetail = errJson.error.message;
      }
    } catch {}
    throw new Error(`OpenRouter API error: ${errDetail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return content;
}

/**
 * Exchanges an OpenRouter OAuth PKCE authorization code for an API key.
 */
export async function exchangeOpenRouterCodeForKey(code: string, codeVerifier?: string | null): Promise<string> {
  const payload: Record<string, string> = { code };
  if (codeVerifier) {
    payload.code_verifier = codeVerifier;
    payload.code_challenge_method = 'S256';
  }

  const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange OpenRouter auth code (${response.status})`);
  }

  const data = await response.json();
  if (!data?.key) {
    throw new Error('No API key returned from OpenRouter.');
  }
  return data.key;
}

/**
 * Generates PKCE S256 code verifier and challenge for one-click OpenRouter login.
 */
export async function createPkceChallenge(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  const verifier = Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  const base64Digest = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { verifier, challenge: base64Digest };
}

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
 * Helper to strip reasoning tokens and parse JSON returned from a local AI or OpenRouter.
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
 * Supports OpenRouter, Local AI (Ollama), and Google Gemini API.
 */
export async function parseDecklistWithGemini(ai: AiClient, decklistText: string): Promise<RawDeckCard[]> {
  if (!ai) {
    throw new Error("AI client not initialized for decklist parsing.");
  }
  if (!decklistText.trim()) {
    return []; 
  }

  const jsonPrompt = `Parse this Magic: The Gathering decklist into a JSON array of objects. 
Each object must have exactly two properties: "name" (string) and "quantity" (integer).
Strip set codes and collector numbers (e.g. convert "Enduring Sliver (MH1) 6" to "Enduring Sliver").
Skip comments, section headers like "Deck" or "Commander", and sideboard indicators.

Format the output strictly as a JSON array of objects. Do not wrap in anything else except a JSON block. Example:
[{"name": "Lightning Bolt", "quantity": 4}, {"name": "Mountain", "quantity": 20}]

Decklist to parse:
${decklistText}`;

  if (ai.type === 'openrouter') {
    const text = await callOpenRouter(ai, jsonPrompt, { json: true, temperature: 0.1 });
    const parsedData = cleanThinkAndParseJson(text);
    if (!Array.isArray(parsedData)) return [];
    return parsedData.map(item => ({
      name: String(item.name || "").trim(),
      quantity: Number(item.quantity) || 1
    })).filter(item => item.name !== "");
  }

  if (ai.type === 'local') {
    try {
      const text = await callOllama(ai, jsonPrompt, { json: true });
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

  const model = "gemini-2.5-flash";
  
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
  if (!ai || !cardName.trim()) {
    return [];
  }

  const prompt = `Identify the primary MTG gameplay mechanics (keywords) for "${cardName}". 
Focus on abilities like Flying, Trample, Removal, Card Draw, Counterspell, Board Wipe, Ramp, Haste, Vigilance, Lifelink, Deathtouch, Defender, Flash, Double Strike, First Strike, Menace, Reach, Scry, Token Creation. 
Return strictly a JSON array of strings. Example:
["flying", "card draw", "removal"]`;

  if (ai.type === 'openrouter') {
    try {
      const text = await callOpenRouter(ai, prompt, { json: true, temperature: 0.1 });
      const keywords = cleanThinkAndParseJson(text);
      return Array.isArray(keywords) ? keywords.map(kw => String(kw).toLowerCase().trim()) : [];
    } catch (error) {
      console.error(`OpenRouter keyword analysis failed for "${cardName}":`, error);
      return [];
    }
  }

  if (ai.type === 'local') {
    try {
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

  const model = "gemini-2.5-flash";

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

  const prompt = `Suggest exactly 3 strictly better or high-synergy alternative Magic: The Gathering cards for this card:
${targetCardDetails}

In a deck that also contains: ${deckContext.slice(0, 30).join(', ')}. 

Return strictly a JSON array of 3 card names (strings). Example:
["Counterspell", "Mana Drain", "Force of Will"]`;

  if (ai.type === 'openrouter') {
    try {
      const text = await callOpenRouter(ai, prompt, { json: true, temperature: 0.2 });
      const suggestions = cleanThinkAndParseJson(text);
      return Array.isArray(suggestions) ? suggestions.map(String) : [];
    } catch (e) {
      console.error("OpenRouter card replacement suggestion failed:", e);
      return [];
    }
  }

  if (ai.type === 'local') {
    try {
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

  const model = "gemini-2.5-flash";

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

  const analysisPrompt = `Analyze this Magic: The Gathering decklist. Each card's oracle rules text, type, cost, and commander status are provided below.

Please use the rules text and color identity to analyze synergy, deck legality, and power level correctly.

Provide a structured report covering:
1. **Deck Archetype & Power Level**: What is this deck trying to do? (Casual/Competitive/High Power)
2. **Win Conditions**: How does it win?
3. **Key Synergies**: What are the main engines or combos?
4. **Weaknesses & Orphan Cuts**: What is it vulnerable to, and which low-synergy cards should be cut?
5. **High-Impact Upgrades**: 3-5 concrete card additions to improve consistency. Make sure suggested additions strictly match the commander's color identity.

Format the output in clean Markdown.

Decklist with Rules Text:
${cardDetailsString}`;

  if (ai.type === 'openrouter') {
    try {
      const text = await callOpenRouter(ai, analysisPrompt, { temperature: 0.25 });
      return stripThink(text) || "No analysis generated.";
    } catch (e: any) {
      console.error("OpenRouter deck analysis failed:", e);
      return `Failed to analyze deck via OpenRouter: ${e.message}`;
    }
  }

  if (ai.type === 'local') {
    try {
      const text = await callOllama(ai, analysisPrompt);
      return stripThink(text);
    } catch (e: any) {
      console.error("Local deck analysis failed:", e);
      return `Failed to analyze deck locally: ${e.message}`;
    }
  }

  const gemini = ai.geminiClient as GoogleGenAI;
  if (!gemini) return "AI Client not initialized.";

  const model = "gemini-2.5-flash";

  try {
    const response: GenerateContentResponse = await gemini.models.generateContent({
      model: model,
      contents: analysisPrompt,
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
