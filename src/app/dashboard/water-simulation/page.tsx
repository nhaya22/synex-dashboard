"use client";

import { useEffect, useRef, useState } from "react";
import type { Map } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const NUST_LAT = 33.6446;
const NUST_LNG = 72.99;

interface RainClass {
  level: number;
  label: string;
  color: string;
  streamW: number;
  glowW: number;
  animDelay: number;
  zoneOpacity: Record<number, number>;
}

interface TimelinePoint {
  time: string;
  mm: number;
  isForecast: boolean;
}

interface LiveStatus {
  rain: number;
  temp: number | null;
  humidity: number | null;
  weatherCode: number;
  fetchedAt: Date;
}

interface PastEvent {
  id: string;
  label: string;
  desc: string;
  start: Date;
  end: Date;
}

interface RainParticle {
  x: number;
  y: number;
  len: number;
  width: number;
  speed: number;
  opacity: number;
  bright: boolean;
}

function classifyRainfall(mmhr: number): RainClass {
  if (mmhr <= 0)
    return {
      level: 0,
      label: "Dry",
      color: "#888888",
      streamW: 1,
      glowW: 4,
      animDelay: 120,
      zoneOpacity: { 1: 0, 2: 0, 3: 0, 4: 0 },
    };
  if (mmhr < 2.5)
    return {
      level: 1,
      label: "Light",
      color: "#00cc44",
      streamW: 2,
      glowW: 7,
      animDelay: 100,
      zoneOpacity: { 1: 0.2, 2: 0, 3: 0, 4: 0 },
    };
  if (mmhr < 7.6)
    return {
      level: 2,
      label: "Moderate",
      color: "#ffdd00",
      streamW: 4,
      glowW: 13,
      animDelay: 72,
      zoneOpacity: { 1: 0.45, 2: 0.3, 3: 0, 4: 0 },
    };
  if (mmhr < 50)
    return {
      level: 3,
      label: "Heavy",
      color: "#ff7700",
      streamW: 7,
      glowW: 20,
      animDelay: 45,
      zoneOpacity: { 1: 0.65, 2: 0.55, 3: 0.45, 4: 0 },
    };
  return {
    level: 4,
    label: "Violent",
    color: "#ff1111",
    streamW: 10,
    glowW: 28,
    animDelay: 25,
    zoneOpacity: { 1: 0.8, 2: 0.72, 3: 0.65, 4: 0.58 },
  };
}

const ZONE_COLORS: Record<number, string> = {
  1: "#00cc44",
  2: "#ffdd00",
  3: "#ff7700",
  4: "#ff1111",
};

const ZONE_LABELS: Record<number, string> = {
  1: "Zone 1 — Low accumulation",
  2: "Zone 2 — Moderate accumulation",
  3: "Zone 3 — High accumulation",
  4: "Zone 4 — Extreme accumulation",
};

async function fetchLiveTimeline(): Promise<TimelinePoint[]> {
  try {
    const now = new Date();
    const past = new Date(now);
    past.setDate(past.getDate() - 2);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const nowStr = now.toISOString().slice(0, 16);

    const [histRes, fcastRes] = await Promise.all([
      fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${NUST_LAT}&longitude=${NUST_LNG}&start_date=${fmt(
          past
        )}&end_date=${fmt(now)}&hourly=precipitation&timezone=Asia/Karachi`
      ),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${NUST_LAT}&longitude=${NUST_LNG}&hourly=precipitation&forecast_days=2&timezone=Asia/Karachi`
      ),
    ]);

    const hist = await histRes.json();
    const fcast = await fcastRes.json();

    const historical = (hist.hourly?.time || []).map((t: string, i: number) => ({
      time: t,
      mm: hist.hourly.precipitation[i] || 0,
      isForecast: false,
    }));

    const forecast = (fcast.hourly?.time || [])
      .map((t: string, i: number) => ({
        time: t,
        mm: fcast.hourly.precipitation[i] || 0,
        isForecast: true,
      }))
      .filter((h: TimelinePoint) => h.time > nowStr);

    return [...historical, ...forecast];
  } catch {
    return [];
  }
}

async function fetchArchiveRange(startDate: Date, endDate: Date): Promise<TimelinePoint[]> {
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  try {
    const res = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${NUST_LAT}&longitude=${NUST_LNG}&start_date=${fmt(
        startDate
      )}&end_date=${fmt(endDate)}&hourly=precipitation&timezone=Asia/Karachi`
    );
    const data = await res.json();
    return (data.hourly?.time || []).map((t: string, i: number) => ({
      time: t,
      mm: data.hourly.precipitation[i] || 0,
      isForecast: false,
    }));
  } catch {
    return [];
  }
}

async function fetchLiveStatus(): Promise<LiveStatus | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${NUST_LAT}&longitude=${NUST_LNG}&current=precipitation,temperature_2m,relative_humidity_2m,weather_code&forecast_days=1&timezone=Asia/Karachi`
    );
    const data = await res.json();
    const cur = data.current || {};
    return {
      rain: cur.precipitation ?? 0,
      temp: cur.temperature_2m ?? null,
      humidity: cur.relative_humidity_2m ?? null,
      weatherCode: cur.weather_code ?? 0,
      fetchedAt: new Date(),
    };
  } catch {
    return null;
  }
}

function weatherDesc(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 84) return "Rain showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

const PAST_EVENTS: PastEvent[] = [
  {
    id: "apr2026",
    label: "🌧 Apr 4–6 2026 — Heavy Rain",
    desc: "Heavy rainfall across Islamabad early April 2026. Real hourly archive data — scrub to see accumulation zones activate at peak hours.",
    start: new Date("2026-04-03"),
    end: new Date("2026-04-07"),
  },
];

const fmtDate = (t: string) => new Date(t).toLocaleDateString("en-PK", { month: "short", day: "numeric" });
const fmtTime = (t: string) => new Date(t).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });

function findPeakIndex(data: TimelinePoint[]): number {
  let max = 0;
  let idx = 0;
  data.forEach((h, i) => {
    if (h.mm > max) {
      max = h.mm;
      idx = i;
    }
  });
  return idx;
}

export default function WaterFlowMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<(Map & { _animDelay?: number }) | null>(null);
  const animFrame = useRef<number | null>(null);
  const initTimeout = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rainParticles = useRef<RainParticle[]>([]);

  const [loaded, setLoaded] = useState(false);
  const [hourlyData, setHourlyData] = useState<TimelinePoint[]>([]);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [showPanel, setShowPanel] = useState<string>("timeline");
  const [manualRain, setManualRain] = useState<number | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);

  const currentH = hourlyData[scrubIndex] ?? null;
  const timelineRain = currentH?.mm || 0;
  const activeRain = manualRain !== null ? manualRain : timelineRain;
  const cls = classifyRainfall(activeRain);
  const isRaining = activeRain > 1;

  useEffect(() => {
    fetchLiveTimeline().then((data) => {
      setHourlyData(data);
      const nowIdx = data.findLastIndex((h) => !h.isForecast);
      setScrubIndex(nowIdx >= 0 ? nowIdx : 0);
    });
  }, []);

  useEffect(() => {
    fetchLiveStatus().then(setLiveStatus);
    const iv = window.setInterval(() => fetchLiveStatus().then(setLiveStatus), 5 * 60 * 1000);
    return () => window.clearInterval(iv);
  }, []);

  async function loadEvent(ev: PastEvent) {
    setEventLoading(ev.id);
    setManualRain(null);
    const raw = await fetchArchiveRange(ev.start, ev.end);
    if (!raw.length) {
      setEventLoading(null);
      return;
    }
    setHourlyData(raw);
    setScrubIndex(findPeakIndex(raw));
    setActiveEventId(ev.id);
    setEventLoading(null);
    setShowPanel("timeline");
  }

  function resetToLive() {
    setActiveEventId(null);
    setManualRain(null);
    fetchLiveTimeline().then((data) => {
      setHourlyData(data);
      const nowIdx = data.findLastIndex((h) => !h.isForecast);
      setScrubIndex(nowIdx >= 0 ? nowIdx : 0);
    });
  }

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const drawCtx = ctx;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (!isRaining) {
      drawCtx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const count = Math.min(800, Math.floor(activeRain * 5) + 80);
    rainParticles.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      len: Math.random() * 22 + 10,
      width: Math.random() * 1.4 + 0.5,
      speed: Math.random() * 11 + 5,
      opacity: Math.random() * 0.45 + 0.25,
      bright: Math.random() > 0.65,
    }));

    let rafId = 0;

    function draw() {
      drawCtx.clearRect(0, 0, canvas.width, canvas.height);
      rainParticles.current.forEach((p) => {
        if (p.bright) {
          drawCtx.globalAlpha = p.opacity * 0.18;
          drawCtx.strokeStyle = "#ffffff";
          drawCtx.lineWidth = p.width + 2;
          drawCtx.beginPath();
          drawCtx.moveTo(p.x, p.y);
          drawCtx.lineTo(p.x - 3, p.y + p.len);
          drawCtx.stroke();
        }
        drawCtx.globalAlpha = p.opacity;
        drawCtx.strokeStyle = p.bright ? "#e8f8ff" : "#7dd4f8";
        drawCtx.lineWidth = p.width;
        drawCtx.beginPath();
        drawCtx.moveTo(p.x, p.y);
        drawCtx.lineTo(p.x - 3, p.y + p.len);
        drawCtx.stroke();
        drawCtx.globalAlpha = p.opacity * 0.8;
        drawCtx.fillStyle = p.bright ? "#ffffff" : "#a8e8ff";
        drawCtx.beginPath();
        drawCtx.arc(p.x, p.y, p.width * 0.8, 0, Math.PI * 2);
        drawCtx.fill();
        p.y += p.speed;
        p.x -= 2;
        if (p.y > canvas.height) {
          p.y = -p.len;
          p.x = Math.random() * canvas.width;
        }
      });
      rafId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [activeRain, isRaining]);

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [NUST_LNG, NUST_LAT],
      zoom: 13.8,
      pitch: 52,
      bearing: -8,
      minZoom: 13.0,
      maxZoom: 18,
      maxBounds: [[72.955, 33.61], [73.025, 33.68]],
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;
      const mapInstance = map.current!;

      mapInstance.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });

      (mapInstance as any).setTerrain?.({ source: "mapbox-dem", exaggeration: 2.0 });

      mapInstance.addLayer({
        id: "sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [0, 90],
          "sky-atmosphere-sun-intensity": 12,
        },
      } as any);

      mapInstance.addSource("flood-zones", {
        type: "geojson",
        data: "/data/flood_zones.geojson",
      });

      [1, 2, 3, 4].forEach((lvl) => {
        mapInstance.addLayer({
          id: `flood-zone-fill-${lvl}`,
          type: "fill",
          source: "flood-zones",
          filter: ["==", ["get", "risk_level"], lvl],
          paint: { "fill-color": ZONE_COLORS[lvl], "fill-opacity": 0 },
        });
        mapInstance.addLayer({
          id: `flood-zone-outline-${lvl}`,
          type: "line",
          source: "flood-zones",
          filter: ["==", ["get", "risk_level"], lvl],
          paint: {
            "line-color": ZONE_COLORS[lvl],
            "line-width": 1.5,
            "line-opacity": 0,
          },
        });
      });

      mapInstance.addSource("buildings", {
        type: "geojson",
        data: "/data/buildings_NUST.geojson",
      });

      mapInstance.addLayer({
        id: "buildings-3d",
        type: "fill-extrusion",
        source: "buildings",
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "heightmedian"],
            0,
            "#cfe2f3",
            10,
            "#8ab4d4",
            20,
            "#4a85b8",
            35,
            "#1a5590",
          ],
          "fill-extrusion-height": ["get", "heightmedian"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.88,
        },
      });

      mapInstance.addSource("streams", {
        type: "geojson",
        data: "/data/streams.geojson",
      });

      mapInstance.addLayer({
        id: "streams-base",
        type: "line",
        source: "streams",
        paint: {
          "line-color": "#003f8a",
          "line-width": 2.5,
          "line-opacity": 0.5,
        },
      });

      mapInstance.addLayer({
        id: "streams-glow",
        type: "line",
        source: "streams",
        paint: {
          "line-color": "#00aaff",
          "line-width": 6,
          "line-opacity": 0.2,
          "line-blur": 5,
        },
      });

      mapInstance.addLayer({
        id: "streams-main",
        type: "line",
        source: "streams",
        paint: {
          "line-color": "#00ddff",
          "line-width": 1.5,
          "line-opacity": 0.95,
        },
      });

      mapInstance.addLayer({
        id: "streams-animated",
        type: "line",
        source: "streams",
        paint: {
          "line-color": "#ffffff",
          "line-width": 1,
          "line-opacity": 0.8,
          "line-dasharray": [0, 4, 3],
        },
      });

      const dashSeq = [
        [0, 4, 3],
        [0.5, 4, 2.5],
        [1, 4, 2],
        [1.5, 4, 1.5],
        [2, 4, 1],
        [2.5, 4, 0.5],
        [3, 4, 0],
        [0, 3, 3, 1],
        [0, 2, 3, 2],
        [0, 1, 3, 3],
      ];
      let step = 0;
      (mapInstance as any)._animDelay = 120;

      function animateFlow() {
        step = (step + 1) % dashSeq.length;
        if (mapInstance.getLayer("streams-animated")) {
          mapInstance.setPaintProperty("streams-animated", "line-dasharray", dashSeq[step]);
        }
        animFrame.current = window.setTimeout(() => requestAnimationFrame(animateFlow), map.current?._animDelay ?? 120);
      }

      animateFlow();

      initTimeout.current = window.setTimeout(() => {
        if (!map.current) return;
        map.current.flyTo({
          center: [NUST_LNG, NUST_LAT],
          zoom: 14.3,
          pitch: 55,
          bearing: -8,
          duration: 2400,
          easing: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
        });
      }, 350);

      setLoaded(true);
    });

    return () => {
      if (animFrame.current !== null) window.clearTimeout(animFrame.current);
      if (initTimeout.current !== null) window.clearTimeout(initTimeout.current);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !loaded) return;
    const c = classifyRainfall(activeRain);

    if (mapInstance.getLayer("streams-main")) mapInstance.setPaintProperty("streams-main", "line-width", c.streamW);
    if (mapInstance.getLayer("streams-glow")) mapInstance.setPaintProperty("streams-glow", "line-width", c.glowW);
    if (mapInstance.getLayer("streams-base")) mapInstance.setPaintProperty("streams-base", "line-width", Math.max(2, c.streamW * 1.2));
    if (mapInstance.getLayer("streams-animated")) mapInstance.setPaintProperty("streams-animated", "line-width", Math.max(0.8, c.streamW * 0.5));

    [1, 2, 3, 4].forEach((lvl) => {
      const op = c.zoneOpacity[lvl] ?? 0;
      if (mapInstance.getLayer(`flood-zone-fill-${lvl}`)) {
        mapInstance.setPaintProperty(`flood-zone-fill-${lvl}`, "fill-opacity", op);
      }
      if (mapInstance.getLayer(`flood-zone-outline-${lvl}`)) {
        mapInstance.setPaintProperty(
          `flood-zone-outline-${lvl}`,
          "line-opacity",
          op > 0.05 ? Math.min(0.95, op * 1.5) : 0
        );
      }
    });

    (mapInstance as any)._animDelay = c.animDelay;
  }, [activeRain, loaded]);

  const panelStyle: React.CSSProperties = {
    position: "absolute",
    top: 80,
    left: 24,
    background: "rgba(4,8,18,0.93)",
    color: "white",
    padding: "18px 20px",
    borderRadius: 16,
    backdropFilter: "blur(18px)",
    border: "1px solid rgba(0,180,255,0.18)",
    width: 320,
    maxHeight: "calc(100vh - 140px)",
    overflowY: "auto",
    scrollbarWidth: "thin",
    zIndex: 5,
  };

  const lbl: React.CSSProperties = {
    fontSize: 11,
    color: "#00ddff",
    fontWeight: 600,
    marginBottom: 6,
  };

  const dim: React.CSSProperties = {
    fontSize: 10,
    color: "rgba(255,255,255,0.42)",
    lineHeight: 1.7,
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 1 }} />

      <div
        style={{
          position: "absolute",
          top: 18,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(4,8,18,0.9)",
          padding: "9px 26px",
          borderRadius: 28,
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(0,180,255,0.25)",
          textAlign: "center",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 13, color: "#00ddff", letterSpacing: 3, fontWeight: 700 }}>NUST DIGITAL TWIN</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", letterSpacing: 1.5, marginTop: 2 }}>
          GIS-BASED SURFACE WATER FLOW · H-12 ISLAMABAD
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 30, left: 24, display: "flex", gap: 6, zIndex: 20 }}>
        {[
          ["timeline", "⏱ Timeline"],
          ["simulate", "🌧 Simulate"],
          ["events", "📅 Past Event"],
          ["info", "ℹ️ About"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setShowPanel(showPanel === id ? "" : String(id))}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              background: showPanel === id ? "#00ddff" : "rgba(4,8,18,0.9)",
              color: showPanel === id ? "#000" : "#fff",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: showPanel === id ? 700 : 400,
              border: `1px solid ${showPanel === id ? "#00ddff" : "rgba(0,180,255,0.2)"}`,
              backdropFilter: "blur(10px)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {showPanel === "timeline" && (
        <div style={panelStyle}>
          {activeEventId && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                padding: "7px 10px",
                borderRadius: 8,
                background: "rgba(255,200,0,0.08)",
                border: "1px solid rgba(255,200,0,0.28)",
              }}
            >
              <span style={{ fontSize: 10, color: "#ffd700", fontWeight: 600 }}>
                {PAST_EVENTS.find((e) => e.id === activeEventId)?.label}
              </span>
              <button
                onClick={resetToLive}
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontSize: 9,
                  cursor: "pointer",
                  border: "1px solid rgba(255,200,0,0.4)",
                  background: "transparent",
                  color: "#ffd700",
                }}
              >
                ← Live
              </button>
            </div>
          )}

          <div style={{ ...lbl, fontSize: 13, marginBottom: 3 }}>⏱ Rainfall Timeline</div>
          <div style={{ ...dim, marginBottom: 14 }}>
            {activeEventId
              ? "Past event — drag to replay hour by hour · zones activate at rainy hours"
              : "48 hrs recorded + 48 hrs forecast · drag scrubber · zones appear live"}
          </div>

          {hourlyData.length === 0 ? (
            <div style={dim}>Fetching data from Open-Meteo…</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: currentH?.isForecast ? "rgba(255,136,0,0.1)" : "rgba(0,180,255,0.08)",
                    border: `1px solid ${currentH?.isForecast ? "rgba(255,136,0,0.3)" : "rgba(0,180,255,0.2)"}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: currentH?.isForecast ? "#ff8800" : "#00ddff",
                      fontWeight: 600,
                      marginBottom: 2,
                    }}
                  >
                    {currentH?.isForecast
                      ? "🔮 FORECAST"
                      : activeEventId
                      ? "📅 PAST EVENT"
                      : "📅 RECORDED"}
                  </div>
                  <div style={{ fontSize: 13, color: "white", fontWeight: 700 }}>
                    {currentH ? fmtDate(currentH.time) : "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                    {currentH ? fmtTime(currentH.time) : "—"}
                  </div>
                </div>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: `${cls.color}22`,
                    border: `1px solid ${cls.color}55`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    minWidth: 80,
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800, color: cls.color }}>{activeRain.toFixed(1)}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>mm/hr</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: cls.color, marginTop: 2 }}>{cls.label}</div>
                </div>
              </div>

              <div
                style={{
                  padding: "8px 11px",
                  borderRadius: 8,
                  marginBottom: 14,
                  background: `${cls.color}12`,
                  border: `1px solid ${cls.color}35`,
                }}
              >
                <div style={{ fontSize: 10, color: cls.color, fontWeight: 600 }}>
                  🗺 Zones on map: {cls.level === 0 ? "Hidden — no rain" : cls.level === 1 ? "Zone 1 faintly visible" : cls.level === 2 ? "Zones 1–2 active" : cls.level === 3 ? "Zones 1–3 active" : "All 4 zones at full intensity"}
                </div>
              </div>

              <div style={{ ...lbl, marginBottom: 5 }}>mm/hr · blue = recorded · orange = forecast</div>
              <div style={{ position: "relative", height: 68, marginBottom: 5 }}>
                {!activeEventId && (() => {
                  const nowIdx = hourlyData.findLastIndex((h) => !h.isForecast);
                  const pct = (nowIdx / (hourlyData.length - 1)) * 100;
                  return (
                    <div
                      style={{ position: "absolute", left: `${pct}%`, top: 0, bottom: 0, width: 1.5, background: "rgba(255,255,255,0.7)", zIndex: 3, pointerEvents: "none" }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: -14,
                          left: -10,
                          fontSize: 8,
                          color: "white",
                          whiteSpace: "nowrap",
                          background: "rgba(0,0,0,0.6)",
                          padding: "1px 5px",
                          borderRadius: 3,
                        }}
                      >
                        NOW
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: "100%" }}>
                  {hourlyData.map((h, i) => {
                    const max = Math.max(...hourlyData.map((x) => x.mm), 1);
                    const barH = Math.max((h.mm / max) * 64, h.mm > 0 ? 2 : 0);
                    const isActive = i === scrubIndex;
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          setScrubIndex(i);
                          setManualRain(null);
                        }}
                        style={{
                          flex: 1,
                          height: `${barH}px`,
                          alignSelf: "flex-end",
                          cursor: "pointer",
                          borderRadius: "2px 2px 0 0",
                          background: isActive ? "#fff" : h.isForecast ? "#ff8800" : "#00aaff",
                          opacity: isActive ? 1 : 0.65,
                          minHeight: h.mm > 0 ? 2 : 0,
                          border: isActive ? "1px solid white" : "none",
                        }}
                        title={`${fmtDate(h.time)} ${fmtTime(h.time)}: ${h.mm.toFixed(1)}mm/hr`}
                      />
                    );
                  })}
                </div>
              </div>

              <input
                type="range"
                min="0"
                max={hourlyData.length - 1}
                value={scrubIndex}
                onChange={(e) => {
                  setScrubIndex(Number(e.target.value));
                  setManualRain(null);
                }}
                style={{ width: "100%", accentColor: "#00ddff", marginBottom: 3 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", ...dim, marginBottom: 14 }}>
                <span>{hourlyData[0] ? fmtDate(hourlyData[0].time) : ""}</span>
                <span>drag to travel in time</span>
                <span>{hourlyData[hourlyData.length - 1] ? fmtDate(hourlyData[hourlyData.length - 1].time) : ""}</span>
              </div>

              <div style={{ ...lbl, marginBottom: 6 }}>Rainfall Classification (WMO Standard)</div>
              {[
                [0, 2.5, "#00cc44", "Light", "< 2.5 mm/hr", "Zone 1 faintly visible"],
                [2.5, 7.6, "#ffdd00", "Moderate", "2.5–7.6 mm/hr", "Zones 1–2 active"],
                [7.6, 50, "#ff7700", "Heavy", "7.6–50 mm/hr", "Zones 1–3 active"],
                [50, "∞", "#ff1111", "Violent", "> 50 mm/hr", "All 4 zones at full intensity"],
              ].map(([min, max, color, label, range, zoneDesc]) => (
                <div
                  key={String(label)}
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 5,
                    padding: "5px 8px",
                    borderRadius: 6,
                    background: `${color}0f`,
                    border: `1px solid ${color}28`,
                  }}
                >
                  <div style={{ width: 10, height: 10, background: String(color), borderRadius: 2, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, color: String(color), fontWeight: 600 }}>
                      {label} <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>({range})</span>
                    </div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{zoneDesc}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {showPanel === "simulate" && (
        <div style={panelStyle}>
          <div style={{ ...lbl, fontSize: 13, marginBottom: 4 }}>🌧 Simulate Rainfall</div>

          <div
            style={{
              padding: "16px",
              borderRadius: 12,
              background: `${cls.color}1a`,
              border: `1px solid ${cls.color}44`,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 800, color: cls.color, lineHeight: 1 }}>{manualRain ?? Math.round(timelineRain)}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>mm / hr</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: cls.color }}>{cls.label}</div>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={manualRain ?? Math.round(timelineRain)}
            onChange={(e) => setManualRain(Number(e.target.value))}
            style={{ width: "100%", accentColor: cls.color, marginBottom: 4 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", ...dim, marginBottom: 14 }}>
            <span>Dry (0)</span>
            <span>Heavy (20)</span>
            <span>Violent (50+)</span>
          </div>

          {manualRain !== null && (
            <button
              onClick={() => setManualRain(null)}
              style={{
                width: "100%",
                padding: "7px",
                borderRadius: 8,
                background: "rgba(0,180,255,0.1)",
                color: "#00ddff",
                fontSize: 11,
                cursor: "pointer",
                border: "1px solid rgba(0,180,255,0.3)",
                marginBottom: 14,
              }}
            >
              ← Back to timeline
            </button>
          )}

          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              marginBottom: 14,
              background: `${cls.color}12`,
              border: `1px solid ${cls.color}35`,
            }}
          >
            <div style={{ fontSize: 11, color: cls.color, fontWeight: 600 }}>
              Map zones: {cls.level === 0 ? "Hidden" : cls.level === 1 ? "Zone 1 visible" : cls.level === 2 ? "Zones 1–2" : cls.level === 3 ? "Zones 1–3" : "All 4 zones"}
            </div>
          </div>

          <div style={{ ...lbl, marginBottom: 8 }}>GIS Accumulation Zones</div>
          {[1, 2, 3, 4].map((lvl) => (
            <div
              key={lvl}
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 6,
                padding: "7px 9px",
                borderRadius: 7,
                background: `${ZONE_COLORS[lvl]}0f`,
                border: `1px solid ${ZONE_COLORS[lvl]}30`,
              }}
            >
              <div
                style={{
                  width: 11,
                  height: 11,
                  background: ZONE_COLORS[lvl],
                  borderRadius: 2,
                  marginTop: 2,
                  flexShrink: 0,
                }}
              />
              <div style={{ fontSize: 11, color: ZONE_COLORS[lvl], fontWeight: 600 }}>{ZONE_LABELS[lvl]}</div>
            </div>
          ))}
        </div>
      )}

      {showPanel === "events" && (
        <div style={panelStyle}>
          <div style={{ ...lbl, fontSize: 13, marginBottom: 4 }}>📅 Past Rainfall Events</div>
          <div style={{ ...dim, marginBottom: 14 }}>
            Real hourly archive data from Open-Meteo. Load an event → scrubber jumps to the rainiest hour → drag to replay → zones activate as rainfall peaks.
          </div>

          {activeEventId && (
            <button
              onClick={resetToLive}
              style={{
                width: "100%",
                padding: "7px",
                borderRadius: 8,
                marginBottom: 14,
                border: "1px solid rgba(0,180,255,0.3)",
                background: "rgba(0,180,255,0.1)",
                color: "#00ddff",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              ← Back to live timeline
            </button>
          )}

          {PAST_EVENTS.map((ev) => {
            const isActive = activeEventId === ev.id;
            const isLoading = eventLoading === ev.id;
            return (
              <div
                key={ev.id}
                style={{
                  marginBottom: 10,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: isActive ? "rgba(0,180,255,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? "rgba(0,180,255,0.35)" : "rgba(255,255,255,0.09)"}`,
                }}
              >
                <div style={{ fontSize: 12, color: isActive ? "#00ddff" : "white", fontWeight: 700, marginBottom: 4 }}>{ev.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.52)", lineHeight: 1.6, marginBottom: 8 }}>{ev.desc}</div>
                <button
                  onClick={() => {
                    if (!isLoading && !isActive) loadEvent(ev);
                  }}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 8,
                    fontSize: 10,
                    cursor: isLoading ? "wait" : isActive ? "default" : "pointer",
                    border: `1px solid ${isActive ? "#00ddff" : "rgba(255,255,255,0.2)"}`,
                    background: isActive ? "#00ddff" : "rgba(255,255,255,0.07)",
                    color: isActive ? "#000" : "#fff",
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {isLoading ? "⏳ Fetching…" : isActive ? "✓ Loaded — see Timeline" : "▶ Load event"}
                </button>
              </div>
            );
          })}

          <div
            style={{
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(0,180,255,0.06)",
              border: "1px solid rgba(0,180,255,0.12)",
              fontSize: 10,
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.7,
            }}
          >
            💡 After loading, switch to <strong style={{ color: "#00ddff" }}>Timeline</strong> and drag the scrubber. Zones will appear and intensify as you hit the rainy hours.
          </div>
        </div>
      )}

      {showPanel === "info" && (
        <div style={panelStyle}>
          <div style={{ ...lbl, fontSize: 13, marginBottom: 12 }}>🎓 Project Context</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.72)", lineHeight: 1.9 }}>
            {[
              ["UN SDG 6", "Clean Water & Sanitation"],
              ["UN SDG 11", "Sustainable Cities"],
              ["UN SDG 13", "Climate Action"],
            ].map(([s, d]) => (
              <div key={String(s)}>
                <span style={{ color: "#00ddff", fontWeight: 600 }}>{s}</span> — {d}
              </div>
            ))}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ color: "#00ddff", fontWeight: 600, marginBottom: 6 }}>🗺️ GIS Methodology</div>
              <div>• Drone DSM + DTM at 1m resolution</div>
              <div>• D8 flow direction via r.watershed (GRASS GIS)</div>
              <div>• Flow accumulation → stream network extraction</div>
              <div>• High-accumulation cells → 4 flood zone levels</div>
              <div>• LOD1 buildings from nDSM median height</div>
              <div>• Rainfall: Open-Meteo hourly API</div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ color: "#00ddff", fontWeight: 600, marginBottom: 6 }}>📊 What the simulation shows</div>
              <div>• Streams widen and glow as rainfall rises</div>
              <div>• Accumulation zones fade in — terrain-derived</div>
              <div>• Zone colour = upstream drainage area at that point</div>
              <div>• Past events replay with real API data</div>
              <div style={{ marginTop: 6, color: "rgba(255,165,0,0.8)", fontStyle: "italic" }}>
                Flow paths and zones are pre-computed from the DEM — they show where terrain channels water.
              </div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ color: "#00ddff", fontWeight: 600, marginBottom: 6 }}>🌿 Sustainability Outcomes</div>
              <div>• Identifies flood-prone campus roads & buildings</div>
              <div>• Guides drainage investment priorities</div>
              <div>• Locates rainwater harvesting sites</div>
              <div>• Supports BIM-GIS digital twin integration</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "absolute", right: 24, bottom: 30, display: "flex", flexDirection: "column", gap: 10, zIndex: 10 }}>
        <div
          style={{
            background: "rgba(4,8,18,0.92)",
            padding: "12px 14px",
            borderRadius: 14,
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(0,180,255,0.18)",
            minWidth: 215,
          }}
        >
          <div style={{ ...lbl, marginBottom: 8 }}>🗺 Accumulation Zones</div>
          {[1, 2, 3, 4].map((lvl) => {
            const active = cls.level >= lvl;
            return (
              <div
                key={lvl}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 5,
                  padding: "4px 7px",
                  borderRadius: 6,
                  background: active ? `${ZONE_COLORS[lvl]}20` : "transparent",
                  border: `1px solid ${active ? `${ZONE_COLORS[lvl]}50` : "transparent"}`,
                  transition: "all 0.4s",
                }}
              >
                <div
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 2,
                    flexShrink: 0,
                    background: ZONE_COLORS[lvl],
                    opacity: active ? 1 : 0.3,
                    boxShadow: active ? `0 0 5px ${ZONE_COLORS[lvl]}` : "none",
                    transition: "all 0.4s",
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: active ? ZONE_COLORS[lvl] : "rgba(255,255,255,0.35)",
                    fontWeight: active ? 600 : 400,
                    transition: "all 0.4s",
                  }}
                >
                  {ZONE_LABELS[lvl]}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            background: "rgba(4,8,18,0.9)",
            padding: "12px 14px",
            borderRadius: 14,
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(0,180,255,0.18)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ ...lbl, marginBottom: 0 }}>📡 NUST Now</div>
            {liveStatus?.fetchedAt && (
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)" }}>{fmtTime(liveStatus.fetchedAt.toISOString())}</div>
            )}
          </div>
          {!liveStatus ? (
            <div style={dim}>Fetching…</div>
          ) : (
            (() => {
              const lc = classifyRainfall(liveStatus.rain);
              return (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.68)", lineHeight: 2 }}>
                  {liveStatus.temp !== null && (
                    <div>🌡 {liveStatus.temp.toFixed(1)}°C · 💧 {liveStatus.humidity}% RH</div>
                  )}
                  <div>☁️ {weatherDesc(liveStatus.weatherCode)}</div>
                  <div>🌧 {liveStatus.rain.toFixed(1)} mm/hr</div>
                  <div style={{ color: lc.color, fontWeight: 700 }}>● {lc.label}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>Open-Meteo</div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
