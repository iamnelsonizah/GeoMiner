"""Public, provenance-first baseline definitions.

Entries here are study configurations, not labelled training data.  An entry
cannot be promoted to ML validation until its occurrence records have passed
the validation data contract and independent geological review.
"""
from typing import Any, Dict


KAZAKHSTAN_PORPHYRY_BASELINE: Dict[str, Any] = {
    "id": "kazakhstan-porphyry-copper-public-v0",
    "name": "Kazakhstan porphyry copper — public baseline",
    "commodity": "porphyry_cu_au",
    "mode": "public-screening-only",
    "status": "not validated for prediction",
    "purpose": "Evaluate data coverage, visual evidence and benchmark-data gaps before ML.",
    "default_imagery_period": {"start": "2023-01-01", "end": "2024-01-01"},
    "available_evidence": [
        "Sentinel-2 SR Harmonized spectral indicators",
        "NASADEM/SRTM terrain context",
        "Sentinel-1 GRD surface-roughness diagnostic (not a ranking feature)",
    ],
    "candidate_public_sources": [
        {
            "name": "Kazakhstan NSDI Geoportal",
            "url": "https://map.gov.kz/",
            "intended_use": "Discover authoritative national geospatial services and map layers.",
            "required_check": "Confirm geological layer coverage, scale, licence and update date before use.",
        },
        {
            "name": "USGS Mineral Resource Data System",
            "url": "https://energy.usgs.gov/arcgis/rest/services/Hosted/Mineral_Resource_Data_System/FeatureServer/0",
            "intended_use": "Candidate occurrence inventory for manual review only.",
            "required_check": "Review source records and remove duplicates, non-porphyry occurrences and uncertain locations.",
        },
    ],
    "prohibited_claims": [
        "Predictive ML performance",
        "Probability of mineralisation",
        "Drill-ready targets",
        "Comparability of scores between separate AOIs",
    ],
    "promotion_requirements": [
        "Vetted porphyry occurrence inventory grouped by independent mineral district",
        "Geology, mapped structures and intrusion/lithology data with provenance",
        "Defined background and exclusion masks",
        "Nested spatial leave-one-district-out benchmark results",
    ],
}


PUBLIC_BASELINES = {KAZAKHSTAN_PORPHYRY_BASELINE["id"]: KAZAKHSTAN_PORPHYRY_BASELINE}
