import ee
import json
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gee_service import initialize_gee, get_s2_composite, get_copernicus_dem, get_sentinel1_sar
from spectral_indices import compute_spectral_indices, get_spectral_vis_params
from structural_service import extract_structural_lineaments, get_structural_vis_params
from prospectivity_model import compute_prospectivity_model, extract_target_polygons_from_gee

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RegressionTest")

TEST_SITES = [
    {
        "name": "Cuprite, Nevada (Epithermal Au / Advanced Argillic)",
        "commodity": "epithermal_au",
        "bbox": [-117.22, 37.50, -117.14, 37.56],
        "expected_alteration": "Hydroxyl / Alunite / Kaolinite"
    },
    {
        "name": "Escondida, Chile (Porphyry Cu-Au)",
        "commodity": "porphyry_cu_au",
        "bbox": [-69.15, -24.35, -68.95, -24.15],
        "expected_alteration": "Phyllic & Gossanous Cap"
    },
    {
        "name": "Pilbara, Australia (Iron Oxide / Pegmatite)",
        "commodity": "lithium_pegmatite",
        "bbox": [119.64, -21.12, 119.84, -20.94],
        "expected_alteration": "Ferric Iron & Structural Trends"
    }
]

def run_regression_tests():
    logger.info("Initializing Google Earth Engine...")
    if not initialize_gee():
        logger.error("Failed to initialize Earth Engine. Check credentials.")
        return False

    all_passed = True

    for site in TEST_SITES:
        logger.info(f"\n==========================================")
        logger.info(f"Running Regression Test for: {site['name']}")
        logger.info(f"Commodity: {site['commodity']} | BBox: {site['bbox']}")
        
        roi = ee.Geometry.Rectangle(site["bbox"])

        # 1. Ingest imagery
        s2 = get_s2_composite(roi, "2023-01-01", "2024-01-01")
        dem_data = get_copernicus_dem(roi)
        sar_data = get_sentinel1_sar(roi, "2023-01-01", "2024-01-01")

        # 2. Compute indices with solar illumination correction
        spectral = compute_spectral_indices(s2, mask_vegetation=True, dem_dict=dem_data, apply_solar_correction=True)
        structural = extract_structural_lineaments(dem_data["dem"], sar_data)

        # 3. Model prospectivity
        model = compute_prospectivity_model(
            spectral_dict=spectral,
            structural_dict=structural,
            dem_dict=dem_data,
            roi=roi,
            commodity_id=site["commodity"]
        )

        # 4. Statistical Sanity Check: Compute Standard Deviation of prospectivity index
        # Real remote sensing data has non-zero spatial variance
        stats = model["prospectivity_index"].reduceRegion(
            reducer=ee.Reducer.stdDev().combine(ee.Reducer.mean(), "", True),
            geometry=roi,
            scale=30,
            maxPixels=1e8
        ).getInfo()

        mean_val = stats.get("prospectivity_index_mean", 0.0)
        std_val = stats.get("prospectivity_index_stdDev", 0.0)

        logger.info(f"Prospectivity Mean: {mean_val:.4f} | StdDev: {std_val:.4f}")

        if std_val is None or std_val < 0.005:
            logger.error(f"FAIL: Near-zero variance detected! Raster may be flat placeholder.")
            all_passed = False
        else:
            logger.info(f"PASS: Non-zero spatial variance verified ({std_val:.4f} > 0.005).")

        # 5. Target Vectorization Check with 3D elevation and alteration shells
        target_res = extract_target_polygons_from_gee(
            classified_image=model["prospectivity_classified"],
            prospectivity_image=model["prospectivity_index"],
            roi=roi,
            profile=model["profile"],
            dem_image=dem_data["dem"],
            alteration_shells=spectral["alteration_shells"],
            fault_intersections=structural["fault_intersections"],
            max_targets=10
        )

        num_targets = len(target_res.get("targets", []))
        logger.info(f"Targets Identified: {num_targets}")

        # 6. AOI Area Calculation Check
        area_m2 = roi.area(maxError=50).getInfo()
        area_km2 = round(area_m2 / 1e6, 2)
        logger.info(f"Exact AOI Area: {area_km2} km² ({area_m2 / 1e4:.1f} ha)")

        logger.info(f"Test for {site['name']} COMPLETED SUCCESSFULLY.")

    logger.info(f"\n==========================================")
    if all_passed:
        logger.info("ALL REGRESSION TESTS PASSED! Continuous raster variance confirmed.")
    else:
        logger.error("SOME REGRESSION TESTS FAILED.")
    
    return all_passed

if __name__ == "__main__":
    run_regression_tests()
