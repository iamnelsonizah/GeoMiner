import os
import logging
import base64
from typing import Dict, Any, List, Optional
import ee
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# GEE Global state tracker
gee_initialized = False

def initialize_gee() -> bool:
    """
    Initializes Google Earth Engine using service account JSON key,
    or falls back to default system credentials.
    """
    global gee_initialized
    if gee_initialized:
        return True

    project_id = os.getenv("GEE_PROJECT")
    sa_email = os.getenv("GEE_SERVICE_ACCOUNT")
    key_file = os.getenv("GEE_KEY_FILE", "credentials.json")
    key_data = os.getenv("GEE_SERVICE_ACCOUNT_JSON")
    key_data_b64 = os.getenv("GEE_SERVICE_ACCOUNT_JSON_B64")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    key_path = os.path.join(base_dir, key_file)

    try:
        if key_data_b64 and not key_data:
            key_data = base64.b64decode(key_data_b64).decode("utf-8")

        if key_data:
            logger.info("Initializing Earth Engine with Service Account JSON from environment.")
            credentials = ee.ServiceAccountCredentials(sa_email or None, key_data=key_data)
            ee.Initialize(credentials, project=project_id)
            gee_initialized = True
            logger.info("Earth Engine initialized successfully via environment credentials.")
            return True

        if sa_email and os.path.exists(key_path):
            logger.info(f"Initializing Earth Engine with Service Account: {sa_email}")
            credentials = ee.ServiceAccountCredentials(sa_email, key_path)
            ee.Initialize(credentials, project=project_id)
            gee_initialized = True
            logger.info("Earth Engine initialized successfully via Service Account.")
            return True

        default_key_path = os.path.join(base_dir, "credentials.json")
        if os.path.exists(default_key_path):
            logger.info("Initializing Earth Engine with default credentials.json file...")
            credentials = ee.ServiceAccountCredentials("", default_key_path)
            ee.Initialize(credentials, project=project_id)
            gee_initialized = True
            logger.info("Earth Engine initialized successfully via credentials.json.")
            return True

        logger.info("No service account credentials file found. Trying Default Credentials...")
        ee.Initialize(project=project_id)
        gee_initialized = True
        logger.info("Earth Engine initialized successfully via Default Credentials.")
        return True

    except Exception as e:
        logger.warning(f"Failed to initialize Earth Engine: {e}")
        return False


def mask_s2_clouds(image: ee.Image) -> ee.Image:
    """
    Masks clouds, shadows, snow and cirrus using QA60 plus Sentinel-2's scene
    classification layer.  Ratio-based mineral indices are especially sensitive
    to residual cloud/shadow pixels, so scene classification is not optional.
    """
    qa = image.select('QA60')
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    qa_clear = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    scl = image.select('SCL')
    # Keep saturated/defective, dark, cloud shadow, cloud, cirrus and snow out.
    scl_clear = (scl.neq(1).And(scl.neq(3)).And(scl.neq(8)).And(scl.neq(9))
                 .And(scl.neq(10)).And(scl.neq(11)))
    mask = qa_clear.And(scl_clear)
    
    # Scale reflectance values from DN (0-10000) to float (0.0-1.0)
    return image.updateMask(mask).divide(10000).copyProperties(image, ["system:time_start"])


def get_s2_composite(
    roi: ee.Geometry, 
    start_date: str = "2023-01-01", 
    end_date: str = "2024-01-01",
    cloud_percentage: int = 20
) -> ee.Image:
    """
    Fetches a cloud-masked Sentinel-2 Surface Reflectance median composite over an AOI.
    Bands: B2 (Blue), B3 (Green), B4 (Red), B8 (NIR), B11 (SWIR1), B12 (SWIR2).
    Includes automatic cloud-threshold relaxation for cloudy tropical/cordilleran belts.
    """
    base_col = (
        ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
        .filterBounds(roi)
        .filterDate(start_date, end_date)
    )
    
    filtered = base_col.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_percentage))
    
    # In cloudy cordilleran or tropical belts, relax threshold to 45% if strict filter is empty
    collection = ee.Algorithms.If(
        filtered.size().gt(0),
        filtered,
        base_col.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 45))
    )
    
    composite = ee.ImageCollection(collection).map(mask_s2_clouds).median().clip(roi)
    return composite


def get_copernicus_dem(roi: ee.Geometry) -> Dict[str, ee.Image]:
    """
    Fetches global 30m Global DEM (NASADEM / SRTM) and computes continuous elevation,
    slope, aspect, and multi-angle hillshade.
    """
    try:
        dem = ee.Image('NASA/NASADEM_HGT/001').select('elevation').rename('DEM')
    except Exception:
        dem = ee.Image('USGS/SRTMGL1_003').rename('DEM')
    
    terrain = ee.Terrain.products(dem)
    slope = terrain.select('slope')
    aspect = terrain.select('aspect')
    
    # Multi-directional hillshades (Azimuth 0, 45, 90, 135 at 45 deg elevation)
    hs0 = ee.Terrain.hillshade(dem, 0, 45)
    hs45 = ee.Terrain.hillshade(dem, 45, 45)
    hs90 = ee.Terrain.hillshade(dem, 90, 45)
    hs135 = ee.Terrain.hillshade(dem, 135, 45)
    
    # Fused multidirectional hillshade (standard exploration geophysical visualization)
    hs_multi = hs0.multiply(0.25).add(hs45.multiply(0.25)).add(hs90.multiply(0.25)).add(hs135.multiply(0.25)).rename('hillshade_multi')
    
    return {
        "dem": dem.clip(roi),
        "slope": slope.clip(roi),
        "aspect": aspect.clip(roi),
        "hillshade": hs_multi.clip(roi)
    }


def get_sentinel1_sar(roi: ee.Geometry, start_date: str = "2023-01-01", end_date: str = "2024-01-01") -> ee.Image:
    """
    Fetches Sentinel-1 SAR (C-band) Ground Range Detected (GRD) in Interferometric Wide (IW) mode.
    Returns VV and VH backscatter for surface-roughness interpretation. C-band
    backscatter does not image subsurface lineaments.
    """
    sar = (
        ee.ImageCollection('COPERNICUS/S1_GRD')
        .filterBounds(roi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
        .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
        .filter(ee.Filter.eq('instrumentMode', 'IW'))
        .select(['VV', 'VH'])
        .median()
        .clip(roi)
    )
    return sar


def get_map_tile_url(image: ee.Image, vis_params: Dict[str, Any]) -> str:
    """
    Generates an XYZ slippy tile template URL from a Google Earth Engine image object.
    """
    map_id_dict = ee.Image(image).getMapId(vis_params)
    return map_id_dict['tile_fetcher'].url_format
