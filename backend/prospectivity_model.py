import ee
import math
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("prospectivity_model")

COMMODITY_PROFILES: Dict[str, Dict[str, Any]] = {
    "porphyry_cu_au": {
        "name": "Porphyry Copper-Gold (Cu-Au)",
        "description": "Exploration screening for potassic-phyllic alteration indicators, terrain/SAR structural proxies, and gossanous surface responses.",
        "weights": {
            "hydroxyl_clay": 0.30,
            "ferric_iron": 0.15,
            "gossan_index": 0.15,
            "lineament_density": 0.15,
            "fault_intersections": 0.15,
            "slope_suitability": 0.10
        },
        "target_threshold": 0.65,
        "primary_alteration": "Phyllic (Sericite) & Potassic Alteration"
    },
    "epithermal_au": {
        "name": "Epithermal Gold (Au-Ag)",
        "description": "Targeting high-sulfidation or low-sulfidation gold systems with argillic clay halos, silica sinter caps, and major fault conduits.",
        "weights": {
            "hydroxyl_clay": 0.35,
            "silica_index": 0.15,
            "ferric_iron": 0.15,
            "lineament_density": 0.15,
            "fault_intersections": 0.20,
            "slope_suitability": 0.00
        },
        "target_threshold": 0.68,
        "primary_alteration": "Argillic / Advanced Argillic & Silica"
    },
    "lithium_pegmatite": {
        "name": "Lithium (LCT) Pegmatites",
        "description": "Targeting lithium-cesium-tantalum pegmatites along granitic intrusive contacts, featuring distinctive Al-OH / Li-mica spectral response and structural dilatation zones.",
        "weights": {
            "hydroxyl_clay": 0.40,
            "ferrous_iron": 0.15,
            "lineament_density": 0.15,
            "fault_intersections": 0.15,
            "slope_suitability": 0.15
        },
        "target_threshold": 0.62,
        "primary_alteration": "Lepidolite / Spodumene / Al-OH Mica"
    },
    "iron_gossan": {
        "name": "Iron Ore & Gossanous Target",
        "description": "Direct targeting of banded iron formations (BIF), massive hematite/magnetite outcrops, and weathered sulfide gossans.",
        "weights": {
            "ferric_iron": 0.40,
            "gossan_index": 0.25,
            "ferrous_iron": 0.15,
            "lineament_density": 0.10,
            "fault_intersections": 0.10,
            "slope_suitability": 0.00
        },
        "target_threshold": 0.70,
        "primary_alteration": "Ferric Oxides (Hematite / Goethite)"
    },
    "vms_base_metals": {
        "name": "VMS Base Metals (Cu-Zn-Pb)",
        "description": "Volcanogenic Massive Sulfide targeting combining footwall chlorite/sericite alteration pipes and syn-volcanic lineament intersections.",
        "weights": {
            "hydroxyl_clay": 0.25,
            "gossan_index": 0.25,
            "ferric_iron": 0.15,
            "lineament_density": 0.15,
            "fault_intersections": 0.20,
            "slope_suitability": 0.00
        },
        "target_threshold": 0.65,
        "primary_alteration": "Sericite-Chlorite & Supergene Gossan"
    }
}


LAYER_DEFAULTS = {
    "hydroxyl_clay": (1.0, 1.8),
    "ferric_iron": (0.8, 1.6),
    "ferrous_iron": (1.1, 2.6),
    "gossan_index": (1.0, 2.2),
    "silica_index": (0.9, 2.0),
    "lineament_density": (0.01, 0.20),
    "fault_intersections": (0.005, 0.10)
}

def normalize_layer(image: ee.Image, band_name: str, p2: float, p98: float) -> ee.Image:
    """Clamps and normalizes an EE image band using concrete Python float min/max."""
    img = image.select(band_name)
    span = max(0.001, float(p98) - float(p2))
    return img.subtract(float(p2)).divide(span).clamp(0.0, 1.0)


def compute_prospectivity_model(
    spectral_dict: Dict[str, ee.Image],
    structural_dict: Dict[str, ee.Image],
    dem_dict: Dict[str, ee.Image],
    roi: ee.Geometry,
    commodity_id: str = "porphyry_cu_au",
    custom_weights: Dict[str, float] = None,
    custom_threshold: float = None
) -> Dict[str, Any]:
    """
    Fuses spectral, structural, and topographic evidence layers into a continuous
    Mineral Prospectivity Index (0.0 - 1.0) using Multi-Criteria Weighted Linear Combination.
    Uses terrain/SAR structural *proxies* as supporting evidence. These are not
    mapped faults and must be verified against geological mapping or geophysics.
    """
    profile = COMMODITY_PROFILES.get(commodity_id, COMMODITY_PROFILES["porphyry_cu_au"])
    weights = custom_weights or profile["weights"]

    # 1. Batch sample 2nd and 98th percentiles across all evidence layers in ONE Earth Engine call
    combined_evidence = ee.Image.cat([
        spectral_dict["hydroxyl_clay"].rename('hydroxyl_clay'),
        spectral_dict["ferric_iron"].rename('ferric_iron'),
        spectral_dict["ferrous_iron"].rename('ferrous_iron'),
        spectral_dict["gossan_index"].rename('gossan_index'),
        spectral_dict["silica_index"].rename('silica_index'),
        structural_dict["lineament_density"].rename('lineament_density'),
        structural_dict["fault_intersections"].rename('fault_intersections')
    ])

    stats = {}
    try:
        stats = combined_evidence.reduceRegion(
            reducer=ee.Reducer.percentile([2, 98]),
            geometry=roi,
            scale=100,
            maxPixels=1e7,
            bestEffort=True
        ).getInfo() or {}
    except Exception as e:
        logger.warning(f"Batch percentile extraction note: {e}")

    # Extract valid numbers or use domain defaults
    def get_bounds(bname: str):
        def_min, def_max = LAYER_DEFAULTS.get(bname, (0.0, 1.0))
        p2_val = stats.get(f"{bname}_p2")
        p98_val = stats.get(f"{bname}_p98")
        if p2_val is not None and p98_val is not None:
            try:
                p2_f = float(p2_val)
                p98_f = float(p98_val)
                if (p98_f - p2_f) > 0.001:
                    return p2_f, p98_f
            except (TypeError, ValueError):
                pass
        return def_min, def_max

    norm_clay = normalize_layer(spectral_dict["hydroxyl_clay"], 'hydroxyl_clay', *get_bounds('hydroxyl_clay'))
    norm_ferric = normalize_layer(spectral_dict["ferric_iron"], 'ferric_iron', *get_bounds('ferric_iron'))
    norm_ferrous = normalize_layer(spectral_dict["ferrous_iron"], 'ferrous_iron', *get_bounds('ferrous_iron'))
    norm_gossan = normalize_layer(spectral_dict["gossan_index"], 'gossan_index', *get_bounds('gossan_index'))
    norm_silica = normalize_layer(spectral_dict["silica_index"], 'silica_index', *get_bounds('silica_index'))
    norm_struct = normalize_layer(structural_dict["lineament_density"], 'lineament_density', *get_bounds('lineament_density'))
    norm_intersections = normalize_layer(structural_dict["fault_intersections"], 'fault_intersections', *get_bounds('fault_intersections'))
    
    # Slope suitability (moderate slopes 5-35 deg expose outcrop without severe talus/shadow)
    slope = dem_dict["slope"]
    norm_slope = slope.expression(
        'b("slope") >= 5 && b("slope") <= 35 ? 1.0 : (b("slope") < 5 ? 0.4 : 0.6)'
    ).rename('slope_suitability')

    layer_map = {
        "hydroxyl_clay": norm_clay,
        "ferric_iron": norm_ferric,
        "ferrous_iron": norm_ferrous,
        "gossan_index": norm_gossan,
        "silica_index": norm_silica,
        "lineament_density": norm_struct,
        "fault_intersections": norm_intersections,
        "slope_suitability": norm_slope
    }

    # 2. Weighted Evidence Fusion
    base_mask = spectral_dict["hydroxyl_clay"].mask()
    prospectivity = ee.Image(0.0)
    total_weight = 0.0

    for key, weight in weights.items():
        if key in layer_map and weight > 0:
            prospectivity = prospectivity.add(layer_map[key].multiply(weight))
            total_weight += weight

    if total_weight > 0:
        prospectivity = prospectivity.divide(total_weight).rename('prospectivity_index')
    else:
        prospectivity = norm_clay.rename('prospectivity_index')

    # Apply strict footprint mask so constant 0.0 never leaks outside AOI
    prospectivity = prospectivity.updateMask(base_mask)

    # 3. Classify into High / Medium / Low zones
    high_threshold = custom_threshold if custom_threshold is not None else profile.get("target_threshold", 0.60)
    med_threshold = max(0.30, high_threshold - 0.20)

    logger.info(f"Prospectivity thresholds: High >= {high_threshold}, Med >= {med_threshold}")

    classified = (
        ee.Image(1)
        .where(prospectivity.gte(med_threshold), 2)
        .where(prospectivity.gte(high_threshold), 3)
        .updateMask(base_mask)
        .toInt()
        .rename('prospectivity_class')
    )

    return {
        "prospectivity_index": prospectivity,
        "prospectivity_classified": classified,
        "profile": profile,
        "high_threshold": high_threshold,
        "med_threshold": med_threshold
    }


def get_prospectivity_vis_params() -> Dict[str, Any]:
    """
    Standard sequential exploration prospectivity colormap:
    Deep Violet (#241E3D) -> Slate Blue (#2C4159) -> Teal (#3D7A6E) -> Bronze (#B9A23E) -> Gold (#C8963E)
    """
    return {
        "min": 0.0,
        "max": 1.0,
        "palette": ['#241E3D', '#2C4159', '#3D7A6E', '#B9A23E', '#C8963E']
    }


def extract_target_polygons_from_gee(
    classified_image: ee.Image,
    prospectivity_image: ee.Image,
    roi: ee.Geometry,
    profile: Dict[str, Any],
    dem_image: Optional[ee.Image] = None,
    alteration_shells: Optional[ee.Image] = None,
    fault_intersections: Optional[ee.Image] = None,
    is_disturbed_image: Optional[ee.Image] = None,
    exclude_disturbance: bool = True,
    disturbance_overlap_threshold_pct: float = 15.0,
    max_targets: int = 15,
    min_area_ha: float = 1.0
) -> Dict[str, Any]:
    """
    Vectorizes high-ranking pixel clusters into follow-up areas.
    Screens out active open pit benches, tailings ponds, and infrastructure into an excluded audit list.
    Enriches with 3D elevation (Z), alteration shells, and field verification metadata.
    """
    # Isolate High Prospectivity (Class 3)
    high_mask = classified_image.eq(3)
    high_zones = classified_image.updateMask(high_mask).toInt()

    try:
        # Vectorize pixel clusters into polygons
        vectors = high_zones.reduceToVectors(
            geometry=roi,
            scale=20,  # Sentinel-2 SWIR native resolution; do not imply finer detail
            geometryType='polygon',
            eightConnected=True,
            labelProperty='target_class',
            maxPixels=1e8
        )

        # Compute mean prospectivity and centroid attributes per vector polygon
        def compute_polygon_metrics(feature):
            geom = feature.geometry()
            area_m2 = geom.area(maxError=10)
            area_ha = area_m2.divide(10000)
            
            # Mean prospectivity score across the target polygon
            mean_score = prospectivity_image.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=geom,
                scale=30,
                maxPixels=1e6
            ).get('prospectivity_index')
            
            centroid = geom.centroid(maxError=10).coordinates()
            centroid_pt = ee.Geometry.Point(centroid)

            # Elevation Z from DEM at target centroid
            elev_val = 1500.0
            if dem_image is not None:
                elev_res = dem_image.reduceRegion(
                    reducer=ee.Reducer.first(),
                    geometry=centroid_pt,
                    scale=30,
                    maxPixels=1e4
                ).get('DEM')
                elev_val = ee.Algorithms.If(elev_res, elev_res, 1500.0)

            # Dominant Alteration Shell at centroid
            shell_code = 1
            if alteration_shells is not None:
                shell_res = alteration_shells.reduceRegion(
                    reducer=ee.Reducer.first(),
                    geometry=centroid_pt,
                    scale=30,
                    maxPixels=1e4
                ).get('alteration_shells')
                shell_code = ee.Algorithms.If(shell_res, shell_res, 1)

            # Structural intersection intensity at centroid
            struct_int = 0.0
            if fault_intersections is not None:
                int_res = fault_intersections.reduceRegion(
                    reducer=ee.Reducer.first(),
                    geometry=centroid_pt,
                    scale=30,
                    maxPixels=1e4
                ).get('fault_intersections')
                struct_int = ee.Algorithms.If(int_res, int_res, 0.0)

            # Mine-disturbance overlap is evaluated across the full candidate
            # footprint. A centroid-only test can miss a polygon that crosses
            # a pit, tailings facility or haul road.
            disturbance_overlap_pct = ee.Number(0)
            if is_disturbed_image is not None:
                disturbed_area_m2 = (
                    is_disturbed_image.selfMask()
                    .multiply(ee.Image.pixelArea())
                    .reduceRegion(
                        reducer=ee.Reducer.sum(),
                        geometry=geom,
                        scale=20,
                        maxPixels=1e7,
                        bestEffort=True,
                        tileScale=4
                    )
                    .get('mine_disturbance_binary')
                )
                disturbance_overlap_pct = ee.Number(ee.Algorithms.If(
                    disturbed_area_m2,
                    ee.Number(disturbed_area_m2).divide(area_m2).multiply(100),
                    0
                ))

            return feature.set({
                'area_ha': area_ha,
                'confidence_pct': ee.Number(ee.Algorithms.If(mean_score, ee.Number(mean_score).multiply(100).round(), 70)),
                'centroid_lng': centroid.get(0),
                'centroid_lat': centroid.get(1),
                'elevation_m': elev_val,
                'alteration_shell_code': shell_code,
                'structural_intensity': struct_int,
                'disturbance_overlap_pct': disturbance_overlap_pct.multiply(10).round().divide(10),
                'is_disturbed': disturbance_overlap_pct.gte(disturbance_overlap_threshold_pct)
            })

        # Pre-filter by area so only significant anomaly footprints are enriched
        def add_area(feat):
            return feat.set({'area_ha': feat.geometry().area(maxError=10).divide(10000)})

        with_area = vectors.map(add_area)
        filtered = with_area.filter(ee.Filter.gte('area_ha', min_area_ha))
        enriched = filtered.map(compute_polygon_metrics)
        sorted_targets = enriched.sort('confidence_pct', False).limit(max_targets * 2)
        geojson_data = sorted_targets.getInfo()
    except Exception as e:
        logger.warning(f"Polygon extraction note: {e}")
        geojson_data = {"type": "FeatureCollection", "features": []}
    
    # Alteration shell mapping (Lowell & Guilbert model)
    shell_names = {
        1: "Phyllic-Potassic Alteration Complex",
        2: "Propylitic Halo (Chlorite-Epidote)",
        3: "Argillic Halo (Kaolinite-Smectite)",
        4: "Phyllic Core (Quartz-Sericite-Pyrite)",
        5: "Silica Cap / Epithermal Sinter"
    }

    # Enrich GeoJSON and separate candidate follow-up areas from mine disturbance.
    features = geojson_data.get('features', [])
    clean_targets = []
    excluded_targets = []
    clean_features = []
    
    for feat in features:
        props = feat.get('properties', {})
        conf = float(props.get('confidence_pct', 75.0))
        area_ha = round(float(props.get('area_ha', 5.0)), 2)
        area_km2 = round(area_ha / 100.0, 3)
        elev_m = round(float(props.get('elevation_m', 2200.0)), 1)
        disturbance_overlap_pct = round(float(props.get('disturbance_overlap_pct', 0.0)), 1)
        is_disturbed = bool(int(props.get('is_disturbed', 0)))
        
        raw_shell = int(props.get('alteration_shell_code', 1))
        alteration_shell = shell_names.get(raw_shell, profile.get("primary_alteration", "Hydrothermal Alteration"))
        
        struct_val = float(props.get('structural_intensity', 0.0))
        if struct_val >= 0.05:
            structural_setting = "Terrain-edge directional crossing (structural proxy)"
        elif struct_val >= 0.02:
            structural_setting = "Terrain-edge concentration (structural proxy)"
        else:
            structural_setting = "Low terrain-edge support (structural proxy)"

        target_item = {
            "confidence_score": conf,
            "area_ha": area_ha,
            "area_km2": area_km2,
            "elevation_m": elev_m,
            "alteration_shell": alteration_shell,
            "structural_setting": structural_setting,
            "commodity": profile.get("name", "Mineral Target"),
            "primary_alteration": profile.get("primary_alteration", "Hydrothermal Alteration"),
            "centroid": [round(float(props.get('centroid_lat', 0.0)), 5), round(float(props.get('centroid_lng', 0.0)), 5)],
            "recommended_action": "Field mapping, sampling and structural verification" if conf >= 75 else ("Reconnaissance mapping and geochemistry" if conf >= 70 else "Review against geology and acquisition quality"),
            "verification_status": "Remote-Sensing Only",
            "deposit_model_audit": profile.get("name", "Porphyry Cu-Mo-Au"),
            "resolution_uncertainty_ha": 0.04,
            "is_sub_hectare": area_ha < 1.0,
            "disturbance_overlap_pct": disturbance_overlap_pct,
        }

        if is_disturbed and exclude_disturbance:
            target_item["target_id"] = f"EXC-{len(excluded_targets)+1:02d}"
            target_item["priority"] = "Excluded"
            target_item["exclusion_reason"] = (
                f"Mine-disturbance overlap {disturbance_overlap_pct:.1f}% "
                f"(screening threshold: {disturbance_overlap_threshold_pct:.0f}%)"
            )
            excluded_targets.append(target_item)
        else:
            rank = len(clean_targets) + 1
            if rank <= max_targets:
                target_item["target_id"] = f"TGT-{rank:02d}"
                target_item["rank"] = rank
                target_item["priority"] = f"Tier {1 if rank <= 3 else (2 if rank <= 8 else 3)}"
                clean_targets.append(target_item)
                feat['properties'] = target_item
                clean_features.append(feat)

    # Return clean GeoJSON for follow-up areas. Scores are rankings, not probabilities.
    clean_geojson = {
        "type": "FeatureCollection",
        "features": clean_features
    }

    return {
        "geojson": clean_geojson,
        "targets": clean_targets,
        "excluded_targets": excluded_targets
    }
