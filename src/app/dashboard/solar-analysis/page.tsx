"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

function getQuantile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function getFirstValidNumber(props: any, keys: string[]) {
  for (const key of keys) {
    const value = Number(props?.[key]);
    if (!Number.isNaN(value) && props?.[key] !== undefined && props?.[key] !== null) return value;
  }
  return null;
}

function getFirstValidString(props: any, keys: string[]) {
  for (const key of keys) {
    const value = props?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function getFeatureCenter(feature: any): [number, number] | null {
  const geom = feature?.geometry;
  if (!geom) return null;

  const pts: [number, number][] = [];

  const collectCoords = (coords: any) => {
    if (Array.isArray(coords) && typeof coords[0] === "number" && typeof coords[1] === "number") {
      pts.push([coords[0], coords[1]]);
      return;
    }
    if (Array.isArray(coords)) coords.forEach((c) => collectCoords(c));
  };

  collectCoords(geom.coordinates);
  if (pts.length === 0) return null;

  let sumX = 0;
  let sumY = 0;

  for (const [x, y] of pts) {
    sumX += x;
    sumY += y;
  }

  return [sumX / pts.length, sumY / pts.length];
}

function offsetLngLat(lng: number, lat: number, dxMeters: number, dyMeters: number): [number, number] {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((lat * Math.PI) / 180);
  return [lng + dxMeters / metersPerDegreeLng, lat + dyMeters / metersPerDegreeLat];
}

const quarterlyLayers = [
  { id: "solar-q1", label: "Solar Potential Jan–March", file: "/data/1.geojson" },
  { id: "solar-q2", label: "Solar Potential April–June", file: "/data/2.geojson" },
  { id: "solar-q3", label: "Solar Potential July–September", file: "/data/3.geojson" },
  { id: "solar-q4", label: "Solar Potential Oct–December", file: "/data/4.geojson" },
];

const colors = {
  low: "#fff176",
  medium: "#ff9800",
  high: "#b71c1c",
};

function getBuildingClass(value: number) {
  if (value <= 871) return 1;
  if (value <= 1182) return 2;
  return 3;
}

function getQuarterlyClass(value: number) {
  if (value <= 9) return "Low";
  if (value <= 18) return "Medium";
  return "High";
}

interface BuildingData {
  properties: any;
  center: [number, number];
}

interface PointData {
  label: string;
  value: number;
  coordinates: [number, number];
  classification: string;
}

export default function SolarAnalysisDashboard() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [activeSolarLayer, setActiveSolarLayer] = useState("buildings");
  const [showTrees, setShowTrees] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingData | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PointData | null>(null);

  const [kpiData, setKpiData] = useState({
    totalBuildings: 0,
    averageSolar: 0,
    highestSolarZone: { label: "", value: 0 },
    lowestSolarZone: { label: "", value: 0 },
  });

  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {},
        layers: [],
      },
      center: [73.05, 33.68],
      zoom: 16,
      pitch: 60,
      bearing: -20,
    });

    mapRef.current = map;

    map.once("load", async () => {
      try {
        map.addSource("esri_satellite", {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
          attribution: "Esri",
        });

        map.addLayer({
          id: "esri_satellite",
          type: "raster",
          source: "esri_satellite",
        });

        const buildingRes = await fetch("/data/SP_2026_PER_BUILDING_name_GJ.geojson");
        if (!buildingRes.ok) throw new Error("Building GeoJSON missing");

        const buildingGeojson = await buildingRes.json();

        buildingGeojson.features = buildingGeojson.features.map((f: any) => {
          const p = f.properties || {};
          const height_m = getFirstValidNumber(p, ["_median", "median", "_mean", "mean"]);
          const solar_kwh = getFirstValidNumber(p, ["SP_mean", "sp_mean", "spmean", "SPMEAN"]);
          const building_label = getFirstValidString(p, ["Building_name", "building_name", "name", "Name"]);
          const solar_class = getBuildingClass(solar_kwh || 0);

          return {
            ...f,
            properties: {
              ...p,
              height_m,
              solar_kwh,
              building_label,
              solar_class,
            },
          };
        });

        const validSolar = buildingGeojson.features
          .map((f: any) => f.properties.solar_kwh)
          .filter((v: any) => typeof v === "number" && v > 0);

        const avgSolar =
          validSolar.length > 0 ? validSolar.reduce((a: number, b: number) => a + b, 0) / validSolar.length : 0;

        const maxBuilding = buildingGeojson.features.reduce(
          (max: any, f: any) => (f.properties.solar_kwh > (max?.properties?.solar_kwh || 0) ? f : max),
          null
        );

        const minBuilding = buildingGeojson.features.reduce(
          (min: any, f: any) =>
            (f.properties.solar_kwh || 9999) < (min?.properties?.solar_kwh || 9999) ? f : min,
          null
        );

        setKpiData({
          totalBuildings: buildingGeojson.features.length,
          averageSolar: avgSolar,
          highestSolarZone: {
            label: maxBuilding?.properties?.building_label || "Building",
            value: maxBuilding?.properties?.solar_kwh || 0,
          },
          lowestSolarZone: {
            label: minBuilding?.properties?.building_label || "Building",
            value: minBuilding?.properties?.solar_kwh || 0,
          },
        });

        setInsights([
          `${buildingGeojson.features.filter((f: any) => f.properties.solar_class === 3).length} buildings have high solar potential`,
          `Average solar potential: ${avgSolar.toFixed(1)} kWh/m²`,
          `Solar potential range: ${(Math.max(...validSolar) - Math.min(...validSolar)).toFixed(1)} kWh/m²`,
        ]);

        map.addSource("buildings", {
          type: "geojson",
          data: buildingGeojson,
        });

        map.addLayer({
          id: "buildings-3d",
          type: "fill-extrusion",
          source: "buildings",
          layout: {
            visibility: "visible",
          },
          paint: {
            "fill-extrusion-height": ["coalesce", ["get", "height_m"], 0],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.9,
            "fill-extrusion-color": [
              "match",
              ["get", "solar_class"],
              1,
              colors.low,
              2,
              colors.medium,
              3,
              colors.high,
              "#cfcfcf",
            ],
          },
        });

        for (const layer of quarterlyLayers) {
          const res = await fetch(layer.file);
          if (!res.ok) {
            console.error("Could not load:", layer.file);
            continue;
          }

          const polygonGeojson = await res.json();

          map.addSource(layer.id, {
            type: "geojson",
            data: polygonGeojson,
          });

          map.addLayer({
            id: `${layer.id}-layer`,
            type: "fill",
            source: layer.id,
            layout: {
              visibility: "none",
            },
            paint: {
              "fill-color": [
                "step",
                ["to-number", ["get", "value"]],
                colors.low,
                9,
                colors.medium,
                18,
                colors.high,
              ],
              "fill-opacity": 0.75,
              "fill-outline-color": "rgba(255,255,255,0.12)",
            },
          });
        }

        const treeRes = await fetch("/data/TREE_WITH_HEIGHTS_GJ.geojson");

        if (treeRes.ok) {
          const treeGeojson = await treeRes.json();
          const treeCanopyFeatures: any[] = [];
          const treeTrunkFeatures: any[] = [];

          treeGeojson.features.forEach((f: any, i: number) => {
            const center = getFeatureCenter(f);
            if (!center) return;

            const h = getFirstValidNumber(f.properties, ["tree_mean", "mean"]) || 8;
            const spread = Math.max(1.5, Math.min(5, h * 0.18));

            [
              [0, 1.4],
              [-1.2, 0],
              [1.2, 0],
              [0, -0.9],
            ].forEach((offset) => {
              treeCanopyFeatures.push({
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: offsetLngLat(center[0], center[1], offset[0] * spread, offset[1] * spread),
                },
                properties: {
                  tree_height: h,
                  parent_id: i,
                },
              });
            });

            treeTrunkFeatures.push({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: center,
              },
              properties: {
                tree_height: h,
              },
            });
          });

          map.addSource("tree-canopies", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: treeCanopyFeatures,
            },
          });

          map.addSource("tree-trunks", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: treeTrunkFeatures,
            },
          });

          map.addLayer({
            id: "tree-canopy-layer",
            type: "circle",
            source: "tree-canopies",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["get", "tree_height"], 0, 2, 30, 10],
              "circle-color": "#4caf50",
              "circle-opacity": 0.8,
              "circle-stroke-width": 0.5,
              "circle-stroke-color": "#1b5e20",
            },
          });

          map.addLayer({
            id: "tree-trunk-layer",
            type: "circle",
            source: "tree-trunks",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["get", "tree_height"], 0, 0.5, 30, 2],
              "circle-color": "#6d4c41",
            },
          });
        }

        popupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: "none",
        });

        map.on("mousemove", "buildings-3d", (e) => {
          if (!e.features?.length) return;

          map.getCanvas().style.cursor = "pointer";
          const p = e.features[0].properties;

          popupRef.current
            ?.setLngLat(e.lngLat)
            .setHTML(`
              <div style="padding: 4px 6px; font-family: sans-serif; line-height: 1.2;">
                <div style="font-size: 11px; font-weight: 800; color: #1e293b;">
                  ${p.building_label || "Building"}
                </div>
                <div style="font-size: 10px; color: #475569;">
                  Height: ${Number(p.height_m).toFixed(1)} m
                </div>
                <div style="font-size: 10px; color: #475569;">
                  Solar: ${Number(p.solar_kwh).toFixed(1)} kWh/m²
                </div>
              </div>
            `)
            .addTo(map);
        });

        map.on("mouseleave", "buildings-3d", () => {
          map.getCanvas().style.cursor = "";
          popupRef.current?.remove();
        });

        for (const layer of quarterlyLayers) {
          map.on("mousemove", `${layer.id}-layer`, (e) => {
            if (!e.features?.length) return;

            map.getCanvas().style.cursor = "pointer";
            const p = e.features[0].properties;
            const buildingName =
              getFirstValidString(p, ["Building_name", "building_name", "building_label", "name", "Name"]) ||
              "Solar zone";

            popupRef.current
              ?.setLngLat(e.lngLat)
              .setHTML(`
                <div style="padding: 4px 6px; font-family: sans-serif; line-height: 1.2;">
                  <div style="font-size: 11px; font-weight: 800; color: #1e293b;">
                    ${buildingName}
                  </div>
                </div>
              `)
              .addTo(map);
          });

          map.on("mouseleave", `${layer.id}-layer`, () => {
            map.getCanvas().style.cursor = "";
            popupRef.current?.remove();
          });

          map.on("click", `${layer.id}-layer`, (e) => {
            if (!e.features?.length) return;

            const value = Number(e.features[0].properties?.value);
            const coords = e.lngLat;

            markerRef.current?.remove();

            markerRef.current = new maplibregl.Marker({ color: "#ffffff" })
              .setLngLat([coords.lng, coords.lat])
              .addTo(map);

            setSelectedBuilding(null);
            setSelectedPoint({
              label: layer.label,
              value,
              coordinates: [coords.lng, coords.lat],
              classification: getQuarterlyClass(value),
            });
          });
        }

        map.on("click", "buildings-3d", (e) => {
          if (!e.features?.length) return;

          const feature = e.features[0];
          const center = getFeatureCenter(feature);

          if (center) {
            markerRef.current?.remove();

            markerRef.current = new maplibregl.Marker({ color: "#ffffff" })
              .setLngLat(center)
              .addTo(map);

            setSelectedPoint(null);
            setSelectedBuilding({
              properties: feature.properties,
              center,
            });

            map.flyTo({
              center,
              zoom: 18,
              pitch: 45,
              bearing: map.getBearing(),
              duration: 1500,
            });
          }
        });

        const bounds = new maplibregl.LngLatBounds();

        buildingGeojson.features.forEach((f: any) => {
          const extend = (c: any) => {
            if (typeof c[0] === "number") bounds.extend(c as [number, number]);
            else c.forEach(extend);
          };
          extend(f.geometry.coordinates);
        });

        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 50 });
      } catch (err) {
        console.error("Map initialization error:", err);
      }
    });

    return () => {
      markerRef.current?.remove();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    if (map.getLayer("buildings-3d")) {
      map.setLayoutProperty(
        "buildings-3d",
        "visibility",
        activeSolarLayer === "buildings" ? "visible" : "none"
      );
    }

    quarterlyLayers.forEach((layer) => {
      const layerId = `${layer.id}-layer`;

      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", activeSolarLayer === layer.id ? "visible" : "none");
      }
    });

    markerRef.current?.remove();
    popupRef.current?.remove();
    setSelectedPoint(null);
    setSelectedBuilding(null);
  }, [activeSolarLayer]);

  useEffect(() => {
    if (!mapRef.current) return;

    ["tree-canopy-layer", "tree-trunk-layer"].forEach((id) => {
      if (mapRef.current!.getLayer(id)) {
        mapRef.current!.setLayoutProperty(id, "visibility", showTrees ? "visible" : "none");
      }
    });
  }, [showTrees]);

  const getSolarClassColor = (classNum: number) => {
    const classColors: Record<number, string> = {
      1: colors.low,
      2: colors.medium,
      3: colors.high,
    };

    return classColors[classNum] || "#cfcfcf";
  };

  const buildingClassLabels: Record<number, string> = {
    1: "Low (560–871 kWh/m²)",
    2: "Medium (871–1182 kWh/m²)",
    3: "High (1182–1493 kWh/m²)",
  };

  const quarterlyClassLabels: Record<number, string> = {
    1: "Low (0–9 kWh/m²)",
    2: "Medium (9–18 kWh/m²)",
    3: "High (18–43 kWh/m²)",
  };

  const activeLabels = activeSolarLayer === "buildings" ? buildingClassLabels : quarterlyClassLabels;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 p-6">
        <h1 className="text-3xl font-bold mb-4">Solar Analysis Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="text-sm text-slate-300 mb-1">Total Buildings</div>
            <div className="text-2xl font-bold text-blue-400">{kpiData.totalBuildings}</div>
          </div>

          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="text-sm text-slate-300 mb-1">Average Solar Potential</div>
            <div className="text-2xl font-bold text-yellow-400">{kpiData.averageSolar.toFixed(1)}</div>
            <div className="text-xs text-slate-400">kWh/m²</div>
          </div>

          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="text-sm text-slate-300 mb-1">Highest Zone</div>
            <div className="text-lg font-bold text-red-400">{kpiData.highestSolarZone.value.toFixed(1)}</div>
            <div className="text-xs text-slate-400">{kpiData.highestSolarZone.label}</div>
          </div>

          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="text-sm text-slate-300 mb-1">Lowest Zone</div>
            <div className="text-lg font-bold text-green-400">{kpiData.lowestSolarZone.value.toFixed(1)}</div>
            <div className="text-xs text-slate-400">{kpiData.lowestSolarZone.label}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        <div className="w-80 flex flex-col gap-4 overflow-hidden">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span className="text-blue-400">⚙️</span> Layer Controls
            </h2>

            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-700 p-2 rounded transition">
                <input
                  type="radio"
                  name="solar-layer"
                  checked={activeSolarLayer === "buildings"}
                  onChange={() => setActiveSolarLayer("buildings")}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm">Current Building Solar Potential</span>
              </label>

              {quarterlyLayers.map((layer) => (
                <label
                  key={layer.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-slate-700 p-2 rounded transition"
                >
                  <input
                    type="radio"
                    name="solar-layer"
                    checked={activeSolarLayer === layer.id}
                    onChange={() => setActiveSolarLayer(layer.id)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm">{layer.label}</span>
                </label>
              ))}

              <div className="border-t border-slate-600 pt-3 mt-3">
                <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-700 p-2 rounded transition">
                  <input
                    type="checkbox"
                    checked={showTrees}
                    onChange={(e) => setShowTrees(e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm">Trees & Vegetation</span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span className="text-green-400">📊</span> Solar Classification
            </h2>

            <div className="space-y-2 text-sm">
              {[1, 2, 3].map((classNum) => (
                <div key={classNum} className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded border border-slate-600"
                    style={{ backgroundColor: getSolarClassColor(classNum) }}
                  />
                  <span className="text-slate-300">{activeLabels[classNum]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex-1 overflow-y-auto">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 sticky top-0 bg-slate-800">
              <span className="text-purple-400">💡</span> Insights & Analysis
            </h2>

            <div className="space-y-2 text-sm">
              {insights.map((insight, idx) => (
                <div key={idx} className="bg-slate-700 rounded p-2 border-l-2 border-blue-400">
                  <p className="text-slate-200">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div ref={mapContainer} className="flex-1 rounded-lg border border-slate-700 overflow-hidden shadow-2xl" />
        </div>

        <div className="w-80 flex flex-col gap-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex-1 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="text-cyan-400">📍</span> Selected Details
              </h2>

              {(selectedBuilding || selectedPoint) && (
                <button
                  onClick={() => {
                    markerRef.current?.remove();
                    setSelectedBuilding(null);
                    setSelectedPoint(null);
                  }}
                  className="text-slate-400 hover:text-white transition text-lg"
                >
                  ✕
                </button>
              )}
            </div>

            {selectedPoint ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Layer</div>
                  <div className="text-lg font-bold text-blue-400">{selectedPoint.label}</div>
                </div>

                <div className="bg-slate-700 rounded p-3 space-y-3 border border-slate-600">
                  <div>
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Solar Value at Pointer
                    </div>
                    <div className="text-xl font-bold text-yellow-400">
                      {selectedPoint.value.toFixed(2)} kWh/m²
                    </div>
                  </div>

                  <div className="border-t border-slate-600 pt-3">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Classification
                    </div>
                    <div className="text-sm font-semibold text-green-300">{selectedPoint.classification}</div>
                  </div>
                </div>

                <div className="bg-blue-900 bg-opacity-30 rounded p-3 border border-blue-600 text-xs text-blue-200">
                  <strong>Pointer Location:</strong> {selectedPoint.coordinates[0].toFixed(5)},{" "}
                  {selectedPoint.coordinates[1].toFixed(5)}
                </div>
              </div>
            ) : selectedBuilding ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Building Name</div>
                  <div className="text-xl font-bold text-blue-400">
                    {selectedBuilding.properties.building_label || "Unknown"}
                  </div>
                </div>

                <div className="bg-slate-700 rounded p-3 space-y-3 border border-slate-600">
                  <div>
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Height
                    </div>
                    <div className="text-lg font-bold text-yellow-400">
                      {Number(selectedBuilding.properties.height_m).toFixed(1)}m
                    </div>
                  </div>

                  <div className="border-t border-slate-600 pt-3">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Solar Potential
                    </div>
                    <div className="text-lg font-bold text-green-400">
                      {Number(selectedBuilding.properties.solar_kwh).toFixed(1)} kWh/m²
                    </div>
                  </div>

                  <div className="border-t border-slate-600 pt-3">
                    <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                      Classification
                    </div>
                    <div className="text-sm font-semibold text-slate-200">
                      {buildingClassLabels[selectedBuilding.properties.solar_class]}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900 bg-opacity-30 rounded p-3 border border-blue-600 text-xs text-blue-200">
                  <strong>Location:</strong> {selectedBuilding.center[0].toFixed(5)},{" "}
                  {selectedBuilding.center[1].toFixed(5)}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-200">
                  <div className="text-4xl mb-2">🗺️</div>
                  <p className="text-sm">Click on a building or solar patch to view detailed solar analysis</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}