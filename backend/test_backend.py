import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app, COMMODITY_PROFILES

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

def test_aoi_extent_guardrail():
    # Huge continental bounding box: 10 degrees wide (> 100,000 km2)
    response = client.post("/api/prospectivity", json={
        "commodity": "porphyry_cu_au",
        "bbox": [-75.0, -30.0, -65.0, -20.0]
    })
    assert response.status_code == 422
    assert "exceeds maximum" in response.json()["detail"].lower()
    print("[PASS] AOI extent guardrail (422 for oversized AOI)")

def test_spectral_indices_endpoint():
    # Small test bbox in Escondida
    response = client.post("/api/spectral-indices", json={
        "commodity": "porphyry_cu_au",
        "bbox": [-69.10, -24.28, -69.05, -24.25]
    })
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    assert "layers" in data
    assert "alteration_composite" in data["layers"]
    assert "hydroxyl_clay" in data["layers"]
    print("[PASS] /api/spectral-indices endpoint (alteration_composite visualized successfully)")

if __name__ == "__main__":
    print("Running GeoMiner Backend Test Suite...")
    test_health()
    test_get_commodities()
    test_aoi_extent_guardrail()
    test_spectral_indices_endpoint()
    print("All GeoMiner backend tests passed successfully!")
