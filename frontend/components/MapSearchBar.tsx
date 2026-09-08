'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import { SearchLocation } from './MapComponent';

interface MapSearchBarProps {
  onLocationSelect: (loc: SearchLocation) => void;
}

interface LocationSuggestion {
  id: string;
  label: string;
  shortLabel: string;
  lat: number;
  lng: number;
}

export default function MapSearchBar({ onLocationSelect }: MapSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // Check if user input is direct coordinates (e.g. "49.80, 73.10" or "-24.27, -69.05")
    const cleanQuery = searchQuery.trim();
    const coordMatch = cleanQuery.match(/^([-+]?\d{1,3}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const val1 = parseFloat(coordMatch[1]);
      const val2 = parseFloat(coordMatch[2]);
      // Detect if lat/lng or lng/lat (lat is between -90 and 90, lng between -180 and 180)
      let lat = val1;
      let lng = val2;
      if (Math.abs(val1) > 90 && Math.abs(val2) <= 90) {
        lat = val2;
        lng = val1;
      }
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        setSuggestions([{
          id: 'manual-coords',
          label: `Coordinates: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
          shortLabel: `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          lat,
          lng
        }]);
        setShowDropdown(true);
        return;
      }
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=6&addressdetails=1`
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
    }, 350);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Check for direct coordinate match first
      const cleanQuery = searchQuery.trim();
      const coordMatch = cleanQuery.match(/^([-+]?\d{1,3}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
      if (coordMatch) {
        const val1 = parseFloat(coordMatch[1]);
        const val2 = parseFloat(coordMatch[2]);
        let lat = val1;
        let lng = val2;
        if (Math.abs(val1) > 90 && Math.abs(val2) <= 90) {
          lat = val2;
          lng = val1;
        }
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          onLocationSelect({ lat, lng, label: `${lat.toFixed(4)}°, ${lng.toFixed(4)}°` });
          setShowDropdown(false);
          return;
        }
      }

      // If suggestions exist, select first
      if (suggestions.length > 0) {
        const first = suggestions[0];
        onLocationSelect({ lat: first.lat, lng: first.lng, label: first.label });
        setSearchQuery(first.shortLabel);
        setShowDropdown(false);
      }
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center border border-[#2E3A4C] bg-[#141B26] px-3 py-1.5 focus-within:border-[#C8963E] transition-colors">
        <Search className="w-3.5 h-3.5 text-[#7C8798] mr-2 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder="Search place, region, or enter Lat, Lng (e.g. 49.80, 73.10)…"
          className="bg-transparent text-[12px] text-[#E9E4D6] placeholder-[#7C8798] outline-none w-full"
        />
        {isSearching ? (
          <Loader2 className="w-3.5 h-3.5 text-[#C8963E] animate-spin shrink-0 ml-1.5" />
        ) : searchQuery ? (
          <button
            onClick={() => {
              setSearchQuery('');
              setSuggestions([]);
              setShowDropdown(false);
            }}
            className="text-[#7C8798] hover:text-[#E9E4D6] cursor-pointer ml-1.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Autocomplete Suggestions Dropdown with Top-Level Z-Index */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1B2331] border border-[#2E3A4C] shadow-2xl py-1 z-[4000] max-h-60 overflow-y-auto">
          {suggestions.map((sug) => (
            <button
              key={sug.id}
              onClick={() => {
                onLocationSelect({ lat: sug.lat, lng: sug.lng, label: sug.label });
                setSearchQuery(sug.shortLabel);
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-[#212B3B] text-[12px] transition cursor-pointer flex items-start gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-[#C8963E] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-[#E9E4D6] truncate">{sug.shortLabel}</div>
                <div className="text-[10px] text-[#7C8798] truncate">{sug.label}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
