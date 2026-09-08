'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Globe, X, GraduationCap, HelpCircle } from 'lucide-react';

import CommoditySelector, { COMMODITY_MODELS } from '../components/CommoditySelector';
import LayerControlPanel, { LayerState } from '../components/LayerControlPanel';
import ProspectivityDashboard, { ExplorationTarget, AreaStatistics } from '../components/ProspectivityDashboard';
import TargetDetailModal from '../components/TargetDetailModal';
import TourGuideModal from '../components/TourGuideModal';
import MapSearchBar from '../components/MapSearchBar';
import DraggableGeomanToolbar, { GeomanToolMode } from '../components/DraggableGeomanToolbar';
import BasemapSelector, { BasemapType } from '../components/BasemapSelector';
import { DraggableContainer } from '../components/DraggableContainer';
import { SearchLocation } from '../components/MapComponent';

// Dynamically import MapComponent to prevent SSR Leaflet window errors
const MapComponent = dynamic(() => import('../components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0D1218] text-[#7C8798]">
      <div className="w-6 h-6 rounded-full border border-[#2E3A4C] border-t-[#C8963E] animate-spin" />
      <span className="text-[11px] mono mt-2 text-[#7C8798]">Initializing Leaflet Map Engine...</span>
    </div>
  )
});

// Benchmark exploration test sites & quick-jump bookmarks
const PROVINCE_BOOKMARKS = [
  {
    name: 'Karaganda Cu-Zn',
    region: 'Kazakhstan',
    commodity: 'vms_base_metals',
    center: [49.8029, 73.1021] as [number, number],
    zoom: 13,
  },
  {
    name: 'Escondida Cu-Au',
    region: 'Chile',
    commodity: 'porphyry_cu_au',
    center: [-24.27, -69.07] as [number, number],
    zoom: 12,
  },
  {
    name: 'Pilbara LCT Pegmatite',
    region: 'Australia',
    commodity: 'lithium_pegmatite',
    center: [-21.03, 119.74] as [number, number],
    zoom: 13,
  },
  {
    name: 'Witwatersrand Au',
    region: 'South Africa',
    commodity: 'epithermal_au',
    center: [-26.20, 28.04] as [number, number],
    zoom: 12,
  },
  {
    name: 'Iberian Pyrite Belt',
    region: 'Spain',
    commodity: 'vms_base_metals',
    center: [37.75, -6.95] as [number, number],
    zoom: 12,
  }
];

// Spherical polygon area calculation in hectares
const calculateAOIArea = (polygonCoords: number[][]) => {
  if (!polygonCoords || polygonCoords.length < 3) return 0;
  let totalArea = 0;
  const first = polygonCoords[0];
  const latRadian = (first[1] * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(latRadian);

  for (let i = 0; i < polygonCoords.length - 1; i++) {
    const p1 = polygonCoords[i];
    const p2 = polygonCoords[i + 1];
    const x1 = p1[0] * metersPerDegLng;
    const y1 = p1[1] * metersPerDegLat;
    const x2 = p2[0] * metersPerDegLng;
    const y2 = p2[1] * metersPerDegLat;
    totalArea += (x1 * y2) - (x2 * y1);
  }

  const p1 = polygonCoords[polygonCoords.length - 1];
  const p2 = polygonCoords[0];
  const x1 = p1[0] * metersPerDegLng;
  const y1 = p1[1] * metersPerDegLat;
  const x2 = p2[0] * metersPerDegLng;
  const y2 = p2[1] * metersPerDegLat;
  totalArea += (x1 * y2) - (x2 * y1);

  const areaSqMeters = Math.abs(totalArea) / 2;
  return areaSqMeters / 10000;
};

export default function GeoMinerPage() {
  const [selectedCommodity, setSelectedCommodity] = useState<string>('porphyry_cu_au');
  const [locationLabel, setLocationLabel] = useState<string>('Escondida Cu-Au, Chile');
  const [mapBounds, setMapBounds] = useState<[number, number, number, number] | null>(null);
  const [selectedBasemap, setSelectedBasemap] = useState<BasemapType>('satellite');
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(65);
  
  const [aoiCoords, setAoiCoords] = useState<number[][]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-24.27, -69.07]);
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [activeTool, setActiveTool] = useState<GeomanToolMode>('rectangle');
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null);

  const [maskVegetation, setMaskVegetation] = useState<boolean>(true);
  const [showScaleAlert, setShowScaleAlert] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('No follow-up areas ranked yet. Scores are relative to this AOI and require geological verification.');
  const [error, setError] = useState<string | null>(null);

  // Targets & Statistics State
  const [targets, setTargets] = useState<ExplorationTarget[]>([]);
  const [targetGeoJSON, setTargetGeoJSON] = useState<any | null>(null);
  const [areaStats, setAreaStats] = useState<AreaStatistics | null>(null);
  const [inspectedTarget, setInspectedTarget] = useState<ExplorationTarget | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  // Tile URLs returned by backend
  const [tileUrls, setTileUrls] = useState<Record<string, string>>({});

  // Active Layers State
  const [layers, setLayers] = useState<Record<string, LayerState>>({
    prospectivity_heatmap: {
      id: 'prospectivity_heatmap',
      name: 'Prospectivity heatmap',
      category: 'prospectivity',
      visible: true,
      opacity: 0.85,
      colorSwatch: '#C8963E'
    },
    target_polygons: {
      id: 'target_polygons',
      name: 'Ranked follow-up areas',
      category: 'prospectivity',
      visible: true,
      opacity: 1.0,
      colorSwatch: '#E9E4D6'
    },
    hydroxyl_clay: {
      id: 'hydroxyl_clay',
      name: 'Hydroxyl / clay (Al-OH)',
      category: 'spectral',
      visible: false,
      opacity: 0.7,
      colorSwatch: '#7C6FA3'
    },
    ferric_iron: {
      id: 'ferric_iron',
      name: 'Ferric iron / gossan (Fe³⁺)',
      category: 'spectral',
      visible: false,
      opacity: 0.7,
      colorSwatch: '#B25A3A'
    },
    gossan_index: {
      id: 'gossan_index',
      name: 'Gossan diagnostic ratio',
      category: 'spectral',
      visible: false,
      opacity: 0.7,
      colorSwatch: '#B25A3A'
    },
    lineament_density: {
      id: 'lineament_density',
      name: 'Terrain-edge density (structural proxy)',
      category: 'structural',
      visible: false,
      opacity: 0.75,
      colorSwatch: '#4E8C85'
    },
    fault_intersections: {
      id: 'fault_intersections',
      name: 'Directional-edge crossings (proxy)',
      category: 'structural',
      visible: false,
      opacity: 0.8,
      colorSwatch: '#3D8B7A'
    },
    alteration_shells: {
      id: 'alteration_shells',
      name: 'Hydrothermal alteration shells',
      category: 'spectral',
      visible: false,
      opacity: 0.75,
      colorSwatch: '#C8963E'
    },
    mine_disturbance: {
      id: 'mine_disturbance',
      name: 'Active pit / mine operations',
      category: 'spectral',
      visible: false,
      opacity: 0.65,
      colorSwatch: '#E74C3C'
    }
  });

  const [excludedTargets, setExcludedTargets] = useState<ExplorationTarget[]>([]);
  const [isThresholdLocked, setIsThresholdLocked] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [activeBackendUrl, setActiveBackendUrl] = useState<string>(
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'
  );

  useEffect(() => {
    let isMounted = true;
    const checkBackend = async () => {
      // Prioritize configured URL, then IPv4 127.0.0.1:8000, then localhost:8000
      const candidates = Array.from(new Set([
        process.env.NEXT_PUBLIC_BACKEND_URL,
        'http://127.0.0.1:8000',
        'http://localhost:8000',
      ].filter(Boolean))) as string[];

      let connected = false;
      for (const url of candidates) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const resp = await fetch(`${url}/health`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (resp.ok) {
            if (isMounted) {
              setActiveBackendUrl(url);
              setBackendStatus('online');
            }
            connected = true;
            break;
          }
        } catch {
          // Try next candidate
        }
      }

      if (!connected && isMounted) {
        setBackendStatus('offline');
      }
    };

    checkBackend();
    const timer = setInterval(checkBackend, 15000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);

  // Auto-launch tour for first-time visitors unless disabled
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dontShow = localStorage.getItem('geominer_tour_dont_show');
      const completed = localStorage.getItem('geominer_tour_completed');
      if (dontShow !== 'true' && completed !== 'true') {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleSelectBookmark = (bm: typeof PROVINCE_BOOKMARKS[0]) => {
    setMapCenter(bm.center);
    setMapZoom(bm.zoom);
    setLocationLabel(`${bm.name}, ${bm.region}`);
    setSelectedCommodity(bm.commodity);
    const profile = COMMODITY_MODELS[bm.commodity];
    if (profile && !isThresholdLocked) {
      setConfidenceThreshold(profile.target_threshold);
    }
    setAoiCoords([]);
    setTargets([]);
    setExcludedTargets([]);
    setTargetGeoJSON(null);
    setAreaStats(null);
    setSelectedTargetId(null);
    setTileUrls({});
    setError(null);
    setStatusMessage(`Navigated to ${bm.name} (${bm.region}). Ready to run ${COMMODITY_MODELS[bm.commodity]?.name || 'targeting'}.`);
  };

  const handleSelectCaseStudy = (districtKey: string) => {
    const bookmark = PROVINCE_BOOKMARKS.find(b => 
      b.name.toLowerCase().includes(districtKey.toLowerCase()) || 
      b.commodity.toLowerCase().includes(districtKey.toLowerCase())
    ) || PROVINCE_BOOKMARKS[1]; // default to Escondida
    handleSelectBookmark(bookmark);
  };

  const aoiAreaHa = useMemo(() => calculateAOIArea(aoiCoords), [aoiCoords]);

  const handleSelectCommodity = (key: string) => {
    setSelectedCommodity(key);
    const profile = COMMODITY_MODELS[key];
    if (profile && !isThresholdLocked) {
      setConfidenceThreshold(profile.target_threshold);
    }
  };

  const handleToggleVerification = (targetId: string) => {
    setTargets(prev => prev.map(t => {
      if (t.target_id === targetId) {
        const current = t.verification_status || 'Remote-Sensing Only';
        const next = current === 'Remote-Sensing Only' 
          ? 'Field-Verified' 
          : (current === 'Field-Verified' ? 'Assay-Confirmed' : 'Remote-Sensing Only');
        return { ...t, verification_status: next };
      }
      return t;
    }));
  };

  // Handler to toggle layers
  const handleToggleLayer = (id: string) => {
    setLayers(prev => ({
      ...prev,
      [id]: { ...prev[id], visible: !prev[id].visible }
    }));
  };

  // Main targeting execution trigger
  const runProspectivityTargeting = async () => {
    setIsLoading(true);
    setError(null);
    setStatusMessage(`Computing multi-criteria remote sensing evidence for ${locationLabel}...`);

    try {
      const thresholdVal = Number.isFinite(confidenceThreshold)
        ? Math.max(0.40, Math.min(0.85, confidenceThreshold / 100.0))
        : 0.65;

      const payload: any = {
        commodity: selectedCommodity,
        start_date: '2023-01-01',
        end_date: '2024-01-01',
        mask_vegetation: maskVegetation,
        custom_threshold: thresholdVal,
        // Fixed solar geometry is not defensible for a seasonal composite.
        apply_solar_correction: false
      };

      if (aoiCoords && aoiCoords.length >= 3) {
        payload.aoi = aoiCoords;
        payload.geometry = {
          type: 'Polygon',
          coordinates: [aoiCoords]
        };
      } else if (mapBounds && mapBounds.length === 4) {
        let [west, south, east, north] = mapBounds;
        const width = Math.abs(east - west);
        const height = Math.abs(north - south);
        // Optimize bounding box to reasonable exploration concession size (max ~40km)
        if (width > 0.35 || height > 0.35) {
          const midLng = (west + east) / 2;
          const midLat = (south + north) / 2;
          west = midLng - 0.10;
          east = midLng + 0.10;
          south = midLat - 0.08;
          north = midLat + 0.08;
        }
        payload.bbox = [west, south, east, north];
      } else {
        const [lat, lng] = mapCenter;
        payload.bbox = [lng - 0.10, lat - 0.08, lng + 0.10, lat + 0.08];
      }

      // 1. Run Prospectivity Target Generation
      const resp = await fetch(`${activeBackendUrl}/api/prospectivity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ detail: 'Targeting pipeline failed' }));
        const errorMessage = typeof errData.detail === 'string'
          ? errData.detail
          : (Array.isArray(errData.detail)
              ? errData.detail.map((e: any) => `${e.loc?.filter((x: string) => x !== 'body').join('.') || 'parameter'}: ${e.msg}`).join(', ')
              : (errData.detail ? JSON.stringify(errData.detail) : 'Targeting pipeline failed'));
        throw new Error(errorMessage);
      }

      const data = await resp.json();

      setTargets(data.targets || []);
      setExcludedTargets(data.excluded_targets || []);
      setTargetGeoJSON(data.target_geojson || null);
      setAreaStats(data.area_statistics || null);

      if (data.heatmap_tile_url) {
        setTileUrls(prev => ({ 
          ...prev, 
          prospectivity_heatmap: data.heatmap_tile_url,
          mine_disturbance: data.mine_disturbance_tile_url || prev.mine_disturbance
        }));
      }

      // 2. Fetch Supporting Layers asynchronously
      fetch(`${activeBackendUrl}/api/spectral-indices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.ok ? r.json() : null).then(specData => {
        if (specData?.layers) {
          setTileUrls(prev => ({ ...prev, ...specData.layers }));
        }
      }).catch(console.error);

      fetch(`${activeBackendUrl}/api/structural-layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.ok ? r.json() : null).then(structData => {
        if (structData?.layers) {
          setTileUrls(prev => ({ ...prev, ...structData.layers }));
        }
      }).catch(console.error);

      const excCount = data.excluded_targets?.length || 0;
      setStatusMessage(`Ranked ${data.targets?.length || 0} follow-up areas across ${data.area_statistics?.total_aoi_km2 || 0} km² (${excCount} possible mine-disturbance anomalies excluded). Scores are not probabilities or drill recommendations.`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during targeting.');
      setStatusMessage('Target generation encountered an error.');
    } finally {
      setIsLoading(false);
    }
  };

  // Export GeoJSON file
  const handleExportGeoJSON = () => {
    if (!targetGeoJSON) return;
    const blob = new Blob([JSON.stringify(targetGeoJSON, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GeoMiner_Targets_${selectedCommodity}_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV file
  const handleExportCSV = () => {
    if (targets.length === 0) return;
    const headers = [
      "Target ID", "Rank", "Priority", "Ranking score (0-100)", "Area (ha)", "Area (km2)", 
      "Elevation (m)", "Latitude", "Longitude", "Alteration Shell", "Structural Setting", 
      "Verification Status", "Deposit Model Audit", "Recommended Action"
    ];
    const rows = targets.map(t => [
      t.target_id,
      t.rank,
      t.priority,
      t.confidence_score,
      t.area_ha,
      t.area_km2,
      t.elevation_m || 2200,
      t.centroid[0],
      t.centroid[1],
      `"${t.alteration_shell || t.primary_alteration}"`,
      `"${t.structural_setting || 'Lineament Corridor'}"`,
      `"${t.verification_status || 'Remote-Sensing Only'}"`,
      `"${t.deposit_model_audit || COMMODITY_MODELS[selectedCommodity]?.name || selectedCommodity}"`,
      `"${t.recommended_action}"`
    ]);

    const csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GeoMiner_Drill_Targets_${selectedCommodity}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export AutoCAD R12 3D DXF for Leapfrog Geo & CAD software
  const handleExportDXF = () => {
    if (!targetGeoJSON || targets.length === 0) return;

    let dxf = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";

    const features = targetGeoJSON.features || [];
    features.forEach((feat: any) => {
      const coords = feat.geometry?.coordinates?.[0] || [];
      const props = feat.properties || {};
      const z = props.elevation_m || 2200.0;
      const targetId = props.target_id || "TARGET";
      const vStatus = props.verification_status || "RS";

      // 3D Polyline outline
      if (coords.length > 0) {
        dxf += `0\nPOLYLINE\n8\n${targetId}\n66\n1\n70\n1\n`;
        coords.forEach((pt: number[]) => {
          dxf += `0\nVERTEX\n8\n${targetId}\n10\n${pt[0]}\n20\n${pt[1]}\n30\n${z}\n`;
        });
        dxf += "0\nSEQEND\n";
      }

      // 3D Collar Point
      if (props.centroid) {
        dxf += `0\nPOINT\n8\n${targetId}_COLLAR\n10\n${props.centroid[1]}\n20\n${props.centroid[0]}\n30\n${z}\n`;
        dxf += `0\nTEXT\n8\n${targetId}_LABELS\n10\n${props.centroid[1]}\n20\n${props.centroid[0]}\n30\n${z}\n40\n0.0005\n1\n${targetId} (${props.confidence_score}%) [${vStatus}]\n`;
      }
    });

    dxf += "0\nENDSEC\n0\nEOF\n";

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GeoMiner_3D_Targets_${selectedCommodity}_${new Date().toISOString().slice(0, 10)}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Leapfrog Geo Drill Hole Collar Planning CSV
  const handleExportLeapfrog = () => {
    if (targets.length === 0) return;
    const headers = [
      "Hole_ID",
      "Planned_Longitude",
      "Planned_Latitude",
      "Planned_Elevation_m",
      "Priority",
      "Ranking_score_0_100",
      "Footprint_ha",
      "Alteration_Shell",
      "Structural_Setting",
      "Verification_Status",
      "Deposit_Model",
      "Recommended_Action"
    ];
    const rows = targets.map((t) => [
      `DH_${t.target_id.replace('-', '_')}`,
      t.centroid[1].toFixed(6),
      t.centroid[0].toFixed(6),
      (t.elevation_m || 2200.0).toFixed(1),
      t.priority,
      t.confidence_score,
      t.area_ha,
      `"${t.alteration_shell || t.primary_alteration}"`,
      `"${t.structural_setting || 'Lineament Corridor'}"`,
      `"${t.verification_status || 'Remote-Sensing Only'}"`,
      `"${t.deposit_model_audit || COMMODITY_MODELS[selectedCommodity]?.name || selectedCommodity}"`,
    ]);

    const csvContent = headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GeoMiner_Leapfrog_Collars_${selectedCommodity}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#141B26] text-[#B7BFCB]">
      
      {/* Top Bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#2E3A4C] shrink-0 bg-[#141B26] z-[2000]">
        <div className="flex items-center">
          <div className="flex items-center gap-3">
            <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="10.5" stroke="#8A6A32" strokeWidth="1.3" />
              <circle cx="14" cy="14" r="6.5" stroke="#C8963E" strokeWidth="1.3" />
              <circle cx="14" cy="14" r="1.6" fill="#C8963E" />
            </svg>
            <div>
              <div className="text-[14px] font-semibold text-[#E9E4D6] tracking-[0.2px] leading-tight">
                GeoMiner
              </div>
              <div className="text-[10.5px] text-[#7C8798] mt-0.5 leading-none">
                Remote sensing &amp; prospectivity targeting
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <div className="text-[10px] text-[#C8963E] border border-[#8A6A32] px-2 py-0.5 tracking-[0.3px]">
              EXPLORATION SUITE
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 border border-[#2E3A4C] bg-[#141B26] text-[10px] rounded-xs" title="Google Earth Engine Backend API status">
              <span className={`w-1.5 h-1.5 rounded-full ${
                backendStatus === 'online' ? 'bg-[#4E8C85] animate-pulse' : backendStatus === 'checking' ? 'bg-[#C8963E]' : 'bg-[#E74C3C]'
              }`} />
              <span className={backendStatus === 'online' ? 'text-[#AAB4C2]' : backendStatus === 'checking' ? 'text-[#C8963E]' : 'text-[#E74C3C]'}>
                {backendStatus === 'online' ? 'Engine Online' : backendStatus === 'checking' ? 'Connecting...' : 'Engine Offline'}
              </span>
            </div>
            <button
              onClick={() => setIsTourOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#C8963E] bg-[#1E2638] hover:bg-[#28344C] hover:text-[#DBA84E] border border-[#C8963E]/40 rounded-xs transition-colors cursor-pointer"
              title="Open Guided Tour and Educational Field Guide"
            >
              <GraduationCap className="w-3.5 h-3.5 text-[#C8963E]" />
              <span>Field Guide</span>
            </button>
          </div>
        </div>

        {/* Dynamic Global Location & Coordinates Readout */}
        <div className="flex items-center gap-2.5 bg-[#141B26] border border-[#2E3A4C] px-3 py-1.5 rounded-sm">
          <MapPin className="w-3.5 h-3.5 text-[#C8963E] shrink-0" />
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-[#E9E4D6] max-w-[280px] truncate" title={locationLabel}>
              {locationLabel}
            </span>
            <span className="text-[10.5px] text-[#7C8798] mono">
              {mapCenter[0].toFixed(3)}°, {mapCenter[1].toFixed(3)}°
            </span>
          </div>
        </div>

        {/* Right Top Actions */}
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => setMaskVegetation(!maskVegetation)}
            className="flex items-center gap-2 text-[11.5px] text-[#7C8798] hover:text-[#E9E4D6] transition-colors cursor-pointer"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                maskVegetation ? 'bg-[#4E8C85]' : 'bg-[#7C8798] opacity-50'
              }`}
            />
            <span>Vegetation mask {maskVegetation ? 'on' : 'off'}</span>
          </button>

          <button
            onClick={runProspectivityTargeting}
            disabled={isLoading}
            className={`bg-[#C8963E] text-[#1B140A] border-none px-4 py-2 text-[12.5px] font-semibold tracking-[0.2px] flex items-center gap-2 transition-opacity cursor-pointer ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#d8a548]'
            }`}
          >
            {isLoading ? (
              <div className="w-3 h-3 rounded-full border-2 border-[#1B140A] border-t-transparent animate-spin" />
            ) : (
              <span className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-left-[6px] border-l-[#1B140A]" />
            )}
            <span>{isLoading ? 'Targeting...' : 'Generate targets'}</span>
          </button>
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <div className="flex-1 grid grid-cols-[minmax(248px,280px)_minmax(0,1fr)_minmax(248px,280px)] overflow-hidden relative geoworkbench-grid">
        
        {/* Left Rail: Deposit Model & Layers */}
        <div className="border-r border-[#2E3A4C] overflow-y-auto p-4 bg-[#141B26] space-y-4">
          <CommoditySelector
            selectedCommodity={selectedCommodity}
            onSelectCommodity={handleSelectCommodity}
            confidenceThreshold={confidenceThreshold}
            onConfidenceChange={setConfidenceThreshold}
            isThresholdLocked={isThresholdLocked}
            onToggleThresholdLock={setIsThresholdLocked}
            disabled={isLoading}
          />

          <LayerControlPanel
            layers={layers}
            onToggleLayer={handleToggleLayer}
          />
        </div>

        {/* Center: Map Area */}
        <div className="flex flex-col h-full overflow-hidden bg-[#0D1218] relative">
          
          {/* Top Search Bar & Basemap Switcher */}
          <div className="p-2.5 border-b border-[#2E3A4C] bg-[#141B26] z-[1500] relative flex items-center justify-between gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[300px]">
              <MapSearchBar
                onLocationSelect={(loc) => {
                  setSearchLocation(loc);
                  setMapCenter([loc.lat, loc.lng]);
                  setMapZoom(13);
                  setLocationLabel(loc.label);
                  setAoiCoords([]);
                  setTargets([]);
                  setExcludedTargets([]);
                  setTargetGeoJSON(null);
                  setAreaStats(null);
                  setSelectedTargetId(null);
                  setTileUrls({});
                  setError(null);
                  setStatusMessage(`Navigated to ${loc.label}. Ready to generate targets.`);
                }}
              />

              {/* Quick-Jump Exploration Province Bookmarks */}
              <div className="hidden xl:flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[10px] text-[#7C8798] uppercase tracking-wider font-semibold mr-0.5 shrink-0">Bookmarks:</span>
                {PROVINCE_BOOKMARKS.map((bm) => (
                  <button
                    key={bm.name}
                    onClick={() => handleSelectBookmark(bm)}
                    className="px-2 py-1 bg-[#1B2331] hover:bg-[#222E40] text-[10.5px] text-[#AAB4C2] hover:text-[#E9E4D6] border border-[#2E3A4C] hover:border-[#C8963E]/60 transition-colors rounded-xs whitespace-nowrap cursor-pointer flex items-center gap-1"
                    title={`Fly to ${bm.name} (${bm.region})`}
                  >
                    <span>{bm.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <BasemapSelector
              selectedBasemap={selectedBasemap}
              onSelectBasemap={setSelectedBasemap}
            />
          </div>

          {/* Map Canvas */}
          <div className="flex-1 relative w-full h-full overflow-hidden">
            {/* Floating Resolution & Scale Alert (Centered, Non-overlapping, Dismissible) */}
            {mapZoom >= 15 && showScaleAlert && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#1B2331]/95 border border-[#3F4E64] shadow-2xl px-3.5 py-1.5 rounded-sm flex items-center gap-2.5 text-[11px] text-[#C8D1DE] z-[1200] max-w-xl pointer-events-auto backdrop-blur">
                <span className="text-[#C8963E] text-xs shrink-0">🔍</span>
                <span className="leading-tight">
                  <strong className="text-[#E9E4D6]">Native Resolution Scale (20m):</strong> Target boundaries reflect raster pixel geometry, not surveyed lease extents (±0.2 ha uncertainty).
                </span>
                <button
                  onClick={() => setShowScaleAlert(false)}
                  className="text-[#7C8798] hover:text-[#E9E4D6] ml-1.5 p-0.5 cursor-pointer shrink-0 transition-colors"
                  title="Dismiss scale alert"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Floating Draggable Geoman GIS Tool Palette */}
            <DraggableContainer
              defaultPosition={{ x: 16, y: 16 }}
              zIndex={1000}
              className="pointer-events-auto"
            >
              <DraggableGeomanToolbar
                activeTool={activeTool}
                onToolSelect={setActiveTool}
                onClearAOI={() => {
                  setAoiCoords([]);
                  setTargets([]);
                  setExcludedTargets([]);
                  setTargetGeoJSON(null);
                  setAreaStats(null);
                  setSelectedTargetId(null);
                  setTileUrls({});
                  setStatusMessage('AOI cleared.');
                }}
                onBoundaryUpload={(coords) => {
                  setAoiCoords(coords);
                  setTargets([]);
                  setExcludedTargets([]);
                  setTargetGeoJSON(null);
                  setAreaStats(null);
                  setSelectedTargetId(null);
                  setTileUrls({});
                  setStatusMessage(`Uploaded boundary with ${coords.length} vertices.`);
                }}
                aoiAreaHa={aoiAreaHa}
                authoritativeAreaKm2={areaStats?.total_aoi_km2}
              />
            </DraggableContainer>
            <MapComponent
              activeLayers={layers}
              tileUrls={tileUrls}
              targetGeoJSON={targetGeoJSON}
              selectedTargetId={selectedTargetId}
              aoiCoords={aoiCoords}
              onAOIDrawn={(coords) => {
                setAoiCoords(coords);
                setTargets([]);
                setExcludedTargets([]);
                setTargetGeoJSON(null);
                setAreaStats(null);
                setSelectedTargetId(null);
                setTileUrls({});
                setActiveTool('pan');
                setStatusMessage(`AOI established with ${coords.length} vertices. Click "Generate targets".`);
              }}
              onTargetClick={(targetId) => {
                setSelectedTargetId(targetId);
                const tgt = targets.find(t => t.target_id === targetId) || excludedTargets.find(t => t.target_id === targetId);
                if (tgt) setInspectedTarget(tgt);
              }}
              center={mapCenter}
              zoom={mapZoom}
              onZoomChange={(z) => {
                setMapZoom(z);
                if (z < 15) setShowScaleAlert(true);
              }}
              onBoundsChange={setMapBounds}
              searchLocation={searchLocation}
              selectedBasemap={selectedBasemap}
            />

            {/* Floating Error Toast Notification */}
            {error && (
              <div className="absolute bottom-6 right-6 z-[2000] max-w-md bg-[#2B1717]/95 border border-[#E74C3C]/80 shadow-2xl p-3.5 rounded-sm flex items-start gap-3 text-[12px] text-[#F5D5D5] animate-in slide-in-from-bottom-3 duration-200 backdrop-blur pointer-events-auto">
                <span className="text-[#E74C3C] text-[15px] shrink-0 mt-0.5">⚠️</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[#FF8F8F] text-[12px] mb-0.5">Targeting Notice</div>
                  <div className="leading-snug text-[#E9E4D6] text-[11.5px] break-words">{error}</div>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-[#A87D7D] hover:text-[#FFFFFF] cursor-pointer p-0.5 shrink-0 transition-colors"
                  title="Dismiss notice"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Bottom Status Bar */}
          <div className="border-t border-[#2E3A4C] px-5 py-2.5 text-[12px] text-[#7C8798] flex items-center gap-2 shrink-0 bg-[#141B26] z-[500]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C8798] shrink-0" />
            <span className="truncate">{error || statusMessage}</span>
          </div>

        </div>

        {/* Right Rail: Results & Zonation */}
        <div className="border-l border-[#2E3A4C] overflow-y-auto p-4 bg-[#141B26]">
          <ProspectivityDashboard
            areaStats={areaStats}
            targets={targets}
            excludedTargets={excludedTargets}
            selectedTargetId={selectedTargetId}
            onSelectTarget={(tgt) => {
              setSelectedTargetId(tgt.target_id);
              setInspectedTarget(tgt);
            }}
            onToggleVerification={handleToggleVerification}
            onExportGeoJSON={handleExportGeoJSON}
            onExportCSV={handleExportCSV}
            onExportDXF={handleExportDXF}
            onExportLeapfrog={handleExportLeapfrog}
            aoiAreaHa={aoiAreaHa}
            isLoading={isLoading}
          />
        </div>

      </div>

      {/* Target Detail Modal */}
      <TargetDetailModal
        target={inspectedTarget}
        onClose={() => setInspectedTarget(null)}
        onZoomTo={(centroid) => {
          setMapCenter(centroid);
          setMapZoom(14);
        }}
      />

      {/* Interactive Exploration Tour Guide & Field Guide */}
      <TourGuideModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onSelectSampleCaseStudy={handleSelectCaseStudy}
      />

    </div>
  );
}
