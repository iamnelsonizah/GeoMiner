"""Validation contracts for spatial mineral-prospectivity experiments.

This module deliberately contains no model training.  It prevents a common
failure mode in mineral prospectivity studies: splitting neighbouring pixels
from the same district between train and test sets and reporting inflated
performance.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Sequence


REQUIRED_OCCURRENCE_PROPERTIES = {
    "site_id", "district_id", "commodity", "deposit_type", "label",
    "source", "source_date", "confidence",
}


def validate_occurrence_records(features: Sequence[Dict[str, Any]]) -> List[str]:
    """Return data-contract errors for a GeoJSON Feature list.

    Labels are ``positive``, ``background`` or ``excluded``.  Background means
    unlabelled comparison ground, not proof of barrenness.
    """
    errors: List[str] = []
    seen_site_ids = set()
    allowed_labels = {"positive", "background", "excluded"}
    for index, feature in enumerate(features):
        props = feature.get("properties") or {}
        missing = REQUIRED_OCCURRENCE_PROPERTIES - set(props)
        if missing:
            errors.append(f"Feature {index}: missing properties {sorted(missing)}")
            continue
        if props["label"] not in allowed_labels:
            errors.append(f"Feature {index}: label must be one of {sorted(allowed_labels)}")
        site_id = str(props["site_id"])
        if site_id in seen_site_ids:
            errors.append(f"Feature {index}: duplicate site_id '{site_id}'")
        seen_site_ids.add(site_id)
    return errors


def leave_one_district_out_splits(features: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Create leakage-resistant outer splits by mineral district/site group.

    A whole district is withheld.  Hyperparameter tuning, feature scaling,
    background sampling and calibration must be performed only within the
    ``train_site_ids`` returned for each split.
    """
    errors = validate_occurrence_records(features)
    if errors:
        raise ValueError("Invalid validation data: " + "; ".join(errors))

    grouped: Dict[str, List[str]] = defaultdict(list)
    for feature in features:
        props = feature["properties"]
        grouped[str(props["district_id"])].append(str(props["site_id"]))

    all_sites = {site_id for ids in grouped.values() for site_id in ids}
    return [
        {
            "held_out_district_id": district_id,
            "test_site_ids": sorted(site_ids),
            "train_site_ids": sorted(all_sites - set(site_ids)),
        }
        for district_id, site_ids in sorted(grouped.items())
    ]


VALIDATION_PROTOCOL: Dict[str, Any] = {
    "name": "Nested spatial leave-one-district-out validation",
    "outer_split": "Hold out an entire mineral district or occurrence cluster.",
    "inner_split": "Use spatial blocks inside the remaining training districts for tuning.",
    "leakage_controls": [
        "Fit scaling, imputation, feature selection and calibration only on each training fold.",
        "Sample background and apply class balancing only after the outer split.",
        "Buffer known occurrences so adjacent pixels cannot enter both train and test data.",
        "Do not use discovery, assay or mapped-occurrence information unavailable at prediction time as a feature.",
    ],
    "required_metrics": [
        "Recall at top 1%, 5% and 10% of ranked search area",
        "Success-rate / prediction-rate curve",
        "Precision-recall AUC",
        "Per-district recall with district-level bootstrap confidence intervals",
    ],
    "reporting_rule": "Do not report calibrated probability unless independent, reliable negative labels and calibration data exist.",
}
