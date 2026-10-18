import React, { useState, useEffect } from 'react';
import type { ProcessedDeckCard, AiClient } from '../types';
import { analyzeDeckWithGemini } from '../services/geminiService';
import { XMarkIcon, SparklesIcon, KeyIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';

interface DeckAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: ProcessedDeckCard[];
  aiClient: AiClient | null;
  commanderId: string | null;
  onOpenAiSetup?: () => void;
}

export const DeckAnalysisModal: React.FC<DeckAnalysisModalProps> = ({
  isOpen,
  onClose,
  deck,
  aiClient,
  commanderId,
  onOpenAiSetup
}) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Retain analysis across re-opens unless deck changes
    }
  }, [isOpen]);

  const handleAnalyze = async () => {
    if (!aiClient) return;
    setIsLoading(true);
    try {
      const result = await analyzeDeckWithGemini(aiClient, deck, commanderId);
      setAnalysis(result);
    } catch {
      setAnalysis("Error analyzing deck. Please check your AI connection settings and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const providerLabel = aiClient?.type === 'openrouter'
    ? `OpenRouter (${aiClient.openRouterModel || 'Free Model'})`
    : aiClient?.type === 'local'
      ? `Local Ollama (${aiClient.localModel || 'llama3'})`
      : aiClient?.type === 'gemini'
        ? 'Google Gemini 2.5 Flash'
        : 'Not Connected';

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-[#0d0d10] border border-white/[0.1] rounded-xl w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/[0.06] bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/25">
              <SparklesIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-zinc-100 tracking-wide">AI Deck Intelligence</h2>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                Engine: {providerLabel}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#09090b]">
          {!aiClient ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <KeyIcon className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="font-display text-base font-bold text-zinc-100">Connect Free AI via OpenRouter or Gemini</h3>
              <p className="text-zinc-400 max-w-md text-xs leading-relaxed">
                To keep Aethergraph 100% free and never touch customer funds, AI analysis runs directly through your own OpenRouter account (supports 100% free models like DeepSeek R1 &amp; Gemini 2.0 Flash), Google Gemini API key, or local Ollama server.
              </p>
              {onOpenAiSetup && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAiSetup();
                  }}
                  className="px-5 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2 text-xs"
                >
                  <SparklesIcon className="w-4 h-4 text-amber-400" />
                  Connect OpenRouter / AI Key (10 Seconds)
                </button>
              )}
            </div>
          ) : !analysis && !isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-90">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <SparklesIcon className="w-10 h-10 text-amber-400" />
              </div>
              <p className="text-zinc-300 max-w-md text-xs leading-relaxed">
                Analyze your deck&apos;s archetype, power level, win conditions, orphan cuts, and high-synergy upgrade recommendations using <strong className="text-amber-300">{providerLabel}</strong>.
              </p>
              <button 
                onClick={handleAnalyze}
                disabled={deck.length === 0}
                className="px-6 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-semibold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                {deck.length === 0 ? "Load a Deck First" : "Generate Full Deck Report"}
              </button>
            </div>
          ) : null}

          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <LoadingSpinner />
              <p className="text-amber-400 font-mono text-xs tracking-wider animate-pulse">ANALYZING DECK ARCHETYPE &amp; SYNERGIES...</p>
            </div>
          )}

          {analysis && !isLoading && (
            <div className="prose prose-invert prose-sm max-w-none">
              {analysis.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h2 key={i} className="font-display text-lg font-bold text-amber-300 mt-6 mb-3 border-b border-white/[0.08] pb-1.5">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-zinc-100 mt-4 mb-2">{line.replace('### ', '')}</h3>;
                if (line.startsWith('**') && line.includes(':')) {
                  const parts = line.split(':');
                  return <p key={i} className="mb-2 text-zinc-300"><strong className="text-amber-200/90">{parts[0].replace(/\*\*/g, '')}:</strong>{parts.slice(1).join(':')}</p>;
                }
                if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-zinc-300 list-disc marker:text-amber-500 pl-1 mb-1">{line.substring(2)}</li>;
                if (line.match(/^\d+\./)) return <li key={i} className="ml-4 text-zinc-300 list-decimal marker:text-amber-400 pl-1 mb-1">{line.replace(/^\d+\.\s*/, '')}</li>;
                if (line.trim() === '') return <br key={i} />;
                return <p key={i} className="text-zinc-300 mb-2 leading-relaxed">{line}</p>;
              })}
            </div>
          )}
        </div>

        {analysis && (
          <div className="px-6 py-3.5 border-t border-white/[0.06] bg-zinc-950/80 flex justify-end">
            <button 
              onClick={handleAnalyze}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 border border-white/[0.08] hover:border-white/[0.2] rounded-md transition-colors mr-auto"
            >
              Regenerate Analysis
            </button>
            <button 
              onClick={onClose}
              className="px-5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 font-semibold rounded-md transition-colors text-xs"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
