import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import ee

from gee_service import (
    initialize_gee, 
    get_s2_composite, 
    get_copernicus_dem, 
    get_sentinel1_sar, 
    get_map_tile_url
)
from spectral_indices import (
    compute_spectral_indices, 
    get_spectral_vis_params
)
from structural_service import (
    extract_structural_lineaments, 
    get_structural_vis_params
)
from prospectivity_model import (
    COMMODITY_PROFILES, 
    compute_prospectivity_model, 
    get_prospectivity_vis_params, 
    extract_target_polygons_from_gee
)
from validation import VALIDATION_PROTOCOL
from validation import leave_one_district_out_splits, validate_occurrence_records
from baselines import PUBLIC_BASELINES

from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("GeoMiner")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for GeoMiner API: initializes Earth Engine on startup."""
    success = initialize_gee()
    if success:
        logger.info("GeoMiner Backend: Google Earth Engine initialized.")
    else:
        logger.warning("GeoMiner Backend: Earth Engine credentials missing or unconfigured.")
    yield
    logger.info("GeoMiner Backend: Shutting down.")

app = FastAPI(
    title="GeoMiner Exploration Backend",
    description="Cloud-Based Remote Sensing Prospectivity and Mineral Exploration Targeting Engine",
    version="1.2.0",
    lifespan=lifespan
)

# Production-safe CORS configuration: supports local dev, custom domain, and cloud preview domains
frontend_origins_raw = os.getenv("FRONTEND_ORIGINS", "")
frontend_origins = [o.strip() for o in frontend_origins_raw.split(",") if o.strip()]
if not frontend_origins:
    frontend_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$|https?://.*(vercel\.app|railway\.app|onrender\.com|geoclass|geominer).*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExplorationRequest(BaseModel):
    bbox: Optional[List[float]] = Field(None, description="Bounding Box [west, south, east, north]")
    geometry: Optional[Dict[str, Any]] = Field(None, description="GeoJSON Polygon Geometry")
    aoi: Optional[List[Any]] = Field(None, description="AOI Polygon Coordinates")
    commodity: str = Field("porphyry_cu_au", description="Deposit model / commodity key")
    start_date: str = Field("2023-01-01", description="Imagery acquisition start date")
    end_date: str = Field("2024-01-01", description="Imagery acquisition end date")
    mask_vegetation: bool = Field(True, description="Whether to mask dense NDVI canopy")
    apply_solar_correction: bool = Field(False, description="Apply only a scene-specific, validated topographic correction")
    exclude_mine_infrastructure: bool = Field(True, description="Whether to filter out active open pits, haul roads, and tailings ponds")
    custom_weights: Optional[Dict[str, float]] = Field(None, description="Custom multi-criteria weights")
    custom_threshold: Optional[float] = Field(None, description="Ranking-score threshold (0.40 - 0.85); not a probability")

    class Config:
        extra = "allow"


class ValidationSplitRequest(BaseModel):
    """Ephemeral validation-data check; records are not persisted by this API."""
    features: List[Dict[str, Any]] = Field(..., description="GeoJSON occurrence/background features")


MAX_EXPLORATION_AOI_KM2 = 5000.0


def get_ee_geometry(req: ExplorationRequest) -> ee.Geometry:
    """Helper to convert bounding box, GeoJSON geometry, or AOI coordinates into ee.Geometry."""
    if req.aoi and len(req.aoi) >= 3:
        coords = req.aoi
        # Ensure polygon closure
        if coords[0] != coords[-1]:
            coords = coords + [coords[0]]
        return ee.Geometry.Polygon([coords])

    if req.geometry:
        coords = req.geometry.get("coordinates")
        geom_type = req.geometry.get("type", "Polygon")
        if geom_type == "Polygon":
            return ee.Geometry.Polygon(coords)
        elif geom_type == "MultiPolygon":
            return ee.Geometry.MultiPolygon(coords)

    if req.bbox and len(req.bbox) == 4:
        return ee.Geometry.BBox(req.bbox[0], req.bbox[1], req.bbox[2], req.bbox[3])

    # Default fallback: Escondida Porphyry Deposit Area, Chile
    return ee.Geometry.BBox(-69.15, -24.35, -68.95, -24.20)


def validate_and_get_ee_geometry(req: ExplorationRequest) -> ee.Geometry:
    """Validates AOI extent and returns bounded ee.Geometry to prevent memory overflow."""
    geom = get_ee_geometry(req)
    try:
        bounds = geom.bounds().coordinates().getInfo()[0]
        west, south, east, north = bounds[0][0], bounds[0][1], bounds[2][0], bounds[2][1]
        width_deg = abs(east - west)
        height_deg = abs(north - south)

        if width_deg > 3.0 or height_deg > 3.0:
            raise HTTPException(
                status_code=422,
                detail=f"AOI bounding box ({width_deg:.1f}° x {height_deg:.1f}°) exceeds maximum single-pass extent. Please zoom in or delineate a localized exploration concession boundary."
            )

        area_m2 = geom.area(maxError=200).getInfo()
        area_km2 = area_m2 / 1_000_000.0
        if area_km2 > MAX_EXPLORATION_AOI_KM2:
            raise HTTPException(
                status_code=422,
                detail=f"AOI footprint ({area_km2:,.1f} km²) exceeds the maximum single-pass exploration limit of 5,000 km² for 20m high-resolution processing. Please define a more focused target area."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"AOI area pre-check warning: {e}")

    return geom


@app.get("/")
@app.get("/health")
@app.get("//health")
@app.get("/api/health")
def health_check():
    """Health check endpoint supporting cloud platforms (Railway, Render, AWS, GCP)."""
    gee_ok = initialize_gee()
    return {
        "status": "healthy" if gee_ok else "degraded",
        "service": "GeoMiner Exploration Targeting Engine",
        "engine": "GeoMiner Exploration Targeting Engine v1.2",
        "version": app.version,
        "gee_initialized": gee_ok,
        "models": list(COMMODITY_PROFILES.keys())
    }


@app.get("/api/deposit-models")
def get_deposit_models():
    """Returns all available mineral deposit models and evidence weighting schemes."""
    return {"status": "success", "models": COMMODITY_PROFILES}


@app.get("/api/methodology")
def get_methodology():
    """Expose model scope, data provenance and the ML validation contract."""
    return {
        "status": "success",
        "scope": "Relative remote-sensing prospectivity ranking; not mineral identification or a drill recommendation.",
        "data_sources": [
            {"name": "Sentinel-2 SR Harmonized", "role": "surface spectral indicators", "native_resolution_m": 20},
            {"name": "NASADEM/SRTM", "role": "topographic context and terrain-edge proxy", "native_resolution_m": 30},
            {"name": "Sentinel-1 GRD", "role": "optional surface-roughness diagnostic; not currently fused into ranking", "native_resolution_m": 10},
        ],
        "known_limitations": [
            "Spectral ratios are non-unique surface indicators and do not identify minerals.",
            "Terrain-edge crossings are not mapped faults.",
            "Scores are normalised within each AOI and are not comparable probabilities.",
            "Mine-disturbance masking is heuristic and requires review in brownfield areas.",
        ],
        "validation_protocol": VALIDATION_PROTOCOL,
    }


@app.get("/api/baselines")
def get_public_baselines():
    """Return public study configurations that have not been promoted to ML."""
    return {"status": "success", "baselines": PUBLIC_BASELINES}


@app.post("/api/validation/splits")
def preview_validation_splits(req: ValidationSplitRequest):
    """Check a supplied occurrence inventory and return district-held-out splits.

    This endpoint is intentionally stateless. It validates the user's data but
    does not store it or train a model.
    """
    errors = validate_occurrence_records(req.features)
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})
    return {
        "status": "success",
        "storage": "ephemeral; request data are not persisted",
        "splits": leave_one_district_out_splits(req.features),
    }


@app.post("/api/spectral-indices")
def get_spectral_layers(req: ExplorationRequest):
    """
    Computes diagnostic hydrothermal alteration band ratios from Sentinel-2 VNIR-SWIR
    with topographic solar illumination correction, vegetation suppression, and mine disturbance mapping.
    """
    if not initialize_gee():
        raise HTTPException(status_code=503, detail="Earth Engine is not initialized.")

    try:
        roi = validate_and_get_ee_geometry(req)
        s2_img = get_s2_composite(roi, req.start_date, req.end_date)
        dem_data = get_copernicus_dem(roi)
        
        spectral = compute_spectral_indices(
            s2_image=s2_img, 
            mask_vegetation=req.mask_vegetation,
            dem_dict=dem_data,
            apply_solar_correction=req.apply_solar_correction
        )

        hydroxyl_url = get_map_tile_url(spectral["hydroxyl_clay"].clip(roi), get_spectral_vis_params("hydroxyl_clay"))
        ferric_url = get_map_tile_url(spectral["ferric_iron"].clip(roi), get_spectral_vis_params("ferric_iron"))
        ferrous_url = get_map_tile_url(spectral["ferrous_iron"].clip(roi), get_spectral_vis_params("ferrous_iron"))
        gossan_url = get_map_tile_url(spectral["gossan_index"].clip(roi), get_spectral_vis_params("gossan_index"))
        alteration_shells_url = get_map_tile_url(spectral["alteration_shells"].clip(roi), get_spectral_vis_params("alteration_shells"))
        alteration_composite_url = get_map_tile_url(spectral["alteration_composite"].clip(roi), get_spectral_vis_params("alteration_composite"))
        disturbance_url = get_map_tile_url(spectral["mine_disturbance"].clip(roi), get_spectral_vis_params("mine_disturbance"))

        return {
            "status": "success",
            "layers": {
                "hydroxyl_clay": hydroxyl_url,
                "ferric_iron": ferric_url,
                "ferrous_iron": ferrous_url,
                "gossan_index": gossan_url,
                "alteration_shells": alteration_shells_url,
                "alteration_composite": alteration_composite_url,
                "mine_disturbance": disturbance_url
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error computing spectral alteration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/structural-layers")
def get_structural_layers(req: ExplorationRequest):
    """
    Computes terrain/SAR edge-density proxies to assist structural interpretation.
    """
    if not initialize_gee():
        raise HTTPException(status_code=503, detail="Earth Engine is not initialized.")

    try:
        roi = validate_and_get_ee_geometry(req)
        dem_data = get_copernicus_dem(roi)
        sar_data = get_sentinel1_sar(roi, req.start_date, req.end_date)
        struct_data = extract_structural_lineaments(dem_data["dem"], sar_data)

        dem_url = get_map_tile_url(dem_data["dem"].clip(roi), get_structural_vis_params("dem"))
        hillshade_url = get_map_tile_url(dem_data["hillshade"].clip(roi), get_structural_vis_params("hillshade"))
        lineament_density_url = get_map_tile_url(struct_data["lineament_density"].clip(roi), get_structural_vis_params("lineament_density"))
        fault_intersections_url = get_map_tile_url(struct_data["fault_intersections"].clip(roi), get_structural_vis_params("fault_intersections"))
        lineament_binary_url = get_map_tile_url(struct_data["lineament_binary"].clip(roi), get_structural_vis_params("lineament_binary"))

        return {
            "status": "success",
            "layers": {
                "dem_elevation": dem_url,
                "hillshade_multi": hillshade_url,
                "lineament_density": lineament_density_url,
                "fault_intersections": fault_intersections_url,
                "lineament_binary": lineament_binary_url
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error computing structural layers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/prospectivity")
def generate_prospectivity(req: ExplorationRequest):
    """
    Runs the complete Mineral Prospectivity Engine:
    1. Ingests multi-sensor data (Sentinel-2, Copernicus DEM, SAR).
    2. Corrects topographic solar illumination in steep terrain.
    3. Computes spectral indicators and terrain/SAR structural proxies.
    4. Fuses layers based on target commodity profile.
    5. Streams prospectivity heatmap tile URL.
    6. Vectorizes high-ranking clusters into follow-up polygons with elevations.
    """
    if not initialize_gee():
        raise HTTPException(status_code=503, detail="Earth Engine is not initialized.")

    profile = COMMODITY_PROFILES.get(req.commodity)
    if profile is None:
        raise HTTPException(status_code=422, detail="Unknown deposit model.")
    if req.custom_threshold is not None and not 0.40 <= req.custom_threshold <= 0.85:
        raise HTTPException(status_code=422, detail="Ranking-score threshold must be between 0.40 and 0.85.")
    if req.custom_weights is not None:
        allowed = set(profile["weights"])
        unknown = set(req.custom_weights) - allowed
        values = list(req.custom_weights.values())
        if unknown or not values or any(not isinstance(value, (int, float)) or value < 0 for value in values) or sum(values) <= 0:
            raise HTTPException(
                status_code=422,
                detail="Custom weights must be non-negative model evidence keys with a positive total."
            )

    try:
        roi = validate_and_get_ee_geometry(req)
        
        # 1. Fetch imagery
        s2_img = get_s2_composite(roi, req.start_date, req.end_date)
        dem_data = get_copernicus_dem(roi)
        sar_data = get_sentinel1_sar(roi, req.start_date, req.end_date)
        
        # 2. Extract evidence with solar illumination correction
        spectral = compute_spectral_indices(
            s2_image=s2_img, 
            mask_vegetation=req.mask_vegetation,
            dem_dict=dem_data,
            apply_solar_correction=req.apply_solar_correction
        )
        structural = extract_structural_lineaments(dem_data["dem"], sar_data)
        
        # 3. Model Prospectivity
        model_res = compute_prospectivity_model(
            spectral_dict=spectral,
            structural_dict=structural,
            dem_dict=dem_data,
            roi=roi,
            commodity_id=req.commodity,
            custom_weights=req.custom_weights,
            custom_threshold=req.custom_threshold
        )
        
        # 4. Generate Heatmap Tile URL strictly clipped to ROI
        heatmap_url = get_map_tile_url(
            model_res["prospectivity_index"].clip(roi), 
            get_prospectivity_vis_params()
        )
        
        # 5. Extract and rank follow-up areas with elevation, alteration-shell
        # and mine-disturbance context.
        target_results = extract_target_polygons_from_gee(
            classified_image=model_res["prospectivity_classified"],
            prospectivity_image=model_res["prospectivity_index"],
            roi=roi,
            profile=model_res["profile"],
            dem_image=dem_data["dem"],
            alteration_shells=spectral["alteration_shells"],
            fault_intersections=structural["fault_intersections"],
            is_disturbed_image=spectral["is_disturbed"],
            exclude_disturbance=req.exclude_mine_infrastructure,
            max_targets=12
        )
        
        # 6. Measure each class directly from raster pixel area.  Do not derive
        # zonation from the small set of exported polygons.
        total_aoi_m2 = roi.area(maxError=50).getInfo()
        total_aoi_ha = round(total_aoi_m2 / 10000.0, 1)
        total_aoi_km2 = round(total_aoi_ha / 100.0, 2)
        
        class_areas = ee.Image.pixelArea().addBands(model_res["prospectivity_classified"]).reduceRegion(
            reducer=ee.Reducer.sum().group(groupField=1, groupName="class"),
            geometry=roi, scale=20, maxPixels=1e8, bestEffort=True, tileScale=4
        ).getInfo()
        measured_m2 = {int(item["class"]): float(item["sum"]) for item in class_areas.get("groups", [])}
        high_area_ha = measured_m2.get(3, 0.0) / 10000.0
        med_area_ha = measured_m2.get(2, 0.0) / 10000.0
        low_area_ha = measured_m2.get(1, 0.0) / 10000.0
        high_area_km2 = round(high_area_ha / 100.0, 2)
        high_pct = round((high_area_ha / max(total_aoi_ha, 1.0)) * 100.0, 1)
        med_pct = round((med_area_ha / max(total_aoi_ha, 1.0)) * 100.0, 1)
        low_pct = round((low_area_ha / max(total_aoi_ha, 1.0)) * 100.0, 1)

        area_stats = {
            "total_aoi_km2": total_aoi_km2,
            "total_aoi_ha": total_aoi_ha,
            "high_prospectivity": {
                "area_km2": high_area_km2,
                "percentage": high_pct,
                "label": "High Priority Target Zones"
            },
            "medium_prospectivity": {
                "area_km2": round(med_area_ha / 100.0, 2),
                "percentage": med_pct,
                "label": "Prospective Alteration Corridor"
            },
            "low_prospectivity": {
                "area_km2": round(low_area_ha / 100.0, 2),
                "percentage": low_pct,
                "label": "Regional / Background Barren"
            }
        }

        disturbance_url = get_map_tile_url(spectral["mine_disturbance"].clip(roi), get_spectral_vis_params("mine_disturbance"))

        run_metadata = {
            "engine_version": app.version,
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "commodity_model": req.commodity,
            "imagery_period": {"start": req.start_date, "end": req.end_date},
            "processing": {
                "vegetation_mask": req.mask_vegetation,
                "topographic_correction": req.apply_solar_correction,
                "mine_infrastructure_screen": req.exclude_mine_infrastructure,
                "spectral_resolution_m": 20,
                "normalization": "AOI 2nd–98th percentile; scores are AOI-relative",
            },
            "interpretation_notice": "Ranked follow-up areas require geological validation; they are not probabilities, resources, or drill recommendations.",
        }

        return {
            "status": "success",
            "commodity": model_res["profile"],
            "heatmap_tile_url": heatmap_url,
            "mine_disturbance_tile_url": disturbance_url,
            "targets": target_results["targets"],
            "excluded_targets": target_results.get("excluded_targets", []),
            "target_geojson": target_results["geojson"],
            "area_statistics": area_stats,
            "run_metadata": run_metadata,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing prospectivity targeting pipeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))
