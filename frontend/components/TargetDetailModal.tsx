'use client';

import React, { useState } from 'react';
import { X, Copy, Check, MapPin } from 'lucide-react';
import { ExplorationTarget } from './ProspectivityDashboard';

interface TargetDetailModalProps {
  target: ExplorationTarget | null;
  onClose: () => void;
  onZoomTo: (centroid: [number, number]) => void;
}

export default function TargetDetailModal({
  target,
  onClose,
  onZoomTo
}: TargetDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!target) return null;

  const handleCopyCoords = () => {
    const text = `${target.centroid[0]}, ${target.centroid[1]}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#141B26] border border-[#2E3A4C] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90dvh]">
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#2E3A4C] flex items-center justify-between bg-[#1B2331] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[14px] font-semibold text-[#E9E4D6] mono">
              {target.target_id}
            </span>
            <span className="text-[10px] text-[#C8963E] border border-[#8A6A32] px-2 py-0.5 tracking-wider uppercase font-medium">
              {target.priority}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:text-[#E9E4D6] text-[#7C8798] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-4 space-y-4 overflow-y-auto">
          
          {/* Metrics Row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="border border-[#2E3A4C] bg-[#141B26] p-3">
              <div className="text-[10px] text-[#7C8798] mb-1">AOI ranking score</div>
              <div className="text-[20px] font-medium text-[#E9E4D6] mono">
                {target.confidence_score}/100
              </div>
              <div className="text-[10px] text-[#7C8798] mt-1">relative evidence rank, not probability</div>
            </div>

            <div className="border border-[#2E3A4C] bg-[#141B26] p-3">
              <div className="text-[10px] text-[#7C8798] mb-1">Target footprint</div>
              <div className="text-[20px] font-medium text-[#E9E4D6] mono">
                {target.area_ha} <span className="text-[11px] text-[#7C8798] font-normal">ha</span>
              </div>
              <div className="text-[10px] text-[#7C8798] mt-1">{target.area_km2} km² outcrop</div>
            </div>
          </div>

          {/* Geological Rationale */}
          <div className="border border-[#2E3A4C] bg-[#1B2331] p-3 space-y-2 text-[12px]">
            <div className="text-[11px] font-medium text-[#E9E4D6] uppercase tracking-wider">
              Geological targeting rationale
            </div>

            <div className="space-y-1 text-[#B7BFCB]">
              <div className="flex justify-between py-1 border-b border-[#2E3A4C]">
                <span className="text-[#7C8798]">Alteration shell:</span>
                <span className="text-[#C8963E] font-medium">{target.alteration_shell || target.primary_alteration}</span>
              </div>
              {target.structural_setting && (
                <div className="flex justify-between py-1 border-b border-[#2E3A4C]">
                  <span className="text-[#7C8798]">Structural setting:</span>
                  <span className="text-[#4E8C85] font-medium text-right truncate max-w-[220px]">{target.structural_setting}</span>
                </div>
              )}
              {target.elevation_m !== undefined && (
                <div className="flex justify-between py-1 border-b border-[#2E3A4C]">
                  <span className="text-[#7C8798]">Surface elevation:</span>
                  <span className="mono text-[#E9E4D6]">{Math.round(target.elevation_m)} m ASL</span>
                </div>
              )}
              {target.disturbance_overlap_pct !== undefined && (
                <div className="flex justify-between py-1 border-b border-[#2E3A4C]">
                  <span className="text-[#7C8798]">Mine-disturbance overlap:</span>
                  <span className="mono text-[#E9E4D6]">{target.disturbance_overlap_pct.toFixed(1)}%</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-[#2E3A4C]">
                <span className="text-[#7C8798]">Centroid (Lat, Lon):</span>
                <span className="mono text-[#E9E4D6]">{target.centroid[0].toFixed(5)}°, {target.centroid[1].toFixed(5)}°</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#7C8798]">AOI rank:</span>
                <span className="mono text-[#E9E4D6]">#{target.rank} of {target.priority} targets</span>
              </div>
            </div>
          </div>

          {/* Recommended Next Step */}
          <div className="border border-[#8A6A32] bg-[#1B2331] p-3">
            <div className="text-[11px] text-[#C8963E] font-medium mb-1">Recommended Exploration Step</div>
            <p className="text-[11.5px] text-[#B7BFCB] leading-relaxed">
              {target.recommended_action}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 bg-[#1B2331] border-t border-[#2E3A4C] flex items-center justify-between">
          <button
            onClick={handleCopyCoords}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 border border-[#2E3A4C] text-[#B7BFCB] hover:text-[#E9E4D6] hover:border-[#3F4E64] transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#4E8C85]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy centroid'}</span>
          </button>

          <button
            onClick={() => {
              onZoomTo(target.centroid);
              onClose();
            }}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-4 py-1.5 bg-[#C8963E] text-[#1B140A] hover:bg-[#d8a548] transition cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Center on map</span>
          </button>
        </div>

      </div>
    </div>
  );
}
