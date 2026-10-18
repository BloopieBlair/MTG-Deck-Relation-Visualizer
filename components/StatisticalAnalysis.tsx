import React, { useMemo } from 'react';
import type { ProcessedDeckCard } from '../types';

interface StatisticalAnalysisProps {
  deck: ProcessedDeckCard[];
}

const HAND_SIZE = 7;
// This priority list determines how cards with multiple types are categorized.
// e.g., an "Artifact Creature" will be counted as a "creature".
const CARD_TYPE_PRIORITY: string[] = ["land", "creature", "planeswalker", "artifact", "enchantment", "instant", "sorcery"];

// Helper to calculate combinations C(n, k) = n! / (k!(n-k)!)
// Calculated iteratively to avoid large numbers from factorials.
const combinations = (n: number, k: number): number => {
    if (k < 0 || k > n) {
        return 0;
    }
    if (k === 0 || k === n) {
        return 1;
    }
    // C(n, k) === C(n, n-k), using the smaller k is more efficient.
    if (k > n / 2) {
        k = n - k;
    }
    let res = 1;
    for (let i = 1; i <= k; i++) {
        res = res * (n - i + 1) / i;
    }
    return Math.round(res); // Round to handle potential floating point inaccuracies
};

interface DrawStat {
    type: string;
    count: number;
    probability: number; // Probability of drawing at least one in opening hand
}

export const StatisticalAnalysis: React.FC<StatisticalAnalysisProps> = ({ deck }) => {
    const analysisResults = useMemo((): DrawStat[] => {
        const totalDeckSize = deck.reduce((sum, card) => sum + card.quantity, 0);

        if (totalDeckSize < HAND_SIZE) {
            return [];
        }

        const typeCounts: Record<string, number> = {};
        CARD_TYPE_PRIORITY.forEach(type => typeCounts[type] = 0);
        typeCounts['other'] = 0;

        deck.forEach(card => {
            let categorized = false;
            const lowerCaseKeywords = card.keywords.map(k => k.toLowerCase());
            for (const type of CARD_TYPE_PRIORITY) {
                if (lowerCaseKeywords.includes(type)) {
                    typeCounts[type] += card.quantity;
                    categorized = true;
                    break;
                }
            }
            if (!categorized) {
                typeCounts['other'] += card.quantity;
            }
        });
        
        const results: DrawStat[] = [];
        const totalCombinations = combinations(totalDeckSize, HAND_SIZE);

        if (totalCombinations === 0) return []; // Avoid division by zero

        Object.entries(typeCounts).forEach(([type, count]) => {
            if (count > 0) {
                // Probability of NOT drawing any card of this type
                const combinationsWithoutType = combinations(totalDeckSize - count, HAND_SIZE);
                const probabilityOfNone = combinationsWithoutType / totalCombinations;
                
                // Probability of drawing at least one is 1 - P(none)
                const probabilityOfAtLeastOne = 1 - probabilityOfNone;

                results.push({
                    type: type.charAt(0).toUpperCase() + type.slice(1), // Capitalize
                    count,
                    probability: probabilityOfAtLeastOne,
                });
            }
        });

        return results;

    }, [deck]);

    if (analysisResults.length === 0) {
        return null;
    }

    return (
        <div className="bg-[#0d0d10] p-5 rounded-xl border border-white/[0.06] shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-white/[0.06]">
                <h4 className="font-display text-sm font-bold text-amber-300 tracking-wide">
                    Opening Hand Draw Analysis (7 Cards)
                </h4>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    Hypergeometric P(X ≥ 1)
                </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                {analysisResults.map(stat => (
                    <div key={stat.type} className="p-2.5 rounded-lg bg-zinc-900/40 border border-white/[0.04]">
                        <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-xs font-medium text-zinc-200">
                                {stat.type} <span className="text-[11px] font-mono text-zinc-500">({stat.count})</span>
                            </span>
                            <span className="text-xs font-mono font-semibold text-amber-300">
                                {(stat.probability * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-zinc-950 border border-white/[0.05] rounded-full h-2 overflow-hidden" title={`Chance to draw at least one: ${(stat.probability * 100).toFixed(1)}%`}>
                            <div 
                                className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-300 h-full rounded-full transition-all duration-500 ease-out" 
                                style={{ width: `${stat.probability * 100}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-4 pt-3 border-t border-white/[0.05]">
                Exact hypergeometric probability of drawing at least one card of each primary type in an opening 7-card hand.
            </p>
        </div>
    );
};