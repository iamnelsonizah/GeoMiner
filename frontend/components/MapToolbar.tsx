'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { SearchLocation } from './MapComponent';

interface MapToolbarProps {
  activeTool: 'pan' | 'rectangle' | 'polygon';
  onToolSelect: (tool: 'pan' | 'rectangle' | 'polygon') => void;
  onClearAOI: () => void;
  onBoundaryUpload: (coords: number[][]) => void;
  onLocationSelect: (loc: SearchLocation) => void;
  aoiAreaHa: number;
}

interface LocationSuggestion {
  id: string;
  label: string;
  shortLabel: string;
  lat: number;
  lng: number;
}

export default function MapToolbar({
  activeTool,
  onToolSelect,
  onClearAOI,
  onBoundaryUpload,
  onLocationSelect,
  aoiAreaHa
}: MapToolbarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
        );
        if (resp.ok) {
          const data = await resp.json();
          const parsed = data.map((item: any) => ({
            id: String(item.place_id),
            label: item.display_name,
            shortLabel: item.name || item.display_name.split(',')[0],
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
          }));
          setSuggestions(parsed);
          setShowDropdown(true);
        }
      } catch (e) {
        console.error('Geocoding search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

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
          alert('Could not find a valid Polygon in uploaded file.');
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
    <div className="flex items-center justify-between border-b border-[#2E3A4C] bg-[#141B26] px-4 py-2.5 z-[500] relative">
      
      {/* Search Input */}
      <div className="relative flex-1 max-w-xs mr-4">
        <div className="flex items-center border border-[#2E3A4C] bg-[#141B26] px-3 py-1.5 focus-within:border-[#8A6A32] transition-colors">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            placeholder="Search deposit location or region…"
            className="bg-transparent text-[12px] text-[#E9E4D6] placeholder-[#7C8798] outline-none w-full"
          />
          {isSearching ? (
            <Loader2 className="w-3 h-3 text-[#C8963E] animate-spin shrink-0 ml-1.5" />
          ) : searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSuggestions([]);
                setShowDropdown(false);
              }}
              className="text-[#7C8798] hover:text-[#E9E4D6] cursor-pointer ml-1.5"
            >
              <X className="w-3 h-3" />
            </button>
          ) : null}
        </div>

        {/* Suggestions Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1B2331] border border-[#2E3A4C] shadow-2xl py-1 z-[2000] max-h-56 overflow-y-auto">
            {suggestions.map((sug) => (
              <button
                key={sug.id}
                onClick={() => {
                  onLocationSelect({ lat: sug.lat, lng: sug.lng, label: sug.label });
                  setSearchQuery(sug.shortLabel);
                  setShowDropdown(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#212B3B] text-[12px] transition cursor-pointer"
              >
                <div className="font-normal text-[#E9E4D6] truncate">{sug.shortLabel}</div>
                <div className="text-[10px] text-[#7C8798] truncate">{sug.label}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Tools */}
      <div className="flex items-center gap-4">
        {/* Rectangle Tool */}
        <button
          onClick={() => {
            const next = activeTool === 'rectangle' ? 'pan' : 'rectangle';
            onToolSelect(next);
            window.dispatchEvent(new CustomEvent(next === 'rectangle' ? 'map-tool-rectangle' : 'map-tool-pan'));
          }}
          className={`flex items-center gap-1.5 text-[12px] transition-colors cursor-pointer ${
            activeTool === 'rectangle' ? 'text-[#C8963E]' : 'text-[#7C8798] hover:text-[#E9E4D6]'
          }`}
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
          className={`flex items-center gap-1.5 text-[12px] transition-colors cursor-pointer ${
            activeTool === 'polygon' ? 'text-[#C8963E]' : 'text-[#7C8798] hover:text-[#E9E4D6]'
          }`}
        >
          <span>⬠</span>
          <span>Polygon</span>
        </button>

        {/* Upload AOI */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-[12px] text-[#7C8798] hover:text-[#E9E4D6] transition-colors cursor-pointer"
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
          className="flex items-center gap-1.5 text-[12px] text-[#7C8798] hover:text-[#E9E4D6] transition-colors cursor-pointer"
        >
          <span>✕</span>
          <span>Clear</span>
        </button>
      </div>

      {/* AOI Readout */}
      <div className="ml-auto text-[11.5px] text-[#7C8798] mono font-normal pl-4">
        {aoiKm2} km²
      </div>

    </div>
  );
}
