'use client';

import React, { useState } from 'react';
import { Layers, Map, Satellite, Mountain, Moon } from 'lucide-react';

export type BasemapType = 'satellite' | 'topo' | 'dark' | 'osm';

export interface BasemapOption {
  id: BasemapType;
  name: string;
  url: string;
  attribution: string;
  icon: any;
}

export const BASEMAP_OPTIONS: BasemapOption[] = [
  {
    id: 'satellite',
    name: 'Satellite (High-Res)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    icon: Satellite,
  },
  {
    id: 'topo',
    name: 'Topographic / Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap, OpenStreetMap contributors',
    icon: Mountain,
  },
  {
    id: 'dark',
    name: 'Dark Canvas',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB, OpenStreetMap',
    icon: Moon,
  },
  {
    id: 'osm',
    name: 'Street / OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    icon: Map,
  },
];

interface BasemapSelectorProps {
  selectedBasemap: BasemapType;
  onSelectBasemap: (id: BasemapType) => void;
}

export default function BasemapSelector({
  selectedBasemap,
  onSelectBasemap,
}: BasemapSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeOption = BASEMAP_OPTIONS.find((b) => b.id === selectedBasemap) || BASEMAP_OPTIONS[0];
  const Icon = activeOption.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 border border-[#2E3A4C] bg-[#141B26]/95 backdrop-blur-md px-3 py-1.5 text-[12px] text-[#E9E4D6] hover:border-[#8A6A32] transition-colors cursor-pointer shadow-xl rounded-sm"
        title="Switch Base Imagery"
      >
        <Icon className="w-3.5 h-3.5 text-[#C8963E]" />
        <span>{activeOption.name.split(' ')[0]}</span>
        <span className="text-[10px] text-[#7C8798]">▾</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 bg-[#1B2331] border border-[#2E3A4C] shadow-2xl py-1 z-[4000] min-w-[190px] rounded-sm">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[#7C8798] font-medium border-b border-[#2E3A4C] mb-1">
            Basemap Imagery
          </div>
          {BASEMAP_OPTIONS.map((opt) => {
            const OptIcon = opt.icon;
            const isSelected = selectedBasemap === opt.id;

            return (
              <button
                key={opt.id}
                onClick={() => {
                  onSelectBasemap(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-[#212B3B] text-[#E9E4D6] border-l-2 border-l-[#C8963E]' : 'text-[#B7BFCB] hover:bg-[#212B3B] hover:text-[#E9E4D6]'
                }`}
              >
                <OptIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#C8963E]' : 'text-[#7C8798]'}`} />
                <span>{opt.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
