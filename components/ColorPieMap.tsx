import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProcessedDeckCard } from '../types';
import {
  buildDeckTrajectory,
  calculateDeckColorPiePoint,
  DEFAULT_WUBRG_SYMBOLOGY,
  fetchWubrgSymbology,
  parseManaInputString,
  simulateCardSwap,
  WUBRG_ANGLES_DEG,
  WUBRG_COLOR_META,
  WUBRG_ORDER,
  type ColorPiePoint,
  type DeckTrajectoryStep,
  type ScryfallSymbolAsset,
  type WubrgColor,
} from '../services/colorPieService';

export interface DeckHistorySnapshot {
  cards: ProcessedDeckCard[];
  timestamp?: number;
  label?: string;
}

export interface ColorPieMapProps {
  currentDeck: ProcessedDeckCard[];
  snapshots: DeckHistorySnapshot[];
  activeSnapshotIndex?: number;
  onSelectSnapshot?: (index: number) => void;
  onLoadSampleAnimPakal?: () => void;
}

type ViewMode = 'full' | 'focus';

interface ViewBoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SVG_SIZE = 800;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const WHEEL_RADIUS = 248;
const SOCKET_RADIUS = 298;
const SOCKET_CIRCLE_RADIUS = 30;
const FULL_VIEW_BOX: ViewBoxRect = { x: 0, y: 0, w: SVG_SIZE, h: SVG_SIZE };
const MIN_VIEW_SPAN = 42;
const MIN_FOCUS_SPAN = 115;

const WEDGE_STYLES: Record<
  WubrgColor,
  { inner: string; mid: string; outer: string; stroke: string; badgeBg: string; textClass: string }
> = {
  W: {
    inner: '#3f3520',
    mid: '#b89f68',
    outer: '#fef3c7',
    stroke: '#fde68a',
    badgeBg: 'rgba(254, 243, 199, 0.14)',
    textClass: 'text-amber-200',
  },
  U: {
    inner: '#0c2742',
    mid: '#0284c7',
    outer: '#7dd3fc',
    stroke: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.14)',
    textClass: 'text-sky-300',
  },
  B: {
    inner: '#1e1333',
    mid: '#6d28d9',
    outer: '#c4b5fd',
    stroke: '#a78bfa',
    badgeBg: 'rgba(167, 139, 250, 0.14)',
    textClass: 'text-violet-300',
  },
  R: {
    inner: '#3d1216',
    mid: '#dc2626',
    outer: '#fca5a5',
    stroke: '#f87171',
    badgeBg: 'rgba(248, 113, 113, 0.14)',
    textClass: 'text-rose-300',
  },
  G: {
    inner: '#0b2e22',
    mid: '#059669',
    outer: '#6ee7b7',
    stroke: '#34d399',
    badgeBg: 'rgba(52, 211, 153, 0.14)',
    textClass: 'text-emerald-300',
  },
};

const PENTAGON_EDGES: ReadonlyArray<readonly [WubrgColor, WubrgColor]> = [
  ['W', 'U'],
  ['U', 'B'],
  ['B', 'R'],
  ['R', 'G'],
  ['G', 'W'],
];

const STAR_CHORDS: ReadonlyArray<readonly [WubrgColor, WubrgColor]> = [
  ['W', 'B'],
  ['B', 'G'],
  ['G', 'U'],
  ['U', 'R'],
  ['R', 'W'],
];

function polarPoint(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + Math.cos(rad) * radius,
    y: CY + Math.sin(rad) * radius,
  };
}

function pointToCanvas(point: Pick<ColorPiePoint, 'x' | 'y'>): { x: number; y: number } {
  return {
    x: CX + point.x * WHEEL_RADIUS,
    y: CY + point.y * WHEEL_RADIUS,
  };
}

function buildWedgePath(centerAngleDeg: number, innerR: number, outerR: number): string {
  const startDeg = centerAngleDeg - 36;
  const endDeg = centerAngleDeg + 36;
  const pOuterStart = polarPoint(startDeg, outerR);
  const pOuterEnd = polarPoint(endDeg, outerR);

  if (innerR <= 0) {
    return [
      `M ${CX} ${CY}`,
      `L ${pOuterStart.x.toFixed(3)} ${pOuterStart.y.toFixed(3)}`,
      `A ${outerR} ${outerR} 0 0 1 ${pOuterEnd.x.toFixed(3)} ${pOuterEnd.y.toFixed(3)}`,
      'Z',
    ].join(' ');
  }

  const pInnerEnd = polarPoint(endDeg, innerR);
  const pInnerStart = polarPoint(startDeg, innerR);
  return [
    `M ${pInnerStart.x.toFixed(3)} ${pInnerStart.y.toFixed(3)}`,
    `L ${pOuterStart.x.toFixed(3)} ${pOuterStart.y.toFixed(3)}`,
    `A ${outerR} ${outerR} 0 0 1 ${pOuterEnd.x.toFixed(3)} ${pOuterEnd.y.toFixed(3)}`,
    `L ${pInnerEnd.x.toFixed(3)} ${pInnerEnd.y.toFixed(3)}`,
    `A ${innerR} ${innerR} 0 0 0 ${pInnerStart.x.toFixed(3)} ${pInnerStart.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

function clampViewBox(rect: ViewBoxRect): ViewBoxRect {
  const w = Math.max(MIN_VIEW_SPAN, Math.min(SVG_SIZE, rect.w));
  const h = w;
  const x = Math.max(-40, Math.min(SVG_SIZE - w + 40, rect.x));
  const y = Math.max(-40, Math.min(SVG_SIZE - h + 40, rect.y));
  return { x, y, w, h };
}

function computeFocusViewBox(points: Array<{ x: number; y: number }>): ViewBoxRect {
  if (points.length === 0) return FULL_VIEW_BOX;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const rawSpan = Math.max(maxX - minX, maxY - minY);
  const paddedSpan = Math.max(MIN_FOCUS_SPAN, Math.min(SVG_SIZE, rawSpan * 2.1 + 70));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  return clampViewBox({
    x: midX - paddedSpan / 2,
    y: midY - paddedSpan / 2,
    w: paddedSpan,
    h: paddedSpan,
  });
}

function formatSharePct(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function formatSignedSharePct(delta: number): string {
  const pct = delta * 100;
  if (Math.abs(pct) < 0.05) return '0.0%';
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function formatTimestamp(ts?: number): string | null {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return null;
  }
}

function formatPipSummary(pips: Record<WubrgColor, number>, signed = false): string {
  const parts: string[] = [];
  for (const color of WUBRG_ORDER) {
    const val = pips[color];
    if (val === 0) continue;
    if (signed) {
      parts.push(`${val > 0 ? '+' : ''}${val}${color}`);
    } else {
      parts.push(`${val}${color}`);
    }
  }
  return parts.length > 0 ? parts.join(' ') : 'No colored pips';
}

function formatCardManaCost(card: ProcessedDeckCard): string {
  if (card.manaCostString) return card.manaCostString;
  const parsed = card.parsedManaCost;
  if (!parsed) return '';
  const parts: string[] = [];
  if (parsed.Generic) parts.push(`{${parsed.Generic}}`);
  for (const color of WUBRG_ORDER) {
    const count = parsed[color] || 0;
    for (let i = 0; i < count; i++) parts.push(`{${color}}`);
  }
  return parts.join('');
}

/**
 * High-definition 5-point Magic: The Gathering Color Pie visualization for
 * tracking deck mana drift over time and simulating card-swap shifts.
 */
export const ColorPieMap: React.FC<ColorPieMapProps> = ({
  currentDeck,
  snapshots,
  activeSnapshotIndex,
  onSelectSnapshot,
  onLoadSampleAnimPakal,
}) => {
  const [symbology, setSymbology] = useState<Record<WubrgColor, ScryfallSymbolAsset>>(DEFAULT_WUBRG_SYMBOLOGY);
  const [symbolImgErrors, setSymbolImgErrors] = useState<Partial<Record<WubrgColor, boolean>>>({});

  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [viewBox, setViewBox] = useState<ViewBoxRect>(FULL_VIEW_BOX);
  const viewBoxRef = useRef<ViewBoxRect>(FULL_VIEW_BOX);
  viewBoxRef.current = viewBox;

  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    startViewBox: ViewBoxRect;
    moved: boolean;
  } | null>(null);

  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);

  // What-If Card Swap Simulator state
  const [swapEnabled, setSwapEnabled] = useState<boolean>(false);
  const [removeMode, setRemoveMode] = useState<'deck' | 'custom'>('deck');
  const [selectedRemoveCardId, setSelectedRemoveCardId] = useState<string>('');
  const [customRemoveCost, setCustomRemoveCost] = useState<string>('2W 1R');
  const [addCardName, setAddCardName] = useState<string>('Simulated Card');
  const [addCardCost, setAddCardCost] = useState<string>('3W 2R');

  useEffect(() => {
    let mounted = true;
    fetchWubrgSymbology().then(assets => {
      if (mounted) {
        setSymbology(assets);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveSnapshots = useMemo<DeckHistorySnapshot[]>(() => {
    if (snapshots.length > 0) return snapshots;
    if (currentDeck.length > 0) {
      return [{ cards: currentDeck, label: 'Current Deck' }];
    }
    return [];
  }, [snapshots, currentDeck]);

  const trajectorySteps = useMemo<DeckTrajectoryStep[]>(() => {
    const built = buildDeckTrajectory(effectiveSnapshots);
    if (built.length === 0 && currentDeck.length > 0) {
      return [
        {
          index: 0,
          label: 'Current Deck',
          point: calculateDeckColorPiePoint(currentDeck),
          changesFromPrev: [],
        },
      ];
    }
    return built;
  }, [effectiveSnapshots, currentDeck]);

  useEffect(() => {
    if (
      activeSnapshotIndex !== undefined &&
      activeSnapshotIndex >= 0 &&
      activeSnapshotIndex < trajectorySteps.length
    ) {
      setSelectedStepIndex(activeSnapshotIndex);
    } else if (trajectorySteps.length > 0) {
      setSelectedStepIndex(trajectorySteps.length - 1);
    } else {
      setSelectedStepIndex(0);
    }
  }, [activeSnapshotIndex, trajectorySteps.length]);

  const swappableDeckCards = useMemo(() => {
    return [...currentDeck]
      .filter(card => (Number(card.quantity) || 0) > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentDeck]);

  useEffect(() => {
    if (swappableDeckCards.length === 0) {
      setSelectedRemoveCardId('');
      return;
    }
    const stillExists = swappableDeckCards.some(c => c.id === selectedRemoveCardId);
    if (!stillExists) {
      const preferred =
        swappableDeckCards.find(c => {
          const parsed = c.parsedManaCost || parseManaInputString(c.manaCostString);
          return WUBRG_ORDER.some(col => (parsed[col] || 0) > 0);
        }) || swappableDeckCards[0];
      setSelectedRemoveCardId(preferred.id);
    }
  }, [swappableDeckCards, selectedRemoveCardId]);

  const swapResult = useMemo(() => {
    if (!swapEnabled || currentDeck.length === 0) return null;
    const removeId = removeMode === 'deck' && selectedRemoveCardId ? selectedRemoveCardId : null;
    const fallbackRemove = removeMode === 'custom' ? customRemoveCost : undefined;
    const hasAdd = addCardCost.trim().length > 0;

    return simulateCardSwap(
      currentDeck,
      removeId,
      hasAdd
        ? {
            name: addCardName.trim() || 'Simulated Card',
            manaCostString: addCardCost.trim(),
            quantity: 1,
          }
        : null,
      fallbackRemove
    );
  }, [swapEnabled, currentDeck, removeMode, selectedRemoveCardId, customRemoveCost, addCardName, addCardCost]);

  const trajectoryCanvasPoints = useMemo(() => {
    return trajectorySteps.map(step => pointToCanvas(step.point));
  }, [trajectorySteps]);

  const animateViewBoxTo = useCallback((target: ViewBoxRect) => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const start = { ...viewBoxRef.current };
    const startTime = performance.now();
    const duration = 320;

    const stepFrame = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setViewBox({
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        w: start.w + (target.w - start.w) * eased,
        h: start.h + (target.h - start.h) * eased,
      });

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(stepFrame);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(stepFrame);
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const targetFocusBox = useMemo(() => {
    const pts = [...trajectoryCanvasPoints];
    if (swapResult) {
      pts.push(pointToCanvas(swapResult.before));
      pts.push(pointToCanvas(swapResult.after));
    }
    return computeFocusViewBox(pts);
  }, [trajectoryCanvasPoints, swapResult]);

  useEffect(() => {
    if (viewMode === 'focus') {
      animateViewBoxTo(targetFocusBox);
    } else {
      animateViewBoxTo(FULL_VIEW_BOX);
    }
  }, [viewMode, targetFocusBox, animateViewBoxTo]);

  // Native non-passive wheel zoom centered on cursor
  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      const svgEl = svgRef.current;
      if (!svgEl) return;
      const rect = svgEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const relX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const relY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

      const zoomFactor = event.deltaY < 0 ? 0.84 : 1.19;
      setViewBox(prev => {
        const nextW = Math.max(MIN_VIEW_SPAN, Math.min(SVG_SIZE, prev.w * zoomFactor));
        const anchorX = prev.x + relX * prev.w;
        const anchorY = prev.y + relY * prev.h;
        return clampViewBox({
          x: anchorX - relX * nextW,
          y: anchorY - relY * nextW,
          w: nextW,
          h: nextW,
        });
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handleZoomBy = useCallback((factor: number) => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setViewBox(prev => {
      const nextW = Math.max(MIN_VIEW_SPAN, Math.min(SVG_SIZE, prev.w * factor));
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return clampViewBox({
        x: cx - nextW / 2,
        y: cy - nextW / 2,
        w: nextW,
        h: nextW,
      });
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    if (viewMode === 'focus') {
      animateViewBoxTo(targetFocusBox);
    } else {
      animateViewBoxTo(FULL_VIEW_BOX);
    }
  }, [viewMode, targetFocusBox, animateViewBoxTo]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    dragStateRef.current = {
      active: true,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startViewBox: { ...viewBoxRef.current },
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragStateRef.current;
    const svgEl = svgRef.current;
    if (!drag?.active || !svgEl) return;

    const rect = svgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dxClient = e.clientX - drag.startClientX;
    const dyClient = e.clientY - drag.startClientY;
    if (Math.hypot(dxClient, dyClient) > 4) {
      drag.moved = true;
    }

    const dxSvg = (dxClient / rect.width) * drag.startViewBox.w;
    const dySvg = (dyClient / rect.height) * drag.startViewBox.h;

    setViewBox(
      clampViewBox({
        x: drag.startViewBox.x - dxSvg,
        y: drag.startViewBox.y - dySvg,
        w: drag.startViewBox.w,
        h: drag.startViewBox.h,
      })
    );
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragStateRef.current?.active) {
      dragStateRef.current.active = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture wasn't active
      }
    }
  };

  const handleSelectStep = useCallback(
    (index: number) => {
      if (dragStateRef.current?.moved) return;
      setSelectedStepIndex(index);
      onSelectSnapshot?.(index);
    },
    [onSelectSnapshot]
  );

  const handleApplyDemoSwap = () => {
    setRemoveMode('custom');
    setCustomRemoveCost('2W 1R');
    setAddCardName('Demo 3W 2R Replacement');
    setAddCardCost('3W 2R');
    setSwapEnabled(true);
    setViewMode('focus');
  };

  const inspectedIndex =
    hoveredStepIndex !== null && hoveredStepIndex >= 0 && hoveredStepIndex < trajectorySteps.length
      ? hoveredStepIndex
      : Math.min(Math.max(0, selectedStepIndex), Math.max(0, trajectorySteps.length - 1));

  const inspectedStep: DeckTrajectoryStep | null = trajectorySteps[inspectedIndex] || null;
  const activePoint: ColorPiePoint | null = inspectedStep?.point || null;

  // Constant-screen-space scale factor when zoomed in
  const zoomRatio = SVG_SIZE / Math.max(MIN_VIEW_SPAN, viewBox.w);
  const uiScale = Math.max(0.06, viewBox.w / SVG_SIZE);

  // Off-screen color direction indicators when zoomed in
  const offscreenDirectionIndicators = useMemo(() => {
    if (viewBox.w >= SVG_SIZE * 0.88) return [];

    const vcx = viewBox.x + viewBox.w / 2;
    const vcy = viewBox.y + viewBox.h / 2;
    const halfSpan = viewBox.w / 2;
    const edgeMargin = 32 * uiScale;
    const maxOffset = Math.max(10 * uiScale, halfSpan - edgeMargin);

    return WUBRG_ORDER.map(color => {
      const socketPos = polarPoint(WUBRG_ANGLES_DEG[color], SOCKET_RADIUS);
      const inView =
        socketPos.x >= viewBox.x + 14 * uiScale &&
        socketPos.x <= viewBox.x + viewBox.w - 14 * uiScale &&
        socketPos.y >= viewBox.y + 14 * uiScale &&
        socketPos.y <= viewBox.y + viewBox.h - 14 * uiScale;

      if (inView) return null;

      // Vector toward the true color vertex on the wheel
      const vertexPos = polarPoint(WUBRG_ANGLES_DEG[color], WHEEL_RADIUS);
      const dx = vertexPos.x - vcx;
      const dy = vertexPos.y - vcy;
      const maxAxis = Math.max(Math.abs(dx), Math.abs(dy), 1e-6);
      const scale = maxOffset / maxAxis;

      const indicatorX = vcx + dx * scale;
      const indicatorY = vcy + dy * scale;
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      return {
        color,
        x: indicatorX,
        y: indicatorY,
        angleDeg,
      };
    }).filter((item): item is { color: WubrgColor; x: number; y: number; angleDeg: number } => item !== null);
  }, [viewBox, uiScale]);

  // Scalloped bronze medallion ticks
  const bezelTicks = useMemo(() => {
    const ticks: Array<{ x1: number; y1: number; x2: number; y2: number; major: boolean }> = [];
    for (let i = 0; i < 60; i++) {
      const deg = -90 + i * 6;
      const major = i % 12 === 0; // Aligns cleanly with W(-90), U(-18), B(54), R(126), G(198)
      const inner = polarPoint(deg, major ? 250 : 254);
      const outer = polarPoint(deg, major ? 268 : 263);
      ticks.push({ x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, major });
    }
    return ticks;
  }, []);

  if (currentDeck.length === 0 && trajectorySteps.length === 0) {
    return (
      <div className="h-full w-full bg-[#09090b] flex items-center justify-center p-6 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl w-full rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex items-center justify-center gap-3">
            {WUBRG_ORDER.map(color => (
              <div
                key={color}
                className="w-11 h-11 rounded-full border border-amber-500/30 bg-zinc-950/90 p-1.5 shadow-lg flex items-center justify-center"
              >
                <img
                  src={symbology[color].svgUri}
                  alt={WUBRG_COLOR_META[color].name}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
          <h2 className="font-display text-2xl font-bold text-amber-200 tracking-wide">
            WUBRG Color Pie Trajectory Map
          </h2>
          <p className="mt-2.5 text-sm text-zinc-400 leading-relaxed max-w-lg mx-auto">
            Load a deck to plot its mana pip balance on the 5-point Magic Color Pie, track shifts across every edit, and simulate single-card swaps with sub-percent precision.
          </p>
          {onLoadSampleAnimPakal && (
            <button
              type="button"
              onClick={onLoadSampleAnimPakal}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-5 py-2.5 text-sm shadow-lg shadow-amber-500/20 transition-colors cursor-pointer"
            >
              <span>Load Sample Deck (Anim Pakal)</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#09090b] text-zinc-200 overflow-y-auto custom-scrollbar p-4 lg:p-5">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left/Main HD Color Pie Canvas */}
        <div className="xl:col-span-7 2xl:col-span-8 bg-[#0c0c10] border border-zinc-800/90 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Canvas Header Controls */}
          <div className="px-4 py-3 border-b border-zinc-800/90 bg-zinc-950/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-zinc-100 tracking-wide">
                  5-Point Color Pie Drift
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300">
                  {zoomRatio.toFixed(1)}×
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Scroll to zoom · Drag to pan · Click nodes to inspect deck snapshots
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('full')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    viewMode === 'full'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Full Color Pie
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('focus')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    viewMode === 'focus'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Focus Trajectory
                </button>
              </div>

              <div className="inline-flex items-center rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleZoomBy(0.75)}
                  title="Zoom in"
                  className="px-2.5 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-800 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleZoomBy(1.33)}
                  title="Zoom out"
                  className="px-2.5 py-1 text-xs font-mono text-zinc-300 hover:bg-zinc-800 hover:text-amber-300 border-l border-zinc-800 transition-colors cursor-pointer"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  title="Reset view"
                  className="px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 border-l border-zinc-800 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Interactive SVG Canvas */}
          <div
            ref={svgContainerRef}
            className="relative w-full aspect-square max-h-[760px] bg-[#060609] select-none overflow-hidden"
          >
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              preserveAspectRatio="xMidYMid meet"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
              role="img"
              aria-label="Magic the Gathering 5-point WUBRG Color Pie trajectory map"
            >
              <defs>
                {/* Obsidian arcane background glow */}
                <radialGradient id="obsidianBgGrad" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="#171923" />
                  <stop offset="55%" stopColor="#0b0c12" />
                  <stop offset="100%" stopColor="#050507" />
                </radialGradient>

                {/* Metallic bronze-gold gradients */}
                <linearGradient
                  id="goldBezelGrad"
                  gradientUnits="userSpaceOnUse"
                  x1={0}
                  y1={0}
                  x2={SVG_SIZE}
                  y2={SVG_SIZE}
                >
                  <stop offset="0%" stopColor="#f3d68b" />
                  <stop offset="28%" stopColor="#b98a3b" />
                  <stop offset="55%" stopColor="#fde68a" />
                  <stop offset="78%" stopColor="#855a20" />
                  <stop offset="100%" stopColor="#d4af37" />
                </linearGradient>

                <linearGradient id="bronzeFrameGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b2610" />
                  <stop offset="50%" stopColor="#6e4b1f" />
                  <stop offset="100%" stopColor="#2c1c0b" />
                </linearGradient>

                <radialGradient id="socketBgGrad" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#27272a" />
                  <stop offset="70%" stopColor="#121217" />
                  <stop offset="100%" stopColor="#09090b" />
                </radialGradient>

                {/* Luminous beveled mana wedge gradients */}
                {WUBRG_ORDER.map(color => (
                  <radialGradient
                    key={`wedge-grad-${color}`}
                    id={`wedgeGrad-${color}`}
                    cx={CX}
                    cy={CY}
                    r={SVG_SIZE / 2}
                    gradientUnits="userSpaceOnUse"
                    fx={CX}
                    fy={CY}
                  >
                    <stop offset="0%" stopColor={WEDGE_STYLES[color].inner} stopOpacity="0.28" />
                    <stop offset="58%" stopColor={WEDGE_STYLES[color].mid} stopOpacity="0.34" />
                    <stop offset="92%" stopColor={WEDGE_STYLES[color].outer} stopOpacity="0.48" />
                    <stop offset="100%" stopColor={WEDGE_STYLES[color].outer} stopOpacity="0.62" />
                  </radialGradient>
                ))}

                <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation={3.5 * uiScale} result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {WUBRG_ORDER.map(color => {
                  const pos = polarPoint(WUBRG_ANGLES_DEG[color], SOCKET_RADIUS);
                  return (
                    <clipPath key={`clip-${color}`} id={`socketClip-${color}`}>
                      <circle cx={pos.x} cy={pos.y} r={SOCKET_CIRCLE_RADIUS - 5} />
                    </clipPath>
                  );
                })}
              </defs>

              {/* Background Canvas */}
              <rect x={-120} y={-120} width={SVG_SIZE + 240} height={SVG_SIZE + 240} fill="url(#obsidianBgGrad)" />

              {/* Subtle outer celestial rings */}
              <circle
                cx={CX}
                cy={CY}
                r={362}
                fill="none"
                stroke="rgba(212, 175, 55, 0.14)"
                strokeWidth={1}
                strokeDasharray="3 7"
              />
              <circle cx={CX} cy={CY} r={342} fill="none" stroke="rgba(212, 175, 55, 0.22)" strokeWidth={1.2} />

              {/* Outer bronze medallion frame */}
              <circle cx={CX} cy={CY} r={272} fill="url(#bronzeFrameGrad)" stroke="url(#goldBezelGrad)" strokeWidth={2.5} />
              <circle cx={CX} cy={CY} r={252} fill="#07080d" stroke="url(#goldBezelGrad)" strokeWidth={1.8} />

              {/* Scalloped bezel ticks */}
              <g opacity={0.85}>
                {bezelTicks.map((tick, idx) => (
                  <line
                    key={idx}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    stroke={tick.major ? '#fde68a' : '#a17a36'}
                    strokeWidth={tick.major ? 2.2 : 1.1}
                    strokeLinecap="round"
                  />
                ))}
              </g>

              {/* Five Luminous Mana Pie Wedges */}
              <g>
                {WUBRG_ORDER.map(color => {
                  const share = activePoint?.shares[color] ?? 0;
                  const fillOpacity = 0.42 + share * 0.58;
                  return (
                    <path
                      key={`wedge-${color}`}
                      d={buildWedgePath(WUBRG_ANGLES_DEG[color], 0, WHEEL_RADIUS)}
                      fill={`url(#wedgeGrad-${color})`}
                      fillOpacity={fillOpacity}
                      stroke="rgba(212, 175, 55, 0.24)"
                      strokeWidth={1.2 * Math.max(0.25, uiScale)}
                    />
                  );
                })}
              </g>

              {/* Inner Concentric Dominance Rings (25%, 50%, 75%, 100%) */}
              <g>
                {[0.25, 0.5, 0.75, 1].map(ratio => (
                  <circle
                    key={`ring-${ratio}`}
                    cx={CX}
                    cy={CY}
                    r={WHEEL_RADIUS * ratio}
                    fill="none"
                    stroke={ratio === 1 ? 'rgba(253, 230, 138, 0.4)' : 'rgba(255, 255, 255, 0.12)'}
                    strokeWidth={(ratio === 1 ? 1.5 : 0.9) * Math.max(0.3, uiScale)}
                    strokeDasharray={ratio < 1 ? `${3 * Math.max(0.35, uiScale)} ${4 * Math.max(0.35, uiScale)}` : undefined}
                  />
                ))}

                {/* Subtle ring percentage labels along top-right neutral diagonal */}
                {[0.25, 0.5, 0.75].map(ratio => {
                  const pt = polarPoint(-54, WHEEL_RADIUS * ratio);
                  return (
                    <text
                      key={`ring-label-${ratio}`}
                      x={pt.x}
                      y={pt.y}
                      fill="rgba(212, 212, 216, 0.45)"
                      fontSize={9 * Math.max(0.35, uiScale)}
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {Math.round(ratio * 100)}%
                    </text>
                  );
                })}
              </g>

              {/* Allied Pentagon & Enemy Star Pentagram Chords (e.g. W-R axis) */}
              <g>
                {PENTAGON_EDGES.map(([a, b]) => {
                  const p1 = polarPoint(WUBRG_ANGLES_DEG[a], WHEEL_RADIUS);
                  const p2 = polarPoint(WUBRG_ANGLES_DEG[b], WHEEL_RADIUS);
                  return (
                    <line
                      key={`pent-${a}-${b}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="rgba(253, 230, 138, 0.28)"
                      strokeWidth={1.1 * Math.max(0.3, uiScale)}
                    />
                  );
                })}

                {STAR_CHORDS.map(([a, b]) => {
                  const p1 = polarPoint(WUBRG_ANGLES_DEG[a], WHEEL_RADIUS);
                  const p2 = polarPoint(WUBRG_ANGLES_DEG[b], WHEEL_RADIUS);
                  return (
                    <line
                      key={`star-${a}-${b}`}
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke="rgba(253, 230, 138, 0.19)"
                      strokeWidth={1.0 * Math.max(0.3, uiScale)}
                      strokeDasharray={`${4 * Math.max(0.35, uiScale)} ${4 * Math.max(0.35, uiScale)}`}
                    />
                  );
                })}

                {/* Radial spokes from center to each WUBRG vertex */}
                {WUBRG_ORDER.map(color => {
                  const pVertex = polarPoint(WUBRG_ANGLES_DEG[color], WHEEL_RADIUS);
                  return (
                    <line
                      key={`spoke-${color}`}
                      x1={CX}
                      y1={CY}
                      x2={pVertex.x}
                      y2={pVertex.y}
                      stroke={WEDGE_STYLES[color].stroke}
                      strokeOpacity={0.34}
                      strokeWidth={1.15 * Math.max(0.3, uiScale)}
                    />
                  );
                })}
              </g>

              {/* Center Arcane Compass Rose */}
              <g opacity={0.85}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={10 * Math.max(0.35, uiScale)}
                  fill="#09090b"
                  stroke="rgba(212, 175, 55, 0.5)"
                  strokeWidth={1.2 * Math.max(0.35, uiScale)}
                />
                <circle cx={CX} cy={CY} r={2.5 * Math.max(0.35, uiScale)} fill="#fbbf24" />
              </g>

              {/* Scryfall WUBRG Medallion Sockets at exact vertex positions */}
              <g>
                {WUBRG_ORDER.map(color => {
                  const angle = WUBRG_ANGLES_DEG[color];
                  const socketPos = polarPoint(angle, SOCKET_RADIUS);
                  const vertexPos = polarPoint(angle, WHEEL_RADIUS);
                  const badgePos = polarPoint(angle, SOCKET_RADIUS + 46);
                  const share = activePoint?.shares[color] ?? 0;
                  const pips = activePoint?.pipCounts[color] ?? 0;
                  const imgFailed = Boolean(symbolImgErrors[color]);

                  return (
                    <g key={`socket-${color}`}>
                      {/* Finial connector from vertex to socket */}
                      <line
                        x1={vertexPos.x}
                        y1={vertexPos.y}
                        x2={socketPos.x}
                        y2={socketPos.y}
                        stroke="url(#goldBezelGrad)"
                        strokeWidth={2.2}
                        opacity={0.75}
                      />
                      <circle cx={vertexPos.x} cy={vertexPos.y} r={3.5} fill="#fde68a" opacity={0.85} />

                      {/* Socket medallion bezel */}
                      <circle
                        cx={socketPos.x}
                        cy={socketPos.y}
                        r={SOCKET_CIRCLE_RADIUS + 2}
                        fill="url(#goldBezelGrad)"
                      />
                      <circle
                        cx={socketPos.x}
                        cy={socketPos.y}
                        r={SOCKET_CIRCLE_RADIUS - 2}
                        fill="url(#socketBgGrad)"
                        stroke={WEDGE_STYLES[color].stroke}
                        strokeOpacity={0.45 + share * 0.55}
                        strokeWidth={1.6}
                      />

                      {/* Official Scryfall SVG Asset + graceful offline fallback glyph */}
                      {!imgFailed ? (
                        <image
                          href={symbology[color].svgUri}
                          x={socketPos.x - (SOCKET_CIRCLE_RADIUS - 6)}
                          y={socketPos.y - (SOCKET_CIRCLE_RADIUS - 6)}
                          width={(SOCKET_CIRCLE_RADIUS - 6) * 2}
                          height={(SOCKET_CIRCLE_RADIUS - 6) * 2}
                          clipPath={`url(#socketClip-${color})`}
                          preserveAspectRatio="xMidYMid meet"
                          onError={() =>
                            setSymbolImgErrors(prev => ({
                              ...prev,
                              [color]: true,
                            }))
                          }
                        />
                      ) : (
                        <text
                          x={socketPos.x}
                          y={socketPos.y}
                          fill={WUBRG_COLOR_META[color].hex}
                          fontSize={22}
                          fontWeight={800}
                          fontFamily="Cinzel, Georgia, serif"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {color}
                        </text>
                      )}

                      {/* Active share badge outside socket */}
                      <g transform={`translate(${badgePos.x}, ${badgePos.y})`}>
                        <rect
                          x={-37}
                          y={-12}
                          width={74}
                          height={24}
                          rx={6}
                          fill="#09090b"
                          fillOpacity={0.92}
                          stroke={WEDGE_STYLES[color].stroke}
                          strokeOpacity={share > 0 ? 0.55 : 0.2}
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={-2}
                          fill={share > 0 ? '#f4f4f5' : '#71717a'}
                          fontSize={10.5}
                          fontWeight={600}
                          fontFamily="JetBrains Mono, monospace"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {formatSharePct(share)}
                        </text>
                        <text
                          x={0}
                          y={7.5}
                          fill="#a1a1aa"
                          fontSize={7.8}
                          fontFamily="JetBrains Mono, monospace"
                          textAnchor="middle"
                          dominantBaseline="central"
                        >
                          {pips} {pips === 1 ? 'pip' : 'pips'}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>

              {/* Deck History Trajectory Lines & Directional Arrowheads */}
              <g>
                {trajectorySteps.slice(1).map((step, i) => {
                  const prevStep = trajectorySteps[i];
                  const from = pointToCanvas(prevStep.point);
                  const to = pointToCanvas(step.point);
                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const dist = Math.hypot(dx, dy);
                  if (dist < 1e-6) return null;

                  const ux = dx / dist;
                  const uy = dy / dist;
                  const nodePad = 7.5 * uiScale;
                  const startX = from.x + ux * Math.min(nodePad * 0.75, dist * 0.35);
                  const startY = from.y + uy * Math.min(nodePad * 0.75, dist * 0.35);
                  const endX = to.x - ux * Math.min(nodePad, dist * 0.45);
                  const endY = to.y - uy * Math.min(nodePad, dist * 0.45);

                  const arrowLen = Math.min(dist * 0.42, 9 * uiScale);
                  const arrowHalfWidth = 4.2 * uiScale;
                  const tipX = endX;
                  const tipY = endY;
                  const baseX = tipX - ux * arrowLen;
                  const baseY = tipY - uy * arrowLen;
                  const perpX = -uy;
                  const perpY = ux;

                  const isSelectedEdge = inspectedIndex === step.index || hoveredStepIndex === step.index;

                  return (
                    <g
                      key={`seg-${prevStep.index}-${step.index}`}
                      className="cursor-pointer"
                      onClick={e => {
                        e.stopPropagation();
                        handleSelectStep(step.index);
                      }}
                      onMouseEnter={() => setHoveredStepIndex(step.index)}
                      onMouseLeave={() => setHoveredStepIndex(null)}
                    >
                      {/* Invisible wider hit target */}
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="transparent"
                        strokeWidth={14 * uiScale}
                      />
                      <line
                        x1={startX}
                        y1={startY}
                        x2={baseX}
                        y2={baseY}
                        stroke={isSelectedEdge ? '#fef08a' : '#f59e0b'}
                        strokeOpacity={isSelectedEdge ? 0.98 : 0.78}
                        strokeWidth={(isSelectedEdge ? 3.0 : 2.1) * uiScale}
                        strokeLinecap="round"
                      />
                      <polygon
                        points={`${tipX},${tipY} ${baseX + perpX * arrowHalfWidth},${baseY + perpY * arrowHalfWidth} ${baseX - perpX * arrowHalfWidth},${baseY - perpY * arrowHalfWidth}`}
                        fill={isSelectedEdge ? '#fef08a' : '#fbbf24'}
                      />
                    </g>
                  );
                })}
              </g>

              {/* Trajectory Step Nodes (t0, intermediate, now) */}
              <g>
                {trajectorySteps.map((step, idx) => {
                  const pos = pointToCanvas(step.point);
                  const isStart = idx === 0;
                  const isCurrent = idx === trajectorySteps.length - 1;
                  const isInspected = inspectedIndex === idx;
                  const baseR = (isCurrent ? 7.2 : isStart ? 6.2 : 5.2) * uiScale;

                  return (
                    <g
                      key={`node-${idx}`}
                      className="cursor-pointer"
                      onClick={e => {
                        e.stopPropagation();
                        handleSelectStep(idx);
                      }}
                      onMouseEnter={() => setHoveredStepIndex(idx)}
                      onMouseLeave={() => setHoveredStepIndex(null)}
                    >
                      {/* Larger invisible hit circle */}
                      <circle cx={pos.x} cy={pos.y} r={14 * uiScale} fill="transparent" />

                      {/* Pulsing / highlighted beacon for Current ('now') */}
                      {isCurrent && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={14 * uiScale}
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth={1.6 * uiScale}
                          strokeOpacity={0.55}
                        >
                          <animate
                            attributeName="r"
                            values={`${9 * uiScale};${19 * uiScale};${9 * uiScale}`}
                            dur="2.4s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="stroke-opacity"
                            values="0.75;0.1;0.75"
                            dur="2.4s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}

                      {/* Selection ring */}
                      {isInspected && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={baseR + 4.2 * uiScale}
                          fill="none"
                          stroke="#fef08a"
                          strokeWidth={1.8 * uiScale}
                        />
                      )}

                      {/* Node core */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={baseR}
                        fill={isCurrent ? '#fbbf24' : isStart ? '#09090b' : '#d97706'}
                        stroke={isStart ? '#34d399' : '#fef3c7'}
                        strokeWidth={(isStart ? 2.4 : 1.5) * uiScale}
                        filter={isCurrent || isInspected ? 'url(#nodeGlow)' : undefined}
                      />

                      {/* Step tag (t0 / now / tN when zoomed or single/endpoints) */}
                      {(isStart || isCurrent || isInspected || zoomRatio >= 2.2) && (
                        <text
                          x={pos.x}
                          y={pos.y - (baseR + 7 * uiScale)}
                          fill={isCurrent ? '#fde68a' : isStart ? '#6ee7b7' : '#d4d4d8'}
                          fontSize={10 * uiScale}
                          fontWeight={700}
                          fontFamily="JetBrains Mono, monospace"
                          textAnchor="middle"
                        >
                          {isStart && isCurrent
                            ? 'Now'
                            : isStart
                            ? 't0'
                            : isCurrent
                            ? 'Now'
                            : `t${idx}`}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* What-If Card Swap Live Ghost Preview */}
              {swapResult && (() => {
                const beforePos = pointToCanvas(swapResult.before);
                const afterPos = pointToCanvas(swapResult.after);
                const dx = afterPos.x - beforePos.x;
                const dy = afterPos.y - beforePos.y;
                const dist = Math.hypot(dx, dy);
                const ux = dist > 1e-6 ? dx / dist : 0;
                const uy = dist > 1e-6 ? dy / dist : 0;
                const ghostR = 6.8 * uiScale;
                const arrowLen = Math.min(dist * 0.45, 9.5 * uiScale);
                const arrowHalfW = 4.5 * uiScale;
                const tipX = afterPos.x - ux * Math.min(ghostR * 0.9, dist * 0.3);
                const tipY = afterPos.y - uy * Math.min(ghostR * 0.9, dist * 0.3);
                const baseX = tipX - ux * arrowLen;
                const baseY = tipY - uy * arrowLen;
                const perpX = -uy;
                const perpY = ux;

                return (
                  <g className="pointer-events-none">
                    {dist > 1e-4 && (
                      <>
                        <line
                          x1={beforePos.x}
                          y1={beforePos.y}
                          x2={baseX}
                          y2={baseY}
                          stroke="#22d3ee"
                          strokeWidth={2.3 * uiScale}
                          strokeDasharray={`${5 * uiScale} ${3.5 * uiScale}`}
                          strokeLinecap="round"
                        />
                        <polygon
                          points={`${tipX},${tipY} ${baseX + perpX * arrowHalfW},${baseY + perpY * arrowHalfW} ${baseX - perpX * arrowHalfW},${baseY - perpY * arrowHalfW}`}
                          fill="#22d3ee"
                        />
                      </>
                    )}
                    <circle
                      cx={afterPos.x}
                      cy={afterPos.y}
                      r={ghostR + 4.5 * uiScale}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={1.4 * uiScale}
                      strokeDasharray={`${3 * uiScale} ${2.5 * uiScale}`}
                    />
                    <circle
                      cx={afterPos.x}
                      cy={afterPos.y}
                      r={ghostR}
                      fill="rgba(34, 211, 238, 0.35)"
                      stroke="#67e8f9"
                      strokeWidth={2 * uiScale}
                    />
                    <text
                      x={afterPos.x}
                      y={afterPos.y + ghostR + 12 * uiScale}
                      fill="#67e8f9"
                      fontSize={10 * uiScale}
                      fontWeight={700}
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      What-If
                    </text>
                  </g>
                );
              })()}

              {/* Off-screen WUBRG Direction Indicators when zoomed in */}
              {offscreenDirectionIndicators.length > 0 && (
                <g className="pointer-events-none">
                  {offscreenDirectionIndicators.map(ind => {
                    const pillR = 14 * uiScale;
                    const iconSize = 18 * uiScale;
                    const arrowDist = pillR + 6 * uiScale;
                    const rad = (ind.angleDeg * Math.PI) / 180;
                    const tipX = ind.x + Math.cos(rad) * (arrowDist + 5 * uiScale);
                    const tipY = ind.y + Math.sin(rad) * (arrowDist + 5 * uiScale);
                    const leftX = ind.x + Math.cos(rad + 0.35) * arrowDist;
                    const leftY = ind.y + Math.sin(rad + 0.35) * arrowDist;
                    const rightX = ind.x + Math.cos(rad - 0.35) * arrowDist;
                    const rightY = ind.y + Math.sin(rad - 0.35) * arrowDist;

                    return (
                      <g key={`dir-${ind.color}`}>
                        <polygon
                          points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
                          fill={WEDGE_STYLES[ind.color].stroke}
                          opacity={0.9}
                        />
                        <circle
                          cx={ind.x}
                          cy={ind.y}
                          r={pillR}
                          fill="#09090b"
                          fillOpacity={0.92}
                          stroke={WEDGE_STYLES[ind.color].stroke}
                          strokeWidth={1.6 * uiScale}
                        />
                        {!symbolImgErrors[ind.color] ? (
                          <image
                            href={symbology[ind.color].svgUri}
                            x={ind.x - iconSize / 2}
                            y={ind.y - iconSize / 2}
                            width={iconSize}
                            height={iconSize}
                            preserveAspectRatio="xMidYMid meet"
                          />
                        ) : (
                          <text
                            x={ind.x}
                            y={ind.y}
                            fill={WUBRG_COLOR_META[ind.color].hex}
                            fontSize={12 * uiScale}
                            fontWeight={700}
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {ind.color}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              )}
            </svg>

            {/* Bottom-Left Compact Legend Overlay */}
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2.5 rounded-lg bg-zinc-950/85 border border-zinc-800/90 px-3 py-1.5 text-[11px] text-zinc-300 backdrop-blur-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 border-2 border-emerald-400 inline-block" />
                Start (t0)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                Current (Now)
              </span>
              {swapResult && (
                <span className="inline-flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400/40 border border-cyan-300 inline-block" />
                  What-If Target
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Snapshot Inspector + Trajectory Timeline + What-If Swap Simulator */}
        <div className="xl:col-span-5 2xl:col-span-4 space-y-4">
          {/* 1. Snapshot Inspector */}
          <div className="bg-zinc-900/75 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    {inspectedIndex === 0 && trajectorySteps.length > 1
                      ? 'Start · t0'
                      : inspectedIndex === trajectorySteps.length - 1
                      ? `Current · t${inspectedIndex}`
                      : `Step · t${inspectedIndex}`}
                  </span>
                  {inspectedStep?.timestamp && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      {formatTimestamp(inspectedStep.timestamp)}
                    </span>
                  )}
                </div>
                <h3 className="mt-1.5 text-sm font-semibold text-zinc-100 leading-snug">
                  {inspectedStep?.label || 'Deck Mana Profile'}
                </h3>
              </div>

              {trajectorySteps.length > 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={inspectedIndex <= 0}
                    onClick={() => handleSelectStep(Math.max(0, inspectedIndex - 1))}
                    className="px-2 py-1 text-xs rounded-md bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-amber-500/40 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={inspectedIndex >= trajectorySteps.length - 1}
                    onClick={() => handleSelectStep(Math.min(trajectorySteps.length - 1, inspectedIndex + 1))}
                    className="px-2 py-1 text-xs rounded-md bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-amber-500/40 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* 5-color pip share bars */}
            {activePoint && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Total Colored Pips</span>
                  <span className="font-mono text-zinc-200 font-semibold">
                    {activePoint.totalColoredPips} pips
                  </span>
                </div>

                <div className="space-y-1.5">
                  {WUBRG_ORDER.map(color => {
                    const share = activePoint.shares[color];
                    const pips = activePoint.pipCounts[color];
                    const deltaShare = inspectedStep?.deltaShares?.[color];
                    const deltaPip = inspectedStep?.deltaPips?.[color];

                    return (
                      <div key={`bar-${color}`} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <img
                              src={symbology[color].svgUri}
                              alt={color}
                              className="w-4 h-4 object-contain"
                            />
                            <span className={`font-medium ${WEDGE_STYLES[color].textClass}`}>
                              {WUBRG_COLOR_META[color].name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            {deltaPip !== undefined && deltaPip !== 0 && (
                              <span className={deltaPip > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {deltaPip > 0 ? `+${deltaPip}` : deltaPip} {color}
                              </span>
                            )}
                            {deltaShare !== undefined && Math.abs(deltaShare) >= 0.0005 && (
                              <span className={deltaShare > 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}>
                                ({formatSignedSharePct(deltaShare)})
                              </span>
                            )}
                            <span className="text-zinc-400">{pips}</span>
                            <span className="text-zinc-100 font-semibold w-12 text-right">
                              {formatSharePct(share)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden border border-zinc-800/80">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(0, Math.min(100, share * 100))}%`,
                              backgroundColor: WUBRG_COLOR_META[color].hex,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card Diffs from Previous Step */}
            {inspectedStep && inspectedStep.changesFromPrev.length > 0 && (
              <div className="pt-2.5 border-t border-zinc-800/90 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Changes From Previous Snapshot
                </div>
                <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                  {inspectedStep.changesFromPrev.map(change => (
                    <div
                      key={`${inspectedStep.index}-${change.name}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950/80 border border-zinc-800/80 px-2.5 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-mono text-[11px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                            change.deltaQty > 0
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : change.deltaQty < 0
                              ? 'bg-rose-500/15 text-rose-300'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}
                        >
                          {change.deltaQty > 0 ? `+${change.deltaQty}` : change.deltaQty}
                        </span>
                        <span className="text-zinc-200 truncate">{change.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                        {formatPipSummary(change.pipDelta, true)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Compact History Timeline */}
            {trajectorySteps.length > 1 && (
              <div className="pt-2.5 border-t border-zinc-800/90 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Edit Trajectory ({trajectorySteps.length} steps)
                </div>
                <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                  {trajectorySteps.map(step => {
                    const isActive = step.index === inspectedIndex;
                    return (
                      <button
                        key={`timeline-${step.index}`}
                        type="button"
                        onClick={() => handleSelectStep(step.index)}
                        className={`w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer border ${
                          isActive
                            ? 'bg-amber-500/12 border-amber-500/35 text-amber-100'
                            : 'bg-zinc-950/60 border-zinc-800/70 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-amber-400 shrink-0">
                            {step.index === 0
                              ? 't0'
                              : step.index === trajectorySteps.length - 1
                              ? 'now'
                              : `t${step.index}`}
                          </span>
                          <span className="truncate">{step.label}</span>
                        </div>
                        {step.deltaPips && (
                          <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                            {formatPipSummary(step.deltaPips, true)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. What-If Card Swap Simulator */}
          <div className="bg-zinc-900/75 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-amber-200 tracking-wide">
                  What-If Card Swap Simulator
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Preview exact Color Pie drift before editing your deck
                </p>
              </div>
              <button
                type="button"
                onClick={handleApplyDemoSwap}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-cyan-200 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Demo: Swap 2W1R → 3W2R
              </button>
            </div>

            {/* Remove card or custom pips */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-zinc-300">Remove From Deck</label>
                <div className="inline-flex rounded-md bg-zinc-950 border border-zinc-800 p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveMode('deck');
                      setSwapEnabled(true);
                    }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      removeMode === 'deck' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Deck Card
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveMode('custom');
                      setSwapEnabled(true);
                    }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      removeMode === 'custom' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Custom Pips
                  </button>
                </div>
              </div>

              {removeMode === 'deck' ? (
                <select
                  value={selectedRemoveCardId}
                  onChange={e => {
                    setSelectedRemoveCardId(e.target.value);
                    setSwapEnabled(true);
                  }}
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">None (Add only)</option>
                  {swappableDeckCards.map(card => {
                    const cost = formatCardManaCost(card);
                    return (
                      <option key={card.id} value={card.id}>
                        {card.name} {cost ? `(${cost})` : ''} ×{card.quantity}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  value={customRemoveCost}
                  onChange={e => {
                    setCustomRemoveCost(e.target.value);
                    setSwapEnabled(true);
                  }}
                  placeholder="e.g. 2W 1R or {1}{W}{R}"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
              )}
            </div>

            {/* Replacement card pips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-300">Add Card Name</label>
                <input
                  type="text"
                  value={addCardName}
                  onChange={e => {
                    setAddCardName(e.target.value);
                    setSwapEnabled(true);
                  }}
                  placeholder="Replacement card"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-300">Add Card Pips</label>
                <input
                  type="text"
                  value={addCardCost}
                  onChange={e => {
                    setAddCardCost(e.target.value);
                    setSwapEnabled(true);
                  }}
                  placeholder="e.g. 3W 2R or {W}{W}{R}"
                  className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSwapEnabled(prev => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  swapEnabled
                    ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-amber-500/40 hover:text-amber-200'
                }`}
              >
                {swapEnabled ? 'Preview Active' : 'Simulate Swap'}
              </button>

              {swapEnabled && (
                <div className="flex items-center gap-1.5">
                  {swapResult && (
                    <button
                      type="button"
                      onClick={() =>
                        animateViewBoxTo(
                          computeFocusViewBox([
                            pointToCanvas(swapResult.before),
                            pointToCanvas(swapResult.after),
                          ])
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg text-xs text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 transition-colors cursor-pointer"
                    >
                      Zoom to Swap
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSwapEnabled(false)}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Live Delta Output */}
            {swapResult && (
              <div className="rounded-xl bg-zinc-950/90 border border-cyan-500/25 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cyan-300 font-semibold">Projected Shift</span>
                  <span className="font-mono text-[11px] text-zinc-300">
                    Pip Delta: {formatPipSummary(swapResult.deltaPips, true)}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {WUBRG_ORDER.map(color => {
                    const deltaShare = swapResult.deltaShares[color];
                    const afterShare = swapResult.after.shares[color];
                    const hasChange = Math.abs(deltaShare) >= 0.0001;
                    return (
                      <div
                        key={`swap-delta-${color}`}
                        className="rounded-lg bg-zinc-900/90 border border-zinc-800 px-1.5 py-1.5 text-center"
                      >
                        <div className={`text-[10px] font-bold ${WEDGE_STYLES[color].textClass}`}>{color}</div>
                        <div className="font-mono text-[11px] text-zinc-200 mt-0.5">
                          {formatSharePct(afterShare)}
                        </div>
                        <div
                          className={`font-mono text-[10px] ${
                            !hasChange
                              ? 'text-zinc-600'
                              : deltaShare > 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {deltaShare > 0 ? '+' : ''}
                          {(deltaShare * 100).toFixed(2)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorPieMap;
