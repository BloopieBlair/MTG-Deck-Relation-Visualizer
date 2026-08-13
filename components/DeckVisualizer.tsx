
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import 'd3-transition';
import { select, Selection } from 'd3-selection';
import { 
  forceSimulation, 
  forceLink, 
  forceManyBody, 
  forceCenter, 
  forceX,
  forceY,
  Simulation, 
  ForceLink, 
  ForceManyBody 
} from 'd3-force';
import { drag, D3DragEvent, type DragBehavior } from 'd3-drag'; 
import { 
  zoom, 
  zoomTransform, 
  ZoomBehavior, 
  D3ZoomEvent, 
  ZoomTransform,
  zoomIdentity
} from 'd3-zoom';
import { polygonHull, polygonCentroid } from 'd3-polygon';
import type { ProcessedDeckCard, KeywordStyle, D3Node, D3Link, PinnedSearch, OrphanClusterInfo, AiClient } from '../types';
import { CardInfoPopup } from './CardInfoPopup';
import { XMarkIcon, CrownIcon, SparklesIcon } from './icons';
import { 
    ACTIVE_SEARCH_HIGHLIGHT_COLOR, 
    SINGLE_SEARCH_RESULT_HIGHLIGHT_COLOR,
    HOVERED_HAND_NODE_HIGHLIGHT_COLOR,
    HOVERED_HAND_NODE_HIGHLIGHT_STROKE_WIDTH,
    HAND_LINK_HIGHLIGHT_COLOR,
    HAND_LINK_HIGHLIGHT_STROKE_WIDTH,
    HAND_LINK_HIGHLIGHT_OPACITY,
    HAND_TO_HAND_LINK_HIGHLIGHT_COLOR,
    HAND_TO_HAND_LINK_HIGHLIGHT_STROKE_WIDTH,
    HAND_TO_HAND_LINK_HIGHLIGHT_OPACITY,
    HAND_PLACEHOLDER_IMAGE_URL,
    DECKLIST_HIGHLIGHT_COLOR,
    DECKLIST_HIGHLIGHT_STROKE_WIDTH,
    DECKLIST_LINK_HIGHLIGHT_COLOR,
    DECKLIST_LINK_HIGHLIGHT_STROKE_WIDTH,
    DECKLIST_LINK_HIGHLIGHT_OPACITY
} from '../constants';


interface DeckVisualizerProps {
  cards: ProcessedDeckCard[];
  keywordConfig: KeywordStyle[]; 
  onNodeSelectionChange: (node: D3Node | null, keywords: string[] | null) => void;
  onCardKeywordsUpdate: (cardId: string, updatedKeywords: string[]) => void;
  allKeywordStyles: KeywordStyle[];
  weaklyConnectedHighlightSet: Set<string>;
  selectedNodeForPopup: D3Node | null; 
  drawnSampleHand: ProcessedDeckCard[] | null;
  onCloseSampleHand: () => void; 
  activeSearchCardIds: Set<string>; 
  pinnedSearches: PinnedSearch[];   
  singleActiveSearchResultId: string | null; 
  onCardImageClick: (card: ProcessedDeckCard) => void; 
  orphanClusters: OrphanClusterInfo[];
  onDeleteNode: (cardId: string) => void;
  commanderId: string | null;
  selectedCardInListId: string | null;
  panToNodeId: string | null;
  onPanComplete: () => void;
  aiClient?: AiClient | null;
  highlightedColors: Set<string>;
  onOpenSimulator?: () => void;
}

const BASE_CHARGE_STRENGTH = -270; 
const SINGLE_RESULT_REPEL_STRENGTH_FACTOR = 10; 
const LINK_DISTANCE = 70;    
const LINK_STRENGTH = 0.07;  
const NODE_RADIUS_BASE = 5;  
const NODE_RADIUS_SCALE = 1.2; 
const POPUP_OFFSET_FROM_NODE_EDGE = 5; 

const DRAWN_CARD_STROKE_COLOR = "#FFFFFF"; 
const DRAWN_CARD_STROKE_WIDTH = 1.8; 

const ACTIVE_SEARCH_STROKE_WIDTH = 1.7; 
const SINGLE_SEARCH_RESULT_STROKE_WIDTH = 2.5; 
const PINNED_SEARCH_RING_THICKNESS = 1.8;

const WEAKLY_CONNECTED_STROKE_COLOR = "#EF4444"; 
const WEAKLY_CONNECTED_STROKE_WIDTH = 2.2; 
const DEFAULT_NODE_STROKE_COLOR = "#000000"; 
const DEFAULT_NODE_STROKE_WIDTH = 1.2; 

const ORPHAN_CLUSTER_HULL_COLOR = "#EF4444"; 
const ORPHAN_CLUSTER_TEXT_COLOR = "#F87171"; 
const ORPHAN_CLUSTER_HULL_PADDING = 15; 

const COMMANDER_ELIGIBLE_STROKE_COLOR = "#FACC15"; 
const COMMANDER_ELIGIBLE_STROKE_WIDTH = 2.2;


function linkArc(d: D3Link): string {
  const sourceNode = d.source as D3Node;
  const targetNode = d.target as D3Node;
  const sx = sourceNode.x ?? 0;
  const sy = sourceNode.y ?? 0;
  const tx = targetNode.x ?? 0;
  const ty = targetNode.y ?? 0;
  const { linkNum = 0, totalLinksInGroup = 1 } = d; 
  if (totalLinksInGroup <= 1 || sourceNode.id === targetNode.id) return `M${sx},${sy}L${tx},${ty}`;
  const dx = tx - sx; const dy = ty - sy; const dr = Math.sqrt(dx * dx + dy * dy);
  const midX = (sx + tx) / 2; const midY = (sy + ty) / 2;
  const normX = -dy; const normY = dx;
  const lengthPerp = Math.sqrt(normX * normX + normY * normY);
  const unitNormX = (lengthPerp === 0) ? 0 : normX / lengthPerp;
  const unitNormY = (lengthPerp === 0) ? 0 : normY / lengthPerp;
  const baseSeparation = dr / 7 < 10 ? 10 : dr / 7 ; 
  const offsetFactor = (linkNum - (totalLinksInGroup - 1) / 2) * baseSeparation;
  const controlX = midX + unitNormX * offsetFactor;
  const controlY = midY + unitNormY * offsetFactor;
  return `M${sx},${sy}Q${controlX},${controlY},${tx},${ty}`;
}

const MTG_COLOR_MAP: Record<string, string> = {
  W: '#fef3c7', // Creamy white
  U: '#0ea5e9', // Vibrant blue
  B: '#111827', // Dark charcoal/black
  R: '#ef4444', // Red
  G: '#22c55e', // Green
};

const getCardColors = (card: ProcessedDeckCard): string[] => {
  if (card.colors && card.colors.length > 0) return card.colors;
  
  const colors = new Set<string>();
  if (card.manaCostString) {
    const matches = card.manaCostString.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach(m => {
        const clean = m.replace(/[{}]/g, '').toUpperCase();
        const parts = clean.split('/');
        parts.forEach(p => {
          if (['W', 'U', 'B', 'R', 'G'].includes(p)) {
            colors.add(p);
          }
        });
      });
    }
  }
  
  if (colors.size === 0 && card.keywords.some(k => k.toLowerCase() === 'land') && card.producesMana) {
    card.producesMana.forEach(m => {
      if (['W', 'U', 'B', 'R', 'G'].includes(m)) {
        colors.add(m);
      }
    });
  }
  
  return Array.from(colors);
};

const isEldrazi = (card: ProcessedDeckCard): boolean => {
  const nameLower = card.name.toLowerCase();
  const textLower = (card.text || '').toLowerCase();
  const typeLineLower = ((card as any).typeLine || '').toLowerCase();
  const keywordLower = card.keywords.map(k => k.toLowerCase());
  return nameLower.includes('eldrazi') || textLower.includes('eldrazi') || typeLineLower.includes('eldrazi') || keywordLower.includes('eldrazi');
};

const getPathForWedge = (r: number, startAngleRad: number, endAngleRad: number): string => {
  const x1 = r * Math.cos(startAngleRad);
  const y1 = r * Math.sin(startAngleRad);
  const x2 = r * Math.cos(endAngleRad);
  const y2 = r * Math.sin(endAngleRad);
  return `M 0 0 L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 0 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
};


export const DeckVisualizer = ({ 
    cards, 
    keywordConfig, 
    onNodeSelectionChange, 
    onCardKeywordsUpdate, 
    allKeywordStyles,
    weaklyConnectedHighlightSet,
    selectedNodeForPopup, 
    drawnSampleHand,
    onCloseSampleHand, 
    activeSearchCardIds,
    pinnedSearches,
    singleActiveSearchResultId,
    onCardImageClick,
    orphanClusters,
    onDeleteNode,
    commanderId,
    selectedCardInListId,
    panToNodeId,
    onPanComplete,
    aiClient,
    highlightedColors,
    onOpenSimulator
}: DeckVisualizerProps): React.ReactElement | null => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  const simulationRef = useRef<Simulation<D3Node, D3Link> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const prevCommanderIdRef = useRef<string | null>(null);
  const [hoveredHandCardId, setHoveredHandCardId] = useState<string | null>(null);
  const [activeLinkInfo, setActiveLinkInfo] = useState<any>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);

  const drawnCardIds = useMemo(() => new Set(drawnSampleHand?.map(c => c.id) || []), [drawnSampleHand]);
  
  const calculatePopupPosition = useCallback((node: D3Node, transform: ZoomTransform, dims: {width: number, height: number}): { x: number; y: number } => {
    const nx = (node.fx ?? node.x ?? 0) * transform.k + transform.x + dims.width / 2;
    const ny = (node.fy ?? node.y ?? 0) * transform.k + transform.y + dims.height / 2;
    const offset = NODE_RADIUS_BASE + Math.log2(Math.max(1, node.quantity)) * NODE_RADIUS_SCALE + POPUP_OFFSET_FROM_NODE_EDGE;
    return { x: Math.max(5, Math.min(dims.width - 325, nx + offset)), y: Math.max(5, Math.min(dims.height - 405, ny + offset)) };
  }, []);

  const handleClosePopup = useCallback(() => { 
      onNodeSelectionChange(null, null); 
      setPopupPosition(null);
      setActiveLinkInfo(null); 
  }, [onNodeSelectionChange]);

  const handleFitToScreen = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current || !simulationRef.current) return;
    const nodes = simulationRef.current.nodes();
    if (nodes.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    
    const dx = maxX - minX;
    const dy = maxY - minY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    
    const padding = 100;
    const scaleX = svgDimensions.width / (dx + padding);
    const scaleY = svgDimensions.height / (dy + padding);
    const scale = Math.max(0.15, Math.min(2.5, Math.min(scaleX, scaleY) * 0.85));
    
    const transform = zoomIdentity.scale(scale).translate(-cx, -cy);
    select(svgRef.current)
      .transition()
      .duration(750)
      .call(zoomBehaviorRef.current!.transform, transform);
  }, [svgDimensions]);

  useEffect(() => {
    const currentSvgContainer = svgContainerRef.current;
    if (!currentSvgContainer) return;
    const updateDimensions = () => setSvgDimensions({ width: currentSvgContainer.clientWidth, height: currentSvgContainer.clientHeight });
    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(currentSvgContainer);
    return () => resizeObserver.unobserve(currentSvgContainer);
  }, []);

  const activeKeywords = useMemo(() => keywordConfig.filter(kw => kw.enabled).map(kw => ({ ...kw, name: kw.name.toLowerCase() })), [keywordConfig]);

  useEffect(() => {
    if (!svgRef.current || svgDimensions.width === 0 || svgDimensions.height === 0 || !svgContainerRef.current) return;
    const svg = select(svgRef.current).attr("width", svgDimensions.width).attr("height", svgDimensions.height).attr("viewBox", [-svgDimensions.width / 2, -svgDimensions.height / 2, svgDimensions.width, svgDimensions.height].join(' '));
    svg.selectAll(".links, .nodes, .orphan-clusters").remove(); 
    svg.select("defs").selectAll(".dynamic-gradient").remove();
    // Use the tooltip div that exists in index.html to avoid DOM conflicts with React
    const tooltip = select(".tooltip"); 
    const d3Nodes: D3Node[] = cards.map(card => {
        const existingNodeFromSim = simulationRef.current?.nodes().find(n => n.id === card.id);
        const isCurrentCommander = card.id === commanderId;
        let newFx = existingNodeFromSim?.fx ?? null;
        let newFy = existingNodeFromSim?.fy ?? null;
        if (commanderId) { if (isCurrentCommander) { newFx = 0; newFy = 0; } else { newFx = null; newFy = null; } } 
        else if (prevCommanderIdRef.current === card.id) { newFx = null; newFy = null; }
        return { ...card, x: existingNodeFromSim?.x ?? (Math.random() - 0.5) * svgDimensions.width * 0.5, y: existingNodeFromSim?.y ?? (Math.random() - 0.5) * svgDimensions.height * 0.5, fx: newFx, fy: newFy };
    });

    // Generate dynamic gradients for 2-color cards
    const uniqueGradients = new Set<string>();
    d3Nodes.forEach(node => {
      const colors = getCardColors(node);
      if (colors.length === 2) {
        uniqueGradients.add(colors.join('-'));
      }
    });
    
    const defs = svg.select("defs");
    uniqueGradients.forEach(gradKey => {
      const colors = gradKey.split('-');
      const gradId = `grad-${gradKey}`;
      const grad = defs.append("linearGradient")
        .attr("id", gradId)
        .attr("class", "dynamic-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");
        
      const numColors = colors.length;
      colors.forEach((colCode, idx) => {
        const color = MTG_COLOR_MAP[colCode] || '#6b7280';
        const startOffset = `${(idx / numColors) * 100}%`;
        const endOffset = `${((idx + 1) / numColors) * 100}%`;
        grad.append("stop").attr("offset", startOffset).attr("stop-color", color);
        grad.append("stop").attr("offset", endOffset).attr("stop-color", color);
      });
    });

    const linksByPair: Map<string, any[]> = new Map();
    activeKeywords.forEach(kwStyle => {
      const cardsWithKw = d3Nodes.filter(n => (n.keywords || []).map(k => k.toLowerCase()).includes(kwStyle.name));
      for (let i = 0; i < cardsWithKw.length; i++) {
        for (let j = i + 1; j < cardsWithKw.length; j++) {
          const pairKey = [cardsWithKw[i].id, cardsWithKw[j].id].sort().join('--');
          if (!linksByPair.has(pairKey)) linksByPair.set(pairKey, []);
          linksByPair.get(pairKey)!.push({ keyword: kwStyle.name, color: kwStyle.color });
        }
      }
    });

    const finalLinks: D3Link[] = [];
    linksByPair.forEach((linkData, key) => {
      const [sourceId, targetId] = key.split('--');
      linkData.forEach((li, idx) => {
        finalLinks.push({ source: sourceId, target: targetId, keyword: li.keyword, color: li.color, linkNum: idx, totalLinksInGroup: linkData.length });
      });
    });
    
    const linkGroup = svg.append("g").attr("class", "links");
    const nodeGroup = svg.append("g").attr("class", "nodes");
    const orphanClusterGroup = svg.append("g").attr("class", "orphan-clusters");

    // Restore the zoom transform from the SVG element to keep the view in sync across re-renders
    const currentTransform = zoomTransform(svgRef.current!);
    linkGroup.attr("transform", currentTransform);
    nodeGroup.attr("transform", currentTransform);
    orphanClusterGroup.attr("transform", currentTransform);

    const linkElements = linkGroup.selectAll<SVGPathElement, D3Link>("path.link").data(finalLinks, d => `${[typeof d.source === 'string' ? d.source : (d.source as any).id, typeof d.target === 'string' ? d.target : (d.target as any).id].sort().join('--')}-${d.keyword}`);
    linkElements.exit().remove();
    const allLinks = linkElements.enter().append("path").attr("class", "link").attr("fill", "none")
        .on("click", (e, d) => {
            e.stopPropagation();
            const sourceId = typeof d.source === 'string' ? d.source : (d.source as D3Node).id;
            const targetId = typeof d.target === 'string' ? d.target : (d.target as D3Node).id;
            setActiveLinkInfo({
                keyword: d.keyword,
                color: d.color,
                sourceId,
                targetId
            });
        })
        .merge(linkElements);

    const nodeElements = nodeGroup.selectAll<SVGGElement, D3Node>("g.node-group").data(d3Nodes, d => d.id);
    nodeElements.exit().remove();
    const nodeEnter = nodeElements.enter().append("g").attr("class", "node-group");
    nodeEnter.append("circle").attr("class", "base-node-circle");
    nodeEnter.append("text").attr("class", "node-label").attr("text-anchor", "middle").style("font-size", "0.7rem").style("pointer-events", "none");
    nodeEnter.append("g").attr("class", "commander-crown-group");
    const allNodes = nodeEnter.merge(nodeElements);

    allNodes.each(function(d) {
        const g = select(this); 
        g.selectAll("circle.pin-highlight-ring").remove(); 
        g.select(".commander-crown-group").selectAll("*").remove(); 
        g.selectAll("path.eldrazi-star").remove();
        
        const baseR = NODE_RADIUS_BASE + Math.log2(Math.max(1, d.quantity)) * NODE_RADIUS_SCALE;
        const baseCircle = g.select<SVGCircleElement>("circle.base-node-circle").attr("r", baseR);
        
        let colors = getCardColors(d);
        const isEldraziCard = colors.length === 0 && isEldrazi(d);
        
        let fillVal = '#4b5563'; // default gray for colorless
        if ((d.keywords || []).map(k=>k.toLowerCase()).includes('land') && colors.length === 0) {
          fillVal = '#374151'; // dark gray for colorless lands
        }
        
        g.selectAll("path.color-segment").remove();
        
        if (colors.length <= 2) {
          if (colors.length === 1) {
            fillVal = MTG_COLOR_MAP[colors[0]] || '#4b5563';
          } else if (colors.length === 2) {
            fillVal = `url(#grad-${colors.join('-')})`;
          }
          baseCircle.attr("fill", fillVal).style("display", null);
        } else {
          baseCircle.attr("fill", "none");
          
          if (colors.length > 4) {
            colors = ['W', 'U', 'B', 'R', 'G'];
          }
          
          const numColors = colors.length;
          colors.forEach((colCode, idx) => {
            const color = MTG_COLOR_MAP[colCode] || '#6b7280';
            const startAngle = idx * (2 * Math.PI / numColors) - Math.PI / 2;
            const endAngle = (idx + 1) * (2 * Math.PI / numColors) - Math.PI / 2;
            const pathD = getPathForWedge(baseR, startAngle, endAngle);
            
            g.insert("path", "circle.base-node-circle")
             .attr("class", "color-segment")
             .attr("d", pathD)
             .attr("fill", color)
             .style("pointer-events", "none");
          });
        }
        g.select<SVGTextElement>(".node-label").attr("y", baseR + 8).text(d.name.length > 15 ? d.name.substring(0,12) + "..." : d.name).attr("fill", "#bae6fd");

        if (isEldraziCard) {
            const starSize = baseR * 0.7;
            g.append("path")
             .attr("class", "eldrazi-star")
             .attr("d", `M 0,${-starSize} Q 0,0 ${starSize},0 Q 0,0 0,${starSize} Q 0,0 ${-starSize},0 Q 0,0 0,${-starSize}`)
             .attr("fill", "#cbd5e1")
             .attr("stroke", "#1f2937")
             .attr("stroke-width", 0.7)
             .style("pointer-events", "none");
        }

        if (d.id === commanderId) {
            baseCircle.attr("stroke", COMMANDER_ELIGIBLE_STROKE_COLOR).attr("stroke-width", 3);
            const crown = g.select(".commander-crown-group").append("path").attr("d", "M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2z").attr("fill", "#FACC15").attr("transform", `translate(0, ${-(baseR + 8)}) scale(${baseR/15}) translate(-12,-12)`);
        } else if (weaklyConnectedHighlightSet.has(d.id)) {
            baseCircle.attr("stroke", WEAKLY_CONNECTED_STROKE_COLOR).attr("stroke-width", WEAKLY_CONNECTED_STROKE_WIDTH);
        } else if (selectedCardInListId === d.id) {
            baseCircle.attr("stroke", DECKLIST_HIGHLIGHT_COLOR).attr("stroke-width", 2.5);
        } else if (activeSearchCardIds.has(d.id)) {
            baseCircle.attr("stroke", ACTIVE_SEARCH_HIGHLIGHT_COLOR).attr("stroke-width", 2);
        } else if (drawnCardIds.has(d.id)) {
            baseCircle.attr("stroke", DRAWN_CARD_STROKE_COLOR).attr("stroke-width", 2);
        } else {
            baseCircle.attr("stroke", DEFAULT_NODE_STROKE_COLOR).attr("stroke-width", DEFAULT_NODE_STROKE_WIDTH);
        }
        
        let ringR = baseR;
        pinnedSearches.filter(p => p.cardIds.has(d.id)).sort((a,b)=>a.pinOrder-b.pinOrder).forEach(p => {
            ringR += 2; g.append("circle").attr("class", "pin-highlight-ring").attr("r", ringR).attr("fill", "none").attr("stroke", p.color).attr("stroke-width", 2);
        });
    });

    allNodes.on("mouseover", (e, d) => { tooltip.style("opacity", .9).html(`<strong>${d.name}</strong>`).style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 28) + "px"); })
            .on("mouseout", () => tooltip.style("opacity", 0))
            .on("click", (e, d) => { e.stopPropagation(); if (selectedNodeForPopup?.id === d.id) handleClosePopup(); else { setPopupPosition(calculatePopupPosition(d, zoomTransform(svgRef.current!), svgDimensions)); onNodeSelectionChange(d, d.keywords); } });

    function ticked() {
      allLinks.attr("d", linkArc).each(function(dl) {
          const l = select(this); 
          const s = dl.source as D3Node; 
          const t = dl.target as D3Node;
          const sId = typeof s === 'string' ? s : s.id;
          const tId = typeof t === 'string' ? t : t.id;

          const currentStyle = keywordConfig.find(k => k.name.toLowerCase() === dl.keyword.toLowerCase());
          let color = currentStyle ? currentStyle.color : dl.color;
          let width = 1;
          let opacity = 0.6;

          if (drawnCardIds.has(sId) && drawnCardIds.has(tId)) { 
              color = "#fff"; 
              width = 2; 
              opacity = 0.9; 
          }
          
          if (activeLinkInfo && 
              activeLinkInfo.sourceId === sId && 
              activeLinkInfo.targetId === tId && 
              activeLinkInfo.keyword === dl.keyword) {
              width = 4;
              opacity = 1.0;
          }

          if (highlightedColors && highlightedColors.size > 0) {
            const sCol = getCardColors(s);
            const tCol = getCardColors(t);
            const sourceHighlighted = highlightedColors.has('C') ? sCol.length === 0 : sCol.some(c => highlightedColors.has(c));
            const targetHighlighted = highlightedColors.has('C') ? tCol.length === 0 : tCol.some(c => highlightedColors.has(c));
            if (!sourceHighlighted || !targetHighlighted) {
              opacity = 0.05;
            }
          }

          l.attr("stroke", color).attr("stroke-width", width).attr("stroke-opacity", opacity);
      });
      allNodes.attr("transform", d => `translate(${d.x},${d.y})`)
              .each(function(d) {
                  let nodeOpacity = 1.0;
                  if (highlightedColors && highlightedColors.size > 0) {
                     const isHighlighted = highlightedColors.has('C') ? getCardColors(d).length === 0 : getCardColors(d).some(c => highlightedColors.has(c));
                     if (!isHighlighted) {
                        nodeOpacity = 0.15;
                     }
                  }
                  select(this).attr("opacity", nodeOpacity);
              });
      
      orphanClusterGroup.selectAll<SVGGElement, OrphanClusterInfo>("g.orphan-cluster-group").data(orphanClusters, d => d.id).join(
          enter => {
            const g = enter.append("g").attr("class", "orphan-cluster-group");
            g.append("path").attr("class", "cluster-hull").attr("fill", "none").attr("stroke", ORPHAN_CLUSTER_HULL_COLOR).attr("stroke-width", 1.5).attr("stroke-dasharray", "4 4");
            g.append("text")
              .attr("class", "cluster-label")
              .attr("fill", ORPHAN_CLUSTER_TEXT_COLOR)
              .attr("font-size", "0.8rem")
              .attr("text-anchor", "middle")
              .attr("cursor", "help")
              .style("pointer-events", "auto")
              .text("Orphan Component ℹ️")
              .on("mouseover", (e) => {
                  tooltip.style("opacity", .95)
                         .html(`<strong>Orphan Component</strong><br/><span style="font-size: 11px; font-weight: normal; color: #cbd5e1; line-height: 1.4; display: block; max-width: 250px;">Cards in this cluster (often lands or standalone spells) do not share any active keyword synergies with the rest of the deck. This is normal, expected behavior for basic lands.</span>`)
                         .style("left", (e.pageX + 15) + "px")
                         .style("top", (e.pageY - 28) + "px");
              })
              .on("mouseout", () => {
                  tooltip.style("opacity", 0);
              });
            return g;
          }
      ).each(function(c) {
          const nodes = d3Nodes.filter(n => c.nodeIds.includes(n.id));
          const pts: [number, number][] = [];
          nodes.forEach(n => {
              const r = NODE_RADIUS_BASE + Math.log2(Math.max(1, n.quantity)) * NODE_RADIUS_SCALE + 15;
              const x = n.x ?? 0, y = n.y ?? 0;
              for(let i=0; i<8; i++) pts.push([x + r * Math.cos(i*Math.PI/4), y + r * Math.sin(i*Math.PI/4)]);
          });
          const hull = polygonHull(pts);
          if (hull) {
              select(this).select("path").attr("d", "M" + hull.join("L") + "Z");
              const ctr = polygonCentroid(hull); select(this).select("text").attr("x", ctr[0]).attr("y", ctr[1] - 15);
          }
      });
    }

    if (simulationRef.current) {
        simulationRef.current.nodes(d3Nodes)
            .force("link", forceLink<D3Node, D3Link>(finalLinks).id(d => d.id).distance(LINK_DISTANCE).strength(LINK_STRENGTH))
            .force("charge", forceManyBody<D3Node>().strength(d => singleActiveSearchResultId === d.id ? BASE_CHARGE_STRENGTH * 10 : BASE_CHARGE_STRENGTH))
            .force("x", forceX(0).strength(0.04))
            .force("y", forceY(0).strength(0.04))
            .alpha(0.3)
            .restart();
    } else {
        simulationRef.current = forceSimulation<D3Node, D3Link>(d3Nodes)
            .force("link", forceLink<D3Node, D3Link>(finalLinks).id(d => d.id).distance(LINK_DISTANCE).strength(LINK_STRENGTH))
            .force("charge", forceManyBody<D3Node>().strength(BASE_CHARGE_STRENGTH))
            .force("center", forceCenter(0, 0))
            .force("x", forceX(0).strength(0.04))
            .force("y", forceY(0).strength(0.04))
            .on("tick", ticked);
    }

    allNodes.call(drag<SVGGElement, D3Node>().on("start", (e, d) => { if (d.id !== commanderId) { if (!e.active) simulationRef.current!.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; } }).on("drag", (e, d) => { if (d.id !== commanderId) { d.fx = e.x; d.fy = e.y; } }).on("end", (e, d) => { if (d.id !== commanderId) { if (!e.active) simulationRef.current!.alphaTarget(0); d.fx = null; d.fy = null; } }));
    
    if (!zoomBehaviorRef.current) {
        zoomBehaviorRef.current = zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
    }
    
    // Always update the zoom listener to capture the latest state (closure)
    zoomBehaviorRef.current.on("zoom", e => {
        linkGroup.attr("transform", e.transform);
        nodeGroup.attr("transform", e.transform);
        orphanClusterGroup.attr("transform", e.transform);
        if (selectedNodeForPopup) {
             setPopupPosition(calculatePopupPosition(selectedNodeForPopup, e.transform, svgDimensions));
        }
    });

    svg.call(zoomBehaviorRef.current).on("dblclick.zoom", null);
    
    simulationRef.current.on("tick", ticked);
    prevCommanderIdRef.current = commanderId;
  }, [cards, activeKeywords, svgDimensions, onNodeSelectionChange, selectedNodeForPopup, weaklyConnectedHighlightSet, drawnCardIds, pinnedSearches, singleActiveSearchResultId, orphanClusters, commanderId, selectedCardInListId]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    
    // Update node opacities
    svg.selectAll<SVGGElement, D3Node>("g.node-group")
       .each(function(d) {
          let nodeOpacity = 1.0;
          if (highlightedColors && highlightedColors.size > 0) {
             const isHighlighted = highlightedColors.has('C') 
               ? getCardColors(d).length === 0 
               : getCardColors(d).some(c => highlightedColors.has(c));
             if (!isHighlighted) {
                nodeOpacity = 0.15;
             }
          }
          select(this).attr("opacity", nodeOpacity);
       });
       
    // Update link styles immediately on state changes
    svg.selectAll<SVGPathElement, D3Link>("path.link")
       .each(function(dl) {
          const s = dl.source as D3Node;
          const t = dl.target as D3Node;
          const sId = typeof s === 'string' ? s : s.id;
          const tId = typeof t === 'string' ? t : t.id;

          const currentStyle = keywordConfig.find(k => k.name.toLowerCase() === dl.keyword.toLowerCase());
          let color = currentStyle ? currentStyle.color : dl.color;
          let width = 1;
          let opacity = 0.6;

          if (drawnCardIds.has(sId) && drawnCardIds.has(tId)) {
             color = "#fff";
             width = 2;
             opacity = 0.9;
          }
          
          if (activeLinkInfo && 
              activeLinkInfo.sourceId === sId && 
              activeLinkInfo.targetId === tId && 
              activeLinkInfo.keyword === dl.keyword) {
              width = 4;
              opacity = 1.0;
          }
          
          if (highlightedColors && highlightedColors.size > 0) {
             const sCol = getCardColors(s);
             const tCol = getCardColors(t);
             const sourceHighlighted = highlightedColors.has('C') ? sCol.length === 0 : sCol.some(c => highlightedColors.has(c));
             const targetHighlighted = highlightedColors.has('C') ? tCol.length === 0 : tCol.some(c => highlightedColors.has(c));
             if (!sourceHighlighted || !targetHighlighted) {
                opacity = 0.05;
             }
          }
          select(this)
            .attr("stroke", color)
            .attr("stroke-width", width)
            .attr("stroke-opacity", opacity);
       });
  }, [highlightedColors, drawnCardIds, activeLinkInfo, keywordConfig]);

  useEffect(() => {
    if (panToNodeId && svgRef.current && zoomBehaviorRef.current && simulationRef.current) {
      const node = simulationRef.current.nodes().find(n => n.id === panToNodeId);
      if (node) {
        const transform = zoomIdentity.scale(1.2).translate(-(node.x ?? 0), -(node.y ?? 0));
        select(svgRef.current).transition().duration(750).call(zoomBehaviorRef.current!.transform, transform).on("end", onPanComplete);
      } else onPanComplete();
    }
  }, [panToNodeId, svgDimensions]);

  return (
    <div className="w-full h-full bg-gray-950 rounded-lg overflow-hidden relative flex flex-col text-sm" style={{ overscrollBehavior: 'none' }} >
        {drawnSampleHand && (
            <div className="relative bg-gray-800/90 p-2 border-b-2 border-cyan-600 shadow-md flex-shrink-0">
                <div className="absolute top-2.5 right-2.5 flex gap-2 z-10">
                    {onOpenSimulator && (
                        <button 
                            onClick={onOpenSimulator}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white rounded-md shadow-lg text-xs font-bold transition-all active:scale-95"
                        >
                            <SparklesIcon className="w-3.5 h-3.5" /> Explore Gameplay
                        </button>
                    )}
                    <button onClick={onCloseSampleHand} className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md shadow-lg transition-colors"><XMarkIcon className="w-6 h-6" /></button>
                </div>
                <h4 className="text-xs font-semibold text-cyan-400 mb-1.5 text-center">Sample Hand</h4>
                <div className="flex justify-center items-center space-x-1.5 overflow-x-auto pb-1 custom-scrollbar">
                    {drawnSampleHand.map((card, idx) => (
                        <div key={idx} className="flex-shrink-0 w-[12rem] h-[16.5rem] rounded-sm overflow-hidden border border-gray-600 shadow-md hover:shadow-cyan-400/30 transition-all cursor-pointer" onClick={() => onCardImageClick(card)} onMouseEnter={() => setHoveredHandCardId(card.id)} onMouseLeave={() => setHoveredHandCardId(null)}>
                            <img src={card.imageUrl || HAND_PLACEHOLDER_IMAGE_URL} className="w-full h-full object-contain" />
                        </div>
                    ))}
                </div>
            </div>
        )}
        {/* Render hovered hand card expanded preview */}
        {drawnSampleHand && hoveredHandCardId && (
            (() => {
                const hoveredHandCard = drawnSampleHand.find(c => c.id === hoveredHandCardId);
                if (!hoveredHandCard) return null;
                return (
                    <div 
                        className="absolute z-50 pointer-events-none rounded-lg overflow-hidden border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)] bg-gray-950 animate-fadeIn"
                        style={{ 
                            top: '19.5rem', 
                            left: '50%', 
                            transform: 'translateX(-50%)',
                            width: 'min(30rem, 90vw)',
                            height: 'min(41.25rem, 125vw)',
                        }}
                    >
                        <img src={hoveredHandCard.imageUrl || HAND_PLACEHOLDER_IMAGE_URL} className="w-full h-full object-contain" alt={hoveredHandCard.name} />
                    </div>
                );
            })()
        )}
        <div ref={svgContainerRef} className="flex-grow relative min-h-0" onClick={handleClosePopup}>
            <svg ref={svgRef}><defs></defs></svg>
            
            {/* Fit to Screen Button */}
            <div className="absolute bottom-4 right-4 z-40 flex flex-col gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); handleFitToScreen(); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-900/90 hover:bg-gray-800 border border-cyan-800/40 rounded-lg shadow-xl text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-all active:scale-95 select-none"
                    title="Fit whole graph to screen"
                >
                    🔍 Fit Graph
                </button>
            </div>
            {activeLinkInfo && (() => {
                const currentStyle = keywordConfig.find(k => k.name.toLowerCase() === activeLinkInfo.keyword.toLowerCase());
                const activeColor = currentStyle ? currentStyle.color : activeLinkInfo.color;
                return (
                    <div 
                        className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg shadow-2xl text-sm font-bold pointer-events-none border border-white/20 backdrop-blur-md animate-fadeIn"
                        style={{ 
                            backgroundColor: `${activeColor}D9`, // High opacity
                            color: '#fff',
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                            boxShadow: `0 0 15px ${activeColor}66`
                        }}
                    >
                       🔗 Connected by: <span className="uppercase tracking-wider ml-1">{activeLinkInfo.keyword}</span>
                    </div>
                );
            })()}
            {selectedNodeForPopup && popupPosition && (
                <CardInfoPopup node={selectedNodeForPopup} position={popupPosition} onClose={handleClosePopup} onUpdateKeywords={onCardKeywordsUpdate} allKeywordStyles={allKeywordStyles} onImageClick={onCardImageClick} onDeleteNode={onDeleteNode} aiClient={aiClient} allCardNames={cards.map(c => c.name)} />
            )}
        </div>
    </div>
  );
};
