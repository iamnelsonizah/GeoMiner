import ee
import math
from typing import Dict, Any, Optional

def compute_vegetation_mask(s2_image: ee.Image, ndvi_threshold: float = 0.30) -> ee.Image:
    """
    Suppresses dense green vegetation where spectral alteration signatures are obscured.
    NDVI = (B8 - B4) / (B8 + B4)
    Returns a binary mask (1 = bare ground/sparse outcrop, 0 = vegetated).
    """
    ndvi = s2_image.normalizedDifference(['B8', 'B4']).rename('ndvi')
    bare_mask = ndvi.lt(ndvi_threshold)
    return bare_mask


def compute_water_tailings_mask(s2_image: ee.Image) -> ee.Image:
    """
    Suppresses open water bodies, acid mine ponds, wet tailings slurry, and evaporative sumps.
    Water has near-total absorption in SWIR1 (B11 < 0.05) and positive MNDWI (Green - SWIR1 > 0),
    which otherwise creates severe false-positive ratio artifacts on brownfield mine sites.
    """
    mndwi = s2_image.normalizedDifference(['B3', 'B11'])
    nir_absorption = s2_image.select('B8').lt(0.05)
    swir_absorption = s2_image.select('B11').lt(0.06)
    is_pond_or_tailings = mndwi.gt(0.05).Or(swir_absorption.And(nir_absorption))
    return is_pond_or_tailings.Not()


def apply_topographic_solar_correction(
    s2_image: ee.Image, 
    slope_deg: ee.Image, 
    aspect_deg: ee.Image,
    solar_zenith_deg: float = 35.0,
    solar_azimuth_deg: float = 135.0,
    c_param: float = 0.20
) -> ee.Image:
    """
    Applies empirical C-correction for topographic solar illumination on Sentinel-2 surface reflectance.
    Eliminates false-positive spectral ratio spikes in rugged cordilleran terrain (Andes, Rockies)
    caused by deep shadows or steep north/south slope facets.

    Formula:
      cos(i) = cos(theta_z)*cos(S) + sin(theta_z)*sin(S)*cos(phi_s - A)
      Normalized_Reflectance = L * (cos(theta_z) + C) / (cos(i) + C)
    """
    # Convert degrees to radians
    deg2rad = math.pi / 180.0
    zenith_rad = solar_zenith_deg * deg2rad
    azimuth_rad = solar_azimuth_deg * deg2rad

    slope_rad = slope_deg.multiply(deg2rad)
    aspect_rad = aspect_deg.multiply(deg2rad)

    # Local incidence angle cos(i)
    # cos(i) = cos(zenith)*cos(slope) + sin(zenith)*sin(slope)*cos(azimuth - aspect)
    cos_zenith = math.cos(zenith_rad)
    sin_zenith = math.sin(zenith_rad)

    cos_i = (
        slope_rad.cos().multiply(cos_zenith)
        .add(slope_rad.sin().multiply(sin_zenith).multiply(aspect_rad.subtract(azimuth_rad).cos()))
    ).rename('cos_i')

    # C-correction scaling factor
    # Scale factor = (cos(theta_z) + C) / (cos(i) + C) clamped between 0.4 and 2.2 to prevent over-correction
    scale_factor = (
        cos_i.add(c_param)
        .pow(-1)
        .multiply(cos_zenith + c_param)
        .clamp(0.4, 2.2)
    )

    bands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12']
    corrected_bands = []
    for b in bands:
        corrected = s2_image.select(b).multiply(scale_factor).rename(b)
        corrected_bands.append(corrected)

    corrected_img = ee.Image.cat(corrected_bands)
    return corrected_img


def compute_spectral_indices(
    s2_image: ee.Image, 
    mask_vegetation: bool = True,
    dem_dict: Optional[Dict[str, ee.Image]] = None,
    apply_solar_correction: bool = True
) -> Dict[str, ee.Image]:
    """
    Calculates diagnostic mineral exploration band ratios from Sentinel-2 VNIR-SWIR bands
    with optional topographic solar illumination correction and vegetation masking:
    - Hydroxyl / Clay (Al-OH) Ratio: B11 (SWIR1) / B12 (SWIR2) [Phyllic, Argillic, Alunite]
    - Ferric Iron (Fe3+) Ratio: B4 (Red) / B2 (Blue) [Hematite, Goethite, Jarosite]
    - Ferrous Iron (Fe2+) Ratio: B12 (SWIR2) / B8 (NIR) + B3 (Green) / B4 (Red)
    - Gossan Index: B11 (SWIR1) / B4 (Red)
    - Silica Index / Quartz: B11 (SWIR1) / B8 (NIR)
    - Alteration Shells: Lowell-Guilbert hydrothermal zonation (Phyllic vs Argillic vs Propylitic)
    - Alteration RGB Composite: R: Clay (B11/B12), G: Ferric (B4/B2), B: Ferrous (B12/B8)
    """
    proc_image = s2_image

    # 0. Apply Topographic Solar Illumination Correction if DEM is supplied
    if apply_solar_correction and dem_dict is not None and "slope" in dem_dict and "aspect" in dem_dict:
        try:
            proc_image = apply_topographic_solar_correction(
                s2_image=s2_image,
                slope_deg=dem_dict["slope"],
                aspect_deg=dem_dict["aspect"]
            )
        except Exception:
            proc_image = s2_image

    # 1. Hydroxyl / Clay (Al-OH) alteration index
    # Illite, Kaolinite, Alunite have deep absorption at 2.20 µm (B12) vs reflectance peak at 1.61 µm (B11)
    hydroxyl_index = proc_image.expression(
        'b("B11") / (b("B12") + 0.0001)'
    ).rename('hydroxyl_clay')

    # 2. Ferric Iron (Fe3+) index
    # Iron oxides have strong charge-transfer absorption in UV-Blue (B2) and high reflectance in Red (B4)
    ferric_iron = proc_image.expression(
        'b("B4") / (b("B2") + 0.0001)'
    ).rename('ferric_iron')

    # 3. Ferrous Iron (Fe2+) index
    # Chlorite, epidote (propylitic alteration) exhibit Fe2+ crystal field absorption near 1.0 µm (B8)
    ferrous_iron = proc_image.expression(
        '(b("B12") / (b("B8") + 0.0001)) + (b("B3") / (b("B4") + 0.0001))'
    ).rename('ferrous_iron')

    # 4. Gossan Index (Hydrothermal cap / weathered sulfide oxidation)
    gossan_index = proc_image.expression(
        'b("B11") / (b("B4") + 0.0001)'
    ).rename('gossan_index')

    # 5. Silica / Quartz enrichment index
    silica_index = proc_image.expression(
        'b("B11") / (b("B8") + 0.0001)'
    ).rename('silica_index')

    # 6. False-Color Alteration RGB Composite
    alteration_composite = ee.Image.cat([
        hydroxyl_index.rename('clay'),
        ferric_iron.rename('ferric'),
        proc_image.expression('b("B11") / (b("B8") + 0.0001)').rename('ferrous_simple')
    ]).rename(['clay', 'ferric', 'ferrous'])

def compute_mine_disturbance_mask(s2_image: ee.Image) -> Dict[str, ee.Image]:
    """
    Classifies active open pit workings, haul roads, leach pads, and plant infrastructure.
    Uses:
      - High Albedo Blasted Rock: B2 > 0.40 and B4 > 0.48 (freshly pulverized pit benches)
      - Artificial Reflectance: B2 > B4 and B2 > 0.18 (blue industrial metal roofs/sheds)
      - Water / Saturated Tailings: MNDWI > 0.05 or (B11 < 0.06 and B8 < 0.06)
      - Industrial Compacted Yards: NDBI > 0.18
    Returns:
      - 'undisturbed_mask': Binary mask (1 = Natural undisturbed terrain, 0 = Active mining disturbance).
      - 'disturbance_vis': Visual layer with crimson overlay over disturbed surfaces.
      - 'is_disturbed': Binary disturbance raster.
    """
    # 1. Freshly blasted, pulverized open-pit bench floor (extreme high-albedo dust)
    high_albedo_pit = s2_image.select('B2').gt(0.40).And(s2_image.select('B4').gt(0.48))
    
    # 2. Liquid tailings ponds, evaporative sumps, and wet leach pools
    mndwi = s2_image.normalizedDifference(['B3', 'B11']).rename('mndwi')
    is_water_tailings = mndwi.gt(0.05).Or(
        s2_image.select('B11').lt(0.06).And(s2_image.select('B8').lt(0.06))
    )
    
    # 3. Engineered metal structures & painted plant roofs (artificial blue reflection)
    is_building = s2_image.select('B2').gt(s2_image.select('B4')).And(s2_image.select('B2').gt(0.18))
    
    # 4. Heavy compacted haul roads & industrial yards (ultra-high SWIR/visible ratio)
    ndbi = s2_image.normalizedDifference(['B11', 'B8'])
    is_industrial = ndbi.gt(0.18)

    is_disturbed = high_albedo_pit.Or(is_water_tailings).Or(is_building).Or(is_industrial).rename('mine_disturbance_binary')
    undisturbed_mask = is_disturbed.Not().rename('undisturbed_terrain_mask')
    disturbance_vis = ee.Image(1).updateMask(is_disturbed).rename('mine_disturbance')

    return {
        "undisturbed_mask": undisturbed_mask,
        "disturbance_vis": disturbance_vis,
        "is_disturbed": is_disturbed
    }


def compute_spectral_indices(
    s2_image: ee.Image, 
    mask_vegetation: bool = True,
    dem_dict: Optional[Dict[str, ee.Image]] = None,
    apply_solar_correction: bool = True
) -> Dict[str, ee.Image]:
    """
    Calculates diagnostic mineral exploration band ratios from Sentinel-2 VNIR-SWIR bands
    with topographic solar illumination correction, vegetation masking, and mine disturbance detection.
    """
    proc_image = s2_image

    # 0. Apply Topographic Solar Illumination Correction if DEM is supplied
    if apply_solar_correction and dem_dict is not None and "slope" in dem_dict and "aspect" in dem_dict:
        try:
            proc_image = apply_topographic_solar_correction(
                s2_image=s2_image,
                slope_deg=dem_dict["slope"],
                aspect_deg=dem_dict["aspect"]
            )
        except Exception:
            proc_image = s2_image

    # 1. Hydroxyl / Clay (Al-OH) alteration index
    hydroxyl_index = proc_image.expression(
        'b("B11") / (b("B12") + 0.0001)'
    ).rename('hydroxyl_clay')

    # 2. Ferric Iron (Fe3+) index
    ferric_iron = proc_image.expression(
        'b("B4") / (b("B2") + 0.0001)'
    ).rename('ferric_iron')

    # 3. Ferrous Iron (Fe2+) index
    ferrous_iron = proc_image.expression(
        '(b("B12") / (b("B8") + 0.0001)) + (b("B3") / (b("B4") + 0.0001))'
    ).rename('ferrous_iron')

    # 4. Gossan Index (Hydrothermal cap / weathered sulfide oxidation)
    gossan_index = proc_image.expression(
        'b("B11") / (b("B4") + 0.0001)'
    ).rename('gossan_index')

    # 5. Silica / Quartz enrichment index
    silica_index = proc_image.expression(
        'b("B11") / (b("B8") + 0.0001)'
    ).rename('silica_index')

    # 6. False-Color Alteration RGB Composite
    alteration_composite = ee.Image.cat([
        hydroxyl_index.rename('clay'),
        ferric_iron.rename('ferric'),
        proc_image.expression('b("B11") / (b("B8") + 0.0001)').rename('ferrous_simple')
    ]).rename(['clay', 'ferric', 'ferrous'])

    # 7. Mining Infrastructure & Disturbance Classification
    disturbance_res = compute_mine_disturbance_mask(s2_image)
    tailings_mask = compute_water_tailings_mask(s2_image)

    # Suppress open water bodies and liquid tailings pools from spectral ratios
    hydroxyl_index = hydroxyl_index.updateMask(tailings_mask)
    ferric_iron = ferric_iron.updateMask(tailings_mask)
    ferrous_iron = ferrous_iron.updateMask(tailings_mask)
    gossan_index = gossan_index.updateMask(tailings_mask)
    silica_index = silica_index.updateMask(tailings_mask)
    alteration_composite = alteration_composite.updateMask(tailings_mask)

    # 8. Vegetation Suppression Mask
    if mask_vegetation:
        veg_mask = compute_vegetation_mask(s2_image)
        hydroxyl_index = hydroxyl_index.updateMask(veg_mask)
        ferric_iron = ferric_iron.updateMask(veg_mask)
        ferrous_iron = ferrous_iron.updateMask(veg_mask)
        gossan_index = gossan_index.updateMask(veg_mask)
        silica_index = silica_index.updateMask(veg_mask)
        alteration_composite = alteration_composite.updateMask(veg_mask)

    # 9. Lowell-Guilbert Hydrothermal Alteration Shell Discrimination
    alteration_shells = (
        ee.Image(1)
        .where(ferrous_iron.gte(1.8).And(hydroxyl_index.lt(1.2)), 2) # Propylitic Halo
        .where(hydroxyl_index.gte(1.15).And(gossan_index.lt(1.3)), 3) # Argillic Halo
        .where(hydroxyl_index.gte(1.2).And(gossan_index.gte(1.3)), 4) # Phyllic Core
        .where(silica_index.gte(1.5).And(hydroxyl_index.gte(1.2)), 5) # Silica Cap
        .updateMask(hydroxyl_index.mask())
        .toInt()
        .rename('alteration_shells')
    )

    return {
        "hydroxyl_clay": hydroxyl_index,
        "ferric_iron": ferric_iron,
        "ferrous_iron": ferrous_iron,
        "gossan_index": gossan_index,
        "silica_index": silica_index,
        "alteration_composite": alteration_composite,
        "alteration_shells": alteration_shells,
        "mine_disturbance": disturbance_res["disturbance_vis"],
        "undisturbed_mask": disturbance_res["undisturbed_mask"],
        "is_disturbed": disturbance_res["is_disturbed"]
    }


def get_spectral_vis_params(layer_name: str) -> Dict[str, Any]:
    """
    Returns standard geological exploration color palettes adhering strictly
    to the UI domain color tokens.
    """
    palettes = {
        "true_color": {
            "bands": ['B4', 'B3', 'B2'],
            "min": 0.0,
            "max": 0.35,
            "gamma": 1.4
        },
        "false_color_ir": {
            "bands": ['B8', 'B4', 'B3'],
            "min": 0.0,
            "max": 0.40,
            "gamma": 1.3
        },
        "swir_geology": {
            "bands": ['B12', 'B11', 'B8'],
            "min": 0.05,
            "max": 0.50,
            "gamma": 1.2
        },
        "hydroxyl_clay": {
            "min": 0.9,
            "max": 2.0,
            "palette": ['#141B26', '#2D2240', '#4A3B66', '#645487', '#7C6FA3', '#A89BC9'] # Deep Navy to Geoscience Violet
        },
        "ferric_iron": {
            "min": 0.8,
            "max": 1.8,
            "palette": ['#141B26', '#3D1C14', '#662E20', '#8C432E', '#B25A3A', '#D98264'] # Deep Navy to Gossan Rust
        },
        "ferrous_iron": {
            "min": 1.0,
            "max": 3.0,
            "palette": ['#141B26', '#17332B', '#245447', '#347564', '#4E8C85', '#7BC3B8'] # Deep Navy to Propylitic Green
        },
        "gossan_index": {
            "min": 0.9,
            "max": 2.5,
            "palette": ['#141B26', '#3D1C14', '#662E20', '#8C432E', '#B25A3A', '#E8967A'] # Deep Navy to Gossan Rust
        },
        "silica_index": {
            "min": 0.8,
            "max": 2.2,
            "palette": ['#141B26', '#1B2B3E', '#2A4A6D', '#4170A2', '#6999CC', '#E9E4D6'] # Deep Navy to Silicic White
        },
        "alteration_shells": {
            "min": 1,
            "max": 5,
            "palette": ['#141B26', '#4E8C85', '#7C6FA3', '#C8963E', '#E9E4D6'] # 1:Bg, 2:Propylitic, 3:Argillic, 4:Phyllic, 5:Silicic
        },
        "alteration_composite": {
            "bands": ['clay', 'ferric', 'ferrous'],
            "min": [0.9, 0.8, 1.0],
            "max": [2.0, 1.8, 2.5],
            "gamma": 1.2
        },
        "mine_disturbance": {
            "min": 0,
            "max": 1,
            "palette": ['#E74C3C'] # Semi-translucent crimson/red indicating active mining operations
        }
    }
    return palettes.get(layer_name, palettes["true_color"])
