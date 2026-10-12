import sys
import os
from unittest.mock import patch

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Prevent network calls during offline unit testing
with patch("gee_service.initialize_gee", return_value=False):
    from fastapi.testclient import TestClient
    from main import app, COMMODITY_PROFILES, rate_limiter

client = TestClient(app)

def test_health():
    for endpoint in ["/api/health", "/health", "/"]:
        response = client.get(endpoint)
        assert response.status_code == 200, f"Failed on {endpoint}"
        data = response.json()
        assert data["engine"].startswith("GeoMiner")
        assert "porphyry_cu_au" in data["models"]
        assert "status" in data
        print(f"[PASS] {endpoint} endpoint")

def test_get_commodities():
    response = client.get("/api/deposit-models")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert "epithermal_au" in data["models"]
    assert "lithium_pegmatite" in data["models"]
    assert "weights" in data["models"]["porphyry_cu_au"]
    print("[PASS] /api/deposit-models endpoint")

def test_aoi_extent_guardrail_bbox():
    # Huge bounding box: 2 degrees wide (~40,000 km² >> 500 km² / 50,000 ha limit)
    response = client.post("/api/prospectivity", json={
        "commodity": "porphyry_cu_au",
        "bbox": [-71.0, -25.0, -69.0, -23.0]
    })
    assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
    detail = response.json()["detail"].lower()
    assert "exceeds maximum" in detail or "50,000" in detail
    print("[PASS] AOI bbox extent guardrail (422 for > 50,000 ha bbox)")

def test_aoi_extent_guardrail_polygon():
    # Huge polygon coordinates (~150 km x ~150 km = 22,500 km² = 2,250,000 ha >> 50,000 ha limit)
    oversized_polygon = [
        [-70.0, -25.0],
        [-68.5, -25.0],
        [-68.5, -23.5],
        [-70.0, -23.5],
        [-70.0, -25.0]
    ]
    response = client.post("/api/prospectivity", json={
        "commodity": "porphyry_cu_au",
        "aoi": oversized_polygon
    })
    assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"
    detail = response.json()["detail"].lower()
    assert "exceeds maximum" in detail or "50,000" in detail
    print("[PASS] AOI polygon extent guardrail (422 for > 50,000 ha polygon)")

def test_rate_limiter():
    rate_limiter.reset()
    # General limit is 60/min. Let's send 65 quick requests to deposit-models from a test client
    status_codes = []
    for _ in range(65):
        resp = client.get("/api/deposit-models")
        status_codes.append(resp.status_code)

    assert 429 in status_codes, f"Expected 429 Too Many Requests in {status_codes}"
    blocked_resp = client.get("/api/deposit-models")
    assert blocked_resp.status_code == 429
    assert "Retry-After" in blocked_resp.headers
    assert "rate limit" in blocked_resp.json()["detail"].lower()
    print("[PASS] IP-based rate limiting guardrail (429 Too Many Requests & Retry-After enforced)")
    rate_limiter.reset()

if __name__ == "__main__":
    print("Running GeoMiner Backend Test Suite...")
    test_health()
    test_get_commodities()
    test_aoi_extent_guardrail_bbox()
    test_aoi_extent_guardrail_polygon()
    test_rate_limiter()
    print("All GeoMiner backend safeguard tests passed successfully!")
