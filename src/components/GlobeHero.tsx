"use client";

import { useEffect, useRef, useState } from "react";

export default function GlobeHero() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    let map: any = null;
    let rafId: number;

    const init = async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      await import("maplibre-gl/dist/maplibre-gl.css");

      if (!mapContainer.current || mapRef.current) return;

      map = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/dark",
        center: [40, 15],
        // SIZE INCREASE: Bumped from 0.45 to 0.6 to fill more of the circular frame
        zoom: 0.6, 
        pitch: 0,
        bearing: 0,
        projection: { name: "globe" },
        interactive: false,
        attributionControl: false,
      } as any);

      mapRef.current = map;

      map.on("style.load", () => {
        if (map.getLayer("background")) {
          map.setPaintProperty("background", "background-color", "#050709");
        }
        map.setLight({
          anchor: "viewport",
          color: "#BDE8F5",
          intensity: 0.15,
        });
      });

      map.on("load", () => {
        let lon = 40;
        // SPEED ADJUSTMENT: Reduced rotation total to 180 degrees 
        // and increased STEP to 1.8 for a much faster spin-to-land transition.
        const SPIN_DEG = 180; 
        const STEP = 1.8; 
        let spun = 0;

        const spin = () => {
          if (!mapRef.current) return;
          lon = (lon + STEP) % 360;
          const normalised = lon > 180 ? lon - 360 : lon;
          mapRef.current.setCenter([normalised, 15]);
          spun += STEP;
          
          if (spun < SPIN_DEG) {
            rafId = requestAnimationFrame(spin);
          } else {
            // Cinematic fly-in to NUST
            setTimeout(() => {
              mapRef.current?.flyTo({
                center: [72.9899, 33.6434],
                zoom: 15.8,
                pitch: 55,
                bearing: -10,
                duration: 2500, // Slightly faster landing (down from 3500)
                essential: true,
                curve: 1.5,
                speed: 1.5,
              });
              setTimeout(() => setArrived(true), 2600);
            }, 150);
          }
        };

        setTimeout(spin, 500); // Start spin slightly sooner
      });
    };

    init();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* ── Circular globe container ── */}
      <div
        className="relative overflow-hidden"
        style={{
          // Increased size range slightly to match the zoom increase
          width:  "clamp(380px, 65vh, 720px)",
          height: "clamp(380px, 65vh, 720px)",
          borderRadius: "50%",
          boxShadow: `
            0 0 0 1px rgba(73,136,196,0.18),
            0 0 60px  rgba(73,136,196,0.12),
            0 0 120px rgba(73,136,196,0.08)
          `,
        }}
      >
        <div
          ref={mapContainer}
          className="absolute"
          style={{
            inset: "-2%", /* Reduced bleed since zoom is higher */
            width: "104%",
            height: "104%",
          }}
        />

        {/* Radial vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 50%, transparent 60%, #050709 90%)",
          }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            borderRadius: "50%",
            backgroundImage: `
              linear-gradient(rgba(73,136,196,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(73,136,196,1) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Ambient glow behind */}
      <div
        className="absolute pointer-events-none"
        style={{
          width:  "clamp(420px, 70vh, 760px)",
          height: "clamp(420px, 70vh, 760px)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(73,136,196,0.08) 0%, transparent 70%)",
          zIndex: -1,
        }}
      />

      {/* NUST label */}
      <div
        className="absolute bottom-12 right-8 flex flex-col items-end gap-2 transition-all duration-1000 ease-out"
        style={{
          opacity: arrived ? 1 : 0,
          transform: arrived ? "translateX(0)" : "translateX(20px)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-[#BDE8F5]">
              NUST · H-12 · Islamabad
            </span>
            <span className="text-[9px] tracking-[0.2em] text-[#4988C4]/70">
              33.6434° N · 72.9899° E
            </span>
          </div>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4988C4] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#BDE8F5]" />
          </span>
        </div>
        <div className="h-[1px] w-32 bg-gradient-to-l from-[#4988C4] to-transparent opacity-40" />
      </div>
    </div>
  );
}