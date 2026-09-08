import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from validation import leave_one_district_out_splits, validate_occurrence_records
from baselines import KAZAKHSTAN_PORPHYRY_BASELINE


def feature(site_id, district_id, label="positive"):
    return {
        "type": "Feature",
        "properties": {
            "site_id": site_id,
            "district_id": district_id,
            "commodity": "Cu",
            "deposit_type": "porphyry",
            "label": label,
            "source": "test",
            "source_date": "2026-01-01",
            "confidence": "verified",
        },
        "geometry": {"type": "Point", "coordinates": [0, 0]},
    }


class ValidationContractTests(unittest.TestCase):
    def test_leave_one_district_out_keeps_sites_together(self):
        records = [feature("a1", "A"), feature("a2", "A"), feature("b1", "B")]
        splits = leave_one_district_out_splits(records)
        self.assertEqual(splits[0]["test_site_ids"], ["a1", "a2"])
        self.assertEqual(splits[0]["train_site_ids"], ["b1"])

    def test_rejects_missing_grouping_metadata(self):
        errors = validate_occurrence_records([{"type": "Feature", "properties": {}}])
        self.assertTrue(errors)

    def test_public_baseline_is_not_misrepresented_as_validated_ml(self):
        self.assertEqual(KAZAKHSTAN_PORPHYRY_BASELINE["mode"], "public-screening-only")
        self.assertEqual(KAZAKHSTAN_PORPHYRY_BASELINE["status"], "not validated for prediction")


if __name__ == "__main__":
    unittest.main()
