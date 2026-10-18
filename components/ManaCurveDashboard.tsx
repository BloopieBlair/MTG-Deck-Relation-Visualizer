import React, { useMemo } from 'react';
import type { ProcessedDeckCard, ParsedManaCost, ManaColor } from '../types';
import { ManaWIcon, ManaUIcon, ManaBIcon, ManaRIcon, ManaGIcon, ManaCIcon } from './icons';
import { StatisticalAnalysis } from './StatisticalAnalysis';

export interface ManaCurveModalRequest {
  cmcLabel: string;
  targetColor?: ManaColor;
  pipIntensity?: '1-pip' | '2-pips' | '3+-pips';
  isGenericColorlessInColorCurve?: boolean;
  isTotalCurve: boolean;
}

interface ManaCurveDashboardProps {
  deck: ProcessedDeckCard[];
  onShowCardsForSegment: (request: ManaCurveModalRequest) => void;
}

const MAX_CMC_DISPLAY = 7;
const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

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

const getCardColors = (cost?: ParsedManaCost): ManaColor[] => {
  if (!cost) return [];
  const colors: ManaColor[] = [];
  if (cost.W) colors.push('W');
  if (cost.U) colors.push('U');
  if (cost.B) colors.push('B');
  if (cost.R) colors.push('R');
  if (cost.G) colors.push('G');
  if (cost.C && colors.length === 0) colors.push('C');
  else if (cost.C && !colors.includes('C')) colors.push('C');
  return colors;
};

const getPipIntensityLabel = (pips: number): '1-pip' | '2-pips' | '3+-pips' => {
  if (pips === 1) return '1-pip';
  if (pips === 2) return '2-pips';
  return '3+-pips';
};

const COLOR_MAP: Record<string, { label: string; icon: React.FC<{className?: string}>; barColor: string; headerColor: string; pipColors: Record<string, string> }> = {
  Total: { 
    label: 'Total Mana Curve', 
    icon: () => null, 
    barColor: 'bg-amber-500', 
    headerColor: 'text-amber-300',
    pipColors: {} 
  },
  W: { 
    label: 'White Mana Curve', 
    icon: ManaWIcon, 
    barColor: 'bg-amber-200',
    headerColor: 'text-amber-100',
    pipColors: { '1-pip': 'bg-amber-100/85', '2-pips': 'bg-amber-200/90', '3+-pips': 'bg-amber-300/95', 'genericColorless': 'bg-amber-50/50' }
  },
  U: { 
    label: 'Blue Mana Curve', 
    icon: ManaUIcon, 
    barColor: 'bg-sky-400',
    headerColor: 'text-sky-300',
    pipColors: { '1-pip': 'bg-sky-300/85', '2-pips': 'bg-sky-400/90', '3+-pips': 'bg-sky-500/95', 'genericColorless': 'bg-sky-200/50' }
  },
  B: { 
    label: 'Black Mana Curve', 
    icon: ManaBIcon, 
    barColor: 'bg-zinc-400',
    headerColor: 'text-zinc-300',
    pipColors: { '1-pip': 'bg-zinc-400/85', '2-pips': 'bg-zinc-500/90', '3+-pips': 'bg-zinc-600/95', 'genericColorless': 'bg-zinc-300/50' }
  },
  R: { 
    label: 'Red Mana Curve', 
    icon: ManaRIcon, 
    barColor: 'bg-rose-400',
    headerColor: 'text-rose-300',
    pipColors: { '1-pip': 'bg-rose-300/85', '2-pips': 'bg-rose-400/90', '3+-pips': 'bg-rose-500/95', 'genericColorless': 'bg-rose-200/50' }
  },
  G: { 
    label: 'Green Mana Curve', 
    icon: ManaGIcon, 
    barColor: 'bg-emerald-400',
    headerColor: 'text-emerald-300',
    pipColors: { '1-pip': 'bg-emerald-300/85', '2-pips': 'bg-emerald-400/90', '3+-pips': 'bg-emerald-500/95', 'genericColorless': 'bg-emerald-200/50' }
  },
  C: { 
    label: 'Colorless Mana Curve', 
    icon: ManaCIcon, 
    barColor: 'bg-stone-400',
    headerColor: 'text-stone-300',
    pipColors: { '1-pip': 'bg-stone-300/85', '2-pips': 'bg-stone-400/90', '3+-pips': 'bg-stone-500/95', 'genericColorless': 'bg-stone-200/50' }
  },
};

interface BarSegment {
  count: number;
  colorClass: string;
  pipIntensity?: '1-pip' | '2-pips' | '3+-pips';
  isGenericColorless?: boolean;
}

interface CurveBar {
  cmcLabel: string;
  totalCount: number;
  segments: BarSegment[];
}

const SmallManaCurveChart: React.FC<{ 
    title: string; 
    data: CurveBar[]; 
    maxBarHeightValue: number; 
    icon: React.FC<{className?: string}>;
    onSegmentClick: (request: ManaCurveModalRequest) => void;
    colorKey: string;
}> = ({ title, data, maxBarHeightValue, onSegmentClick, icon: Icon, colorKey }) => {
  const isTotal = colorKey === 'Total';
  const headerAccent = COLOR_MAP[colorKey]?.headerColor || 'text-amber-300';

  // Generate steps of 5 for the Y-axis
  const yAxisSteps = [];
  for (let i = maxBarHeightValue; i >= 0; i -= 5) {
      yAxisSteps.push(i);
  }
  if (!yAxisSteps.includes(0)) yAxisSteps.push(0);

  return (
    <div className="bg-[#0d0d10] rounded-xl border border-white/[0.06] p-4 flex flex-col h-full shadow-lg hover:border-white/[0.11] transition-colors">
      <div className="flex items-center justify-between mb-4 border-b border-white/[0.06] pb-2.5">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${headerAccent}`} />
          <h4 className={`text-[11px] font-semibold uppercase tracking-widest ${headerAccent}`}>{title}</h4>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">
          {data.reduce((s, b) => s + b.totalCount, 0)} spells
        </span>
      </div>

      <div className="flex-1 relative min-h-[125px] ml-6 mb-5 mt-2">
        {/* Y-Axis Labels & Horizontal Grid Lines */}
        <div className="absolute inset-0 pointer-events-none">
          {yAxisSteps.map((step) => {
              const bottomPct = maxBarHeightValue > 0 ? (step / maxBarHeightValue) * 100 : 0;
              return (
                  <div key={step} className="absolute left-0 right-0 z-0" style={{ bottom: `${bottomPct}%` }}>
                      <span className="absolute -left-6 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 w-5 text-right font-mono">{step}</span>
                      <div className="w-full border-t border-white/[0.05] border-dashed" />
                  </div>
              );
          })}
        </div>

        {/* Bars Container */}
        <div className="absolute inset-0 flex items-end justify-between z-10">
          {data.map((bar, index) => {
            const barHeightPercentage = maxBarHeightValue > 0 ? (bar.totalCount / maxBarHeightValue) * 100 : 0;
            return (
              <div key={index} className="flex flex-col items-center justify-end h-full group relative flex-1">
                {bar.totalCount > 0 && (
                  <span className="text-[9px] font-mono text-zinc-400 group-hover:text-amber-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {bar.totalCount}
                  </span>
                )}
                <div 
                  className="w-full max-w-[1.5rem] cursor-pointer rounded-t-sm overflow-hidden transition-all duration-300 hover:scale-x-110 flex flex-col-reverse"
                  style={{ height: `${barHeightPercentage}%` }}
                  onClick={() => {
                    if (bar.totalCount > 0) {
                      onSegmentClick({
                        cmcLabel: bar.cmcLabel,
                        isTotalCurve: isTotal,
                        targetColor: isTotal ? undefined : colorKey as ManaColor
                      });
                    }
                  }}
                >
                  {isTotal ? (
                     <div className="w-full h-full bg-gradient-to-t from-amber-600 via-amber-500 to-amber-300 hover:from-amber-500 hover:to-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)]" />
                  ) : (
                    bar.segments.map((seg, si) => (
                      <div 
                        key={si} 
                        className={`w-full ${seg.colorClass}`} 
                        style={{ height: `${(seg.count / bar.totalCount) * 100}%` }} 
                      />
                    ))
                  )}
                </div>
                {/* CMC Label below the chart */}
                <span className="absolute -bottom-5 text-[10px] font-mono text-zinc-500 group-hover:text-amber-300">{bar.cmcLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const ManaCurveDashboard: React.FC<ManaCurveDashboardProps> = ({ deck, onShowCardsForSegment }) => {
  const curveData = useMemo(() => {
    const filteredDeck = deck.filter(card => !card.keywords.map(k => k.toLowerCase()).includes('land'));
    
    const initBins = () => {
        const bins: Record<string, any> = {};
        for (let i = 0; i <= MAX_CMC_DISPLAY; i++) {
             bins[i.toString()] = { total: 0, byPipIntensity: { '1-pip': 0, '2-pips': 0, '3+-pips': 0, genericColorless: 0 } };
        }
        bins[`${MAX_CMC_DISPLAY + 1}+`] = { total: 0, byPipIntensity: { '1-pip': 0, '2-pips': 0, '3+-pips': 0, genericColorless: 0 } };
        return bins;
    };

    const totalBins = initBins();
    const colorBins: Record<string, any> = {};
    MANA_COLORS.forEach(c => colorBins[c] = initBins());

    filteredDeck.forEach(card => {
      const cmc = getCMC(card.parsedManaCost);
      const cmcLabel = cmc <= MAX_CMC_DISPLAY ? cmc.toString() : `${MAX_CMC_DISPLAY + 1}+`;
      const qty = card.quantity;

      totalBins[cmcLabel].total += qty;

      const colors = getCardColors(card.parsedManaCost);
      MANA_COLORS.forEach(c => {
        let include = false;
        let pips = 0;
        let isGenC = false;

        if (c === 'C') {
             const hasColoredPips = colors.some(col => col !== 'C' && card.parsedManaCost?.[col]);
             if (!hasColoredPips && (!card.parsedManaCost || Object.keys(card.parsedManaCost).every(k => ['Generic','C','X'].includes(k)))) {
                 include = true; isGenC = true; pips = card.parsedManaCost?.C || 0;
             } else if (card.parsedManaCost?.C) {
                 include = true; pips = card.parsedManaCost.C;
             }
        } else if (colors.includes(c) && card.parsedManaCost?.[c]) {
             include = true; pips = card.parsedManaCost[c]!;
        }

        if (include) {
            colorBins[c][cmcLabel].total += qty;
            const dest = colorBins[c][cmcLabel].byPipIntensity!;
            if (isGenC && c === 'C') dest.genericColorless = (dest.genericColorless || 0) + qty;
            else dest[getPipIntensityLabel(pips)] += qty;
        }
      });
    });

    const format = (bins: any, colorKey: string): CurveBar[] => {
        return Object.entries(bins).map(([cmcLabel, d]: [string, any]) => {
            const segments: BarSegment[] = [];
            if (colorKey !== 'Total' && d.byPipIntensity) {
                const keys: any[] = colorKey === 'C' ? ['genericColorless', '1-pip', '2-pips', '3+-pips'] : ['1-pip', '2-pips', '3+-pips'];
                keys.forEach(k => {
                    if (d.byPipIntensity[k] > 0) {
                        segments.push({ count: d.byPipIntensity[k], colorClass: COLOR_MAP[colorKey].pipColors[k] });
                    }
                });
            }
            return { cmcLabel, totalCount: d.total, segments };
        }).sort((a,b) => (a.cmcLabel.includes('+') ? 100 : parseInt(a.cmcLabel)) - (b.cmcLabel.includes('+') ? 100 : parseInt(b.cmcLabel)));
    };

    const results: Record<string, CurveBar[]> = { Total: format(totalBins, 'Total') };
    MANA_COLORS.forEach(c => results[c] = format(colorBins[c], c));

    let rawMax = 0;
    Object.values(results).flat().forEach(b => rawMax = Math.max(rawMax, b.totalCount));

    // Ensure the scale is in steps of 5, minimum 20
    const max = Math.max(Math.ceil(rawMax / 5) * 5, 20);

    return { results, max };
  }, [deck]);

  if (deck.length === 0) return null;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-6 bg-[#09090b]">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="font-display text-lg font-bold text-zinc-100 tracking-wide">Mana Curve &amp; Hypergeometric Distribution</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Click any mana value column to inspect cards in that slot</p>
        </div>
        <span className="text-[11px] font-mono text-amber-300/90 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-md">
          Scale Max: {curveData.max} cards
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Total Chart - Always first */}
        <div className="md:col-span-1">
             <SmallManaCurveChart 
                title={COLOR_MAP.Total.label} 
                data={curveData.results.Total} 
                maxBarHeightValue={curveData.max} 
                icon={ViewColumnsIcon} 
                onSegmentClick={onShowCardsForSegment}
                colorKey="Total"
             />
        </div>

        {/* Color Charts */}
        {MANA_COLORS.map(c => (
            <SmallManaCurveChart 
                key={c}
                title={COLOR_MAP[c].label} 
                data={curveData.results[c]} 
                maxBarHeightValue={curveData.max} 
                icon={COLOR_MAP[c].icon} 
                onSegmentClick={onShowCardsForSegment}
                colorKey={c}
            />
        ))}
      </div>

      <div className="mt-6">
          <StatisticalAnalysis deck={deck} />
      </div>

      <div className="mt-4 p-4 bg-[#0d0d10] rounded-xl border border-white/[0.06] text-[11px] text-zinc-500 leading-relaxed">
          <p>
            <strong className="text-zinc-400">Methodology:</strong> Curves show non-land card counts by Mana Value (CMC). Color-specific curves are stacked by pip intensity required. X in mana costs is treated as 0. Click any bar to inspect the cards in that slot.
          </p>
      </div>
    </div>
  );
};

const ViewColumnsIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.5 0h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v10.5A2.25 2.25 0 005.25 19.5z" />
    </svg>
);
