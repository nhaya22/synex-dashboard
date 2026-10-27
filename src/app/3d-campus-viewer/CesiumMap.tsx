"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from 'next/navigation';
// ── TOKEN & ASSETS ─────────────────────────────────────────────────────────────
const ION_TOKEN =
  "";

const TERRAIN_DSM           = 4654970;
const TERRAIN_DTM           = 4658029;
const IGIS                  = 4658377;
const SADA                  = 4669867;

// ── STUDY AREA ─────────────────────────────────────────────────────────────────
const CENTER = { lon: 72.9891871, lat: 33.6444094 };

const CAMPUS_POLYGON: [number, number][] = [
  [72.97793,  33.64793],
  [72.995031, 33.65629],
  [73.00518,  33.64198],
  [72.98876,  33.63366],
  [72.97793,  33.64793],
];

// ── ELEVATION RANGES ───────────────────────────────────────────────────────────
const GEOID_OFFSET   = 22;
const DSM_MIN_HEIGHT = 515   - GEOID_OFFSET;
const DSM_MAX_HEIGHT = 621.5 - GEOID_OFFSET;
const DTM_MIN_HEIGHT = 515   - GEOID_OFFSET;
const DTM_MAX_HEIGHT = 615   - GEOID_OFFSET;
const DTM_LEGEND_BOT = "515 m";
const DTM_LEGEND_MID = "554 m";
const DTM_LEGEND_TOP = "593 m";

type Mode        = "ramp" | "contour" | "none";
type TerrainMode = "dsm" | "dtm";
type BasemapMode = TerrainMode | "buildings";

// ── BUILDING CLICK INFO ────────────────────────────────────────────────────────
interface BuildingInfo {
  name:      string;
  lon:       string;
  lat:       string;
  height:    string;
  lod:       string;
  lodNum:    number;
  isTileset: boolean;
}

// ── POINT-IN-POLYGON ───────────────────────────────────────────────────────────
function isPointInPolygon(lat: number, lon: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = yi > lon !== yj > lon &&
      lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── COLOUR RAMPS ───────────────────────────────────────────────────────────────
function buildDSMRampImage() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 1;
  const ctx = c.getContext("2d")!;
  const g   = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0.0,  "#0d47a1"); g.addColorStop(0.25, "#1976d2");
  g.addColorStop(0.5,  "#2e7d32"); g.addColorStop(0.7,  "#fdd835");
  g.addColorStop(0.9,  "#ef6c00"); g.addColorStop(1.0,  "#b71c1c");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 1);
  return c;
}

function buildDTMRampImage() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 1;
  const ctx = c.getContext("2d")!;
  const g   = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0.00, "#1a0030"); g.addColorStop(0.18, "#2d0080");
  g.addColorStop(0.35, "#0b3d91"); g.addColorStop(0.50, "#0077b6");
  g.addColorStop(0.63, "#00b4d8"); g.addColorStop(0.76, "#0d9e8a");
  g.addColorStop(0.88, "#52b788"); g.addColorStop(1.00, "#b7e4c7");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 1);
  return c;
}

// ── MATERIAL APPLICATOR ────────────────────────────────────────────────────────
function applyMaterial(
  Cesium: any, viewer: any, mode: Mode, spacing: number, terrainMode: TerrainMode
) {
  if (mode === "none")    { viewer.scene.globe.material = undefined; return; }
  if (mode === "ramp")    {
    const isDSM = terrainMode === "dsm";
    viewer.scene.globe.material = Cesium.Material.fromType("ElevationRamp", {
      minimumHeight: isDSM ? DSM_MIN_HEIGHT : DTM_MIN_HEIGHT,
      maximumHeight: isDSM ? DSM_MAX_HEIGHT : DTM_MAX_HEIGHT,
      image: isDSM ? buildDSMRampImage() : buildDTMRampImage(),
    }); return;
  }
  viewer.scene.globe.material = Cesium.Material.fromType("ElevationContour", {
    spacing,
    color: terrainMode === "dtm"
      ? Cesium.Color.BLACK.withAlpha(0.85)
      : Cesium.Color.WHITE.withAlpha(0.9),
    width: terrainMode === "dtm" ? 2.0 : 2.5,
  });
}

// ── BASEMAP SWITCHER ───────────────────────────────────────────────────────────
function switchBasemap(Cesium: any, viewer: any, mode: BasemapMode) {
  viewer.imageryLayers.removeAll();
  if (mode === "dsm") {
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      credit: "Google Satellite", minimumLevel: 0, maximumLevel: 21,
    }));
  } else if (mode === "dtm") {
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
      credit: "Esri, USGS, NOAA", minimumLevel: 0, maximumLevel: 14,
    }));
  } else {
    // Buildings mode — OpenStreetMap: flat, labelled, no terrain confusion
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      credit: "©️ OpenStreetMap contributors",
      minimumLevel: 0, maximumLevel: 19,
    }));
  }
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────
export default function CesiumMap() {
  const containerRef    = useRef<HTMLDivElement>(null);
  const viewerRef       = useRef<any>(null);
  const CesiumRef       = useRef<any>(null);
  const handlerRef      = useRef<any>(null);
  const markerRef       = useRef<any>(null);
  const geoJsonDsRef    = useRef<any>(null);
  const tilesetRef      = useRef<any>(null);
  const sadaTilesetRef  = useRef<any>(null);
  // entity → { height, name } map for click detection
  const entityPropsRef  = useRef<Map<any, { height: number; name: string }>>(new Map());

  const [spacing,          setSpacing]          = useState(10);
  const [mode,             setMode]             = useState<Mode>("none");
  const [terrainMode,      setTerrainMode]      = useState<TerrainMode>("dsm");
  const [switching,        setSwitching]        = useState(false);
  const [showBuildings,    setShowBuildings]    = useState(false);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [buildingInfo,     setBuildingInfo]     = useState<BuildingInfo | null>(null);
  
  const [clickInfo, setClickInfo] = useState<{
    lon: string; lat: string; cesium: string; arcpro: string;
    isInside: boolean; readingMode: TerrainMode; pending?: boolean;
  } | null>(null);

  // ── INIT ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    const init = async () => {
      const CesiumModule = await import("cesium");
      const Cesium = CesiumModule.default ?? CesiumModule;
      if (!alive || !containerRef.current) return;

      await import("cesium/Build/Cesium/Widgets/widgets.css");
      (window as any).CESIUM_BASE_URL = "/cesium/";
      Cesium.Ion.defaultAccessToken = ION_TOKEN;
      CesiumRef.current = Cesium;

      const [dsmProvider, dtmProvider] = await Promise.all([
        Cesium.CesiumTerrainProvider.fromIonAssetId(TERRAIN_DSM),
        Cesium.CesiumTerrainProvider.fromIonAssetId(TERRAIN_DTM),
      ]);
      if (!alive) return;

      const viewer = new Cesium.Viewer(containerRef.current!, {
        terrainProvider: dsmProvider,
        baseLayerPicker: true, geocoder: true, timeline: false,
        animation: false, homeButton: true, sceneModePicker: true,
        navigationHelpButton: true, infoBox: false, selectionIndicator: false,
      });

      // Configure camera for building inspection
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1; // Allow very close zoom
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 50000; // Allow far zoom
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = false; // Disable collision to allow zooming through terrain

      viewerRef.current = viewer;
      (viewer as any)._dsmProvider = dsmProvider;
      (viewer as any)._dtmProvider = dtmProvider;

      switchBasemap(Cesium, viewer, "dsm");
      viewer.scene.globe.enableLighting = false;
      viewer.scene.verticalExaggeration  = 1.1;

      // Campus boundary
      viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(CAMPUS_POLYGON.flat() as number[]),
          width: 4,
          material: new Cesium.PolylineOutlineMaterialProperty({
            color: Cesium.Color.LIME, outlineColor: Cesium.Color.BLACK, outlineWidth: 1,
          }),
          clampToGround: true,
        },
      });

      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(CENTER.lon, CENTER.lat, 650),
        label: {
          text: "NUST H-12", font: "bold 14px sans-serif",
          fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(CENTER.lon, CENTER.lat - 0.015, 1500),
        orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-25), roll: 0 },
        duration: 2,
        maximumHeight: 2000, // Allow camera to get closer to ground
      });

      // Mutable refs kept in sync for the click handler closure
      const terrainModeRef   = { current: "dsm"  as TerrainMode };
      const showBuildingsRef = { current: false };
      (viewer as any)._terrainModeRef   = terrainModeRef;
      (viewer as any)._showBuildingsRef = showBuildingsRef;

      // ── Click handler ──────────────────────────────────────────────────────
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handlerRef.current = handler;

      handler.setInputAction((click: any) => {
        const inBuildingMode = showBuildingsRef.current;

        if (inBuildingMode) {
          // ── Building mode: pick entity or tileset ─────────────────────────
          const picked = viewer.scene.pick(click.position);

          if (Cesium.defined(picked)) {
            // GeoJSON polygon entity
            if (picked.id && entityPropsRef.current.has(picked.id)) {
              const props = entityPropsRef.current.get(picked.id)!;
              const pos   = viewer.scene.pickPosition(click.position);
              if (!pos) return;
              const carto  = Cesium.Cartographic.fromCartesian(pos);

              // Zoom to building
              const zoomHeight = Math.max(props.height + 50, 100); // Zoom above building height
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                  Cesium.Math.toDegrees(carto.longitude),
                  Cesium.Math.toDegrees(carto.latitude),
                  zoomHeight
                ),
                orientation: {
                  heading: viewer.camera.heading,
                  pitch: Cesium.Math.toRadians(-30), // Look down at building
                  roll: 0
                },
                duration: 1.5,
                maximumHeight: zoomHeight + 100,
              });

              setBuildingInfo({
                name:      props.name,
                lon:       Cesium.Math.toDegrees(carto.longitude).toFixed(6),
                lat:       Cesium.Math.toDegrees(carto.latitude).toFixed(6),
                height:    String(Math.round(props.height)),
                lod:       "LOD 1",
                lodNum:    1,
                isTileset: false,
              });
              return;
            }

            // Ion 3D Tileset (IGIS or SADA)
            if (
              picked.primitive &&
              (picked.primitive === tilesetRef.current || picked.primitive === sadaTilesetRef.current)
            ) {
              const pos = viewer.scene.pickPosition(click.position);
              if (!pos) return;
              const carto = Cesium.Cartographic.fromCartesian(pos);

              let featureHeight = "N/A";
              const tryGet = (key: string) => {
                try { if (picked.getProperty) return picked.getProperty(key); } catch {}
                try { if (picked.feature?.getProperty) return picked.feature.getProperty(key); } catch {}
                return undefined;
              };
              const hVal = tryGet("height") ?? tryGet("Height") ?? tryGet("_mean")
                        ?? tryGet("RoofHeight") ?? tryGet("roofHeight") ?? tryGet("measuredHeight")
                        ?? tryGet("bldgheight") ?? tryGet("BLDG_HEIGHT") ?? tryGet("building_height");
              if (hVal != null && hVal !== "") featureHeight = String(Math.round(Number(hVal)));

              // Zoom to building
              const buildingHeight = Number(featureHeight) || 50;
              const zoomHeight = Math.max(buildingHeight + 30, 80);
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                  Cesium.Math.toDegrees(carto.longitude),
                  Cesium.Math.toDegrees(carto.latitude),
                  zoomHeight
                ),
                orientation: {
                  heading: viewer.camera.heading,
                  pitch: Cesium.Math.toRadians(-35), // Look down at detailed building
                  roll: 0
                },
                duration: 1.5,
                maximumHeight: zoomHeight + 50,
              });

              const isSada = picked.primitive === sadaTilesetRef.current;
              setBuildingInfo({
                name:      isSada ? "SADA Building" : "NUST Academic Block",
                lon:       Cesium.Math.toDegrees(carto.longitude).toFixed(6),
                lat:       Cesium.Math.toDegrees(carto.latitude).toFixed(6),
                height:    featureHeight,
                lod:       "LOD 3",
                lodNum:    3,
                isTileset: true,
              });
              return;
            }
          }

          // Clicked empty ground — clear popup
          setBuildingInfo(null);
          return;
        }

        // ── Terrain elevation mode ─────────────────────────────────────────
        const ray = viewer.camera.getPickRay(click.position);
        if (!ray) return;
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (!cartesian) return;

        const carto       = Cesium.Cartographic.fromCartesian(cartesian);
        const latDeg      = Cesium.Math.toDegrees(carto.latitude);
        const lonDeg      = Cesium.Math.toDegrees(carto.longitude);
        const rawH        = carto.height;
        const isInside    = isPointInPolygon(lonDeg, latDeg, CAMPUS_POLYGON);
        const currentMode = terrainModeRef.current;

        if (markerRef.current) viewer.entities.remove(markerRef.current);
        markerRef.current = viewer.entities.add({
          position: cartesian,
          point: {
            pixelSize: 10,
            color: isInside ? Cesium.Color.YELLOW : Cesium.Color.RED,
            outlineColor: Cesium.Color.WHITE, outlineWidth: 2,
          },
        });

        setClickInfo({
          lon:     lonDeg.toFixed(6),
          lat:     latDeg.toFixed(6),
          cesium:  rawH.toFixed(1),
          arcpro:  currentMode === "dtm"
                   ? (rawH - GEOID_OFFSET).toFixed(1)
                   : (rawH + GEOID_OFFSET).toFixed(1),
          isInside, readingMode: currentMode, pending: false,
        });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      applyMaterial(Cesium, viewer, "none", 10, "dsm");
    };

    init();
    return () => {
      alive = false;
      if (markerRef.current && viewerRef.current)
        viewerRef.current.entities.remove(markerRef.current);
      handlerRef.current?.destroy();
      viewerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── REACTIVE: overlay material ─────────────────────────────────────────────
  useEffect(() => {
    if (viewerRef.current && CesiumRef.current) {
      // When buildings are visible, disable terrain overlay completely
      const effectiveMode = showBuildings ? "none" : mode;
      applyMaterial(CesiumRef.current, viewerRef.current, effectiveMode, spacing, terrainMode);
    }
  }, [mode, spacing, terrainMode, showBuildings]);

  // ── REACTIVE: terrain switch ───────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium) return;
    const dsmP = (viewer as any)._dsmProvider;
    const dtmP = (viewer as any)._dtmProvider;
    if (!dsmP || !dtmP) return;

    setSwitching(true);
    viewer.terrainProvider = terrainMode === "dsm" ? dsmP : dtmP;
    switchBasemap(Cesium, viewer, terrainMode);
    if ((viewer as any)._terrainModeRef)
      (viewer as any)._terrainModeRef.current = terrainMode;
    setClickInfo(null);
    if (markerRef.current) {
      viewer.entities.remove(markerRef.current);
      markerRef.current = null;
    }
    setSwitching(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrainMode]);

  // ── REACTIVE: buildings toggle ─────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewer || !Cesium) return;

    if ((viewer as any)._showBuildingsRef)
      (viewer as any)._showBuildingsRef.current = showBuildings;

    if (showBuildings) {
      switchBasemap(Cesium, viewer, "buildings");
      setBuildingsLoading(true);
      entityPropsRef.current.clear();

      // 1. GeoJSON LOD-1 ──────────────────────────────────────────────────────
      const loadGeoJson = async () => {
        try {
          const geojson  = await (await fetch("/Building_with_heights.geojson")).json();
          const features = geojson.features as any[];
          const ds       = new Cesium.CustomDataSource("buildings-geojson");

          // ── Percentile-based colour ramp (anchored to real height quantiles) ──
          type RGB = [number, number, number];
          const heightStops: [number, RGB][] = [
            [0,     [58,  90, 200]],
            [3,     [30, 165, 210]],
            [6.4,   [34, 197, 150]],
            [10.5,  [132, 204,  22]],
            [13,    [234, 179,   8]],
            [15.3,  [249, 115,  22]],
            [33.64, [220,  38,  38]],
          ];
          const heightToColor = (h: number): string => {
            const clamp = Math.max(heightStops[0][0], Math.min(heightStops[heightStops.length - 1][0], h));
            let lo = heightStops[0], hi = heightStops[heightStops.length - 1];
            for (let i = 0; i < heightStops.length - 1; i++) {
              if (clamp >= heightStops[i][0] && clamp <= heightStops[i + 1][0]) {
                lo = heightStops[i]; hi = heightStops[i + 1]; break;
              }
            }
            const span = hi[0] - lo[0];
            const f    = span === 0 ? 0 : (clamp - lo[0]) / span;
            const r = Math.round(lo[1][0] + f * (hi[1][0] - lo[1][0]));
            const g = Math.round(lo[1][1] + f * (hi[1][1] - lo[1][1]));
            const b = Math.round(lo[1][2] + f * (hi[1][2] - lo[1][2]));
            return `rgb(${r},${g},${b})`;
          };

          // ── Fetch OSM names via Overpass API ──────────────────────────────────
          const ringCentroid = (ring: number[][]): [number, number] => {
            if (!Array.isArray(ring) || ring.length === 0) return [0, 0];
            const lon = ring.reduce((s, c) => s + (Array.isArray(c) && c.length > 0 ? c[0] : 0), 0) / ring.length;
            const lat = ring.reduce((s, c) => s + (Array.isArray(c) && c.length > 1 ? c[1] : 0), 0) / ring.length;
            return [lon, lat];
          };

          const featCentroids: [number, number][] = features.map((feat: any) => {
            const g = feat.geometry;
            if (!g || !g.coordinates) return [0, 0];
            let ring: number[][];
            if (g.type === "Polygon" && g.coordinates && g.coordinates[0]) {
              ring = g.coordinates[0];
            } else if (g.type === "MultiPolygon" && g.coordinates && g.coordinates[0] && g.coordinates[0][0]) {
              ring = g.coordinates[0][0];
            } else {
              ring = [[0, 0]];
            }
            return ringCentroid(ring);
          });

          const osmNameMap = new Map<number, string>();
          try {
            const overpassQuery = `
[out:json][timeout:25];
(
  way["name"](33.63472,72.98020,33.65423,73.00097);
  node["name"]["amenity"](33.63472,72.98020,33.65423,73.00097);
);
out center tags;`;
            const ovResp = await fetch("https://overpass-api.de/api/interpreter", {
              method: "POST",
              body: new URLSearchParams({ data: overpassQuery }),
            });
            if (ovResp.ok) {
              const ovData = await ovResp.json();
              const osmElements: { tags: Record<string, string>; center?: { lat: number; lon: number }; lat?: number; lon?: number }[] =
                ovData.elements ?? [];

              for (const el of osmElements) {
                const name = el.tags?.name;
                if (!name) continue;
                const elLat = el.center?.lat ?? el.lat ?? 0;
                const elLon = el.center?.lon ?? el.lon ?? 0;
                if (!elLat && !elLon) continue;

                let bestIdx = -1, bestDist = Infinity;
                featCentroids.forEach(([flon, flat], i) => {
                  const d = Math.hypot(flon - elLon, flat - elLat);
                  if (d < bestDist) { bestDist = d; bestIdx = i; }
                });
                if (bestIdx >= 0 && bestDist < 0.00027) {
                  osmNameMap.set(bestIdx, name);
                }
              }
              console.log(`OSM labels matched: ${osmNameMap.size} / ${features.length}`);
            }
          } catch (osmErr) {
            console.warn("Overpass fetch failed, using generic names:", osmErr);
          }

          // ── Build entities ─────────────────────────────────────────────────────
          features.forEach((feat: any, idx: number) => {
            if (!feat.geometry) return;
            const heightVal = (feat.properties?._median && feat.properties._median !== 0 ? feat.properties._median : null) ?? feat.properties?._mean ?? 10;
            const name      = osmNameMap.get(idx)
                           ?? feat.properties?.name
                           ?? feat.properties?.Name
                           ?? feat.properties?.building
                           ?? `Building ${idx + 1}`;
            const color     = heightToColor(heightVal);

            const rings: number[][][] =
              feat.geometry.type === "Polygon" && feat.geometry.coordinates && feat.geometry.coordinates[0]
                ? [feat.geometry.coordinates[0]]
                : feat.geometry.type === "MultiPolygon" && feat.geometry.coordinates
                ? feat.geometry.coordinates.map((p: number[][][]) => p && p[0] ? p[0] : []).filter((r: number[][]) => r.length > 0)
                : [];

            for (const ring of rings) {
              if (!Array.isArray(ring) || ring.length === 0) continue;
              const degs   = ring.flatMap(([lon, lat]: number[]) => [lon, lat]);
              const [cLon, cLat] = ringCentroid(ring);
              const entity = ds.entities.add({
                polygon: {
                  hierarchy: new Cesium.PolygonHierarchy(
                    Cesium.Cartesian3.fromDegreesArray(degs)
                  ),
                  extrudedHeight:          heightVal,
                  extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                  height:                  0,
                  heightReference:         Cesium.HeightReference.CLAMP_TO_GROUND,
                  material:    Cesium.Color.fromCssColorString(color).withAlpha(0.85),
                  outline:     true,
                  outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
                  outlineWidth: 1,
                  shadows:     Cesium.ShadowMode.DISABLED,
                },
                ...(name !== `Building ${idx + 1}` ? {
                  position: Cesium.Cartesian3.fromDegrees(cLon, cLat, heightVal + 4),
                  label: {
                    text:             name,
                    font:             "bold 12px sans-serif",
                    fillColor:        Cesium.Color.WHITE,
                    outlineColor:     Cesium.Color.BLACK,
                    outlineWidth:     3,
                    style:            Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin:   Cesium.VerticalOrigin.BOTTOM,
                    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                    pixelOffset:      new Cesium.Cartesian2(0, -4),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    scaleByDistance:  new Cesium.NearFarScalar(200, 1.2, 1500, 0.0),
                    translucencyByDistance: new Cesium.NearFarScalar(600, 1.0, 1400, 0.0),
                    showBackground:   true,
                    backgroundColor:  new Cesium.Color(0.05, 0.08, 0.15, 0.75),
                    backgroundPadding: new Cesium.Cartesian2(6, 4),
                  },
                } : {}),
              });
              entityPropsRef.current.set(entity, { height: heightVal, name });
            }
          });

          await viewer.dataSources.add(ds);
          geoJsonDsRef.current = ds;
        } catch (err) {
          console.error("GeoJSON load failed:", err);
        }
      };

      // 2. Ion 3D Tilesets — IGIS + SADA ─────────────────────────────────────
      const loadTileset = async () => {
        // IGIS
        try {
          const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(IGIS);
          tileset.style = new Cesium.Cesium3DTileStyle({
            color: "color('#7eb8d4', 1.0)",
          });
          viewer.scene.primitives.add(tileset);
          tilesetRef.current = tileset;
        } catch (err) {
          console.error("Ion tileset (IGIS) load failed:", err);
        }

        // SADA
        try {
          const sadaTileset = await Cesium.Cesium3DTileset.fromIonAssetId(SADA);
          sadaTileset.style = new Cesium.Cesium3DTileStyle({
            color: "color('#7eb8d4', 1.0)",
          });
          viewer.scene.primitives.add(sadaTileset);
          sadaTilesetRef.current = sadaTileset;
        } catch (err) {
          console.error("Ion tileset (SADA) load failed:", err);
        }
      };

      Promise.all([loadGeoJson(), loadTileset()]).finally(() => setBuildingsLoading(false));

    } else {
      // Turn OFF — restore terrain basemap
      switchBasemap(Cesium, viewer, terrainMode);
      if (geoJsonDsRef.current) {
        viewer.dataSources.remove(geoJsonDsRef.current, true);
        geoJsonDsRef.current = null;
      }
      if (tilesetRef.current) {
        viewer.scene.primitives.remove(tilesetRef.current);
        tilesetRef.current = null;
      }
      if (sadaTilesetRef.current) {
        viewer.scene.primitives.remove(sadaTilesetRef.current);
        sadaTilesetRef.current = null;
      }
      entityPropsRef.current.clear();
      setBuildingInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBuildings]);

  // ── Toggle handler ─────────────────────────────────────────────────────────
  const handleBuildingToggle = () => {
    const next = !showBuildings;
    setShowBuildings(next);
    if (next) {
      setMode("none");
      setClickInfo(null);
      if (markerRef.current && viewerRef.current) {
        viewerRef.current.entities.remove(markerRef.current);
        markerRef.current = null;
      }
    } else {
      setBuildingInfo(null);
    }
  };

  // ── Legend ─────────────────────────────────────────────────────────────────
  const showLegend = mode === "ramp" && !showBuildings;
  const legendGrad = terrainMode === "dsm"
    ? "linear-gradient(to top,#0d47a1,#1976d2,#2e7d32,#fdd835,#ef6c00,#b71c1c)"
    : "linear-gradient(to top,#1a0030,#2d0080,#0b3d91,#0077b6,#00b4d8,#0d9e8a,#52b788,#b7e4c7)";
  const legendTop = terrainMode === "dsm" ? "627.5 m" : DTM_LEGEND_TOP;
  const legendMid = terrainMode === "dsm" ? "568 m"   : DTM_LEGEND_MID;
  const legendBot = terrainMode === "dsm" ? "515 m"   : DTM_LEGEND_BOT;

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Switching overlay */}
      {switching && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(5,10,20,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 999, backdropFilter: "blur(4px)",
        }}>
          <div style={{ color: "#7cf", fontSize: 16, fontWeight: 700, letterSpacing: "0.15em", animation: "pulse 1s infinite" }}>
            ⟳ LOADING {terrainMode.toUpperCase()} TERRAIN…
          </div>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        </div>
      )}

      {/* ── LEFT PANEL COLUMN ─────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 10, left: 10,
        display: "flex", flexDirection: "column", gap: 8, width: 270,
      }}>

        {/* ── TERRAIN PANEL ── */}
        <div style={{
          background: "rgba(10,14,26,0.88)", border: "1px solid rgba(120,200,255,0.2)",
          borderRadius: 10, padding: "18px 20px", color: "#cde",
          backdropFilter: "blur(10px)", fontSize: 14, userSelect: "none",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          opacity: showBuildings ? 0.45 : 1,
          pointerEvents: showBuildings ? "none" : "auto",
          transition: "opacity 0.3s",
        }}>
          <div style={{ fontWeight: 700, letterSpacing: "0.1em", color: "#7cf", fontSize: 16, marginBottom: 16 }}>
            ▲ DSM / DTM VIEWER — NUST H-12
          </div>

          <PanelLabel>TERRAIN MODEL</PanelLabel>
          <BtnRow>
            <PBtn active={terrainMode === "dsm"} onClick={() => setTerrainMode("dsm")}>DSM</PBtn>
            <PBtn active={terrainMode === "dtm"} onClick={() => setTerrainMode("dtm")}>DTM</PBtn>
          </BtnRow>

          <div style={{
            background: terrainMode === "dsm" ? "rgba(120,200,255,0.08)" : "rgba(100,220,160,0.08)",
            border: terrainMode === "dsm" ? "1px solid rgba(120,200,255,0.2)" : "1px solid rgba(100,220,160,0.2)",
            borderRadius: 6, padding: "7px 10px",
            color: terrainMode === "dsm" ? "#7cf" : "#6de8a0",
            fontSize: 11.5, lineHeight: 1.6, marginBottom: 4, whiteSpace: "pre-line",
          }}>
            {terrainMode === "dsm"
              ? "🏙 Surface model — includes buildings & trees\nBasemap: Google Satellite"
              : "🏔 Bare-earth model — vegetation & structures removed\nBasemap: Esri World Shaded Relief"}
          </div>

          <PanelLabel>OVERLAY</PanelLabel>
          <BtnRow>
            {(["none", "ramp", "contour"] as Mode[]).map((m) => (
              <PBtn key={m} active={mode === m} onClick={() => setMode(m)}
                accent={terrainMode === "dtm" ? "#6de8a0" : "#7cf"}>
                {m === "none" ? "Normal" : m === "ramp" ? "Ramp" : "Contour"}
              </PBtn>
            ))}
          </BtnRow>

          {mode === "contour" && (
            <>
              <PanelLabel>CONTOUR SPACING: {spacing} M</PanelLabel>
              <input type="range" min={5} max={50} step={5} value={spacing}
                onChange={(e) => setSpacing(Number(e.target.value))}
                style={{ width: "100%", accentColor: terrainMode === "dtm" ? "#6de8a0" : "#7cf" }}
              />
            </>
          )}

          <div style={{
            background: "rgba(255,210,80,0.09)", border: "1px solid rgba(255,210,80,0.25)",
            borderRadius: 6, padding: "9px 11px", color: "#ffd580", fontSize: 12, lineHeight: 1.6, marginTop: 10,
          }}>
            <b>Click anywhere inside the campus to find elevation of point</b>
          </div>
        </div>

        {/* ── BUILDINGS PANEL ── */}
        <div style={{
          background: "rgba(10,14,26,0.88)",
          border: showBuildings ? "1px solid rgba(255,159,67,0.5)" : "1px solid rgba(255,159,67,0.15)",
          borderRadius: 10, padding: "18px 20px", color: "#cde",
          backdropFilter: "blur(10px)", fontSize: 14, userSelect: "none",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)", transition: "border-color 0.3s",
        }}>
          <div style={{ fontWeight: 700, letterSpacing: "0.1em", color: "#ff9f43", fontSize: 16, marginBottom: 14 }}>
            🏢 3D BUILDINGS
          </div>

          {/* Toggle switch */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "#a0b8c8" }}>{showBuildings ? "Visible" : "Hidden"}</span>
            <button onClick={handleBuildingToggle} disabled={buildingsLoading} style={{
              position: "relative", width: 52, height: 28, borderRadius: 14,
              border: "none", cursor: buildingsLoading ? "wait" : "pointer",
              background: showBuildings ? "rgba(255,159,67,0.8)" : "rgba(255,255,255,0.1)",
              transition: "background 0.25s", padding: 0,
            }}>
              <span style={{
                position: "absolute", top: 3, left: showBuildings ? 27 : 3,
                width: 22, height: 22, borderRadius: "50%",
                background: showBuildings ? "#fff" : "rgba(255,255,255,0.5)",
                transition: "left 0.25s", display: "block",
              }} />
            </button>
          </div>

          <div style={{
            background: "rgba(255,159,67,0.07)", border: "1px solid rgba(255,159,67,0.18)",
            borderRadius: 6, padding: "8px 10px", fontSize: 11.5, lineHeight: 1.8, color: "#c8a882",
          }}>
            <div>📐 <b style={{ color: "#ff9f43" }}>LOD 1</b> footprints · <code>_mean</code> height</div>
            <div>🏛 <b style={{ color: "#7eb8d4" }}>LOD 3</b> detailed buildings · Ion 3D Tiles</div>
            <div style={{ marginTop: 4, color: "#7a6048", fontSize: 11 }}>
              Basemap: OpenStreetMap · <b>click a building to zoom in</b>
            </div>
          </div>

          {showBuildings && (
            <div style={{
              marginTop: 10, background: "rgba(255,80,80,0.08)",
              border: "1px solid rgba(255,100,100,0.2)",
              borderRadius: 6, padding: "7px 10px",
              color: "#ff9999", fontSize: 11.5, lineHeight: 1.5,
            }}>
              ⚠ Terrain overlays disabled while buildings are visible
            </div>
          )}

          {buildingsLoading && (
            <div style={{ marginTop: 8, color: "#ff9f43", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", animation: "pulse 1s infinite" }}>
              ⟳ Loading buildings…
            </div>
          )}
        </div>
      </div>

      {/* ── Elevation Legend ── */}
      {showLegend && (
        <div style={{
          position: "absolute", bottom: 40, right: 12,
          background: "rgba(10,14,26,0.85)",
          border: terrainMode === "dsm" ? "1px solid rgba(120,200,255,0.2)" : "1px solid rgba(100,220,160,0.2)",
          borderRadius: 10, padding: "14px 16px", color: "#cde", fontSize: 13,
          textAlign: "center", backdropFilter: "blur(10px)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}>
          <div style={{ color: terrainMode === "dsm" ? "#7cf" : "#6de8a0", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", marginBottom: 4 }}>
            {terrainMode === "dsm" ? "DSM" : "DTM"} ELEVATION (m)
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <div style={{ width: 22, height: 150, borderRadius: 4, background: legendGrad, border: "1px solid rgba(255,255,255,0.1)" }} />
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: 12, color: "#9bc" }}>
              <span>{legendTop}</span><span>{legendMid}</span><span>{legendBot}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#556e7a", marginTop: 6 }}>ArcPro-corrected (+{GEOID_OFFSET}m geoid)</div>
        </div>
      )}

      {/* ── Terrain elevation popup (hidden in building mode) ── */}
      {clickInfo && !showBuildings && (
        <div style={{
          position: "absolute", bottom: 40, left: 10,
          background: clickInfo.isInside ? "rgba(10,14,26,0.9)" : "rgba(26,10,10,0.9)",
          border: clickInfo.isInside ? "1px solid rgba(120,200,255,0.2)" : "1px solid rgba(255,100,100,0.3)",
          borderRadius: 10, padding: "14px 18px", color: "#cde", fontSize: 14,
          minWidth: 240, backdropFilter: "blur(10px)", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", lineHeight: 2,
        }}>
          <div style={{ color: clickInfo.isInside ? "#ffd580" : "#ff6b6b", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", marginBottom: 6 }}>
            📍 POINT INSPECTION — {clickInfo.readingMode === "dsm" ? "DSM" : "DTM"} ELEVATION
          </div>
          {clickInfo.isInside ? (
            <>
              <KV k="Lon">{clickInfo.lon}°</KV>
              <KV k="Lat">{clickInfo.lat}°</KV>
              <div style={{ borderTop: "1px solid rgba(120,200,255,0.15)", marginTop: 4, paddingTop: 4 }}>
                <KV k={`${clickInfo.readingMode === "dsm" ? "DSM" : "DTM"} Elevation`}>
                  <span style={{ color: "#ffd580", fontWeight: 700 }}>
                    {clickInfo.pending ? "sampling…" : `${clickInfo.arcpro} m`}
                  </span>
                </KV>
                <div style={{ fontSize: 11, color: "#556e7a", marginTop: 2 }}>
                  Raw Cesium: {clickInfo.cesium} m (+{GEOID_OFFSET}m geoid)
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: "#ff9999", fontSize: 13, fontWeight: 500, padding: "8px 0", textAlign: "center" }}>
              Point is outside the campus boundary
            </div>
          )}
          <button onClick={() => {
            setClickInfo(null);
            if (markerRef.current && viewerRef.current) {
              viewerRef.current.entities.remove(markerRef.current);
              markerRef.current = null;
            }
          }} style={{
            marginTop: 8, background: "transparent",
            border: "1px solid rgba(120,200,255,0.2)",
            color: "#556e7a", borderRadius: 4,
            padding: "4px 10px", cursor: "pointer", fontSize: 12,
          }}>✕ clear</button>
        </div>
      )}

      {/* ── Building click popup ── */}
      {buildingInfo && showBuildings && (
        <div style={{
          position: "absolute", bottom: 40, left: 10,
          background: "rgba(10,14,26,0.93)",
          border: buildingInfo.isTileset
            ? "1px solid rgba(126,184,212,0.5)"
            : "1px solid rgba(255,159,67,0.4)",
          borderRadius: 10, padding: "16px 18px", color: "#cde", fontSize: 14,
          minWidth: 265, backdropFilter: "blur(12px)", boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>{buildingInfo.isTileset ? "🏛" : "🏢"}</span>
            <div>
              <div style={{
                fontWeight: 700, fontSize: 13,
                color: buildingInfo.isTileset ? "#7eb8d4" : "#ff9f43",
                letterSpacing: "0.04em",
              }}>
                {buildingInfo.name}
              </div>
              <div style={{ fontSize: 10, color: "#556e7a", marginTop: 1, letterSpacing: "0.08em" }}>
                BUILDING INFORMATION
              </div>
            </div>
          </div>

          {/* LOD badge + description */}
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-block",
              background: buildingInfo.lodNum === 3 ? "rgba(126,184,212,0.18)" : "rgba(255,159,67,0.15)",
              border: buildingInfo.lodNum === 3 ? "1px solid rgba(126,184,212,0.45)" : "1px solid rgba(255,159,67,0.35)",
              borderRadius: 4, padding: "3px 9px",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
              color: buildingInfo.lodNum === 3 ? "#7eb8d4" : "#ff9f43",
            }}>
              {buildingInfo.lod}
            </span>
            <span style={{ fontSize: 10.5, color: "#5a8aab" }}>
              {buildingInfo.lodNum === 3
                ? "Detailed geometry · georeferenced"
                : "Extruded footprint · mean height"}
            </span>
          </div>

          {/* Data rows */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 6, padding: "9px 12px",
            display: "flex", flexDirection: "column", gap: 7, lineHeight: 1.4,
          }}>
            <KV k="Longitude">{buildingInfo.lon}°</KV>
            <KV k="Latitude">{buildingInfo.lat}°</KV>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "#5a8aab" }}>Height</span>
                <span style={{ color: "#ffd580", fontWeight: 700 }}>
                  {buildingInfo.height !== "N/A" ? `= ${buildingInfo.height} m` : "N/A"}
                </span>
              </div>
            </div>
          </div>

          <button onClick={() => setBuildingInfo(null)} style={{
            marginTop: 10, background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#556e7a", borderRadius: 4,
            padding: "4px 10px", cursor: "pointer", fontSize: 12,
          }}>✕ close</button>
        </div>
      )}
    </div>
  );
}

// ── UI helpers ─────────────────────────────────────────────────────────────────
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11.5, letterSpacing: "0.1em", color: "#5a8aab", textTransform: "uppercase", marginTop: 12, marginBottom: 6 }}>
      {children}
    </div>
  );
}

function BtnRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 2 }}>{children}</div>;
}

function PBtn({ active, onClick, children, accent = "#7cf" }: {
  active: boolean; onClick: () => void; children: React.ReactNode; accent?: string;
}) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 5, cursor: "pointer", fontSize: 13,
      fontWeight: active ? 700 : 400,
      border: active ? `1px solid ${accent}` : "1px solid rgba(120,200,255,0.2)",
      background: active ? "rgba(100,200,255,0.18)" : "transparent",
      color: active ? accent : "#6a9ab5",
    }}>
      {children}
    </button>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "#5a8aab" }}>{k}</span>
      <span>{children}</span>
    </div>
  );
}
