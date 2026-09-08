# GeoMiner: Cloud-Based Mineral Exploration Targeting & Remote Sensing Platform

GeoMiner is a full-stack, cloud-based mineral exploration targeting and remote-sensing prospectivity platform. Powered by Google Earth Engine, it integrates multi-spectral satellite imagery (Sentinel-2 L2A) and digital elevation models (SRTM 30m) with genetic mineral deposit models to rank prospective exploration ground for follow-up field investigation.

---

## 🌟 Key Features

### 1. Multi-Sensor Data Ingestion
- **Sentinel-2 (Harmonized Level-2A)**: VNIR & SWIR bands (B2, B3, B4, B8, B11, B12) for diagnostic mineral spectral signatures.
- **Copernicus 30m Global DEM (GLO-30)**: High-resolution elevation, slope, aspect, and multidirectional shaded relief.
- **Sentinel-1 SAR (C-Band GRD)**: VV/VH polarized backscatter as a surface-roughness input. It cannot image subsurface structures.

### 2. Spectral Alteration Engine
- **Hydroxyl / Clay Alteration (Al-OH)**: SWIR1/SWIR2 ($B_{11}/B_{12}$) ratio for sericite, illite, kaolinite, and alunite.
- **Ferric Iron / Gossan ($\text{Fe}^{3+}$)**: Red/Green ($B_4/B_3$) and SWIR1/NIR for hematite, goethite, and jarosite.
- **Ferrous Iron ($\text{Fe}^{2+}$)**: $(B_{11}/B_8) + (B_3/B_4)$ for carbonates and chlorite.
- **Gossan Diagnostic Ratio**: $B_{11}/B_4$ for weathered sulfide caps.
- **Automated Vegetation Masking**: NDVI filtering to suppress dense vegetation interference over bare rock outcrops.

### 3. Structural Geophysics Engine
- **Multidirectional Hillshade Fusion**: Blends $0^\circ, 45^\circ, 90^\circ, 135^\circ$ azimuths to reveal regional structural fabrics.
- **Edge & Lineament Filtering**: Sobel and gradient magnitude filters to detect fault scarps and shear zones.
- **Lineament Density & Intersection Mapping**: Circular kernel density estimation identifying structural dilatation corridors.

### 4. Multi-Criteria Prospectivity & Vector Target Generation
- **Deposit Targeting Presets**:
  1. *Porphyry Copper-Gold (Cu-Au)*
  2. *Epithermal Gold (Au-Ag)*
  3. *Lithium (LCT) Pegmatites*
  4. *Iron Ore & Gossanous Target*
  5. *VMS / Base Metals (Cu-Pb-Zn)*
- **Ranked Follow-up Areas**: Generates vector polygons with priority ranking (Tier 1, Tier 2, Tier 3), surface footprint (ha / km²), centroid coordinates, and a relative 0–100 ranking score. The score is not a probability of mineralisation or a drill recommendation.
- **One-Click GIS Export**: Direct export to **GeoJSON** and **CSV** for QGIS, ArcGIS, and Leapfrog Geo.

---

## 🛠️ Architecture

```
GeoMiner/
├── backend/
│   ├── main.py                  # FastAPI server & REST API routes
│   ├── gee_service.py           # Earth Engine authentication & multi-sensor layer streaming
│   ├── spectral_indices.py      # Hydrothermal alteration & mineral spectral ratios
│   ├── structural_service.py    # Copernicus DEM hillshade & SAR lineament density
│   ├── prospectivity_model.py   # Multi-Criteria Decision & target ranking engine
│   ├── test_backend.py          # Unit tests
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Configuration template
│   └── railway.json             # Deployment configuration
│
└── frontend/
    ├── app/
    │   ├── page.tsx             # Interactive exploration workbench UI
    │   ├── layout.tsx           # Shell layout
    │   └── globals.css          # Styling & glowing target animations
    ├── components/
    │   ├── MapComponent.tsx     # Dynamic Leaflet map with Geoman AOI tools
    │   ├── CommoditySelector.tsx# Exploration deposit preset selector
    │   ├── ProspectivityDashboard.tsx # Target rankings & area distribution charts
    │   ├── LayerControlPanel.tsx# Layer switcher & opacity controls
    │   └── TargetDetailModal.tsx# Drill target inspection modal
    ├── package.json
    └── tsconfig.json
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start FastAPI backend
uvicorn main:app --reload --port 8000
```

> **Note**: For Google Earth Engine access, place your `credentials.json` in `backend/` or set `GEE_PROJECT` and `GEE_SERVICE_ACCOUNT` in your `.env`.

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to launch the GeoMiner workbench!
