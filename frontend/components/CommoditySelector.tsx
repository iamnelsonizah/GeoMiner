'use client';

import React from 'react';

export interface CommodityProfile {
  name: string;
  sublabel: string;
  description: string;
  weights: {
    alteration: number;
    structure: number;
    gossan: number;
    terrain: number;
  };
  target_threshold: number;
  primary_alteration: string;
}

export const COMMODITY_MODELS: Record<string, CommodityProfile> = {
  porphyry_cu_au: {
    name: "Porphyry",
    sublabel: "Cu-Mo-Au",
    description: "Potassic-phyllic alteration indicators, terrain/SAR structural proxies, and gossanous surface responses.",
    weights: { alteration: 35, structure: 20, gossan: 25, terrain: 20 },
    target_threshold: 65,
    primary_alteration: "Phyllic (Sericite) & Potassic Alteration"
  },
  epithermal_au: {
    name: "Epithermal gold",
    sublabel: "Au-Ag",
    description: "High and low sulfidation gold systems with argillic clay halos, silica sinter caps, and major structural controls.",
    weights: { alteration: 34, structure: 22, gossan: 20, terrain: 24 },
    target_threshold: 68,
    primary_alteration: "Argillic / advanced argillic & silica"
  },
  lithium_pegmatite: {
    name: "Lithium clay-trend",
    sublabel: "LCT",
    description: "Lithium-bearing pegmatites at granitic intrusive contacts with Al-OH/Li-mica and structural dilatation zones.",
    weights: { alteration: 45, structure: 25, gossan: 15, terrain: 15 },
    target_threshold: 62,
    primary_alteration: "Lepidolite / Spodumene / Al-OH Mica"
  },
  iron_gossan: {
    name: "Iron oxide",
    sublabel: "Ferric",
    description: "Direct targeting of banded iron formations (BIF), massive hematite/magnetite outcrops, and weathered sulfide gossans.",
    weights: { alteration: 20, structure: 15, gossan: 50, terrain: 15 },
    target_threshold: 70,
    primary_alteration: "Ferric Oxides (Hematite / Goethite)"
  },
  vms_base_metals: {
    name: "VMS",
    sublabel: "Cu-Zn-Pb",
    description: "Volcanogenic Massive Sulfide targeting combining footwall chlorite/sericite alteration pipes and syn-volcanic lineaments.",
    weights: { alteration: 30, structure: 25, gossan: 35, terrain: 10 },
    target_threshold: 65,
    primary_alteration: "Sericite-Chlorite & Supergene Gossan"
  }
};

interface CommoditySelectorProps {
  selectedCommodity: string;
  onSelectCommodity: (key: string) => void;
  confidenceThreshold: number;
  onConfidenceChange: (threshold: number) => void;
  isThresholdLocked?: boolean;
  onToggleThresholdLock?: (locked: boolean) => void;
  disabled?: boolean;
}

export default function CommoditySelector({
  selectedCommodity,
  onSelectCommodity,
  confidenceThreshold,
  onConfidenceChange,
  isThresholdLocked = false,
  onToggleThresholdLock,
  disabled = false
}: CommoditySelectorProps) {
  const currentProfile = COMMODITY_MODELS[selectedCommodity] || COMMODITY_MODELS["epithermal_au"];

  return (
    <div className="space-y-4">
      <div className="text-[12.5px] font-medium text-[#E9E4D6]">
        Deposit model
      </div>

      {/* Vertical Model List */}
      <div className="border border-[#2E3A4C] bg-[#141B26]">
        {Object.entries(COMMODITY_MODELS).map(([key, model], idx, arr) => {
          const isSelected = selectedCommodity === key;
          const isLast = idx === arr.length - 1;

          return (
            <button
              key={key}
              disabled={disabled}
              onClick={() => {
                onSelectCommodity(key);
                onConfidenceChange(model.target_threshold);
              }}
              className={`w-full flex items-center justify-between py-2.5 px-3 text-[12.5px] text-left transition-colors cursor-pointer ${
                !isLast ? 'border-b border-[#2E3A4C]' : ''
              } ${
                isSelected
                  ? 'bg-[#212B3B] border-l-2 border-l-[#C8963E] text-[#E9E4D6] pl-[10px]'
                  : 'text-[#B7BFCB] hover:bg-[#1B2331] hover:text-[#E9E4D6]'
              }`}
            >
              <span className="font-normal">{model.name}</span>
              <span className="text-[10.5px] text-[#7C8798] mono">{model.sublabel}</span>
            </button>
          );
        })}
      </div>

      {/* Model Detail Card */}
      <div className="border border-[#2E3A4C] bg-[#1B2331] p-3.5 text-[12px] leading-relaxed">
        <div className="text-[13px] font-medium text-[#E9E4D6] mb-0.5">
          {currentProfile.name} ({currentProfile.sublabel})
        </div>
        <div className="text-[10.5px] text-[#C8963E] mb-2 font-medium">
          {currentProfile.primary_alteration}
        </div>
        <div className="text-[#7C8798] text-[11.5px] mb-3 leading-normal">
          {currentProfile.description}
        </div>

        {/* Evidence Weighting Bar */}
        <div className="flex justify-between text-[10.5px] text-[#7C8798] mb-1.5 pt-2 border-t border-[#2E3A4C]">
          <span>Evidence weighting</span>
          <span className="mono">AHP vector</span>
        </div>
        
        <div className="flex h-1.5 w-full bg-[#141B26] overflow-hidden">
          <div style={{ width: `${currentProfile.weights.alteration}%` }} className="bg-[#C8963E]" title="Alteration" />
          <div style={{ width: `${currentProfile.weights.structure}%` }} className="bg-[#4E8C85]" title="Structure" />
          <div style={{ width: `${currentProfile.weights.gossan}%` }} className="bg-[#B25A3A]" title="Gossan" />
          <div style={{ width: `${currentProfile.weights.terrain}%` }} className="bg-[#7C6FA3]" title="Terrain" />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-[#7C8798]">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#C8963E]" /> Alteration
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#4E8C85]" /> Structure
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#B25A3A]" /> Gossan
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#7C6FA3]" /> Terrain
          </div>
        </div>

        {/* Interactive Confidence Threshold Slider */}
        <div className="mt-3 pt-2.5 border-t border-[#2E3A4C] space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-[#7C8798]">Confidence threshold</span>
            <div className="flex items-center gap-2">
              {onToggleThresholdLock && (
                <button
                  type="button"
                  onClick={() => onToggleThresholdLock(!isThresholdLocked)}
                  className={`text-[9.5px] px-1.5 py-0.5 border cursor-pointer transition-colors ${
                    isThresholdLocked 
                      ? 'bg-[#2D2240] text-[#A89BC9] border-[#7C6FA3]' 
                      : 'bg-[#141B26] text-[#7C8798] border-[#2E3A4C] hover:text-[#B7BFCB]'
                  }`}
                  title="Lock threshold to perform consistent apples-to-apples comparison across deposit models"
                >
                  {isThresholdLocked ? '🔒 Locked' : '🔓 Lock'}
                </button>
              )}
              <span className="text-[#C8963E] mono font-semibold">{confidenceThreshold}%</span>
            </div>
          </div>
          <input
            type="range"
            min={40}
            max={85}
            step={1}
            value={confidenceThreshold}
            disabled={disabled}
            onChange={(e) => onConfidenceChange(Number(e.target.value))}
            className="w-full h-1 bg-[#141B26] rounded-lg appearance-none cursor-pointer accent-[#C8963E]"
          />
          <div className="flex justify-between text-[9px] text-[#7C8798] mono">
            <span>40% (Broad)</span>
            <span>Model default: {currentProfile.target_threshold}%</span>
            <span>85% (Selective)</span>
          </div>
        </div>

      </div>
    </div>
  );
}
