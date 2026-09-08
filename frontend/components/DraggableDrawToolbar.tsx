'use client';

import React, { useRef } from 'react';
import { GripVertical } from 'lucide-react';

interface DraggableDrawToolbarProps {
  activeTool: 'pan' | 'rectangle' | 'polygon';
  onToolSelect: (tool: 'pan' | 'rectangle' | 'polygon') => void;
  onClearAOI: () => void;
  onBoundaryUpload: (coords: number[][]) => void;
  aoiAreaHa: number;
}

export default function DraggableDrawToolbar({
  activeTool,
  onToolSelect,
  onClearAOI,
  onBoundaryUpload,
  aoiAreaHa
}: DraggableDrawToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let coords: number[][] = [];
        if (parsed.type === 'FeatureCollection' && parsed.features?.length > 0) {
          const geom = parsed.features[0].geometry;
          coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
        } else if (parsed.type === 'Feature') {
          const geom = parsed.geometry;
          coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
        } else if (parsed.type === 'Polygon') {
          coords = parsed.coordinates[0];
        }

        if (coords && coords.length >= 3) {
          onBoundaryUpload(coords);
        } else {
          alert('Could not find a valid Polygon in uploaded boundary file.');
        }
      } catch (err) {
        alert('Invalid GeoJSON file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const aoiKm2 = aoiAreaHa > 0 ? (aoiAreaHa / 100).toFixed(2) : '49.19';

  return (
    <div className="flex items-center gap-3 border border-[#2E3A4C] bg-[#141B26]/95 backdrop-blur-md px-3 py-1.5 shadow-2xl rounded-sm">
      
      {/* Drag Grip Handle */}
      <div 
        className="flex items-center text-[#7C8798] hover:text-[#E9E4D6] cursor-grab active:cursor-grabbing pr-1 border-r border-[#2E3A4C]"
        title="Drag to reposition toolbar"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Rectangle Tool */}
      <button
        onClick={() => {
          const next = activeTool === 'rectangle' ? 'pan' : 'rectangle';
          onToolSelect(next);
          window.dispatchEvent(new CustomEvent(next === 'rectangle' ? 'map-tool-rectangle' : 'map-tool-pan'));
        }}
        className={`flex items-center gap-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
          activeTool === 'rectangle' ? 'text-[#C8963E]' : 'text-[#7C8798] hover:text-[#E9E4D6]'
        }`}
        title="Draw Rectangular AOI"
      >
        <span>◻</span>
        <span>Rectangle</span>
      </button>

      {/* Polygon Tool */}
      <button
        onClick={() => {
          const next = activeTool === 'polygon' ? 'pan' : 'polygon';
          onToolSelect(next);
          window.dispatchEvent(new CustomEvent(next === 'polygon' ? 'map-tool-polygon' : 'map-tool-pan'));
        }}
        className={`flex items-center gap-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
          activeTool === 'polygon' ? 'text-[#C8963E]' : 'text-[#7C8798] hover:text-[#E9E4D6]'
        }`}
        title="Draw Freeform Polygon AOI"
      >
        <span>⬠</span>
        <span>Polygon</span>
      </button>

      {/* Upload AOI */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 text-[12px] text-[#7C8798] hover:text-[#E9E4D6] transition-colors cursor-pointer"
        title="Upload GeoJSON/KML Boundary"
      >
        <span>↑</span>
        <span>Upload AOI</span>
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".geojson,.json,.kml"
        className="hidden"
      />

      {/* Clear AOI */}
      <button
        onClick={() => {
          onClearAOI();
          window.dispatchEvent(new CustomEvent('map-tool-clear'));
        }}
        className="flex items-center gap-1.5 text-[12px] text-[#7C8798] hover:text-[#B0554A] transition-colors cursor-pointer"
        title="Clear Drawn AOI"
      >
        <span>✕</span>
        <span>Clear</span>
      </button>

      {/* AOI Readout */}
      <div className="border-l border-[#2E3A4C] pl-3 text-[11.5px] text-[#7C8798] mono">
        {aoiKm2} km²
      </div>

    </div>
  );
}
