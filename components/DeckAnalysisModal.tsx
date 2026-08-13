import React, { useState, useEffect } from 'react';
import type { ProcessedDeckCard, AiClient } from '../types';
import { analyzeDeckWithGemini } from '../services/geminiService';
import { XMarkIcon, SparklesIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';

interface DeckAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: ProcessedDeckCard[];
  aiClient: AiClient | null;
  commanderId: string | null;
}

export const DeckAnalysisModal: React.FC<DeckAnalysisModalProps> = ({ isOpen, onClose, deck, aiClient, commanderId }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
        // Optional: clear analysis on close? Keeping it might be better for re-opening.
    }
  }, [isOpen]);

  const handleAnalyze = async () => {
    if (!aiClient) return;
    setIsLoading(true);
    try {
        const result = await analyzeDeckWithGemini(aiClient, deck, commanderId);
        setAnalysis(result);
    } catch (e) {
        setAnalysis("Error analyzing deck. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-gray-900 border border-cyan-600/50 rounded-xl w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gray-950">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/30">
                <SparklesIcon className="w-6 h-6 text-purple-400" />
             </div>
             <div>
                <h2 className="text-xl font-bold text-white tracking-tight">AI Deck Intelligence</h2>
                <p className="text-xs text-gray-400 uppercase tracking-widest">
                  Powered by {aiClient?.type === 'local' ? (aiClient.localModel || 'Local AI') : 'Gemini 3.5 Flash'}
                </p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-[#0B0C10]">
            {!analysis && !isLoading && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                    <SparklesIcon className="w-16 h-16 text-gray-600" />
                    <p className="text-gray-400 max-w-md">
                        {aiClient?.type === 'local' 
                          ? "Ask your local AI model to analyze your deck's synergy, power level, and win conditions. This process runs entirely on your local machine." 
                          : "Ask Gemini to analyze your deck's synergy, power level, and win conditions. This process sends your decklist to Google's AI model."}
                    </p>
                    <button 
                        onClick={handleAnalyze}
                        disabled={!aiClient || deck.length === 0}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {deck.length === 0 ? "Deck is Empty" : "Generate Analysis"}
                    </button>
                </div>
            )}

            {isLoading && (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                    <LoadingSpinner />
                    <p className="text-cyan-400 font-mono text-sm animate-pulse">ANALYZING DECK ARCHETYPE...</p>
                </div>
            )}

            {analysis && (
                <div className="prose prose-invert prose-sm max-w-none">
                    {analysis.split('\n').map((line, i) => {
                        // Simple Markdown-ish rendering
                        if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-cyan-400 mt-6 mb-3 border-b border-cyan-900/30 pb-1">{line.replace('## ', '')}</h2>;
                        if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold text-purple-400 mt-4 mb-2">{line.replace('### ', '')}</h3>;
                        if (line.startsWith('**') && line.includes(':')) {
                            const parts = line.split(':');
                            return <p key={i} className="mb-2"><strong className="text-gray-200">{parts[0].replace(/\*\*/g, '')}:</strong>{parts.slice(1).join(':')}</p>;
                        }
                        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-gray-300 list-disc marker:text-cyan-600 pl-1 mb-1">{line.substring(2)}</li>;
                        if (line.match(/^\d+\./)) return <li key={i} className="ml-4 text-gray-300 list-decimal marker:text-purple-500 pl-1 mb-1">{line.replace(/^\d+\.\s*/, '')}</li>;
                        if (line.trim() === '') return <br key={i} />;
                        return <p key={i} className="text-gray-300 mb-2 leading-relaxed">{line}</p>;
                    })}
                </div>
            )}
        </div>

        {analysis && (
             <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-end">
                <button 
                    onClick={handleAnalyze}
                    className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors mr-auto"
                >
                    Regenerate Analysis
                </button>
                <button 
                    onClick={onClose}
                    className="px-6 py-2 bg-cyan-700 hover:bg-cyan-600 text-white font-semibold rounded-lg shadow-md transition-colors"
                >
                    Close
                </button>
             </div>
        )}
      </div>
    </div>
  );
};
