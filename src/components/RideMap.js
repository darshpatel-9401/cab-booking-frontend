"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const MARKER_COLORS = {
  green: { color: "#166534", fillColor: "#22c55e", fillOpacity: 0.9 },
  red: { color: "#991b1b", fillColor: "#ef4444", fillOpacity: 0.9 },
  indigo: { color: "#3730a3", fillColor: "#6366f1", fillOpacity: 0.9 },
};

function PointMarker({ point, label, tone }) {
  return (
    <CircleMarker
      center={[point.lat, point.lng]}
      radius={10}
      pathOptions={MARKER_COLORS[tone] || MARKER_COLORS.indigo}
    >
      <Tooltip permanent direction="top">
        {label}
      </Tooltip>
    </CircleMarker>
  );
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      if (!onPick) {
        return;
      }
      const point = event.latlng.wrap();
      onPick(point.lat, point.lng);
    },
  });
  return null;
}

// Moves the map when the page hands it a new target ({ points: [[lat, lng], ...] })
function FitTo({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target || target.points.length === 0) {
      return;
    }
    if (target.points.length === 1) {
      map.setView(target.points[0], 15);
    } else {
      map.fitBounds(target.points, { padding: [40, 40] });
    }
  }, [target, map]);

  return null;
}

export default function RideMap({ pickup, drop, markers, onPick, target }) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <FitTo target={target} />

      {pickup && <PointMarker point={pickup} label="Pickup" tone="green" />}
      {drop && <PointMarker point={drop} label="Drop-off" tone="red" />}
      {(markers || []).map((marker) => (
        <PointMarker
          key={marker.label}
          point={marker}
          label={marker.label}
          tone={marker.tone}
        />
      ))}
    </MapContainer>
  );
}