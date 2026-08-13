
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
    <div className="flex items-center space-x-2 text-xs text-gray-300">
      <button
        onClick={decreaseZoom}
        disabled={zoomLevel <= MIN_ZOOM}
        className="px-2 py-1 bg-cyan-700 hover:bg-cyan-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Decrease zoom"
        title="Decrease Zoom"
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
        className="w-20 md:w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm accent-cyan-500"
        aria-label="Zoom slider"
      />
      <button
        onClick={increaseZoom}
        disabled={zoomLevel >= MAX_ZOOM}
        className="px-2 py-1 bg-cyan-700 hover:bg-cyan-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Increase zoom"
        title="Increase Zoom"
      >
        +
      </button>
      <span className="w-16 text-center tabular-nums" aria-live="polite">Zoom: {zoomLevel}%</span>
    </div>
  );
};
