'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for default Leaflet icon paths under Webpack/Next.js bundler
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface BranchMapPickerProps {
  latitude: number;
  longitude: number;
  radiusMetres: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
}

function LocationMarker({
  position,
  radius,
  onChange,
}: {
  position: [number, number];
  radius: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
}) {
  const map = useMapEvents({
    click(e) {
      onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng });
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return (
    <>
      <Marker
        position={position}
        icon={markerIcon}
        draggable={true}
        eventHandlers={{
          dragend: (e) => {
            const marker = e.target;
            const position = marker.getLatLng();
            onChange({ latitude: position.lat, longitude: position.lng });
          },
        }}
      />
      <Circle
        center={position}
        radius={radius}
        pathOptions={{
          color: '#2563EB',
          fillColor: '#3B82F6',
          fillOpacity: 0.15,
          weight: 2,
        }}
      />
    </>
  );
}

export default function BranchMapPicker({
  latitude,
  longitude,
  radiusMetres,
  onChange,
}: BranchMapPickerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-64 bg-[#F0EFEB] rounded flex items-center justify-center text-xs text-[#737373]">
        Loading map picker...
      </div>
    );
  }

  const center: [number, number] = [latitude || 14.4673, longitude || 78.8242]; // Default: Kadapa, AP

  return (
    <div className="w-full h-64 rounded overflow-hidden border border-[#E5E5E5] relative z-0">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker
          position={center}
          radius={radiusMetres}
          onChange={onChange}
        />
      </MapContainer>
      <div className="absolute bottom-2 left-2 z-[400] bg-white/90 backdrop-blur px-2.5 py-1 rounded text-[10px] text-[#171717] border border-[#E5E5E5] shadow-sm">
        Click or drag marker to set coordinates
      </div>
    </div>
  );
}

