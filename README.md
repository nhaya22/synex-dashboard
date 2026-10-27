# SYNEX - GIS and BIM Integration Framework for Campus Sustainability

SYNEX is a low-cost **campus digital twin** of the NUST H-12 campus, Islamabad. It brings a navigable 3D BIM of a pivot building, campus-scale solar potential analysis, and rainfall-responsive surface water flow simulation together in a single Next.js web dashboard.

Undergraduate Final Year Project, BE Geoinformatics Engineering, Institute of Geographical Information Systems (IGIS), NUST, 2026.

## Why SYNEX

Campuses usually monitor energy, water, air quality and infrastructure in separate systems, often with manual records. SYNEX explores how **BIM, GIS and IoT** can be combined into one decision-support interface, so that facility managers can see building-level conditions and campus-level environmental risk in one place without needing GIS expertise.

## Dashboard modules

The landing page opens a **Launch Platform** menu with three main views, plus a separate 3D terrain viewer.

| Module | What it shows |
|---|---|
| **Digital Twin** | A Unity WebGL walkthrough of the IGIS building, with first-person navigation, interactive doors, and room-level sensor overlays that change colour by threshold |
| **Solar Analysis** | 191 campus buildings extruded to their measured heights and colour-coded by rooftop solar potential, for identifying candidate PV sites |
| **Water Simulation** | An animated D8 stream network and four flood accumulation zones that respond to hourly rainfall, with a 48 h historical / 48 h forecast timeline and replay of past storm events |
| **3D Campus Viewer** | The drone-derived DSM and the DTM rendered as exaggerated terrain for inspecting campus topography |

## How it was built

### 1. 3D BIM → Unity WebGL
- IGIS floor plans (DWG) were checked against the building and corrected, then modelled in **Revit** at a deliberately lean level of detail (walls, floors, windows, doors, stairs).
- The model was exported as FBX to **Unity**, with PBR materials, **43 interactive doors**, and **38 trigger zones** (36 rooms and 2 corridors).
- In each room, the floor is colour-graded for temperature, humidity and air quality. Normal / Warning / Critical thresholds follow WHO and ASHRAE guidance.
- The scene is exported as a **WebGL build** and embedded in the dashboard.
- Controls: `W A S D` / arrow keys to move, mouse to look around, `E` or click to open doors.

### 2. Solar potential analysis
- A **30 cm DSM** was generated from drone imagery using photogrammetry (Pix4D), then resampled to 1 m (EPSG:32643).
- A **DTM** was interpolated from sampled ground points using a thin-plate spline. The nDSM is the DSM minus the DTM.
- Building heights are the **median nDSM value per footprint**, which makes them robust to rooftop clutter such as tanks, parapets and HVAC units.
- Annual irradiation was computed with ArcGIS Pro **Area Solar Radiation**, including terrain and building shading. Results were masked to rooftops and classified by percentile across all buildings.
- Buildings were extruded and colour-coded in QGIS, then exported as GeoJSON for the web map.

### 3. Surface water flow simulation
- A **hybrid DEM** (the DTM plus rasterised building heights, built with Python GDAL) makes buildings act as flow barriers. Without it, flow routed straight through building footprints.
- Using **GRASS GIS `r.watershed`**, the hybrid DEM was sink-filled, then D8 flow direction and flow accumulation were computed.
- The stream network was extracted at a 1,000-cell (≈0.1 ha) contributing-area threshold.
- Flow accumulation was reclassified into four flood zones:

  | Zone | Upstream cells | Campus cover |
  |---|---|---|
  | 1 – Low | 0–100 | 66.5% |
  | 2 – Moderate | 100–5,000 | 18.4% |
  | 3 – High | 5,000–20,000 | 0.3% |
  | 4 – Extreme | > 20,000 | 0.2% |

- On the dashboard, stream animation speed, line width and zone opacity scale with rainfall intensity (mm/hr) from the **Open-Meteo API**.

### 4. Web dashboard
**Next.js (React)** · **Mapbox GL JS** · **Tailwind CSS + shadcn/ui** · Unity WebGL embed · Open-Meteo API

## Repository structure

```
├── public/data/        Pre-processed analysis outputs: solar layers, water flow layers, Unity build
├── public/             Static assets
└── src/                Next.js application (pages, components, map logic)
```

## Running locally

**Requirements:** Node.js 18+ and a free [Mapbox access token](https://account.mapbox.com/).

```bash
git clone https://github.com/nhaya22/synex-dashboard.git
cd synex-dashboard
npm install
```

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

Start the development server and open [http://localhost:3000](http://localhost:3000):

```bash
npm run dev
```

The Unity WebGL build is about 45 MB, so the Digital Twin page takes a few seconds to load the first time.

> **Note:** The IoT sensor firmware and its API are not part of this repository. The Digital Twin page runs with demonstration sensor values.

## Limitations

- **Sensors:** the IoT pipeline was bench-tested but not deployed in the building.
- **Solar:** results cover rooftops only, because a 2.5D DSM cannot model facades. A constant annual atmospheric transmissivity is used.
- **Hydrology:** D8 uses a single flow direction and assumes no infiltration or subsurface drainage, so the flood zones are a worst-case hazard view, not a flood forecast. Rainfall is a single-point estimate for the campus.
- **Dashboard:** the modules are separate pages. GIS layers are not yet overlaid in the Unity view.

## Future work

- Field deployment of sensors, scaling with MQTT and LoRaWAN
- D∞ multiple-flow routing and SCS curve-number infiltration
- Seasonal clearness indices for the solar model
- Facade solar assessment from LiDAR or photogrammetric meshes
- Bidirectional building control


Supervisor: Dr. Salman Atif · Co-Supervisor: Dr. Ali Tahir
Institute of Geographical Information Systems, School of Civil and Environmental Engineering, NUST, Islamabad

## Acknowledgements

Built with Revit, Unity, Pix4D, ArcGIS Pro, QGIS / GRASS GIS, GDAL, Next.js, Mapbox GL JS and the [Open-Meteo](https://open-meteo.com/) API.
