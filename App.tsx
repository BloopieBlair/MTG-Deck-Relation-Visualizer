
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
import { ExportDeckModal } from './components/ExportDeckModal';
import { CommanderSelectionModal } from './components/CommanderSelectionModal'; 
import { DeckListView } from './components/DeckListView';
import { HoveredCardDisplay } from './components/HoveredCardDisplay';
import { GoldfishSimulatorModal } from './components/GoldfishSimulatorModal';
import { MtgaCollectionDrawer } from './components/MtgaCollectionDrawer';
import { FooterBanner } from './components/FooterBanner';
import { fetchMtgaCollection } from './services/mtgaLogService';
import { PINNED_SEARCH_COLORS, ACTIVE_SEARCH_HIGHLIGHT_COLOR, SINGLE_SEARCH_RESULT_HIGHLIGHT_COLOR, DEFAULT_KEYWORD_STYLES, MOCK_CARD_DATABASE, SAMPLE_DECK_ANIM_PAKAL, SAMPLE_DECK_SLIVERS } from './constants';
import { parseCsvContent } from './services/csvParser';
import { fetchCardDataFromScryfall, fetchCardsBatch, parseScryfallManaCost, normalizeCardName } from './services/scryfallService';
import { parseDecklistWithGemini, fetchCardKeywordsWithGemini, exchangeOpenRouterCodeForKey, DEFAULT_OPENROUTER_MODEL } from './services/geminiService';
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
  const [showExportDeckModal, setShowExportDeckModal] = useState<boolean>(false);

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
    const mode = localStorage.getItem('ai_mode') || 'openrouter';

    if (mode === 'openrouter') {
      const orKey = (localStorage.getItem('openrouter_api_key') || '').trim();
      const orModel = localStorage.getItem('openrouter_model') || DEFAULT_OPENROUTER_MODEL;
      if (!orKey) {
        setAiError(null);
        setAiPoweredFeaturesEnabled(false);
        setAiClient(null);
        setIsInitializingAI(false);
        return;
      }
      setAiClient({
        type: 'openrouter',
        openRouterKey: orKey,
        openRouterModel: orModel,
      });
      setAiPoweredFeaturesEnabled(true);
      setAiError(null);
      setIsInitializingAI(false);
    } else if (mode === 'local') {
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
        setAiError(null);
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

    // Handle OpenRouter OAuth PKCE callback if returning with ?code=...
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get('code');
    if (oauthCode) {
      const verifier = sessionStorage.getItem('openrouter_pkce_verifier');
      // Clean URL query params immediately
      window.history.replaceState({}, document.title, window.location.pathname);
      exchangeOpenRouterCodeForKey(oauthCode, verifier)
        .then((newKey) => {
          localStorage.setItem('openrouter_api_key', newKey);
          localStorage.setItem('ai_mode', 'openrouter');
          localStorage.setItem('app_setup_completed', 'true');
          sessionStorage.removeItem('openrouter_pkce_verifier');
          initializeAI();
        })
        .catch((err) => {
          console.error('OpenRouter OAuth failed:', err);
          setAiError('OpenRouter connection failed. Please try again.');
          initializeAI();
        });
    } else {
      initializeAI();
    }
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
    setLoadingDetailMessage("Parsing decklist...");

    try {
      const fileType = file.name.split('.').pop()?.toLowerCase();
      // Fast, deterministic rule-based parser first (instant, zero API cost)
      let parsedCards: RawDeckCard[] = fileType === 'csv'
        ? parseCsvContent(decklistText)
        : parseSimpleTxtDecklist(decklistText);

      // Only fall back to AI parser if rule-based parser found nothing and AI is connected
      if (parsedCards.length === 0 && aiClient && aiPoweredFeaturesEnabled) {
        setLoadingDetailMessage("Parsing decklist with AI...");
        try {
          parsedCards = await parseDecklistWithGemini(aiClient, decklistText);
        } catch (e) {
          console.warn("AI parsing failed:", e);
        }
      }

      const newProcessedCards = await fetchCardDataAndProcess(parsedCards, setLoadingDetailMessage);
      setProcessedDeckCards(newProcessedCards);

      // Auto-select Commander if the first card in the list is a legendary creature/planeswalker
      if (newProcessedCards.length > 0) {
        const firstCard = newProcessedCards[0];
        const tl = (firstCard.typeLine || '').toLowerCase();
        if (tl.includes('legendary') && (tl.includes('creature') || tl.includes('planeswalker'))) {
          setCommanderId(firstCard.id);
        }
      }
    } catch (e: any) {
      setError(`Failed to process deck: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchCardDataAndProcess, aiClient, aiPoweredFeaturesEnabled]);

  const handleLoadSampleDeck = useCallback((sampleType: 'animPakal' | 'slivers') => {
    const sampleText = sampleType === 'animPakal' ? SAMPLE_DECK_ANIM_PAKAL : SAMPLE_DECK_SLIVERS;
    const sampleFile = new File([sampleText], `${sampleType}.txt`, { type: 'text/plain' });
    processUploadedDeck(sampleText, sampleFile);
  }, [processUploadedDeck]);

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

  const handleSwapCard = useCallback(async (oldCardId: string, newCardName: string) => {
    if (!newCardName.trim()) return;
    setIsLoading(true);
    setLoadingDetailMessage(`Fetching data for "${newCardName}"...`);
    try {
      const scryfallData = await fetchCardDataFromScryfall(newCardName);
      if (scryfallData) {
        const replacement: ProcessedDeckCard = {
          id: normalizeCardName(scryfallData.nameScryfall || newCardName),
          name: scryfallData.nameScryfall || newCardName,
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
        setProcessedDeckCards(prev => prev.map(c => c.id === oldCardId ? { ...replacement, quantity: c.quantity } : c));
        if (commanderId === oldCardId) {
          setCommanderId(replacement.id);
        }
      }
    } catch (err) {
      console.error('Failed to swap card:', err);
    } finally {
      setIsLoading(false);
    }
  }, [commanderId]);

  const handleApplyDeckChanges = useCallback((suggestions: string[]) => {
    console.log("Applying deck changes:", suggestions);
  }, []);

  const isCardLegendaryCreature = useCallback((card: ProcessedDeckCard) => {
    const typeLineLower = (card.typeLine || '').toLowerCase();
    const keywordsLower = (card.keywords || []).map(k => k.toLowerCase());
    
    const isLegendary = typeLineLower.includes('legendary') || keywordsLower.includes('legendary');
    const isCreatureOrPlaneswalker = typeLineLower.includes('creature') || typeLineLower.includes('planeswalker') || keywordsLower.includes('creature') || keywordsLower.includes('planeswalker');

    return isLegendary && isCreatureOrPlaneswalker;
  }, []);

  const aiBadgeText = aiPoweredFeaturesEnabled
    ? aiClient?.type === 'openrouter'
      ? 'OpenRouter AI'
      : aiClient?.type === 'local'
        ? 'Local AI'
        : 'Gemini AI'
    : 'Connect Free AI';

  if (isInitializingAI) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-zinc-200">
        <LoadingSpinner />
        <p className="mt-3 text-amber-400/90 font-mono text-xs tracking-widest uppercase">Initializing Aethergraph Engine...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-200 text-sm flex flex-col select-none">
      {/* Main Full-Viewport Workspace (Scroll down past 100vh to view the single FooterBanner) */}
      <div className="flex flex-col h-screen overflow-hidden shrink-0">
        <header className="bg-zinc-950/95 backdrop-blur-md px-4 py-2.5 border-b border-zinc-800/80 flex items-center justify-between z-30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/40 flex items-center justify-center shadow-sm">
                <CrownIcon className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <h1 className="font-display text-lg font-bold tracking-wider text-zinc-100">
                  AETHERGRAPH
                </h1>
                <span className="hidden xl:inline text-[11px] font-medium text-zinc-500 tracking-wide">
                  MTG Synergy &amp; Manifold Studio
                </span>
              </div>
            </div>

            <div className="h-5 w-px bg-zinc-800 hidden md:block" />

            <div className="hidden md:flex bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800/90">
              <button
                onClick={() => setActiveTab('visualizer')}
                className={`px-3.5 py-1 rounded-md transition-all font-medium text-xs ${
                  activeTab === 'visualizer'
                    ? 'bg-zinc-800 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                Synergy Graph
              </button>
              <button
                onClick={() => setActiveTab('manaCurve')}
                className={`px-3.5 py-1 rounded-md transition-all font-medium text-xs ${
                  activeTab === 'manaCurve'
                    ? 'bg-zinc-800 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
              >
                Mana &amp; Odds
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {mtgaCards.length > 0 && (
              <button
                onClick={() => {
                  setShowRightSidebar(true);
                  setRightPanelTab(prev => prev === 'deck' ? 'split' : prev);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all text-xs font-medium text-zinc-300 group"
                title="Browse Local MTG Arena Collection in Right Sidebar"
              >
                <span className="text-amber-400/90">🎴</span>
                <span className="hidden sm:inline">Arena Collection</span>
                <span className="px-1.5 py-0.2 rounded bg-zinc-950 text-zinc-400 font-mono text-[10px] border border-zinc-800">
                  {mtgaCards.length.toLocaleString()}
                </span>
              </button>
            )}

            <button
              onClick={() => setShowApiKeyModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 hover:border-amber-500/40 transition-all text-xs font-medium text-zinc-200 group"
              title={aiError ? `AI Error: ${aiError} - Click to fix` : aiPoweredFeaturesEnabled ? `AI Active (${aiBadgeText})` : "Connect OpenRouter (Free Models), Gemini, or Local Ollama"}
            >
              <div className={`w-2 h-2 rounded-full ${
                aiError
                  ? 'bg-rose-500 animate-pulse'
                  : aiPoweredFeaturesEnabled
                    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                    : 'bg-amber-400'
              }`} />
              <span className="text-zinc-300 group-hover:text-amber-200 transition-colors">
                {aiBadgeText}
              </span>
            </button>

            {!showRightSidebar && (
              <button
                onClick={() => {
                  setShowRightSidebar(true);
                  setRightPanelTab('deck');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-200 rounded-lg border border-zinc-800 transition-all text-xs font-medium"
                title="Open Right Inspector Panel"
              >
                <span>Inspector</span>
              </button>
            )}

            <ZoomControl zoomLevel={zoomLevel} onZoomChange={setZoomLevel} />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 lg:w-72 bg-[#0c0c0e] p-3.5 space-y-5 overflow-y-auto custom-scrollbar border-r border-zinc-800/80 shadow-2xl z-20">
            <FileUpload
              onFileUpload={processUploadedDeck}
              onLoadSampleDeck={handleLoadSampleDeck}
              disabled={isLoading}
            />
            
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest border-b border-zinc-800/80 pb-1.5">
                Workbench &amp; Simulation
              </h3>

              {/* Primary Hero CTA: AI Deck Intelligence */}
              <button 
                onClick={() => setShowDeckAnalysisModal(true)} 
                disabled={processedDeckCards.length === 0}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-gradient-to-r from-amber-500/20 via-amber-500/15 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/40 rounded-lg text-xs font-semibold text-amber-200 shadow-sm transition-all active:scale-98 disabled:opacity-35"
              >
                <SparklesIcon className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{aiClient ? `AI Deck Report (${aiBadgeText})` : 'AI Deck Report (Free Setup)'}</span>
              </button>

              {/* Secondary Tactical Tool Grid */}
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button 
                  onClick={handleDrawHand} 
                  disabled={processedDeckCards.length === 0}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-md text-xs font-medium text-zinc-200 transition-all active:scale-95 disabled:opacity-35"
                  title="Draw a random 7-card sample opening hand"
                >
                  <HandIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Sample Hand</span>
                </button>
                <button 
                  onClick={() => {
                    if (!drawnSampleHand || drawnSampleHand.length === 0) {
                      handleDrawHand();
                    }
                    setShowGoldfishSimulator(true);
                  }} 
                  disabled={processedDeckCards.length === 0}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-md text-xs font-medium text-zinc-200 transition-all active:scale-95 disabled:opacity-35"
                  title="Simulate Turns 1-6 opening play sequences"
                >
                  <SparklesIcon className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                  <span>Goldfish Sim</span>
                </button>
                <button 
                  onClick={() => setShowCommanderSelectionModal(true)} 
                  disabled={processedDeckCards.length === 0}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-md text-xs font-medium text-zinc-200 transition-all active:scale-95 disabled:opacity-35"
                  title="Assign or change your deck's Commander"
                >
                  <CrownIcon className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
                  <span>Commander</span>
                </button>
                <button 
                  onClick={() => setShowExportDeckModal(true)} 
                  disabled={processedDeckCards.length === 0}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-md text-xs font-medium text-zinc-200 transition-all active:scale-95 disabled:opacity-35"
                  title="Export decklist to Arena / Moxfield / Text"
                >
                  <DownloadIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Export List</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest border-b border-zinc-800/80 pb-1.5">
                Filter &amp; Edit Deck
              </h3>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Highlight card or oracle text..."
                  value={activeSearchTerm}
                  onChange={(e) => setActiveSearchTerm(e.target.value)}
                  className="flex-grow bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 outline-none transition-all placeholder-zinc-600"
                />
                <button
                  onClick={handlePinSearch}
                  className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-md transition-colors border border-zinc-800 text-amber-400/90"
                  title="Pin search highlight (up to 3 colors)"
                >
                  <MapPinIcon className="w-4 h-4"/>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => setShowAddCardModal(true)}
                  className="py-1.5 px-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-md text-xs font-medium text-zinc-300 border border-zinc-800 transition-all flex items-center justify-center gap-1.5"
                >
                  <PlusIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Add Card</span>
                </button>
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="py-1.5 px-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-md text-xs font-medium text-zinc-300 border border-zinc-800 transition-all flex items-center justify-center gap-1.5 disabled:opacity-30"
                >
                  <ArrowUturnLeftIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Undo</span>
                </button>
              </div>
            </div>

            <KeywordManager keywordStyles={keywordStyles} onKeywordStylesChange={setKeywordStyles} />

            {processedDeckCards.length > 0 && (
              <Legend keywordStyles={keywordStyles.filter(k => k.enabled)} highlightedKeywords={highlightedKeywords} />
            )}
          </aside>

          <main
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            className="flex-1 flex flex-col overflow-hidden bg-[#09090b] relative"
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
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                  <LoadingSpinner />
                  <p className="mt-4 text-amber-300 font-mono text-xs animate-pulse uppercase tracking-[0.2em]">{loadingDetailMessage || 'Processing Deck...'}</p>
              </div>
            )}
          </main>

          {showRightSidebar ? (
            <aside className={`bg-[#0c0c0e] p-3 flex flex-col space-y-3 border-l border-zinc-800/80 shadow-2xl z-20 transition-all duration-300 ${
              rightPanelTab === 'deck' 
                ? 'w-72 lg:w-80' 
                : 'w-[440px] lg:w-[490px] xl:w-[540px]'
            }`}>
              {/* Right Sidebar Header / Tab Control */}
              <div className="bg-zinc-900/80 p-1 rounded-lg border border-zinc-800/90 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setRightPanelTab('deck')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                      rightPanelTab === 'deck'
                        ? 'bg-zinc-800 text-amber-300 border border-amber-500/30 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                    }`}
                    title="View Deck List"
                  >
                    <span>Decklist</span>
                    <span className="px-1.5 py-0.2 rounded bg-zinc-950 text-zinc-300 font-mono text-[10px] border border-zinc-800">
                      {processedDeckCards.reduce((sum, c) => sum + c.quantity, 0)}
                    </span>
                  </button>

                  {mtgaCards.length > 0 && (
                    <>
                      <button
                        onClick={() => setRightPanelTab('collection')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                          rightPanelTab === 'collection'
                            ? 'bg-zinc-800 text-amber-300 border border-amber-500/30 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                        }`}
                        title="Browse MTG Arena Collection"
                      >
                        <span>Arena</span>
                        <span className="px-1.5 py-0.2 rounded bg-zinc-950 text-zinc-400 font-mono text-[10px] border border-zinc-800">
                          {mtgaCards.length.toLocaleString()}
                        </span>
                      </button>

                      <button
                        onClick={() => setRightPanelTab('split')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                          rightPanelTab === 'split'
                            ? 'bg-zinc-800 text-amber-300 border border-amber-500/30 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                        }`}
                        title="Split View: Deck List on Top, MTGA Collection on Bottom"
                      >
                        <span>Split</span>
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setShowRightSidebar(false)}
                  className="p-1 text-zinc-500 hover:text-zinc-200 rounded-md hover:bg-zinc-800 transition-colors"
                  title="Hide Inspector Panel"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Hovered Card Image Preview Box */}
              <div className="shrink-0 flex justify-center py-0.5">
                <HoveredCardDisplay 
                  card={hoveredCardInList || (rightPanelTab === 'deck' || rightPanelTab === 'split' ? selectedCard : null)} 
                  deckCards={processedDeckCards}
                />
              </div>

              {/* Deck List Only Tab */}
              {rightPanelTab === 'deck' && (
                <div className="flex-grow min-h-0 border-t border-zinc-800/80 pt-2.5 flex flex-col">
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
                <div className="flex-grow min-h-0 border-t border-zinc-800/80 pt-1 flex flex-col overflow-hidden">
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
                <div className="flex-grow min-h-0 flex flex-col space-y-2 divide-y divide-zinc-800/80 overflow-hidden">
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
                setRightPanelTab('deck');
              }}
              className={`fixed right-3 z-30 px-3 py-2 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-amber-200 rounded-lg border border-zinc-700/80 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-medium transition-all active:scale-95 ${
                drawnSampleHand ? 'top-28' : 'top-16'
              }`}
              title="Open Right Inspector Panel"
            >
              <span>Inspector Panel</span>
            </button>
          )}
        </div>
      </div>

      {/* Single Respectful Below-the-Fold Banner & Indie Supporter Bar */}
      <FooterBanner
        commanderCard={processedDeckCards.find(c => c.id === commanderId) || null}
        deckCount={processedDeckCards.length}
        onOpenAiSetup={() => setShowApiKeyModal(true)}
      />

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
        onSave={() => {
          initializeAI();
          setShowApiKeyModal(false);
        }}
      />

      <DeckAnalysisModal
        isOpen={showDeckAnalysisModal}
        onClose={() => setShowDeckAnalysisModal(false)}
        deck={processedDeckCards}
        aiClient={aiClient}
        commanderId={commanderId}
        onOpenAiSetup={() => setShowApiKeyModal(true)}
      />

      <ExportDeckModal
        isOpen={showExportDeckModal}
        onClose={() => setShowExportDeckModal(false)}
        deck={processedDeckCards}
        commanderId={commanderId}
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

