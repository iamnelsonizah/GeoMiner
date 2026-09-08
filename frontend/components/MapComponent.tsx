'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { LayerState } from './LayerControlPanel';
import { BasemapType, BASEMAP_OPTIONS } from './BasemapSelector';

// Fix Leaflet Default Icon Paths in Next.js SSR
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export interface SearchLocation {
  lat: number;
  lng: number;
  label: string;
}

interface MapComponentProps {
  activeLayers: Record<string, LayerState>;
  tileUrls: Record<string, string>;
  targetGeoJSON: any | null;
  selectedTargetId: string | null;
  aoiCoords: number[][];
  onAOIDrawn: (coords: number[][]) => void;
  onTargetClick: (targetId: string) => void;
  center: [number, number];
  zoom: number;
  onZoomChange?: (zoom: number) => void;
  onBoundsChange?: (bbox: [number, number, number, number]) => void;
  searchLocation?: SearchLocation | null;
  selectedBasemap: BasemapType;
}

// ───────────────────────────────── Safe Scale Control ─────────────────────────────────
function SafeScaleControl() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    let scaleControl: L.Control.Scale | null = null;
    let timer: NodeJS.Timeout | null = null;

    map.whenReady(() => {
      timer = setTimeout(() => {
        try {
          const pane = (map as any)._panes?.mapPane;
          if (pane && (map as any)._loaded) {
            scaleControl = L.control.scale({ position: 'bottomleft', imperial: false });
            scaleControl.addTo(map);
          }
        } catch {}
      }, 150);
    });

    return () => {
      if (timer) clearTimeout(timer);
      if (scaleControl && map) {
        try {
          scaleControl.remove();
        } catch {}
      }
    };
  }, [map]);

  return null;
}

// ───────────────────────────────── Controller ─────────────────────────────────
function MapController({ 
  center, 
  zoom, 
  searchLocation,
  onZoomChange,
  onBoundsChange
}: { 
  center: [number, number]; 
  zoom: number; 
  searchLocation?: SearchLocation | null;
  onZoomChange?: (z: number) => void;
  onBoundsChange?: (bbox: [number, number, number, number]) => void;
}) {
  const map = useMap();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!map) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    map.whenReady(() => {
      try {
        const pane = (map as any)._panes?.mapPane;
        if (pane && pane._leaflet_pos && typeof (map as any).flyTo === 'function') {
          map.flyTo(center, zoom, { duration: 1.2 });
        } else {
          map.setView(center, zoom);
        }
      } catch {
        try {
          map.setView(center, zoom);
        } catch {}
      }
    });
  }, [center, zoom, map]);

  // Handle mobile drawer open/close and window resize
  useEffect(() => {
    if (!map) return;
    const handleInvalidate = () => {
      try {
        if ((map as any)._loaded) {
          map.invalidateSize();
        }
      } catch {}
    };

    window.addEventListener('resize', handleInvalidate);
    window.addEventListener('map-invalidate-size', handleInvalidate);
    const timer = setTimeout(handleInvalidate, 200);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleInvalidate);
      window.removeEventListener('map-invalidate-size', handleInvalidate);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !onZoomChange) return;
    const handleZoom = () => {
      try {
        onZoomChange(map.getZoom());
      } catch {}
    };
    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);

  useEffect(() => {
    if (!map || !onBoundsChange) return;
    const handleMove = () => {
      try {
        if (!(map as any)._loaded) return;
        const b = map.getBounds();
        if (b && typeof b.isValid === 'function' && b.isValid()) {
          onBoundsChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
        }
      } catch {}
    };
    map.on('moveend', handleMove);
    const initTimer = setTimeout(handleMove, 300);
    return () => {
      clearTimeout(initTimer);
      map.off('moveend', handleMove);
    };
  }, [map, onBoundsChange]);

  useEffect(() => {
    if (!map || !searchLocation) return;
    map.whenReady(() => {
      try {
        const pane = (map as any)._panes?.mapPane;
        if (pane && pane._leaflet_pos && typeof (map as any).flyTo === 'function') {
          map.flyTo([searchLocation.lat, searchLocation.lng], 14, { duration: 1.5 });
        } else {
          map.setView([searchLocation.lat, searchLocation.lng], 14);
        }
      } catch {
        try {
          map.setView([searchLocation.lat, searchLocation.lng], 14);
        } catch {}
      }
    });
  }, [searchLocation, map]);

  return null;
}

// ──────────────────────────────── Geoman Draw Control ────────────────────────────────
function GeomanDrawControl({ onAOIDrawn }: { onAOIDrawn: (coords: number[][]) => void }) {
  const map = useMap();
  const drawnLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!map || !map.pm) return;

    map.pm.setPathOptions({
      color: '#C8963E',
      fillColor: '#C8963E',
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '5, 5'
    });

    map.on('pm:create', (e: any) => {
      const { layer } = e;
      if (drawnLayerRef.current) {
        map.removeLayer(drawnLayerRef.current);
      }
      drawnLayerRef.current = layer;

      const geojson = layer.toGeoJSON();
      const coords = geojson.geometry.coordinates[0] as number[][];
      onAOIDrawn(coords);

      if (layer.getBounds) {
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
      }
    });

    map.on('pm:remove', (e: any) => {
      if (drawnLayerRef.current === e.layer) {
        drawnLayerRef.current = null;
        onAOIDrawn([]);
      }
    });

    // Custom Geoman Mode Event Listeners
    const onDrawRect = () => {
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalDragMode();
      map.pm.enableDraw('Rectangle');
    };
    
    const onDrawPoly = () => {
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalDragMode();
      map.pm.enableDraw('Polygon');
    };

    const onEdit = () => {
      map.pm.disableDraw();
      map.pm.disableGlobalDragMode();
      map.pm.toggleGlobalEditMode();
    };

    const onDrag = () => {
      map.pm.disableDraw();
      map.pm.disableGlobalEditMode();
      map.pm.toggleGlobalDragMode();
    };

    const onCut = () => {
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalDragMode();
      map.pm.enableDraw('Cut');
    };

    const onPan = () => {
      map.pm.disableDraw();
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalDragMode();
      map.pm.disableGlobalRemovalMode();
    };

    const onClear = () => {
      onPan();
      if (drawnLayerRef.current) {
        map.removeLayer(drawnLayerRef.current);
        drawnLayerRef.current = null;
      }
      onAOIDrawn([]);
    };

    window.addEventListener('map-tool-rectangle', onDrawRect);
    window.addEventListener('map-tool-polygon', onDrawPoly);
    window.addEventListener('map-tool-edit', onEdit);
    window.addEventListener('map-tool-drag', onDrag);
    window.addEventListener('map-tool-cut', onCut);
    window.addEventListener('map-tool-pan', onPan);
    window.addEventListener('map-tool-clear', onClear);

    return () => {
      map.off('pm:create');
      map.off('pm:remove');
      window.removeEventListener('map-tool-rectangle', onDrawRect);
      window.removeEventListener('map-tool-polygon', onDrawPoly);
      window.removeEventListener('map-tool-edit', onEdit);
      window.removeEventListener('map-tool-drag', onDrag);
      window.removeEventListener('map-tool-cut', onCut);
      window.removeEventListener('map-tool-pan', onPan);
      window.removeEventListener('map-tool-clear', onClear);
    };
  }, [map, onAOIDrawn]);

  return null;
}

// ──────────────────────────────── AOI Boundary Outline ────────────────────────────────
function AOIBoundary({ coords }: { coords: number[][] }) {
  const map = useMap();
  const borderRef = useRef<L.Polygon | null>(null);

  useEffect(() => {
    if (borderRef.current) {
      map.removeLayer(borderRef.current);
      borderRef.current = null;
    }

    if (coords && coords.length > 2) {
      const latLngs = coords.map(c => [c[1], c[0]] as [number, number]);

      borderRef.current = L.polygon(latLngs, {
        color: '#8A6A32',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#C8963E',
        fillOpacity: 0.08,
        interactive: false,
        pane: 'overlayPane',
      }).addTo(map);

      borderRef.current.bringToFront();
    }

    return () => {
      if (borderRef.current) {
        map.removeLayer(borderRef.current);
        borderRef.current = null;
      }
    };
  }, [map, coords]);

  return null;
}

export default function MapComponent({
  activeLayers,
  tileUrls,
  targetGeoJSON,
  selectedTargetId,
  aoiCoords,
  onAOIDrawn,
  onTargetClick,
  center,
  zoom,
  onZoomChange,
  onBoundsChange,
  searchLocation,
  selectedBasemap
}: MapComponentProps) {
  
  const activeBasemap = BASEMAP_OPTIONS.find(b => b.id === selectedBasemap) || BASEMAP_OPTIONS[0];

  // Style function for Target Polygons
  const getTargetPolygonStyle = (feature: any) => {
    const isSelected = selectedTargetId === feature?.properties?.target_id;

    return {
      color: isSelected ? '#C8963E' : '#E9E4D6',
      weight: isSelected ? 3 : 1.5,
      fillColor: '#C8963E',
      fillOpacity: isSelected ? 0.6 : 0.35,
      dashArray: isSelected ? undefined : '2, 2'
    };
  };

  const onEachTargetFeature = (feature: any, layer: L.Layer) => {
    const props = feature.properties || {};
    const tooltipContent = `
      <div style="font-family: inherit; font-size: 11px; padding: 3px; background: #1B2331; color: #E9E4D6; border: 1px solid #2E3A4C;">
        <strong style="color: #C8963E;">${props.target_id || 'Target'}</strong> (${props.priority || 'Tier-1'})<br/>
        <span>Ranking score: <strong>${props.confidence_score || 80}/100</strong></span><br/>
        <span>Area: ${props.area_ha || 0} ha</span>
      </div>
    `;
    layer.bindTooltip(tooltipContent, { sticky: true });

    layer.on({
      click: () => {
        if (props.target_id) {
          onTargetClick(props.target_id);
        }
      }
    });
  };

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (wrapperRef.current) {
        const leafletContainer = wrapperRef.current.querySelector('.leaflet-container');
        if (leafletContainer) {
          delete (leafletContainer as any)._leaflet_id;
        }
      }
    };
  }, []);

  return (
    <div ref={wrapperRef} className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false}
        className="w-full h-full"
      >
        <MapController center={center} zoom={zoom} searchLocation={searchLocation} onZoomChange={onZoomChange} onBoundsChange={onBoundsChange} />
        <GeomanDrawControl onAOIDrawn={onAOIDrawn} />
        <AOIBoundary coords={aoiCoords} />
        <SafeScaleControl />

        {/* Dynamic Basemap Layer (Satellite / Topo / Dark / OSM) */}
        <TileLayer
          key={activeBasemap.id}
          attribution={activeBasemap.attribution}
          url={activeBasemap.url}
          maxZoom={19}
        />

        {/* Dynamic GEE Composite Layer (True Color / False Color / SWIR) */}
        {activeLayers.true_color?.visible && tileUrls.true_color && (
          <TileLayer
            key={`tc-${tileUrls.true_color}`}
            url={tileUrls.true_color}
            opacity={activeLayers.true_color.opacity}
            zIndex={2}
          />
        )}
        {activeLayers.false_color_ir?.visible && tileUrls.false_color_ir && (
          <TileLayer
            key={`fc-${tileUrls.false_color_ir}`}
            url={tileUrls.false_color_ir}
            opacity={activeLayers.false_color_ir.opacity}
            zIndex={3}
          />
        )}
        {activeLayers.swir_geology?.visible && tileUrls.swir_geology && (
          <TileLayer
            key={`swir-${tileUrls.swir_geology}`}
            url={tileUrls.swir_geology}
            opacity={activeLayers.swir_geology.opacity}
            zIndex={4}
          />
        )}

        {/* Spectral Alteration Overlays */}
        {activeLayers.hydroxyl_clay?.visible && tileUrls.hydroxyl_clay && (
          <TileLayer
            key={`clay-${tileUrls.hydroxyl_clay}`}
            url={tileUrls.hydroxyl_clay}
            opacity={activeLayers.hydroxyl_clay.opacity}
            zIndex={10}
          />
        )}
        {activeLayers.ferric_iron?.visible && tileUrls.ferric_iron && (
          <TileLayer
            key={`ferric-${tileUrls.ferric_iron}`}
            url={tileUrls.ferric_iron}
            opacity={activeLayers.ferric_iron.opacity}
            zIndex={11}
          />
        )}
        {activeLayers.gossan_index?.visible && tileUrls.gossan_index && (
          <TileLayer
            key={`gossan-${tileUrls.gossan_index}`}
            url={tileUrls.gossan_index}
            opacity={activeLayers.gossan_index.opacity}
            zIndex={12}
          />
        )}

        {/* Structural Lineaments & Topography */}
        {activeLayers.hillshade_multi?.visible && tileUrls.hillshade_multi && (
          <TileLayer
            key={`hs-${tileUrls.hillshade_multi}`}
            url={tileUrls.hillshade_multi}
            opacity={activeLayers.hillshade_multi.opacity}
            zIndex={15}
          />
        )}
        {activeLayers.lineament_density?.visible && tileUrls.lineament_density && (
          <TileLayer
            key={`ld-${tileUrls.lineament_density}`}
            url={tileUrls.lineament_density}
            opacity={activeLayers.lineament_density.opacity}
            zIndex={16}
          />
        )}

        {/* Final Prospectivity Heatmap Overlay */}
        {activeLayers.prospectivity_heatmap?.visible && tileUrls.prospectivity_heatmap && (
          <TileLayer
            key={`heatmap-${tileUrls.prospectivity_heatmap}`}
            url={tileUrls.prospectivity_heatmap}
            opacity={activeLayers.prospectivity_heatmap.opacity}
            zIndex={20}
          />
        )}

        {/* Vector Target Polygons */}
        {activeLayers.target_polygons?.visible && targetGeoJSON && (
          <GeoJSON
            key={`geojson-${selectedTargetId || 'all'}-${JSON.stringify(targetGeoJSON).length}`}
            data={targetGeoJSON}
            style={getTargetPolygonStyle}
            onEachFeature={onEachTargetFeature}
          />
        )}

        {/* Searched Location Marker */}
        {searchLocation && (
          <Marker position={[searchLocation.lat, searchLocation.lng]}>
            <Popup>
              <div className="text-xs font-sans">
                <strong className="text-[#C8963E] font-bold">Search Location</strong>
                <p className="text-slate-200 mt-1">{searchLocation.label}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
