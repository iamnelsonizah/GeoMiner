import ee
from typing import Dict, Any

def extract_structural_lineaments(dem_image: ee.Image, sar_image: ee.Image = None) -> Dict[str, ee.Image]:
    """
    Extracts terrain edge and orientation proxies. Sentinel-1 is retained as a
    diagnostic output only until it shows a validated improvement in independent
    tests. These rasters do not delineate faults or prove fluid pathways.
    Operates continuously on the unclipped input to prevent boundary convolution seams.
    """
    # 1. Multi-directional Sobel kernels on DEM (N-S, E-W, NE-SW, NW-SE)
    k_ew = ee.Kernel.fixed(3, 3, [[-1, -2, -1], [0, 0, 0], [1, 2, 1]])
    k_ns = ee.Kernel.fixed(3, 3, [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
    k_ne = ee.Kernel.fixed(3, 3, [[0, 1, 2], [-1, 0, 1], [-2, -1, 0]])
    k_nw = ee.Kernel.fixed(3, 3, [[-2, -1, 0], [-1, 0, 1], [0, 1, 2]])
    
    grad_ew = dem_image.convolve(k_ew)
    grad_ns = dem_image.convolve(k_ns)
    grad_ne = dem_image.convolve(k_ne)
    grad_nw = dem_image.convolve(k_nw)
    
    # Gradient magnitude = sqrt(gh^2 + gv^2)
    grad_mag = (grad_ew.pow(2).add(grad_ns.pow(2))).sqrt().rename('lineament_magnitude')
    
    # 2. Threshold sharp topographic edges. Lithology, roads and mine benches can
    # also produce edges, so this is deliberately described as a proxy.
    edge_threshold = 22.0
    lineament_binary = grad_mag.gt(edge_threshold).rename('lineament_binary')
    
    # Directional lineament branches
    branch_ns = grad_ns.abs().gt(edge_threshold * 0.7)
    branch_ew = grad_ew.abs().gt(edge_threshold * 0.7)
    branch_ne = grad_ne.abs().gt(edge_threshold * 0.7)
    branch_nw = grad_nw.abs().gt(edge_threshold * 0.7)

    # 3. Detect crossings of directional terrain-edge branches. This is a geometric
    # proxy, not a mapped conjugate fault intersection.
    intersect_orthogonal = branch_ns.And(branch_ew)
    intersect_conjugate = branch_ne.And(branch_nw)
    structural_intersections = (
        intersect_orthogonal.Or(intersect_conjugate)
        .rename('structural_intersections')
    )

    # 4. Continuous Gaussian Lineament Density
    density_kernel = ee.Kernel.gaussian(radius=300, sigma=150, units='meters')
    lineament_density = lineament_binary.convolve(density_kernel).rename('lineament_density')
    
    # 5. Continuous Fault Intersection Density (High-priority structural conduit nodes)
    intersect_kernel = ee.Kernel.gaussian(radius=250, sigma=120, units='meters')
    fault_intersections = structural_intersections.convolve(intersect_kernel).rename('fault_intersections')

    # 6. If SAR (Sentinel-1) is available, combine surface roughness edges
    sar_combined = None
    if sar_image is not None:
        try:
            sar_vv = sar_image.select('VV')
            sar_grad = (sar_vv.convolve(k_ew).pow(2).add(sar_vv.convolve(k_ns).pow(2))).sqrt()
            sar_lineaments = sar_grad.gt(2.0).rename('sar_lineaments')
            sar_combined = sar_lineaments
        except Exception:
            sar_combined = None
    
    return {
        "gradient_magnitude": grad_mag,
        "lineament_binary": lineament_binary,
        "lineament_density": lineament_density,
        "structural_intersections": structural_intersections,
        "fault_intersections": fault_intersections,
        "sar_lineaments": sar_combined
    }


def get_structural_vis_params(layer_name: str) -> Dict[str, Any]:
    """
    Returns visual stretch parameters and color ramps for structural layers.
    Palettes strictly adhere to the UI domain color tokens (Teal #4E8C85 and Bronze #C8963E).
    """
    palettes = {
        "dem": {
            "min": 500,
            "max": 3500,
            "palette": ['#141B26', '#1E3A37', '#2E665E', '#4E8C85', '#95C5BD', '#E9E4D6']
        },
        "hillshade": {
            "min": 0,
            "max": 255,
            "palette": ['#080C10', '#1C2430', '#4A5B73', '#9BAEC7', '#E2EAF4']
        },
        "lineament_density": {
            "min": 0.01,
            "max": 0.25,
            "palette": ['#141B26', '#1E3A37', '#2E665E', '#4E8C85', '#7BC3B8'] # Deep Navy to Geoscience Teal
        },
        "fault_intersections": {
            "min": 0.005,
            "max": 0.15,
            "palette": ['#141B26', '#1B3B36', '#2E6B60', '#3D8B7A', '#C8963E', '#F4E0A5'] # Deep Navy -> Teal -> Gold Dilational Nodes
        },
        "lineament_binary": {
            "min": 0,
            "max": 1,
            "palette": ['#141B2600', '#4E8C85'] # Transparent to Teal
        }
    }
    return palettes.get(layer_name, palettes["hillshade"])
