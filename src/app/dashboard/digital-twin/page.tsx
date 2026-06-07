"use client";

import { useEffect, useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SensorData {
  indoor_aq: { temperature: number; humidity: number; co2?: number };
  outdoor_aq: { pm_1: number; pm_2_0: number; pm_10: number };
  water_flow: { flow_rate: number };
  power: { voltage: number; current: number; power: number };
}

// ─── Gauge Component ──────────────────────────────────────────────────────────
function RadialGauge({
  value, max, label, unit, color, size = 110,
}: {
  value: number; max: number; label: string; unit: string; color: string; size?: number;
}) {
  const pct = Math.min(value / max, 1);
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const startAngle = -220;
  const sweepAngle = 260;
  const arcPath = (angle: number) => {
    const rad = toRad(startAngle + angle);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const end = arcPath(sweepAngle * pct);
  const trackEnd = arcPath(sweepAngle);
  const largeArc = sweepAngle * pct > 180 ? 1 : 0;
  const trackLarge = sweepAngle > 180 ? 1 : 0;
  const startPt = arcPath(0);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size}>
        <path d={`M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${trackLarge} 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
        {pct > 0 && (
          <path d={`M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
            fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        )}
        <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="'DM Mono', monospace">
          {typeof value === "number" ? value.toFixed(1) : "--"}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="'DM Mono', monospace">
          {unit}
        </text>
      </svg>
      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase" as const, fontFamily: "'DM Mono', monospace", marginTop: "-4px" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const w = 120;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={w} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ title, value, unit, color, history, icon }: {
  title: string; value: number | string; unit: string; color: string; history?: number[]; icon: string;
}) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column" as const, gap: "6px", position: "relative" as const, overflow: "hidden" }}>
      <div style={{ position: "absolute" as const, top: 0, left: 0, width: "3px", height: "100%", background: color, borderRadius: "12px 0 0 12px", boxShadow: `0 0 10px ${color}` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>{title}</span>
        <span style={{ fontSize: "16px" }}>{icon}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
        <span style={{ fontSize: "26px", fontWeight: "700", color, fontFamily: "'DM Mono', monospace", lineHeight: 1, textShadow: `0 0 20px ${color}60` }}>
          {typeof value === "number" ? value.toFixed(1) : value}
        </span>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: "'DM Mono', monospace" }}>{unit}</span>
      </div>
      {history && history.length > 1 && (
        <div style={{ marginTop: "4px", opacity: 0.7 }}><Sparkline data={history} color={color} /></div>
      )}
    </div>
  );
}

// ─── PM Bar ───────────────────────────────────────────────────────────────────
function PMBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>{label}</span>
        <span style={{ fontSize: "10px", color, fontFamily: "'DM Mono', monospace" }}>{value} µg/m³</span>
      </div>
      <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "4px", boxShadow: `0 0 8px ${color}`, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ ok, label }: { ok: boolean; label: string }) {
  const c = ok ? "#00ff88" : "#ff5050";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: ok ? "rgba(0,255,136,0.08)" : "rgba(255,80,80,0.1)", border: `1px solid ${ok ? "rgba(0,255,136,0.25)" : "rgba(255,80,80,0.3)"}`, borderRadius: "20px", padding: "2px 8px", fontSize: "9px", letterSpacing: "0.12em", color: c, fontFamily: "'DM Mono', monospace" }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}`, animation: "pulse 2s infinite" }} />
      {label}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, accent }: { title: string; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
      <div style={{ width: "3px", height: "14px", background: accent, borderRadius: "2px", boxShadow: `0 0 8px ${accent}` }} />
      <span style={{ fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.45)", fontFamily: "'DM Mono', monospace" }}>{title}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<Record<string, number[]>>({ temp: [], humidity: [], flow: [], power: [] });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://192.168.187.150:5000/data");
        const json: SensorData = await res.json();
        setData(json);
        setConnected(true);
        setLastUpdated(new Date());
        setHistory((prev) => ({
          temp: [...prev.temp.slice(-19), json.indoor_aq.temperature],
          humidity: [...prev.humidity.slice(-19), json.indoor_aq.humidity],
          flow: [...prev.flow.slice(-19), json.water_flow.flow_rate],
          power: [...prev.power.slice(-19), json.power.power],
        }));
      } catch {
        setConnected(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const d = data;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow: hidden; height: 100%; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      <div style={{ display: "grid", gridTemplateRows: "48px 1fr", height: "100vh", width: "100vw", background: "#080c14", color: "white", overflow: "hidden" }}>

        {/* TOP BAR */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)", backdropFilter: "blur(10px)", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "18px", letterSpacing: "0.05em", background: "linear-gradient(90deg, #00ff88, #00c8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              SYNEX
            </span>
            <span style={{ fontSize: "9px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase", borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "12px", fontFamily: "'DM Mono', monospace" }}>
              Campus Digital Twin
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Pill ok={connected} label={connected ? "LIVE" : "OFFLINE"} />
            {lastUpdated && (
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono', monospace" }}>
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* BODY */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 260px", overflow: "hidden" }}>

          {/* LEFT */}
          <div style={{ padding: "14px 12px", borderRight: "1px solid rgba(255,255,255,0.05)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px", background: "rgba(0,0,0,0.25)", animation: "fadeIn 0.5s ease" }}>

            <div>
              <SectionHeader title="Indoor Air Quality" accent="#00ff88" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", justifyItems: "center", background: "rgba(255,255,255,0.02)", borderRadius: "12px", padding: "12px 8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <RadialGauge value={d?.indoor_aq.temperature ?? 0} max={50} label="Temp" unit="°C" color="#00ff88" />
                <RadialGauge value={d?.indoor_aq.humidity ?? 0} max={100} label="Humidity" unit="%" color="#00c8ff" />
              </div>
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <StatCard title="Temperature" value={d?.indoor_aq.temperature ?? 0} unit="°C" color="#00ff88" history={history.temp} icon="🌡️" />
                <StatCard title="Humidity" value={d?.indoor_aq.humidity ?? 0} unit="%" color="#00c8ff" history={history.humidity} icon="💧" />
              </div>
            </div>

            <div>
              <SectionHeader title="Outdoor Air Quality" accent="#f59e0b" />
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: "12px", padding: "14px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <PMBar label="PM 1.0" value={d?.outdoor_aq.pm_1 ?? 0} max={100} color="#f59e0b" />
                <PMBar label="PM 2.5" value={d?.outdoor_aq.pm_2_0 ?? 0} max={150} color="#fb923c" />
                <PMBar label="PM 10" value={d?.outdoor_aq.pm_10 ?? 0} max={200} color="#ef4444" />
              </div>
            </div>
          </div>

          {/* UNITY CENTER */}
          <div style={{ position: "relative", overflow: "hidden" }}>
            {/* corner labels */}
            <div style={{ position: "absolute", top: "10px", left: "12px", zIndex: 5, fontSize: "8px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.18)", fontFamily: "'DM Mono', monospace" }}>CAMPUS MODEL</div>
            <div style={{ position: "absolute", top: "10px", right: "12px", zIndex: 5, fontSize: "8px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.18)", fontFamily: "'DM Mono', monospace" }}>DIGITAL TWIN</div>

            <iframe
              ref={iframeRef}
              src="/unity/index.html"
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              tabIndex={0}
              allow="fullscreen; autoplay"
              onLoad={() => iframeRef.current?.focus()}
              onClick={() => iframeRef.current?.focus()}
            />

            {/* HUD Overlay */}
            <div style={{ position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px", zIndex: 5 }}>
              {[
                { label: "FLOW", value: d?.water_flow.flow_rate, unit: "L/m", color: "#38bdf8" },
                { label: "PWR", value: d?.power.power, unit: "W", color: "#a78bfa" },
                { label: "VOLT", value: d?.power.voltage, unit: "V", color: "#f472b6" },
                { label: "AMP", value: d?.power.current, unit: "A", color: "#fb923c" },
              ].map(({ label, value, unit, color }) => (
                <div key={label} style={{ background: "rgba(8,12,20,0.88)", backdropFilter: "blur(12px)", border: `1px solid ${color}28`, borderRadius: "8px", padding: "6px 14px", display: "flex", flexDirection: "column" as const, alignItems: "center", minWidth: "70px" }}>
                  <span style={{ fontSize: "8px", letterSpacing: "0.15em", color: "rgba(255,255,255,0.28)", fontFamily: "'DM Mono', monospace" }}>{label}</span>
                  <span style={{ fontSize: "17px", fontWeight: "700", color, textShadow: `0 0 12px ${color}80`, fontFamily: "'DM Mono', monospace" }}>
                    {typeof value === "number" ? value.toFixed(1) : "--"}
                  </span>
                  <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono', monospace" }}>{unit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ padding: "14px 12px", borderLeft: "1px solid rgba(255,255,255,0.05)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px", background: "rgba(0,0,0,0.25)", animation: "fadeIn 0.5s ease 0.1s both" }}>

            <div>
              <SectionHeader title="Water Flow" accent="#38bdf8" />
              <StatCard title="Flow Rate" value={d?.water_flow.flow_rate ?? 0} unit="L/min" color="#38bdf8" history={history.flow} icon="🌊" />
              <div style={{ marginTop: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", padding: "12px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "center" }}>
                <RadialGauge value={d?.water_flow.flow_rate ?? 0} max={50} label="Flow" unit="L/min" color="#38bdf8" size={120} />
              </div>
            </div>

            <div>
              <SectionHeader title="Power" accent="#a78bfa" />
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <StatCard title="Power" value={d?.power.power ?? 0} unit="W" color="#a78bfa" history={history.power} icon="⚡" />
                <StatCard title="Voltage" value={d?.power.voltage ?? 0} unit="V" color="#f472b6" icon="🔌" />
                <StatCard title="Current" value={d?.power.current ?? 0} unit="A" color="#fb923c" icon="〰️" />
              </div>
              <div style={{ marginTop: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", padding: "12px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-around" }}>
                <RadialGauge value={d?.power.voltage ?? 0} max={250} label="Voltage" unit="V" color="#f472b6" />
                <RadialGauge value={d?.power.current ?? 0} max={20} label="Current" unit="A" color="#fb923c" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}