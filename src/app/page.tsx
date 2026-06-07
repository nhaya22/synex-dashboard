"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import GlobeHero from "@/components/GlobeHero"; // ← adjust path to match your project

/* ─── Animated Counter ─────────────────────────────────────────── */
function Counter({ from = 0, to, suffix = "", duration = 2 }: { from?: number; to: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(from);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / (duration * 1000), 1);
      setCount(Math.floor(progress * (to - from) + from));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, from, to, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─── Noise Texture SVG ─────────────────────────────────────────── */
function NoiseOverlay() {
  return (
    <svg className="pointer-events-none fixed inset-0 z-[999] opacity-[0.03] w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)"/>
    </svg>
  );
}

/* ─── Animated Grid Lines ──────────────────────────────────────── */
function GridLines() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div style={{
        backgroundImage: `linear-gradient(rgba(73,136,196,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(73,136,196,0.04) 1px, transparent 1px)`,
        backgroundSize: "80px 80px",
        width: "100%", height: "100%",
      }}/>
    </div>
  );
}

/* ─── Platform module definitions ───────────────────────────────── */
const PLATFORM_ITEMS = [
  {
    href: "/unity/index.html",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
    label: "Digital Twin",
    sub: "Unity 3D walkthrough + live IoT",
    color: "text-[#4988C4]",
    dot: "bg-[#4988C4]",
  },
  {
    href: "/dashboard/water-simulation",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
    ),
    label: "Water Simulation",
    sub: "DSM terrain flow & drainage",
    color: "text-[#1C4D8D]",
    dot: "bg-[#1C4D8D]",
  },
  {
    href: "/dashboard/solar-analysis",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    ),
    label: "Solar Analysis",
    sub: "3D solar potential + GIS layers",
    color: "text-[#0F2854]",
    dot: "bg-[#0F2854]",
  },
];

/* ─── Reusable Platform Dropdown ────────────────────────────────── */
function PlatformDropdown({
  trigger,
  align = "right",
}: {
  trigger: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const alignClass =
    align === "left" ? "left-0"
    : align === "center" ? "left-1/2 -translate-x-1/2"
    : "right-0";

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(v => !v)} className="cursor-pointer">
        {trigger}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`absolute ${alignClass} top-full mt-3 z-[60] w-64 rounded-2xl border border-white/10 bg-[#0d1117]/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden`}
          >
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-[10px] tracking-[0.25em] uppercase text-slate-500">Select Module</p>
            </div>
            {PLATFORM_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                <div className="group flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors border-b border-white/4 last:border-0">
                  <div className={`${item.color} p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors flex-shrink-0`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-tight">{item.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.sub}</p>
                  </div>
                  <div className={`w-1.5 h-1.5 rounded-full ${item.dot} flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity`}/>
                </div>
              </Link>
            ))}
            <div className="px-4 py-2.5 bg-white/2">
              <p className="text-[10px] text-slate-600 tracking-wide">3 modules available</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Smooth scroll helper ──────────────────────────────────────── */
function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ─── Nav link → section id map ────────────────────────────────── */
const NAV_LINKS: { label: string; id: string }[] = [
  { label: "Overview", id: "overview" },
  { label: "Features", id: "features" },
  { label: "Analysis", id: "analysis" },
  { label: "Platform", id: "platform" },
];

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function Home() {
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroY = useTransform(scrollY, [0, 500], [0, 80]);

  return (
    <main className="bg-[#050709] text-white font-[system-ui] antialiased selection:bg-[#4988C4]/30">
      <NoiseOverlay />

      {/* ── NAV ───────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-5 flex items-center justify-between border-b border-white/5 bg-[#050709]/80 backdrop-blur-xl">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 -ml-4 group"
        >
          <div className="relative h-16 w-16 flex items-center justify-center">
            <img src="/synex-logo.png" alt="Synex Logo" className="h-full w-full object-contain scale-180" />
          </div>
          <span className="text-xl font-bold tracking-widest uppercase text-white">SYNEX</span>
        </button>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ label, id }) => (
            <button
              key={label}
              onClick={() => scrollTo(id)}
              className="text-xs tracking-widest uppercase text-slate-400 hover:text-white transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <PlatformDropdown
          align="right"
          trigger={
            <button className="hidden md:flex items-center gap-2 text-xs tracking-widest uppercase bg-[#1C4D8D]/20 hover:bg-[#1C4D8D]/40 border border-[#4988C4]/30 text-[#BDE8F5] px-4 py-2 rounded-full transition-all">
              Launch Platform
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
          }
        />
      </nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      {/*
        CHANGED: Hero is now a two-column layout on large screens.
        Left col: existing text content (unchanged)
        Right col: GlobeHero fills the full viewport height
      */}
      <section className="relative min-h-screen overflow-hidden">
        <GridLines />

        {/* Ambient glows — repositioned to left half only */}
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-[#4988C4]/6 blur-[120px] pointer-events-none"/>
        <div className="absolute bottom-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-[#1C4D8D]/10 blur-[100px] pointer-events-none"/>

        {/* Two-column grid */}
        <div className="relative grid lg:grid-cols-2 min-h-screen">

          {/* ── LEFT: Text content ── */}
          <motion.div
            style={{ opacity: heroOpacity, y: heroY }}
            className="relative z-10 flex flex-col justify-center px-8 md:px-16 lg:px-24 pt-28 pb-20"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
              className="flex items-center gap-3 mb-8"
            >
              <div className="h-px w-8 bg-[#4988C4]"/>
              <span className="text-[#4988C4] text-[11px] tracking-[0.3em] uppercase">Smart Campus Infrastructure</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 1 }}
              className="leading-[0.9] tracking-tight mb-8"
            >
              <div className="text-[clamp(3rem,7vw,7rem)]">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] via-[#1C4D8D] to-[#BDE8F5] font-semibold">
                  SYNEX
                </span>
              </div>
              <div className="text-[clamp(1.2rem,2.5vw,2.2rem)] font-extralight text-slate-300 mt-2">
                Synergetic Nexus
              </div>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.8 }}
              className="text-slate-400 text-lg max-w-xl leading-relaxed mb-10"
            >
              Integrating IoT sensing, BIM models, and GIS data into a unified spatial intelligence platform for next-generation campus management.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
              className="flex gap-4 items-center"
            >
              <Link href="/3d-campus-viewer">
                <button
                  className="text-sm tracking-widest uppercase text-[#BDE8F5] hover:text-white border border-[#4988C4]/30 hover:border-[#4988C4]/60 px-6 py-4 rounded-full transition-all"
                >
                  3D Campus Viewer
                </button>
              </Link>
            </motion.div>
          </motion.div>

          {/* ── RIGHT: Globe ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 1.2 }}
            className="relative hidden lg:block"
            style={{ minHeight: "100vh" }}
          >
            {/* Subtle inner border on left edge to separate columns */}
            <div className="absolute left-0 top-16 bottom-16 w-px bg-gradient-to-b from-transparent via-[#4988C4]/15 to-transparent pointer-events-none z-10"/>

            <GlobeHero />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer z-20"
          onClick={() => scrollTo("overview")}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-slate-600">Scroll</span>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent"/>
        </motion.div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/2 py-10 px-8 md:px-24">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-8">
          {[
            { n: 240, suffix: "+", label: "IoT Sensors Deployed" },
            { n: 98, suffix: "%", label: "Uptime Reliability" },
            { n: 12, suffix: "TB", label: "Data Processed" },
          ].map(({ n, suffix, label }) => (
            <div key={label} className="text-center">
              <p className="text-4xl font-extralight text-white mb-1">
                <Counter to={n} suffix={suffix}/>
              </p>
              <p className="text-[11px] tracking-widest uppercase text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── OVERVIEW ──────────────────────────────────────────── */}
      <motion.section
        id="overview"
        initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}
        className="py-32 px-8 md:px-24 relative overflow-hidden scroll-mt-20"
      >
        <GridLines/>
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-8 bg-[#4988C4]"/>
              <span className="text-[#4988C4] text-[11px] tracking-[0.3em] uppercase">Platform Overview</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-extralight leading-tight mb-8">
              Bridging Physical<br/><span className="text-slate-300">&amp; Digital Worlds</span>
            </h2>
            <p className="text-slate-400 leading-relaxed mb-6 text-base">
              SYNEX integrates IoT sensing modules with BIM–GIS models through a centralized data pipeline powered by Python APIs and PostgreSQL — transforming raw signals into actionable intelligence.
            </p>
            <p className="text-slate-400 leading-relaxed text-base mb-10">
              From water flow simulations to solar potential mapping, every data stream converges into a single pane of truth for sustainable campus operations.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {["Real-time ingestion", "Predictive analytics", "3D visualization", "Automated alerts"].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500 flex-shrink-0"/>{f}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-[#4988C4]/5 rounded-2xl blur-xl"/>
            <div className="relative rounded-2xl border border-white/8 bg-white/2 backdrop-blur-sm p-8 overflow-hidden">
              <p className="text-[10px] tracking-[0.3em] uppercase text-slate-500 mb-6">System Architecture</p>
              <div className="mt-6 p-3 rounded-lg border border-white/5 bg-white/2">
                <img src="/synex-diagram.png" className="rounded-md w-full opacity-80 hover:opacity-100 transition-opacity" alt="SYNEX Architecture"/>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── CORE FEATURES ─────────────────────────────────────── */}
      <motion.section
        id="features"
        initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}
        className="py-32 px-8 md:px-24 border-t border-white/5 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-[#4988C4]"/>
            <span className="text-[#4988C4] text-[11px] tracking-[0.3em] uppercase">Core Capabilities</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extralight mb-20">What SYNEX Delivers</h2>

          <div className="grid md:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden">
            {[
              {
                icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>),
                title: "Real-Time Monitoring",
                desc: "Live telemetry from 240+ IoT nodes covering air quality, power consumption, water flow, and occupancy — all visualized on a sub-second dashboard.",
                stat: "< 500ms latency",
              },
              {
                icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>),
                title: "3D Digital Twin",
                desc: "Interactive Unity-based BIM visualization with live data overlay. Navigate, inspect, and analyze every building component in photorealistic 3D space.",
                stat: "Full BIM fidelity",
              },
              {
                icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>),
                title: "Unified Dashboard",
                desc: "Toggle between GIS layers, sensor heatmaps, energy flows, and predictive alerts — all from a single, role-based web interface.",
                stat: "Multi-layer GIS",
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                className="group bg-[#050709] p-8 hover:bg-white/3 transition-all duration-500"
              >
                <div className="text-[#4988C4] mb-6 p-3 bg-[#4988C4]/10 rounded-xl w-fit group-hover:bg-[#4988C4]/20 transition-colors">
                  {card.icon}
                </div>
                <h3 className="text-lg font-medium mb-3 text-white">{card.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">{card.desc}</p>
                <div className="text-[11px] tracking-widest uppercase text-[#4988C4]/70 border-t border-white/5 pt-4">
                  {card.stat}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── ADVANCED ANALYSIS ─────────────────────────────────── */}
      <motion.section
        id="analysis"
        initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}
        className="py-32 px-8 md:px-24 relative overflow-hidden scroll-mt-20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F2854]/10 to-[#1C4D8D]/5 pointer-events-none"/>
        <GridLines/>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-[#4988C4]"/>
            <span className="text-[#4988C4] text-[11px] tracking-[0.3em] uppercase">Advanced Analysis</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extralight mb-20">Simulation Modules</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                href: "/dashboard/water-simulation",
                label: "Water Simulation",
                emoji: "💧",
                desc: "Terrain-based water flow modeling using DSM elevation data and real-time rainfall. Identify drainage risks and model flood scenarios before they happen.",
                tags: ["Rainfall modeling", "Flood risk", "DSM elevation"],
                color: "from-[#1C4D8D]/30 to-transparent",
                border: "border-[#4988C4]/20",
                accent: "text-[#BDE8F5]",
                btnColor: "bg-[#1C4D8D]/20 hover:bg-[#1C4D8D]/40 border-[#4988C4]/30 text-[#BDE8F5]",
              },
              {
                href: "/dashboard/solar-analysis",
                label: "Solar Mapping",
                emoji: "☀️",
                desc: "Building-level solar irradiance visualization using 3D BIM geometry and seasonal sun-path data. Optimize PV panel placement for maximum generation.",
                tags: ["Irradiance calc", "PV optimization", "Seasonal analysis"],
                color: "from-[#0F2854]/30 to-transparent",
                border: "border-[#1C4D8D]/20",
                accent: "text-[#4988C4]",
                btnColor: "bg-[#0F2854]/20 hover:bg-[#0F2854]/40 border-[#1C4D8D]/30 text-[#4988C4]",
              },
            ].map(item => (
              <motion.div
                key={item.label}
                whileHover={{ y: -4 }} transition={{ duration: 0.3 }}
                className={`relative rounded-2xl border ${item.border} bg-gradient-to-br ${item.color} bg-white/2 p-8 overflow-hidden flex flex-col`}
              >
                <div className="text-4xl mb-4">{item.emoji}</div>
                <h3 className={`text-xl font-medium mb-4 ${item.accent}`}>{item.label}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-1">{item.desc}</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {item.tags.map(t => (
                    <span key={t} className="text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-slate-500">{t}</span>
                  ))}
                </div>
                <Link href={item.href}>
                  <button className={`flex items-center gap-2 text-xs tracking-widest uppercase border px-4 py-2.5 rounded-full transition-all ${item.btnColor}`}>
                    Open Module
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── PLATFORM MODULES ──────────────────────────────────── */}
      <motion.section
        id="platform"
        initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}
        className="py-32 px-8 md:px-24 border-t border-white/5 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-[#4988C4]"/>
            <span className="text-[#4988C4] text-[11px] tracking-[0.3em] uppercase">Platform Modules</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extralight mb-4">
            Three Modules,<br/>One Platform
          </h2>
          <p className="text-slate-400 text-sm mb-16 max-w-xl">
            Each module is purpose-built for a specific layer of spatial intelligence — choose where to start, or run them in parallel.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {PLATFORM_ITEMS.map((item, i) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }} viewport={{ once: true }}
                whileHover={{ y: -6 }}
                className="group"
              >
                <Link href={item.href}>
                  <div className="rounded-2xl border border-white/8 bg-white/2 hover:bg-white/4 hover:border-white/15 p-8 transition-all duration-400 cursor-pointer h-full flex flex-col">
                    <div className={`${item.color} mb-6 p-3 bg-[#4988C4]/5 group-hover:bg-[#4988C4]/10 rounded-xl w-fit transition-colors`}>
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">{item.label}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed flex-1">{item.sub}</p>
                    <div className="mt-6 flex items-center gap-2 text-[11px] tracking-widest uppercase text-[#4988C4] opacity-0 group-hover:opacity-100 transition-opacity">
                      Open
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── KEY TAKEAWAYS ─────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}
        className="py-32 px-8 md:px-24 border-t border-white/5"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-8 bg-[#4988C4]"/>
            <span className="text-[#4988C4] text-[11px] tracking-[0.3em] uppercase">Key Takeaways</span>
          </div>
          <div className="grid md:grid-cols-3 gap-16 mt-16">
            {[
              { n: "01", title: "Unified IoT + BIM + GIS", body: "All data streams — physical sensors, geometric models, spatial layers — converge in one intelligent platform." },
              { n: "02", title: "Real-time → Insights", body: "From raw millisecond telemetry to executive-level dashboards, SYNEX closes the gap between data and decision." },
              { n: "03", title: "Simulation-Driven", body: "Water, solar, and energy simulations let campus managers act on predictive intelligence, not reactive reports." },
            ].map(item => (
              <div key={item.n}>
                <span className="text-[4rem] font-extralight text-white/5 leading-none block mb-4">{item.n}</span>
                <h3 className="text-lg font-medium text-white mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── CTA FOOTER ────────────────────────────────────────── */}
      <footer className="relative border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F2854]/15 to-transparent pointer-events-none"/>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-px bg-gradient-to-r from-transparent via-[#4988C4]/40 to-transparent"/>

        <div className="relative max-w-7xl mx-auto px-8 md:px-24 py-32 text-center">
          <div className="flex items-center gap-3 justify-center mb-6">
            <div className="h-px w-8 bg-sky-500"/>
            <span className="text-sky-400 text-[11px] tracking-[0.3em] uppercase">Ready to deploy</span>
            <div className="h-px w-8 bg-sky-500"/>
          </div>

          <h2 className="text-4xl md:text-6xl font-extralight mb-6">
            Explore the<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4988C4] to-[#BDE8F5]">
              SYNEX Platform
            </span>
          </h2>

          <p className="text-slate-400 text-sm mb-12 max-w-md mx-auto leading-relaxed">
            Choose a module to begin — Digital Twin, Water Simulation, or Solar Analysis.
          </p>

          <div className="flex justify-center">
            <PlatformDropdown
              align="center"
              trigger={
                <button className="group inline-flex items-center gap-3 bg-[#1C4D8D] hover:bg-[#4988C4] text-white px-10 py-5 rounded-full text-sm tracking-widest uppercase transition-all shadow-[0_0_60px_rgba(73,136,196,0.4)] hover:shadow-[0_0_80px_rgba(73,136,196,0.6)]">
                  Launch Dashboard
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
              }
            />
          </div>
        </div>

        <div className="border-t border-white/5 px-8 md:px-24 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            {/* <div className="w-5 h-5 rounded bg-[#4988C4] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="white" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div> */}
            <span className="text-xs tracking-widest uppercase text-slate-500">SYNEX Digital Twin</span>
          </div>
          <p className="text-[11px] text-slate-600 tracking-wider">© 2026 · Smart Campus Intelligence Platform</p>
        </div>
      </footer>
    </main>
  );
}
