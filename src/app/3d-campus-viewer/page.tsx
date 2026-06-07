"use client";
import dynamic from "next/dynamic";

const CesiumMap = dynamic(() => import("./CesiumMap"), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100vw", height: "100vh", background: "#060a14", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "monospace", fontSize: 14 }}>
      Loading 3D Scene...
    </div>
  ),
});

export default function Home() {
  return <CesiumMap />;
}