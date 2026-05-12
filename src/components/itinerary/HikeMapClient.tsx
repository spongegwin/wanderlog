"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import type { HikeWaypoint } from "@/lib/types";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet's default icon path issue with bundlers
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const breakIcon = L.divIcon({
  className: "",
  html: `<div style="background:#f59e0b;border-radius:50%;width:10px;height:10px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const waypointIcon = (index: number, isLast: boolean) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${isLast ? "#10b981" : "#6366f1"};border-radius:50%;width:20px;height:20px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;font-family:monospace">${index + 1}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [24, 24] });
    } else if (positions.length === 1) {
      map.setView(positions[0], 13);
    }
  }, [map, positions]);
  return null;
}

interface HikeMapClientProps {
  waypoints: HikeWaypoint[];
}

export default function HikeMapClient({ waypoints }: HikeMapClientProps) {
  const withCoords = waypoints.filter((wp) => wp.lat != null && wp.lon != null);
  const positions = withCoords.map((wp) => [wp.lat!, wp.lon!] as [number, number]);
  const routePositions = withCoords.filter((wp) => !wp.is_break).map((wp) => [wp.lat!, wp.lon!] as [number, number]);

  const center = positions.length > 0 ? positions[0] : ([33.4, -118.4] as [number, number]);

  let waypointIdx = 0;

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: "260px", width: "100%", borderRadius: "8px" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds positions={positions} />

      {routePositions.length > 1 && (
        <Polyline positions={routePositions} color="#6366f1" weight={3} opacity={0.8} />
      )}

      {withCoords.map((wp, i) => {
        const pos: [number, number] = [wp.lat!, wp.lon!];
        if (wp.is_break) {
          return (
            <Marker key={i} position={pos} icon={breakIcon}>
              <Popup>
                <div className="text-xs">
                  <span className="font-medium">☕ {wp.location}</span>
                  {wp.duration && <div className="text-gray-500">{wp.duration}</div>}
                </div>
              </Popup>
            </Marker>
          );
        }
        const idx = waypointIdx++;
        const isLast = idx === withCoords.filter((w) => !w.is_break).length - 1;
        return (
          <Marker key={i} position={pos} icon={waypointIcon(idx, isLast)}>
            <Popup>
              <div className="text-xs space-y-0.5">
                <div className="font-semibold">{wp.location}</div>
                {wp.elevation_ft != null && <div className="text-gray-500">{wp.elevation_ft.toLocaleString()} ft</div>}
                {wp.time && <div className="font-mono text-gray-500">{wp.time}</div>}
                {wp.escape && <div className="text-amber-600">↪ {wp.escape}</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
