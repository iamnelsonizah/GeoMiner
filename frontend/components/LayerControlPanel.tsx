'use client';

import React from 'react';

export interface LayerState {
  id: string;
  name: string;
  category: 'prospectivity' | 'spectral' | 'structural';
  visible: boolean;
  opacity: number;
  colorSwatch: string;
}

interface LayerControlPanelProps {
  layers: Record<string, LayerState>;
  onToggleLayer: (id: string) => void;
  onChangeOpacity?: (id: string, opacity: number) => void;
}

const LAYER_EXPLANATIONS: Record<string, string> = {
  prospectivity_heatmap: "AHP multi-criteria targeting heatmap synthesis (0.0 to 1.0 ranking).",
  mine_disturbance: "Detected active open-pit bench excavations, haul roads, and tailings infrastructure.",
  hydroxyl_clay: "Sentinel-2 B11/B12 band ratio mapping Al-OH and Fe-OH clay alteration (argillic/phyllic halos).",
  ferric_iron: "Sentinel-2 B4/B3 band ratio highlighting hematite, jarosite, and goethite in leached caps.",
  gossan: "Weathered massive sulfide index highlighting supergene oxidized iron outcrops.",
  alteration_composite: "False-color RGB alteration synthesis (Red=Clay, Green=Ferric, Blue=Ferrous).",
  dem_elevation: "SRTM 30m digital elevation model indicating topographic elevation.",
  slope: "Topographic slope gradient in degrees. Slopes > 35° or < 5° are masked.",
  lineament_density: "Sobel-filtered fault and fracture density per square kilometer.",
};

export default function LayerControlPanel({
  layers,
  onToggleLayer,
  onChangeOpacity
}: LayerControlPanelProps) {
  const activeCount = Object.values(layers).filter(l => l.visible).length;

  const groups = [
    { key: 'prospectivity', title: 'Prospectivity targeting' },
    { key: 'spectral', title: 'Spectral alteration' },
    { key: 'structural', title: 'Structural geophysics' }
  ];

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between text-[12.5px] font-medium text-[#E9E4D6]">
        <span>Map layers</span>
        <span className="text-[10.5px] text-[#7C8798] mono font-normal">
          {activeCount} active
        </span>
      </div>

      <div className="space-y-4">
        {groups.map(group => {
          const groupLayers = Object.values(layers).filter(l => l.category === group.key);
          if (groupLayers.length === 0) return null;

          return (
            <div key={group.key} className="space-y-1.5">
              <div className="text-[10.5px] text-[#7C8798] tracking-wide uppercase font-medium">
                {group.title}
              </div>

              <div className="space-y-0.5">
                {groupLayers.map((layer, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  const explanation = LAYER_EXPLANATIONS[layer.id] || "Remote sensing spatial layer";

                  return (
                    <div
                      key={layer.id}
                      onClick={() => onToggleLayer(layer.id)}
                      title={explanation}
                      className={`flex items-center justify-between py-2 px-1 text-[12px] transition-colors cursor-pointer group ${
                        !isLast ? 'border-b border-[#2E3A4C]' : ''
                      } ${layer.visible ? 'text-[#B7BFCB]' : 'text-[#7C8798]'}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          style={{ backgroundColor: layer.colorSwatch }}
                          className={`w-2.5 h-2.5 shrink-0 transition-opacity ${
                            layer.visible ? 'opacity-100' : 'opacity-25'
                          }`}
                        />
                        <span className={`truncate ${layer.visible ? 'text-[#E9E4D6]' : 'text-[#7C8798] group-hover:text-[#B7BFCB]'}`}>
                          {layer.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        {layer.visible && (
                          <span className="text-[10.5px] text-[#7C8798] mono">
                            {Math.round(layer.opacity * 100)}%
                          </span>
                        )}
                        <span className="text-[10px] text-[#556275] group-hover:text-[#C8963E] transition-colors" title={explanation}>
                          ⓘ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
