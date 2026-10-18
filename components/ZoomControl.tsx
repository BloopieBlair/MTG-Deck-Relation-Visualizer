import React from 'react';

interface ZoomControlProps {
  zoomLevel: number;
  onZoomChange: (newZoomLevel: number) => void;
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

export const ZoomControl: React.FC<ZoomControlProps> = ({ zoomLevel, onZoomChange }) => {
  const handleZoomChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onZoomChange(parseInt(event.target.value, 10));
  };

  const increaseZoom = () => {
    onZoomChange(Math.min(zoomLevel + ZOOM_STEP, MAX_ZOOM));
  };

  const decreaseZoom = () => {
    onZoomChange(Math.max(zoomLevel - ZOOM_STEP, MIN_ZOOM));
  };

  return (
    <div className="hidden lg:flex items-center space-x-1.5 text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-800 rounded-lg px-2 py-1">
      <button
        onClick={decreaseZoom}
        disabled={zoomLevel <= MIN_ZOOM}
        className="w-5 h-5 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-40 transition-colors"
        aria-label="Decrease UI scale"
        title="Decrease UI Scale"
      >
        -
      </button>
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={ZOOM_STEP}
        value={zoomLevel}
        onChange={handleZoomChange}
        className="w-16 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
        aria-label="UI Scale slider"
      />
      <button
        onClick={increaseZoom}
        disabled={zoomLevel >= MAX_ZOOM}
        className="w-5 h-5 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-40 transition-colors"
        aria-label="Increase UI scale"
        title="Increase UI Scale"
      >
        +
      </button>
      <span className="w-10 text-right font-mono text-[11px] text-zinc-400 tabular-nums">{zoomLevel}%</span>
    </div>
  );
};
