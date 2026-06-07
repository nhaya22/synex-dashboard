"use client";

import { useState } from "react";

export default function Dashboard() {
  const [activeView, setActiveView] = useState("unity");
  const [layers, setLayers] = useState({
    water: false,
    solar: false,
    sensors: true,
  });

  const toggleLayer = (layer: keyof typeof layers) => {
  setLayers({ ...layers, [layer]: !layers[layer] });
  };

  return (
    <div className="flex h-screen">

      {/* 🟩 SIDEBAR */}
      <div className="w-64 bg-gray-900 text-white p-5">
        <h1 className="text-2xl font-bold mb-6">SYNEX</h1>

        <ul className="space-y-4">
          <li className="cursor-pointer hover:text-blue-400"
              onClick={() => setActiveView("unity")}>
            🏢 Digital Twin
          </li>

          <li className="cursor-pointer hover:text-blue-400"
              onClick={() => setActiveView("map")}>
            🗺️ Map View
          </li>

          <li className="cursor-pointer hover:text-blue-400">
            📊 Analytics
          </li>
        </ul>
      </div>

      {/* 🟦 MAIN CONTENT */}
      <div className="flex-1 bg-gray-100 p-4">

        {/* 🔵 TOP CONTROLS */}
        <div className="bg-white p-4 rounded-xl shadow mb-4 flex gap-4">

          <button
            onClick={() => toggleLayer("water")}
            className={`px-4 py-2 rounded ${
              layers.water ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            💧 Water Simulation
          </button>

          <button
            onClick={() => toggleLayer("solar")}
            className={`px-4 py-2 rounded ${
              layers.solar ? "bg-yellow-500 text-white" : "bg-gray-200"
            }`}
          >
            ☀️ Solar Layer
          </button>

          <button
            onClick={() => toggleLayer("sensors")}
            className={`px-4 py-2 rounded ${
              layers.sensors ? "bg-green-600 text-white" : "bg-gray-200"
            }`}
          >
            📡 Sensors
          </button>
        </div>

        {/* 🟪 VIEW AREA */}
        <div className="bg-white h-[80%] rounded-xl shadow flex items-center justify-center">

          {activeView === "unity" ? (
            <iframe
              src="http://localhost:3001" // 👉 your Unity WebGL build URL
              className="w-full h-full rounded-xl"
            />
          ) : (
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Map View</h2>
              <p>Mapbox / Terrain will appear here</p>

              {/* 👇 Debug Layer State */}
              <div className="mt-4 text-sm text-gray-600">
                <p>Water: {layers.water ? "ON" : "OFF"}</p>
                <p>Solar: {layers.solar ? "ON" : "OFF"}</p>
                <p>Sensors: {layers.sensors ? "ON" : "OFF"}</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}