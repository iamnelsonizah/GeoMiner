'use client';

import React, { useRef, useEffect, useState } from 'react';

export interface ExplorationTarget {
  target_id: string;
  rank?: number;
  priority: string;
  confidence_score: number;
  area_ha: number;
  area_km2: number;
  elevation_m?: number;
  alteration_shell?: string;
  structural_setting?: string;
  commodity: string;
  primary_alteration: string;
  centroid: [number, number];
  recommended_action: string;
  verification_status?: string;
  exclusion_reason?: string;
  deposit_model_audit?: string;
  resolution_uncertainty_ha?: number;
  is_sub_hectare?: boolean;
  disturbance_overlap_pct?: number;
}

export interface AreaStatistics {
  total_aoi_km2: number;
  total_aoi_ha: number;
  high_prospectivity: {
    area_km2: number;
    percentage: number;
    label: string;
  };
  medium_prospectivity: {
    area_km2: number;
    percentage: number;
    label: string;
  };
  low_prospectivity: {
    area_km2: number;
    percentage: number;
    label: string;
  };
}

interface ProspectivityDashboardProps {
  areaStats: AreaStatistics | null;
  targets: ExplorationTarget[];
  excludedTargets?: ExplorationTarget[];
  selectedTargetId: string | null;
  onSelectTarget: (target: ExplorationTarget) => void;
  onToggleVerification?: (targetId: string) => void;
  onExportGeoJSON: () => void;
  onExportCSV: () => void;
  onExportDXF?: () => void;
  onExportLeapfrog?: () => void;
  aoiAreaHa: number;
  isLoading?: boolean;
}

export default function ProspectivityDashboard({
  areaStats,
  targets,
  excludedTargets = [],
  selectedTargetId,
  onSelectTarget,
  onToggleVerification,
  onExportGeoJSON,
  onExportCSV,
  onExportDXF,
  onExportLeapfrog,
  aoiAreaHa,
  isLoading = false
}: ProspectivityDashboardProps) {
  const [activeTab, setActiveTab] = useState<'ranked' | 'excluded'>('ranked');

  const footprintKm2 = areaStats?.total_aoi_km2 !== undefined
    ? areaStats.total_aoi_km2.toFixed(2)
    : (aoiAreaHa > 0 ? (aoiAreaHa / 100).toFixed(2) : '0.00');
    
  const footprintHa = areaStats?.total_aoi_ha !== undefined
    ? areaStats.total_aoi_ha.toFixed(1)
    : (aoiAreaHa > 0 ? aoiAreaHa.toFixed(1) : '0.0');

  const hasTargets = targets.length > 0 && areaStats !== null;

  // Auto-scroll target list to top when new targets arrive
  const targetListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hasTargets && targetListRef.current) {
      targetListRef.current.scrollTop = 0;
    }
  }, [targets, hasTargets]);

  return (
    <div className="space-y-4">
      {/* Section Title */}
      <div className="text-[12.5px] font-medium text-[#E9E4D6]">
        Target results
      </div>

      {isLoading ? (
        <div className="border border-[#2E3A4C] bg-[#1B2331] p-5 text-center space-y-2">
          <div className="w-5 h-5 rounded-full border-2 border-[#2E3A4C] border-t-[#C8963E] animate-spin mx-auto" />
          <div className="text-[11.5px] text-[#7C8798] mono">Computing Earth Engine Evidence & Pit Screening...</div>
        </div>
      ) : !hasTargets ? (
        <div className="border border-dashed border-[#3F4E64] p-4 text-center">
          <div className="text-[13px] font-medium text-[#E9E4D6] mb-1">
            No targets generated
          </div>
          <div className="text-[11.5px] text-[#7C8798] leading-relaxed">
            Run generation to rank remote-sensing follow-up areas. A ranking score is not a discovery probability.
          </div>
        </div>
      ) : null}

      {/* Stat Row */}
      <div className="flex gap-2.5">
        <div className="flex-1 border border-[#2E3A4C] bg-[#141B26] p-2.5">
          <div className="text-[10px] text-[#7C8798] mb-1">AOI footprint</div>
          <div className="text-[16px] text-[#E9E4D6] mono font-medium">{footprintKm2}</div>
          <div className="text-[10px] text-[#7C8798] mt-0.5">km² · {footprintHa} ha</div>
        </div>

        <div className="flex-1 border border-[#2E3A4C] bg-[#141B26] p-2.5">
          <div className="text-[10px] text-[#7C8798] mb-1">Top ranking score</div>
          <div className={`text-[16px] mono font-medium ${hasTargets ? 'text-[#E9E4D6]' : 'text-[#7C8798]'}`}>
            {hasTargets && targets[0] ? `${targets[0].confidence_score}/100` : '—'}
          </div>
          <div className="text-[10px] text-[#7C8798] mt-0.5">
            {hasTargets ? 'relative AOI score' : 'awaiting run'}
          </div>
        </div>
      </div>

      {/* Ranked vs Excluded Targets Tab Navigation */}
      {(hasTargets || excludedTargets.length > 0) && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between border-b border-[#2E3A4C] pb-1.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('ranked')}
                className={`text-[11px] font-medium uppercase tracking-wider pb-1 transition-colors cursor-pointer ${
                  activeTab === 'ranked'
                    ? 'text-[#C8963E] border-b-2 border-[#C8963E]'
                    : 'text-[#7C8798] hover:text-[#B7BFCB]'
                }`}
              >
                Ranked Targets ({targets.length})
              </button>

              {excludedTargets.length > 0 && (
                <button
                  onClick={() => setActiveTab('excluded')}
                  className={`text-[11px] font-medium uppercase tracking-wider pb-1 transition-colors cursor-pointer ${
                    activeTab === 'excluded'
                      ? 'text-[#E74C3C] border-b-2 border-[#E74C3C]'
                      : 'text-[#7C8798] hover:text-[#E74C3C]'
                  }`}
                >
                  Excluded Pit/Works ({excludedTargets.length})
                </button>
              )}
            </div>
          </div>

          {/* Active Tab Content */}
          {activeTab === 'ranked' ? (
            <div ref={targetListRef} className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              {targets.map((tgt) => {
                const isSelected = selectedTargetId === tgt.target_id;
                const vStatus = tgt.verification_status || 'Remote-Sensing Only';

                return (
                  <div
                    key={tgt.target_id}
                    onClick={() => onSelectTarget(tgt)}
                    className={`border p-2.5 text-left transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'border-[#C8963E] bg-[#212B3B] text-[#E9E4D6]'
                        : 'border-[#2E3A4C] bg-[#1B2331] text-[#B7BFCB] hover:border-[#3F4E64] hover:bg-[#212B3B]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="font-semibold text-[#C8963E] mono">
                        #{tgt.rank} {tgt.target_id}
                      </span>
                      <span className="mono font-medium text-[#E9E4D6]">
                        {tgt.confidence_score}/100
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-[#7C8798]">
                      <span>
                        {tgt.area_ha} ha
                        {tgt.is_sub_hectare && (
                          <span className="text-[#8A96A6] text-[9px] pl-1 font-normal">(±0.2 ha res)</span>
                        )}
                      </span>
                      {tgt.elevation_m !== undefined && (
                        <span className="mono text-[#E9E4D6]">{Math.round(tgt.elevation_m)}m elev</span>
                      )}
                      <span className="mono">{tgt.centroid[0].toFixed(4)}, {tgt.centroid[1].toFixed(4)}</span>
                    </div>
                    
                    {/* Geological Alteration Shell Badge */}
                    <div className="flex flex-wrap gap-1 items-center pt-0.5">
                      <span className="inline-block px-1.5 py-0.5 text-[9px] bg-[#141B26] text-[#C8963E] border border-[#C8963E]/40 font-medium">
                        {tgt.alteration_shell || tgt.primary_alteration}
                      </span>

                      {/* Interactive Verification Workflow Hook */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleVerification) onToggleVerification(tgt.target_id);
                        }}
                        className={`px-1.5 py-0.5 text-[8.5px] border uppercase tracking-wider transition-colors cursor-pointer ${
                          vStatus === 'Assay-Confirmed'
                            ? 'bg-[#17332B] text-[#4E8C85] border-[#4E8C85]'
                            : vStatus === 'Field-Verified'
                            ? 'bg-[#1E3A37] text-[#95C5BD] border-[#3D7A6E]'
                            : 'bg-[#141B26] text-[#7C8798] border-[#3F4E64] hover:text-[#E9E4D6]'
                        }`}
                        title="Click to advance field verification status"
                      >
                        {vStatus}
                      </button>
                    </div>

                    {/* Structural Context */}
                    {tgt.structural_setting && (
                      <div className="text-[9.5px] text-[#7C8798] truncate">
                        {tgt.structural_setting}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Excluded Targets Tab */
            <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
              <div className="text-[10px] text-[#7C8798] leading-relaxed p-2 bg-[#1B2331] border border-[#E74C3C]/30 text-[#B7BFCB]">
                <strong className="text-[#E74C3C]">Mine-disturbance screening:</strong> The following {excludedTargets.length} anomalies exceeded the 15% disturbed-footprint threshold. Review imagery and field context because this is a screening mask, not a mine boundary.
              </div>

              {excludedTargets.map((tgt) => (
                <div
                  key={tgt.target_id}
                  onClick={() => onSelectTarget(tgt)}
                  className="border border-[#E74C3C]/40 bg-[#1B2331] p-2.5 text-left opacity-80 hover:opacity-100 transition-opacity cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#E74C3C] mono">
                      {tgt.target_id} (Disqualified)
                    </span>
                    <span className="mono text-[#7C8798]">{tgt.confidence_score}/100</span>
                  </div>
                  <div className="text-[10px] text-[#E74C3C]">
                    {tgt.exclusion_reason}
                  </div>
                  <div className="flex justify-between text-[9.5px] text-[#7C8798]">
                    <span>{tgt.area_ha} ha</span>
                    <span>{tgt.disturbance_overlap_pct?.toFixed(1) ?? '0.0'}% disturbed</span>
                    <span className="mono">{tgt.centroid[0].toFixed(4)}, {tgt.centroid[1].toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prospectivity Zonation Section */}
      <div className="space-y-2 pt-1">
        <div className="text-[12.5px] font-medium text-[#E9E4D6]">
          Prospectivity zonation
        </div>

        {!hasTargets ? (
          <div className="border border-dashed border-[#3F4E64] p-3 text-center">
            <div className="text-[11.5px] text-[#7C8798] leading-relaxed">
              Multi-criteria zonation breakdown appears here once targets are generated.
            </div>
          </div>
        ) : (
          <div className="border border-[#2E3A4C] bg-[#1B2331] p-3 space-y-2">
            <div className="flex h-2 w-full bg-[#141B26] overflow-hidden">
              <div style={{ width: `${areaStats.high_prospectivity.percentage}%` }} className="bg-[#C8963E]" title="High" />
              <div style={{ width: `${areaStats.medium_prospectivity.percentage}%` }} className="bg-[#4E8C85]" title="Medium" />
              <div style={{ width: `${areaStats.low_prospectivity.percentage}%` }} className="bg-[#2E3A4C]" title="Low" />
            </div>

            <div className="flex justify-between text-[10.5px] text-[#7C8798] pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#C8963E]" /> High ({areaStats.high_prospectivity.percentage}%)
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#4E8C85]" /> Moderate ({areaStats.medium_prospectivity.percentage}%)
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#2E3A4C]" /> Barren ({areaStats.low_prospectivity.percentage}%)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Options: GeoJSON, CSV, DXF (3D CAD/Leapfrog), Leapfrog Collar CSV */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[10.5px] text-[#7C8798] uppercase tracking-wider font-medium">
          Exploration Exports
        </div>
        
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onExportGeoJSON}
            disabled={!hasTargets}
            className={`border border-[#2E3A4C] py-2 text-center text-[11px] transition-colors cursor-pointer ${
              hasTargets
                ? 'text-[#B7BFCB] hover:text-[#E9E4D6] hover:border-[#C8963E] bg-[#141B26]'
                : 'text-[#7C8798] opacity-50 cursor-not-allowed bg-[#141B26]'
            }`}
            title="Export standard GIS Polygon GeoJSON"
          >
            GeoJSON
          </button>

          <button
            onClick={onExportCSV}
            disabled={!hasTargets}
            className={`border border-[#2E3A4C] py-2 text-center text-[11px] transition-colors cursor-pointer ${
              hasTargets
                ? 'text-[#B7BFCB] hover:text-[#E9E4D6] hover:border-[#C8963E] bg-[#141B26]'
                : 'text-[#7C8798] opacity-50 cursor-not-allowed bg-[#141B26]'
            }`}
            title="Export CSV target table with verification status"
          >
            CSV Summary
          </button>

          <button
            onClick={onExportDXF}
            disabled={!hasTargets || !onExportDXF}
            className={`border border-[#2E3A4C] py-2 text-center text-[11px] transition-colors cursor-pointer ${
              hasTargets
                ? 'text-[#B7BFCB] hover:text-[#E9E4D6] hover:border-[#C8963E] bg-[#141B26]'
                : 'text-[#7C8798] opacity-50 cursor-not-allowed bg-[#141B26]'
            }`}
            title="Export AutoCAD/Leapfrog Geo 3D DXF Polylines"
          >
            3D DXF (CAD)
          </button>

          <button
            onClick={onExportLeapfrog}
            disabled={!hasTargets || !onExportLeapfrog}
            className={`border border-[#2E3A4C] py-2 text-center text-[11px] transition-colors cursor-pointer ${
              hasTargets
                ? 'text-[#B7BFCB] hover:text-[#E9E4D6] hover:border-[#C8963E] bg-[#141B26]'
                : 'text-[#7C8798] opacity-50 cursor-not-allowed bg-[#141B26]'
            }`}
            title="Export Leapfrog Geo Drill Hole Collar Planning Table"
          >
            Leapfrog Collars
          </button>
        </div>
      </div>
    </div>
  );
}
