'use client';

import React, { useRef } from 'react';
import { 
  GripVertical, 
  Square, 
  Pentagon, 
  Edit3, 
  Move, 
  Scissors, 
  Trash2, 
  Upload, 
  Hand,
  RotateCcw
} from 'lucide-react';

export type GeomanToolMode = 'pan' | 'rectangle' | 'polygon' | 'edit' | 'drag' | 'cut' | 'remove';

interface DraggableGeomanToolbarProps {
  activeTool: GeomanToolMode;
  onToolSelect: (tool: GeomanToolMode) => void;
  onClearAOI: () => void;
  onBoundaryUpload: (coords: number[][]) => void;
  aoiAreaHa: number;
  authoritativeAreaKm2?: number;
}

export default function DraggableGeomanToolbar({
  activeTool,
  onToolSelect,
  onClearAOI,
  onBoundaryUpload,
  aoiAreaHa,
  authoritativeAreaKm2
}: DraggableGeomanToolbarProps) {
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

  // Prefer backend geodesic area (single source of truth), fall back to frontend planar calc
  const aoiKm2 = authoritativeAreaKm2 !== undefined && authoritativeAreaKm2 > 0
    ? authoritativeAreaKm2.toFixed(2)
    : (aoiAreaHa > 0 ? (aoiAreaHa / 100).toFixed(2) : null);

  return (
    <div className="flex flex-col bg-[#141B26]/95 backdrop-blur-md border border-[#2E3A4C] shadow-2xl rounded-sm overflow-hidden min-w-[42px]">
      
      {/* Drag Grip Handle */}
      <div 
        className="flex items-center justify-center py-2 text-[#7C8798] hover:text-[#E9E4D6] cursor-grab active:cursor-grabbing border-b border-[#2E3A4C] bg-[#1B2331]"
        title="Click and drag anywhere to move this toolbar"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Tools Vertical Strip */}
      <div className="flex flex-col divide-y divide-[#2E3A4C]">
        
        {/* Draw Rectangle */}
        <button
          onClick={() => {
            const next = activeTool === 'rectangle' ? 'pan' : 'rectangle';
            onToolSelect(next);
            window.dispatchEvent(new CustomEvent(next === 'rectangle' ? 'map-tool-rectangle' : 'map-tool-pan'));
          }}
          className={`p-2.5 flex items-center justify-center transition-colors cursor-pointer ${
            activeTool === 'rectangle' ? 'bg-[#212B3B] text-[#C8963E]' : 'text-[#B7BFCB] hover:bg-[#212B3B] hover:text-[#E9E4D6]'
          }`}
          title="Draw Rectangle AOI"
        >
          <Square className="w-4 h-4" />
        </button>

        {/* Draw Polygon */}
        <button
          onClick={() => {
            const next = activeTool === 'polygon' ? 'pan' : 'polygon';
            onToolSelect(next);
            window.dispatchEvent(new CustomEvent(next === 'polygon' ? 'map-tool-polygon' : 'map-tool-pan'));
          }}
          className={`p-2.5 flex items-center justify-center transition-colors cursor-pointer ${
            activeTool === 'polygon' ? 'bg-[#212B3B] text-[#C8963E]' : 'text-[#B7BFCB] hover:bg-[#212B3B] hover:text-[#E9E4D6]'
          }`}
          title="Draw Freeform Polygon AOI"
        >
          <Pentagon className="w-4 h-4" />
        </button>

        {/* Edit Vertices */}
        <button
          onClick={() => {
            const next = activeTool === 'edit' ? 'pan' : 'edit';
            onToolSelect(next);
            window.dispatchEvent(new CustomEvent(next === 'edit' ? 'map-tool-edit' : 'map-tool-pan'));
          }}
          className={`p-2.5 flex items-center justify-center transition-colors cursor-pointer ${
            activeTool === 'edit' ? 'bg-[#212B3B] text-[#C8963E]' : 'text-[#B7BFCB] hover:bg-[#212B3B] hover:text-[#E9E4D6]'
          }`}
          title="Edit AOI Vertices"
        >
          <Edit3 className="w-4 h-4" />
        </button>

        {/* Drag / Move AOI */}
        <button
          onClick={() => {
            const next = activeTool === 'drag' ? 'pan' : 'drag';
            onToolSelect(next);
            window.dispatchEvent(new CustomEvent(next === 'drag' ? 'map-tool-drag' : 'map-tool-pan'));
          }}
          className={`p-2.5 flex items-center justify-center transition-colors cursor-pointer ${
            activeTool === 'drag' ? 'bg-[#212B3B] text-[#C8963E]' : 'text-[#B7BFCB] hover:bg-[#212B3B] hover:text-[#E9E4D6]'
          }`}
          title="Drag / Move AOI Layer"
        >
          <Move className="w-4 h-4" />
        </button>

        {/* Cut / Hole in Polygon */}
        <button
          onClick={() => {
            const next = activeTool === 'cut' ? 'pan' : 'cut';
            onToolSelect(next);
            window.dispatchEvent(new CustomEvent(next === 'cut' ? 'map-tool-cut' : 'map-tool-pan'));
          }}
          className={`p-2.5 flex items-center justify-center transition-colors cursor-pointer ${
            activeTool === 'cut' ? 'bg-[#212B3B] text-[#C8963E]' : 'text-[#B7BFCB] hover:bg-[#212B3B] hover:text-[#E9E4D6]'
          }`}
          title="Cut / Split Boundary"
        >
          <Scissors className="w-4 h-4" />
        </button>

        {/* Upload Boundary */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 flex items-center justify-center text-[#B7BFCB] hover:bg-[#212B3B] hover:text-[#E9E4D6] transition-colors cursor-pointer"
          title="Upload Concession Boundary (GeoJSON/KML)"
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".geojson,.json,.kml"
          className="hidden"
        />

        {/* Clear AOI / Removal Mode */}
        <button
          onClick={() => {
            onClearAOI();
            window.dispatchEvent(new CustomEvent('map-tool-clear'));
          }}
          className="p-2.5 flex items-center justify-center text-[#7C8798] hover:bg-[#212B3B] hover:text-[#B0554A] transition-colors cursor-pointer"
          title="Clear AOI"
        >
          <Trash2 className="w-4 h-4" />
        </button>

      </div>

      {/* Footer Area Readout */}
      {aoiKm2 && (
        <div className="px-1.5 py-2 text-[9.5px] text-[#C8963E] mono text-center border-t border-[#2E3A4C] bg-[#1B2331] leading-tight">
          {aoiKm2}<br/><span className="text-[8px] text-[#7C8798]">km²</span>
        </div>
      )}

    </div>
  );
}
