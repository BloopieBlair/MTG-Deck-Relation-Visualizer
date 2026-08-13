
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

import { FileUpload } from './components/FileUpload';
import { KeywordManager } from './components/KeywordManager';
import { DeckVisualizer } from './components/DeckVisualizer';
import { Legend } from './components/Legend';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ManaAnalysisDisplay } from './components/ManaAnalysisDisplay';
import { ManaCurveDashboard, type ManaCurveModalRequest } from './components/ManaCurveDashboard';
import { ManaCurveCardListModal } from './components/ManaCurveCardListModal';
import { LargeCardImageModal } from './components/LargeCardImageModal';
import { ZoomControl } from './components/ZoomControl';
import { AddCardModal } from './components/AddCardModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { DeckAnalysisModal } from './components/DeckAnalysisModal';
import { CommanderSelectionModal } from './components/CommanderSelectionModal'; 
import { DeckListView } from './components/DeckListView';
import { HoveredCardDisplay } from './components/HoveredCardDisplay';
import { GoldfishSimulatorModal } from './components/GoldfishSimulatorModal';
import { MtgaCollectionDrawer } from './components/MtgaCollectionDrawer';
import { fetchMtgaCollection } from './services/mtgaLogService';
import { PINNED_SEARCH_COLORS, ACTIVE_SEARCH_HIGHLIGHT_COLOR, SINGLE_SEARCH_RESULT_HIGHLIGHT_COLOR, DEFAULT_KEYWORD_STYLES, MOCK_CARD_DATABASE } from './constants';
import { parseCsvContent } from './services/csvParser';
import { fetchCardDataFromScryfall, fetchCardsBatch, parseScryfallManaCost, normalizeCardName } from './services/scryfallService';
import { parseDecklistWithGemini, fetchCardKeywordsWithGemini } from './services/geminiService';
import type { RawDeckCard, ProcessedDeckCard, KeywordStyle, ManaAnalysisData, ParsedManaCost, ManaSymbol, ManaColor, D3Node, PinnedSearch, OrphanClusterInfo, AiClient, MtgaCardItem } from './types';
import { v4 as uuidv4 } from 'uuid';
import { HandIcon, XMarkIcon, PlusIcon, MapPinIcon, ArrowUturnLeftIcon, DownloadIcon, ShieldCheckIcon, CrownIcon, DocumentIcon, KeyIcon, SparklesIcon } from './components/icons';


const getCMC = (cost?: ParsedManaCost): number => {
  if (!cost) return 0;
  let cmc = 0;
  cmc += cost.W || 0;
  cmc += cost.U || 0;
  cmc += cost.B || 0;
  cmc += cost.R || 0;
  cmc += cost.G || 0;
  cmc += cost.C || 0;
  cmc += cost.Generic || 0;
  return cmc;
};

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const MAX_PINNED_SEARCHES = 3;
const MAX_HISTORY_SIZE = 20;

const App: React.FC = () => {
  const [processedDeckCards, setProcessedDeckCards] = useState<ProcessedDeckCard[]>([]);
  const [keywordStyles, setKeywordStyles] = useState<KeywordStyle[]>(DEFAULT_KEYWORD_STYLES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'manaCurve'>('visualizer');

  const [highlightedKeywords, setHighlightedKeywords] = useState<string[] | null>(null);
  const [manaAnalysisData, setManaAnalysisData] = useState<ManaAnalysisData | null>(null);

  const [aiClient, setAiClient] = useState<AiClient | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isInitializingAI, setIsInitializingAI] = useState<boolean>(true);
  const [aiPoweredFeaturesEnabled, setAiPoweredFeaturesEnabled] = useState<boolean>(false);
  
  const [showManaCardListModal, setShowManaCardListModal] = useState<boolean>(false);
  const [manaListModalContent, setManaListModalContent] = useState<{title: string, cards: ProcessedDeckCard[]}>({title: '', cards: []});

  const [showManaCurveCardListModal, setShowManaCurveCardListModal] = useState<boolean>(false);
  const [manaCurveModalContent, setManaCurveModalContent] = useState<{ title: string; cards: ProcessedDeckCard[] }>({ title: '', cards: [] });

  const [selectedNodeForPopup, setSelectedNodeForPopup] = useState<D3Node | null>(null);

  const [drawnSampleHand, setDrawnSampleHand] = useState<ProcessedDeckCard[] | null>(null);

  const [activeSearchTerm, setActiveSearchTerm] = useState<string>('');
  const [activeSearchCardIds, setActiveSearchCardIds] = useState<Set<string>>(new Set());
  const [pinnedSearches, setPinnedSearches] = useState<PinnedSearch[]>([]);
  const [pinnedSearchSlotColors, setPinnedSearchSlotColors] = useState<string[]>(() => PINNED_SEARCH_COLORS.slice(0, MAX_PINNED_SEARCHES));
  const [singleActiveSearchResultId, setSingleActiveSearchResultId] = useState<string | null>(null);

  const [loadingDetailMessage, setLoadingDetailMessage] = useState<string | null>(null);

  const [showLargeImageModal, setShowLargeImageModal] = useState<boolean>(false);
  const [largeImageModalCard, setLargeImageModalCard] = useState<ProcessedDeckCard | null>(null);
  
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [showDeckAnalysisModal, setShowDeckAnalysisModal] = useState<boolean>(false);

  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [history, setHistory] = useState<ProcessedDeckCard[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isUndoRedoAction, setIsUndoRedoAction] = useState<boolean>(false); 

  const [showAddCardModal, setShowAddCardModal] = useState<boolean>(false);

  const [commanderId, setCommanderId] = useState<string | null>(null);
  const [showCommanderSelectionModal, setShowCommanderSelectionModal] = useState<boolean>(false);
  const [showGoldfishSimulator, setShowGoldfishSimulator] = useState<boolean>(false);
  
  const [showMtgaDrawer, setShowMtgaDrawer] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'deck' | 'collection' | 'split'>('deck');
  const [showRightSidebar, setShowRightSidebar] = useState<boolean>(true);
  const [mtgaCards, setMtgaCards] = useState<MtgaCardItem[]>([]);
  const [isMtgaLoading, setIsMtgaLoading] = useState<boolean>(false);
  const [mtgaError, setMtgaError] = useState<string | null>(null);
  const [hoveredMtgaCard, setHoveredMtgaCard] = useState<MtgaCardItem | null>(null);

  const [panToNodeId, setPanToNodeId] = useState<string | null>(null);
  const [selectedCardInListId, setSelectedCardInListId] = useState<string | null>(null);
  const [hoveredCardInList, setHoveredCardInList] = useState<ProcessedDeckCard | null>(null);
  const [highlightedColors, setHighlightedColors] = useState<Set<string>>(new Set());

  const loadMtgaCollectionData = useCallback(async () => {
    setIsMtgaLoading(true);
    setMtgaError(null);
    const result = await fetchMtgaCollection();
    if (result.status === 'error' || result.cards.length === 0) {
      setMtgaError(result.error || 'No cards found in MTG Arena Player.log');
    } else {
      setMtgaCards(result.cards);
    }
    setIsMtgaLoading(false);
  }, []);

  useEffect(() => {
    loadMtgaCollectionData();
  }, [loadMtgaCollectionData]);

  const handleAddCardToVisualizer = useCallback(async (cardNameOrItem: string | MtgaCardItem) => {
    const cardTitle = typeof cardNameOrItem === 'string' ? cardNameOrItem : cardNameOrItem.title;
    if (!cardTitle || cardTitle.startsWith('http://') || cardTitle.startsWith('https://')) {
      return;
    }
    const existingIndex = processedDeckCards.findIndex(c => c.name.toLowerCase() === cardTitle.toLowerCase());
    
    if (existingIndex >= 0) {
      setProcessedDeckCards(prev => prev.map((c, i) => i === existingIndex ? { ...c, quantity: c.quantity + 1 } : c));
      return;
    }

    setIsLoading(true);
    setLoadingDetailMessage(`Adding "${cardTitle}" to visualizer...`);
    try {
      const scryfallData = await fetchCardDataFromScryfall(cardTitle);
      if (scryfallData) {
        const newCard: ProcessedDeckCard = {
          id: normalizeCardName(scryfallData.nameScryfall),
          name: scryfallData.nameScryfall || cardTitle,
          quantity: 1,
          keywords: scryfallData.keywords,
          text: scryfallData.text || '',
          imageUrl: scryfallData.imageUrl,
          manaCostString: scryfallData.manaCostString,
          producesMana: scryfallData.producesMana,
          parsedManaCost: parseScryfallManaCost(scryfallData.manaCostString),
          colors: scryfallData.colors,
          typeLine: scryfallData.typeLine,
          colorIdentity: scryfallData.colorIdentity
        };
        setProcessedDeckCards(prev => [...prev, newCard]);
      } else if (typeof cardNameOrItem !== 'string') {
        const fallbackCard: ProcessedDeckCard = {
          id: normalizeCardName(cardNameOrItem.title),
          name: cardNameOrItem.title,
          quantity: 1,
          keywords: [cardNameOrItem.primaryType.toLowerCase()],
          text: cardNameOrItem.typeText,
          imageUrl: cardNameOrItem.imageUrl,
          manaCostString: cardNameOrItem.manaCost,
          colors: cardNameOrItem.colors,
          typeLine: cardNameOrItem.typeText
        };
        setProcessedDeckCards(prev => [...prev, fallbackCard]);
      }
    } catch (err) {
      console.error('Failed to add card:', err);
    } finally {
      setIsLoading(false);
    }
  }, [processedDeckCards]);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const jsonStr = e.dataTransfer.getData('application/json');
    const textStr = e.dataTransfer.getData('text/plain');
    
    if (jsonStr) {
      try {
        const cardObj = JSON.parse(jsonStr) as MtgaCardItem;
        handleAddCardToVisualizer(cardObj);
        return;
      } catch {}
    }
    if (textStr) {
      handleAddCardToVisualizer(textStr);
    }
  }, [handleAddCardToVisualizer]);

  const handleColorHighlightToggle = useCallback((color: string) => {

    setHighlightedColors(prev => {
      const next = new Set(prev);
      if (next.has(color)) {
        next.delete(color);
      } else {
        next.add(color);
      }
      return next;
    });
  }, []);

  const selectedCard = useMemo(() => {
    return processedDeckCards.find(c => c.id === selectedCardInListId) || null;
  }, [processedDeckCards, selectedCardInListId]);

  useEffect(() => {
    if (!activeSearchTerm.trim()) {
      setActiveSearchCardIds(new Set());
      return;
    }
    const term = activeSearchTerm.toLowerCase();
    const matches = processedDeckCards.filter(card => 
      card.name.toLowerCase().includes(term) ||
      card.keywords.some(k => k.toLowerCase().includes(term)) ||
      (card.text || '').toLowerCase().includes(term)
    ).map(c => c.id);
    setActiveSearchCardIds(new Set(matches));
  }, [activeSearchTerm, processedDeckCards]);

  // --- Graph Analysis ---
  const { weaklyConnectedHighlightSet, orphanClusters } = useMemo(() => {
    if (processedDeckCards.length === 0) return { weaklyConnectedHighlightSet: new Set<string>(), orphanClusters: [] };

    const adj = new Map<string, Set<string>>();
    processedDeckCards.forEach(c => adj.set(c.id, new Set()));

    const activeKwNames = keywordStyles.filter(k => k.enabled).map(k => k.name.toLowerCase());
    processedDeckCards.forEach((c1, i) => {
      const kw1 = c1.keywords.map(k => k.toLowerCase());
      processedDeckCards.slice(i + 1).forEach(c2 => {
        const kw2 = c2.keywords.map(k => k.toLowerCase());
        const shared = activeKwNames.filter(k => kw1.includes(k) && kw2.includes(k));
        if (shared.length > 0) {
          adj.get(c1.id)!.add(c2.id);
          adj.get(c2.id)!.add(c1.id);
        }
      });
    });

    const components: string[][] = [];
    const visited = new Set<string>();
    processedDeckCards.forEach(c => {
      if (!visited.has(c.id)) {
        const comp: string[] = [];
        const q = [c.id];
        visited.add(c.id);
        while (q.length > 0) {
          const curr = q.shift()!;
          comp.push(curr);
          adj.get(curr)?.forEach(neighbor => {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              q.push(neighbor);
            }
          });
        }
        components.push(comp);
      }
    });

    const weaklyConnected = new Set<string>();
    const clusters: OrphanClusterInfo[] = [];

    // Identify "Main" component (largest or the one with commander)
    let mainCompIndex = 0;
    if (commanderId) {
      const idx = components.findIndex(comp => comp.includes(commanderId));
      if (idx !== -1) mainCompIndex = idx;
    } else {
      mainCompIndex = components.reduce((maxIdx, comp, idx, arr) => comp.length > arr[maxIdx].length ? idx : maxIdx, 0);
    }

    components.forEach((comp, idx) => {
      if (idx !== mainCompIndex) {
        if (comp.length === 1) weaklyConnected.add(comp[0]);
        else if (comp.length > 1) {
          clusters.push({ id: `cluster-${idx}`, nodeIds: comp });
        }
      }
    });

    return { weaklyConnectedHighlightSet: weaklyConnected, orphanClusters: clusters };
  }, [processedDeckCards, keywordStyles, commanderId]);

  const updateHistory = useCallback((newCardsSnapshot: ProcessedDeckCard[]) => {
    const newHistoryEntry = [...newCardsSnapshot]; 
    const currentHistoryStack = history.slice(0, historyIndex + 1);
    const newHistoryStack = [...currentHistoryStack, newHistoryEntry];

    if (newHistoryStack.length > MAX_HISTORY_SIZE) {
        setHistory(newHistoryStack.slice(newHistoryStack.length - MAX_HISTORY_SIZE));
        setHistoryIndex(MAX_HISTORY_SIZE - 1);
    } else {
        setHistory(newHistoryStack);
        setHistoryIndex(newHistoryStack.length - 1);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    if (!isUndoRedoAction) {
      const lastHistoryEntry = history[historyIndex];
      if (!lastHistoryEntry || JSON.stringify(processedDeckCards) !== JSON.stringify(lastHistoryEntry)) {
         updateHistory(processedDeckCards);
      }
    } else {
      setIsUndoRedoAction(false);
    }
  }, [processedDeckCards, updateHistory, isUndoRedoAction, history, historyIndex]);

  const initializeAI = useCallback(() => {
    const mode = localStorage.getItem('ai_mode') || 'gemini';

    if (mode === 'local') {
      const host = localStorage.getItem('local_ai_host') || 'http://localhost:11434';
      const model = localStorage.getItem('local_ai_model') || 'llama3';

      setAiClient({
        type: 'local',
        localHost: host,
        localModel: model
      });
      setAiPoweredFeaturesEnabled(true);
      setAiError(null);
      setIsInitializingAI(false);
    } else {
      // @ts-ignore
      const envApiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;
      const apiKey = localStorage.getItem('gemini_api_key') || envApiKey;
      
      if (!apiKey) {
        setAiError("API Key missing. Please set it in options.");
        setAiPoweredFeaturesEnabled(false);
        setAiClient(null);
        setIsInitializingAI(false);
        return;
      }

      try {
        const client = new GoogleGenAI({ apiKey });
        setAiClient({
          type: 'gemini',
          geminiClient: client
        });
        setAiPoweredFeaturesEnabled(true);
        setAiError(null);
      } catch (e: any) {
        setAiError(`Failed to initialize Gemini: ${e.message}`);
        setAiPoweredFeaturesEnabled(false);
        setAiClient(null);
      } finally {
        setIsInitializingAI(false);
      }
    }
  }, []);

  useEffect(() => {
    const savedZoom = localStorage.getItem('appZoomLevel');
    if (savedZoom) {
      const newZoom = parseInt(savedZoom, 10);
      if (newZoom >= 50 && newZoom <= 200) {
        setZoomLevel(newZoom);
      }
    }

    if (!localStorage.getItem('app_setup_completed')) {
      setShowApiKeyModal(true);
    }

    initializeAI();
  }, [initializeAI]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${75 * (zoomLevel / 100)}%`;
    localStorage.setItem('appZoomLevel', zoomLevel.toString());
  }, [zoomLevel]);

  useEffect(() => {
    if (processedDeckCards.length === 0) {
      setManaAnalysisData(null);
      return;
    }

    const pipsRequired: ParsedManaCost = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0, Generic: 0 };
    const manaSources: ParsedManaCost = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

    processedDeckCards.forEach(card => {
      const q = card.quantity || 1;
      const lowerCaseKeywords = card.keywords.map(k => k.toLowerCase());
      const isLand = lowerCaseKeywords.includes('land');

      // Count pips required for non-land cards
      if (!isLand && card.parsedManaCost) {
        Object.entries(card.parsedManaCost).forEach(([symbol, value]) => {
          const valNum = value as number;
          if (valNum && valNum > 0 && ['W', 'U', 'B', 'R', 'G', 'C', 'X', 'Generic'].includes(symbol)) {
            pipsRequired[symbol] = (pipsRequired[symbol] || 0) + valNum * q;
          }
        });
      }

      // Count mana sources
      if (card.producesMana && card.producesMana.length > 0) {
        card.producesMana.forEach(symbol => {
          if (['W', 'U', 'B', 'R', 'G', 'C'].includes(symbol)) {
            manaSources[symbol] = (manaSources[symbol] || 0) + q;
          }
        });
      }
    });

    setManaAnalysisData({ pipsRequired, manaSources });
  }, [processedDeckCards]);

  const handleShowLargeImage = useCallback((card: ProcessedDeckCard) => {
    setLargeImageModalCard(card);
    setShowLargeImageModal(true);
  }, []);

  const parseSimpleTxtDecklist = (content: string): RawDeckCard[] => {
    const lines = content.split(/\r?\n/);
    const cards: RawDeckCard[] = [];
    const lineRegex = /^\s*(?:(\d+)\s*[xX]?\s*)?(.+?)\s*(?:\/\/.*|\(#\d+\))?\s*$/;
    
    // Common decklist section headers to ignore
    const sectionHeaders = ["commander", "deck", "sideboard", "maybeboard", "outside the game", "mainboard", "non-deck cards", "companion"];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '' || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) continue;
      
      // Skip section headers
      if (sectionHeaders.includes(trimmedLine.toLowerCase())) continue;

      const match = trimmedLine.match(lineRegex);
      if (match) {
        const quantity = match[1] ? parseInt(match[1], 10) : 1;
        let name = match[2].trim(); 
        
        // Strip set info like (MH1) 6 or [MH1] 123
        // This handles cases like "Enduring Sliver (MH1) 6" -> "Enduring Sliver"
        name = name.replace(/\s*[([][a-zA-Z0-9]{3,4}[)\]].*$/, "").trim();
        
        if (name && quantity > 0) cards.push({ name, quantity });
      }
    }
    return cards;
  };

  const fetchCardDataAndProcess = useCallback(async (
    cardsToProcess: RawDeckCard[],
    onProgressUpdate: (message: string) => void
  ): Promise<ProcessedDeckCard[]> => {
    const newProcessedCards: ProcessedDeckCard[] = [];
    
    // 1. Identify cards not in local mock database
    const cardsToFetchFromScryfall = cardsToProcess.filter(c => !MOCK_CARD_DATABASE[normalizeCardName(c.name)]);
    
    // 2. Fetch from Scryfall in batch
    let scryfallBatchResults: Record<string, any> = {};
    if (cardsToFetchFromScryfall.length > 0) {
      scryfallBatchResults = await fetchCardsBatch(cardsToFetchFromScryfall.map(c => c.name), onProgressUpdate);
    }

    // 3. Process all cards, falling back to individual fetch (including fuzzy) for missing ones
    for (const rawCard of cardsToProcess) {
      const normalizedName = normalizeCardName(rawCard.name);
      let cardData = MOCK_CARD_DATABASE[normalizedName] || scryfallBatchResults[normalizedName] || null;
      
      if (!cardData) {
        // Fallback to individual fetch (fuzzy search) if not found in batch or mock
        cardData = await fetchCardDataFromScryfall(rawCard.name, onProgressUpdate);
      }

      const idForCard = normalizeCardName(cardData?.nameScryfall || rawCard.name);
      newProcessedCards.push({
        id: idForCard, 
        name: cardData?.nameScryfall || rawCard.name, 
        quantity: rawCard.quantity,
        keywords: cardData?.keywords || ['unknown'],
        text: cardData?.text || 'No text available.',
        imageUrl: cardData?.imageUrl,
        manaCostString: cardData?.manaCostString,
        producesMana: cardData?.producesMana,
        parsedManaCost: parseScryfallManaCost(cardData?.manaCostString),
        colors: cardData?.colors,
        typeLine: cardData?.typeLine,
        colorIdentity: cardData?.colorIdentity,
      });
    }
    return newProcessedCards;
  }, []);

  const processUploadedDeck = useCallback(async (decklistText: string, file: File) => {
    setIsLoading(true);
    setError(null);
    setLoadingDetailMessage(aiClient?.type === 'local' ? "Parsing decklist with Local AI (Ollama)..." : "Parsing decklist with Gemini AI...");

    try {
      let parsedCards: RawDeckCard[] = [];
      if (aiClient && aiPoweredFeaturesEnabled) {
        try {
          parsedCards = await parseDecklistWithGemini(aiClient, decklistText);
        } catch (e) {
          console.warn("AI parsing failed, falling back to rule-based parser.");
        }
      }

      if (parsedCards.length === 0) {
        const fileType = file.name.split('.').pop()?.toLowerCase();
        parsedCards = fileType === 'csv' ? parseCsvContent(decklistText) : parseSimpleTxtDecklist(decklistText);
      }

      const newProcessedCards = await fetchCardDataAndProcess(parsedCards, setLoadingDetailMessage);
      setProcessedDeckCards(newProcessedCards);
    } catch (e: any) {
      setError(`Failed to process deck: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCardDataAndProcess, aiClient, aiPoweredFeaturesEnabled]);

  const handleDrawHand = useCallback(() => {
    if (processedDeckCards.length === 0) return;
    const flatDeck: ProcessedDeckCard[] = [];
    processedDeckCards.forEach(card => {
        for(let i=0; i<card.quantity; i++) flatDeck.push(card);
    });
    const shuffled = shuffleArray(flatDeck);
    setDrawnSampleHand(shuffled.slice(0, 7));
  }, [processedDeckCards]);

  const handleNodeSelectionChange = useCallback((node: D3Node | null, keywords: string[] | null) => {
    setSelectedNodeForPopup(node);
    setHighlightedKeywords(keywords);
    setSelectedCardInListId(node?.id || null);
  }, []);

  const handleCardKeywordsUpdate = useCallback((cardId: string, updatedKeywords: string[]) => {
    setIsUndoRedoAction(false);
    setProcessedDeckCards(prev => prev.map(c => c.id === cardId ? { ...c, keywords: updatedKeywords } : c));
  }, []);

  const handleManaStatClick = useCallback((symbol: ManaSymbol, type: 'pipsRequired' | 'manaSources') => {
    const relevantCards = processedDeckCards.filter(c => 
      type === 'pipsRequired' ? (c.parsedManaCost?.[symbol] || 0) > 0 : c.producesMana?.includes(symbol)
    );
    setManaListModalContent({ title: `${symbol} ${type}`, cards: relevantCards });
    setShowManaCardListModal(true);
  }, [processedDeckCards]);

  const handleShowCardsForManaCurveSegment = useCallback((request: ManaCurveModalRequest) => {
    const { cmcLabel, targetColor, isTotalCurve } = request;
    const filtered = processedDeckCards.filter(c => {
      const cmc = getCMC(c.parsedManaCost);
      const isLand = c.keywords.includes('land');
      if (isLand) return false;
      
      const matchesCmc = cmcLabel.includes('+') ? cmc >= parseInt(cmcLabel) : cmc === parseInt(cmcLabel);
      if (!matchesCmc) return false;

      // Filter by color if not the Total curve
      if (!isTotalCurve && targetColor) {
        if (targetColor === 'C') {
           // Colorless filtering (cards with generic/colorless mana only, or explicit {C} cost)
           const cost = c.parsedManaCost || {};
           const hasColoredMana = ['W', 'U', 'B', 'R', 'G'].some(color => cost[color as ManaColor] && cost[color as ManaColor]! > 0);
           if (hasColoredMana) return false;
        } else {
           // Standard color filtering
           if (!c.parsedManaCost || !c.parsedManaCost[targetColor] || c.parsedManaCost[targetColor]! === 0) {
               return false;
           }
        }
      }

      return true;
    });
    
    let title = `CMC ${cmcLabel}`;
    if (!isTotalCurve && targetColor) {
        const colorNameMap: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
        title = `${colorNameMap[targetColor]} Cards at CMC ${cmcLabel}`;
    }

    setManaCurveModalContent({ title, cards: filtered });
    setShowManaCurveCardListModal(true);
  }, [processedDeckCards]);

  const handlePinSearch = useCallback(() => {
    if (!activeSearchTerm.trim() || pinnedSearches.length >= MAX_PINNED_SEARCHES) return;
    const newPin: PinnedSearch = {
      id: uuidv4(),
      term: activeSearchTerm, 
      cardIds: activeSearchCardIds, 
      color: pinnedSearchSlotColors[pinnedSearches.length],
      pinOrder: pinnedSearches.length,
    };
    setPinnedSearches(prev => [...prev, newPin]);
    setActiveSearchTerm('');
  }, [activeSearchTerm, activeSearchCardIds, pinnedSearches, pinnedSearchSlotColors]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setIsUndoRedoAction(true);
      const prev = historyIndex - 1;
      setProcessedDeckCards(history[prev]);
      setHistoryIndex(prev);
    }
  }, [history, historyIndex]);

  const handleApplyDeckChanges = useCallback((suggestions: string[]) => {
    console.log("Applying deck changes:", suggestions);
    // Placeholder for applying AI suggestions to the deck
  }, []);

  const isCardLegendaryCreature = useCallback((card: ProcessedDeckCard) => {
    const typeLineLower = (card.typeLine || '').toLowerCase();
    const keywordsLower = (card.keywords || []).map(k => k.toLowerCase());
    
    const isLegendary = typeLineLower.includes('legendary') || keywordsLower.includes('legendary');
    const isCreatureOrPlaneswalker = typeLineLower.includes('creature') || typeLineLower.includes('planeswalker') || keywordsLower.includes('creature') || keywordsLower.includes('planeswalker');

    return isLegendary && isCreatureOrPlaneswalker;
  }, []);

  if (isInitializingAI) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-gray-200">
        <LoadingSpinner />
        <p className="mt-3 text-cyan-400 font-mono tracking-widest">INITIALIZING MTG_CORE ENGINE...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-gray-200 text-sm overflow-hidden select-none">
      <header className="bg-gray-900 shadow-xl p-3 border-b border-cyan-800/50 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                MTG Deck Relation Visualizer
            </h1>
            <div className="h-6 w-px bg-gray-700 mx-2 hidden md:block" />
            <div className="hidden md:flex gap-4">
                <button onClick={() => setActiveTab('visualizer')} className={`px-4 py-1 rounded transition-all font-semibold text-xs tracking-widest uppercase ${activeTab === 'visualizer' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-gray-500 hover:text-gray-300'}`}>Graph</button>
                <button onClick={() => setActiveTab('manaCurve')} className={`px-4 py-1 rounded transition-all font-semibold text-xs tracking-widest uppercase ${activeTab === 'manaCurve' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20' : 'text-gray-500 hover:text-gray-300'}`}>Curve</button>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowRightSidebar(true);
                setRightPanelTab(prev => prev === 'deck' ? 'split' : prev);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-900/60 to-blue-900/60 hover:from-cyan-800 hover:to-blue-800 rounded-md border border-cyan-700/60 transition-all text-xs font-semibold text-cyan-300 shadow-lg shadow-cyan-950/50 group"
              title="View MTG Arena Collection Cards in Right Sidebar"
            >
              <SparklesIcon className="w-4 h-4 text-cyan-400 group-hover:rotate-12 transition-transform" />
              <span>MTGA Cards</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-200 font-mono text-[10px] border border-cyan-800">
                {mtgaCards.length || '...'}
              </span>
            </button>
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 transition-colors text-xs font-semibold text-cyan-400 group"
              title={aiError ? `AI Error: ${aiError} - Click to fix` : aiPoweredFeaturesEnabled ? `AI Active (${aiClient?.type === 'local' ? 'Local' : 'Gemini'})` : "AI Inactive - Click to configure"}
            >
              <div className={`w-2 h-2 rounded-full ${aiError ? 'bg-red-500 animate-pulse' : aiPoweredFeaturesEnabled ? (aiClient?.type === 'local' ? 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.6)]' : 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]') : 'bg-amber-500'}`} />
              <span className="hidden sm:inline text-gray-300 group-hover:text-cyan-400 transition-colors">
                {aiPoweredFeaturesEnabled ? (aiClient?.type === 'local' ? 'Local AI' : 'Gemini AI') : 'AI Config'}
              </span>
            </button>
            {!showRightSidebar && (
              <button
                onClick={() => {
                  setShowRightSidebar(true);
                  setRightPanelTab('split');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-400 hover:text-white rounded-md border border-cyan-700/60 transition-all text-xs font-semibold shadow-md active:scale-95"
                title="Open Right Deck & Collection Panel"
              >
                <span>📋 Open Panel</span>
              </button>
            )}
            <ZoomControl zoomLevel={zoomLevel} onZoomChange={setZoomLevel} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 lg:w-80 bg-gray-950 p-4 space-y-6 overflow-y-auto custom-scrollbar border-r border-gray-800 shadow-2xl z-20">
          <FileUpload onFileUpload={processUploadedDeck} disabled={isLoading} />
          
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Deck Actions</h3>
            <div className="grid grid-cols-1 gap-2">
                <button 
                    onClick={() => {
                      setShowRightSidebar(true);
                      setRightPanelTab('split');
                    }} 
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-br from-cyan-700 to-blue-800 hover:from-cyan-600 hover:to-blue-700 rounded-md text-xs font-bold shadow-lg transition-all active:scale-95 text-white"
                >
                    <SparklesIcon className="w-4 h-4 text-cyan-300" /> MTG Arena Cards ({mtgaCards.length})
                </button>
                <button 
                    onClick={handleDrawHand} 
                    disabled={processedDeckCards.length === 0}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-br from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 rounded-md text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-30"
                >
                    <HandIcon className="w-4 h-4" /> Draw Sample Hand
                </button>
                <button 
                    onClick={() => setShowCommanderSelectionModal(true)} 
                    disabled={processedDeckCards.length === 0}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-br from-amber-600 to-yellow-700 hover:from-amber-500 hover:to-yellow-600 rounded-md text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-30"
                >
                    <CrownIcon className="w-4 h-4" /> Set Commander
                </button>
                <button 
                    onClick={() => setShowDeckAnalysisModal(true)} 
                    disabled={processedDeckCards.length === 0 || !aiClient}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 rounded-md text-xs font-bold shadow-lg transition-all active:scale-95 disabled:opacity-30"
                >
                    <SparklesIcon className="w-4 h-4" /> {aiClient?.type === 'local' ? 'Analyze Deck (Local)' : 'Ask Gemini about Deck'}
                </button>
            </div>
          </div>

          <KeywordManager keywordStyles={keywordStyles} onKeywordStylesChange={setKeywordStyles} />
          
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2">Search & Filter</h3>
            <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search keywords/text..."
                  value={activeSearchTerm}
                  onChange={(e) => setActiveSearchTerm(e.target.value)}
                  className="flex-grow bg-gray-900 border border-gray-800 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-cyan-500 outline-none transition-all placeholder-gray-700"
                />
                <button onClick={handlePinSearch} className="p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors border border-gray-700 shadow-md">
                    <MapPinIcon className="w-4 h-4 text-cyan-400"/>
                </button>
            </div>
          </div>

          <div className="space-y-2">
            <button onClick={() => setShowAddCardModal(true)} className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-semibold border border-gray-700 shadow-md transition-all flex items-center justify-center gap-2">
                <PlusIcon className="w-4 h-4 text-green-500" /> Add Card
            </button>
            <button onClick={handleUndo} disabled={historyIndex <= 0} className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 rounded text-xs font-semibold border border-gray-700 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-20">
                <ArrowUturnLeftIcon className="w-4 h-4 text-amber-500" /> Undo Change
            </button>
          </div>

          {processedDeckCards.length > 0 && <Legend keywordStyles={keywordStyles.filter(k => k.enabled)} highlightedKeywords={highlightedKeywords} />}
        </aside>

        <main
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          className="flex-1 flex flex-col overflow-hidden bg-black relative"
        >
          {activeTab === 'visualizer' ? (
            <DeckVisualizer
              cards={processedDeckCards}
              keywordConfig={keywordStyles} 
              onNodeSelectionChange={handleNodeSelectionChange}
              onCardKeywordsUpdate={handleCardKeywordsUpdate}
              allKeywordStyles={keywordStyles}
              weaklyConnectedHighlightSet={weaklyConnectedHighlightSet}
              selectedNodeForPopup={selectedNodeForPopup}
              drawnSampleHand={drawnSampleHand}
              onCloseSampleHand={() => setDrawnSampleHand(null)}
              activeSearchCardIds={activeSearchCardIds}
              pinnedSearches={pinnedSearches}
              singleActiveSearchResultId={singleActiveSearchResultId}
              onCardImageClick={handleShowLargeImage}
              orphanClusters={orphanClusters}
              onDeleteNode={(id) => setProcessedDeckCards(prev => prev.filter(c => c.id !== id))}
              commanderId={commanderId}
              selectedCardInListId={selectedCardInListId}
              panToNodeId={panToNodeId}
              onPanComplete={() => setPanToNodeId(null)}
              aiClient={aiClient}
              highlightedColors={highlightedColors}
              onOpenSimulator={() => setShowGoldfishSimulator(true)}
            />
          ) : (
            <div className="overflow-y-auto custom-scrollbar flex-grow p-4">
               <ManaCurveDashboard deck={processedDeckCards} onShowCardsForSegment={handleShowCardsForManaCurveSegment} />
            </div>
          )}
          {manaAnalysisData && activeTab === 'visualizer' && (
            <ManaAnalysisDisplay 
              analysisData={manaAnalysisData} 
              onStatClick={handleManaStatClick} 
              highlightedColors={highlightedColors}
              onColorHighlightToggle={handleColorHighlightToggle}
            />
          )}
          
          {isLoading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                <LoadingSpinner />
                <p className="mt-4 text-cyan-400 font-mono text-sm animate-pulse uppercase tracking-[0.2em]">{loadingDetailMessage || 'Processing Deck...'}</p>
            </div>
          )}
        </main>

        {showRightSidebar ? (
          <aside className={`bg-gray-950 p-3 flex flex-col space-y-3 border-l border-gray-800 shadow-2xl z-20 transition-all duration-300 ${
            rightPanelTab === 'deck' 
              ? 'w-72 lg:w-80' 
              : 'w-[440px] lg:w-[490px] xl:w-[540px]'
          }`}>
            {/* Right Sidebar Header / Tab Control */}
            <div className="bg-gray-900/90 p-1.5 rounded-lg border border-gray-800 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-md border border-gray-800/80">
                <button
                  onClick={() => setRightPanelTab('deck')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                    rightPanelTab === 'deck'
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                  title="View Deck List"
                >
                  <span>📋 Deck</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 font-mono text-[10px] border border-cyan-800">
                    {processedDeckCards.reduce((sum, c) => sum + c.quantity, 0)}
                  </span>
                </button>

                <button
                  onClick={() => setRightPanelTab('collection')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                    rightPanelTab === 'collection'
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                  title="Browse MTG Arena Collection"
                >
                  <span>🎴 MTGA</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 font-mono text-[10px] border border-cyan-800">
                    {mtgaCards.length}
                  </span>
                </button>

                <button
                  onClick={() => setRightPanelTab('split')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                    rightPanelTab === 'split'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                  title="Split View: Deck List on Top, MTGA Collection on Bottom"
                >
                  <span>📑 Split</span>
                </button>
              </div>

              <button
                onClick={() => setShowRightSidebar(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-md bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
                title="Hide Right Panel"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Large 270px x 360px Hovered Card Image Preview Box */}
            <div className="shrink-0 flex justify-center py-1">
              <HoveredCardDisplay 
                card={hoveredCardInList || (rightPanelTab === 'deck' || rightPanelTab === 'split' ? selectedCard : null)} 
                deckCards={processedDeckCards}
              />
            </div>

            {/* Deck List Only Tab */}
            {rightPanelTab === 'deck' && (
              <div className="flex-grow min-h-0 border-t border-gray-800/80 pt-2 flex flex-col">
                <DeckListView
                  cards={processedDeckCards}
                  onCardHover={setHoveredCardInList}
                  onCardLeave={() => setHoveredCardInList(null)}
                  onCardSelect={(id) => {
                      setSelectedCardInListId(id);
                      setPanToNodeId(id);
                  }}
                  selectedCardId={selectedCardInListId}
                  onCardDelete={(id) => setProcessedDeckCards(prev => prev.filter(c => c.id !== id))}
                  commanderId={commanderId}
                />
              </div>
            )}

            {/* Collection Only Tab */}
            {rightPanelTab === 'collection' && (
              <div className="flex-grow min-h-0 border-t border-gray-800/80 pt-1 flex flex-col overflow-hidden">
                <MtgaCollectionDrawer
                  isOpen={true}
                  embedded={true}
                  onClose={() => setRightPanelTab('deck')}
                  cards={mtgaCards}
                  isLoading={isMtgaLoading}
                  error={mtgaError}
                  onRefresh={loadMtgaCollectionData}
                  onAddCardToDeck={handleAddCardToVisualizer}
                  commanderCard={processedDeckCards.find(c => c.id === commanderId) || null}
                  deckCards={processedDeckCards}
                  onCardHover={(card) => {
                    if (card) {
                      setHoveredCardInList({
                        id: normalizeCardName(card.title),
                        name: card.title,
                        quantity: card.quantity,
                        keywords: [card.primaryType.toLowerCase()],
                        text: card.typeText,
                        imageUrl: card.imageUrl,
                        manaCostString: card.manaCost,
                        typeLine: card.typeText,
                        colors: card.colors
                      });
                    } else {
                      setHoveredCardInList(null);
                    }
                  }}
                />
              </div>
            )}

            {/* Split View Tab */}
            {rightPanelTab === 'split' && (
              <div className="flex-grow min-h-0 flex flex-col space-y-2 divide-y divide-gray-800/80 overflow-hidden">
                {/* Top Half: Deck List */}
                <div className="h-[42%] min-h-[160px] flex flex-col pt-1 overflow-hidden">
                  <DeckListView
                    cards={processedDeckCards}
                    onCardHover={setHoveredCardInList}
                    onCardLeave={() => setHoveredCardInList(null)}
                    onCardSelect={(id) => {
                        setSelectedCardInListId(id);
                        setPanToNodeId(id);
                    }}
                    selectedCardId={selectedCardInListId}
                    onCardDelete={(id) => setProcessedDeckCards(prev => prev.filter(c => c.id !== id))}
                    commanderId={commanderId}
                  />
                </div>

                {/* Bottom Half: Collection Browser */}
                <div className="h-[58%] min-h-[220px] flex flex-col pt-2 overflow-hidden">
                  <MtgaCollectionDrawer
                    isOpen={true}
                    embedded={true}
                    onClose={() => setRightPanelTab('deck')}
                    cards={mtgaCards}
                    isLoading={isMtgaLoading}
                    error={mtgaError}
                    onRefresh={loadMtgaCollectionData}
                    onAddCardToDeck={handleAddCardToVisualizer}
                    commanderCard={processedDeckCards.find(c => c.id === commanderId) || null}
                    deckCards={processedDeckCards}
                    onCardHover={(card) => {
                      if (card) {
                        setHoveredCardInList({
                          id: normalizeCardName(card.title),
                          name: card.title,
                          quantity: card.quantity,
                          keywords: [card.primaryType.toLowerCase()],
                          text: card.typeText,
                          imageUrl: card.imageUrl,
                          manaCostString: card.manaCost,
                          typeLine: card.typeText,
                          colors: card.colors
                        });
                      } else {
                        setHoveredCardInList(null);
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </aside>
        ) : (
          <button
            onClick={() => {
              setShowRightSidebar(true);
              setRightPanelTab('split');
            }}
            className={`fixed right-3 z-30 p-2.5 bg-gray-900/90 hover:bg-gray-800 text-cyan-400 hover:text-white rounded-lg border border-cyan-700/60 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-bold transition-all active:scale-95 ${
              drawnSampleHand ? 'top-28' : 'top-16'
            }`}
            title="Open Right Panel (Deck & Collection)"
          >
            <span>📋 Open Deck & Collection Panel</span>
          </button>
        )}
      </div>

      {/* Modals */}
      <CommanderSelectionModal
        isOpen={showCommanderSelectionModal}
        onClose={() => setShowCommanderSelectionModal(false)}
        potentialCommanders={processedDeckCards.filter(isCardLegendaryCreature).length > 0 ? processedDeckCards.filter(isCardLegendaryCreature) : processedDeckCards}
        currentCommanderId={commanderId}
        onSetCommander={(card) => {
          setCommanderId(card.id);
          setShowCommanderSelectionModal(false);
        }}
        onCardImageClick={handleShowLargeImage}
      />

      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={(key, model, provider, endpoint) => {
          localStorage.setItem('GEMINI_API_KEY', key);
          if (provider) localStorage.setItem('AI_PROVIDER', provider);
          if (endpoint) localStorage.setItem('OLLAMA_ENDPOINT', endpoint);
          window.location.reload();
        }}
        currentProvider={aiClient?.type || 'gemini'}
      />

      <DeckAnalysisModal
        isOpen={showDeckAnalysisModal}
        onClose={() => setShowDeckAnalysisModal(false)}
        deck={processedDeckCards}
        aiClient={aiClient}
        onApplySuggestions={handleApplyDeckChanges}
      />

      <GoldfishSimulatorModal
        isOpen={showGoldfishSimulator}
        onClose={() => setShowGoldfishSimulator(false)}
        deck={processedDeckCards}
        drawnSampleHand={drawnSampleHand}
        commanderId={commanderId}
        onSetCommander={(card) => setCommanderId(card.id)}
        onCardClick={handleShowLargeImage}
      />

      <LargeCardImageModal
        isOpen={showLargeImageModal}
        onClose={() => setShowLargeImageModal(false)}
        card={largeImageModalCard}
      />

      <ManaCurveCardListModal
        isOpen={showManaCardListModal}
        onClose={() => setShowManaCardListModal(false)}
        title={manaListModalContent.title}
        cards={manaListModalContent.cards}
        onCardImageClick={handleShowLargeImage}
      />

      <ManaCurveCardListModal
        isOpen={showManaCurveCardListModal}
        onClose={() => setShowManaCurveCardListModal(false)}
        title={manaCurveModalContent.title}
        cards={manaCurveModalContent.cards}
        onCardImageClick={handleShowLargeImage}
      />

      <AddCardModal
        isOpen={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
        onAddCard={handleAddCardToVisualizer}
      />
    </div>
  );
};

export default App;

