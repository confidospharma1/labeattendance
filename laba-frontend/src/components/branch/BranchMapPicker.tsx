'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  Maximize2,
  Minimize2,
  Layers,
  Search,
  Check,
  Loader2,
  MapPin,
  Compass,
} from 'lucide-react';
import { findAndhraCoordinates } from '@/lib/geoData';

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
  className?: string;
}

// Controller component that fly-pans the map when coordinates change externally
function MapPanController({
  latitude,
  longitude,
  triggerCount,
}: {
  latitude: number;
  longitude: number;
  triggerCount: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (latitude && longitude && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 14), {
        duration: 1.2,
      });
    }
  }, [latitude, longitude, triggerCount, map]);

  return null;
}

// Resizes Leaflet tiles whenever fullscreen is toggled
function MapResizeInvalidator({ isMaximized }: { isMaximized: boolean }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [isMaximized, map]);

  return null;
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
      map.flyTo(e.latlng, map.getZoom(), { duration: 0.8 });
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
            const pos = marker.getLatLng();
            onChange({ latitude: pos.lat, longitude: pos.lng });
          },
        }}
      />
      <Circle
        center={position}
        radius={radius}
        pathOptions={{
          color: '#2563EB',
          fillColor: '#3B82F6',
          fillOpacity: 0.18,
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
  className = '',
}: BranchMapPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [mapLayer, setMapLayer] = useState<'satellite' | 'streets'>('satellite');
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [triggerCount, setTriggerCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCurrentLocation = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        onChange({ latitude: lat, longitude: lng });
        setTriggerCount((c) => c + 1);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        alert(`Could not fetch current location: ${err.message}. Please allow location permissions in your browser.`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const match = findAndhraCoordinates(searchQuery);
    if (match) {
      onChange({ latitude: match.latitude, longitude: match.longitude });
      setTriggerCount((c) => c + 1);
    } else {
      // Direct Nominatim geocoding for specific Andhra Pradesh landmarks or streets
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery + ', Andhra Pradesh, India'
        )}&limit=1`
      )
        .then((res) => res.json())
        .then((results) => {
          if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            onChange({ latitude: lat, longitude: lon });
            setTriggerCount((c) => c + 1);
          } else {
            alert(`No location found for "${searchQuery}". Try typing "Kurnool", "Nandyal", "Kadapa", etc.`);
          }
        })
        .catch(() => {
          alert('Location search failed. Please select directly on the map or type district name.');
        });
    }
  };

  if (!mounted) {
    return (
      <div className="w-full h-64 bg-[#F0EFEB] rounded-xl flex items-center justify-center text-xs text-[#737373]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span>Loading map environment...</span>
      </div>
    );
  }

  const validLat = typeof latitude === 'number' && !Number.isNaN(latitude) ? latitude : 15.8281; // Default Kurnool
  const validLng = typeof longitude === 'number' && !Number.isNaN(longitude) ? longitude : 78.0373;
  const center: [number, number] = [validLat, validLng];

  // Map Tile URLs:
  // Google Satellite Hybrid (Google Satellite + Roads/Labels):
  const googleHybridUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
  // Google Standard Roadmap:
  const googleStreetsUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

  return (
    <div
      className={
        isMaximized
          ? 'fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col p-2 sm:p-5 animate-in fade-in duration-150'
          : `relative w-full rounded-xl overflow-hidden border border-[#E5E5E5] shadow-xs ${className}`
      }
    >
      {/* Maximize container wrap */}
      <div
        className={
          isMaximized
            ? 'w-full h-full bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[#CCCCCC]'
            : 'w-full h-72 relative flex flex-col'
        }
      >
        {/* Floating Controls Bar */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Search Bar on Map */}
          <form
            onSubmit={handleSearchSubmit}
            className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-[#E5E5E5] px-2 py-1 text-xs"
          >
            <Search className="w-3.5 h-3.5 text-[#737373] mr-1.5 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search Kurnool, Kadapa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-32 sm:w-48 bg-transparent text-[#171717] focus:outline-none placeholder:text-[#737373] text-xs"
            />
            <button
              type="submit"
              className="bg-[#171717] hover:bg-black text-white px-2 py-0.5 rounded text-[10px] font-medium ml-1 transition-colors"
            >
              Go
            </button>
          </form>

          {/* Action Pills */}
          <div className="pointer-events-auto flex items-center space-x-1.5 bg-white/95 backdrop-blur-sm p-1 rounded-lg shadow-md border border-[#E5E5E5]">
            {/* Satellite / Streets Toggle */}
            <div className="flex rounded-md p-0.5 bg-[#F0EFEB] text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setMapLayer('satellite')}
                className={`px-2 py-1 rounded transition-all flex items-center space-x-1 ${
                  mapLayer === 'satellite'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <span>🛰️ Satellite</span>
              </button>
              <button
                type="button"
                onClick={() => setMapLayer('streets')}
                className={`px-2 py-1 rounded transition-all flex items-center space-x-1 ${
                  mapLayer === 'streets'
                    ? 'bg-[#171717] text-white shadow-xs font-semibold'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <span>🗺️ Roadmap</span>
              </button>
            </div>

            {/* Current Location Button */}
            <button
              type="button"
              onClick={handleCurrentLocation}
              disabled={locating}
              className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
              title="Detect and mark my current GPS location"
            >
              {locating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5 fill-current" />
              )}
              <span className="hidden sm:inline">{locating ? 'Locating...' : 'My Location'}</span>
            </button>

            {/* Maximize / Minimize Button */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-[#171717] hover:bg-[#F0EFEB] rounded transition-colors"
              title={isMaximized ? 'Minimize Map' : 'Maximize Map Fullscreen'}
            >
              {isMaximized ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Map Canvas */}
        <div className="w-full flex-1 relative">
          <MapContainer
            center={center}
            zoom={15}
            scrollWheelZoom={true}
            className="w-full h-full min-h-[260px]"
          >
            {mapLayer === 'satellite' ? (
              <TileLayer
                url={googleHybridUrl}
                attribution='&copy; Google Maps Satellite'
                maxZoom={20}
                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
              />
            ) : (
              <TileLayer
                url={googleStreetsUrl}
                attribution='&copy; Google Maps Roadmap'
                maxZoom={20}
                subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
              />
            )}

            <LocationMarker position={center} radius={radiusMetres} onChange={onChange} />
            <MapPanController
              latitude={validLat}
              longitude={validLng}
              triggerCount={triggerCount}
            />
            <MapResizeInvalidator isMaximized={isMaximized} />
          </MapContainer>
        </div>

        {/* Bottom Status / Instructions Bar */}
        <div className="bg-[#F7F6F2] border-t border-[#E5E5E5] px-3 py-2 flex items-center justify-between text-[11px] text-[#737373]">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>
              Click or drag the pin to set boundary • Radius: <strong className="text-blue-700">{radiusMetres}m</strong>
            </span>
          </div>
          <div className="font-mono text-[#171717] font-medium hidden xs:block">
            {validLat.toFixed(6)}°, {validLng.toFixed(6)}°
          </div>
          {isMaximized && (
            <button
              type="button"
              onClick={() => setIsMaximized(false)}
              className="px-3 py-1 bg-[#171717] text-white rounded text-xs font-semibold hover:bg-black transition-colors"
            >
              Done / Select Location
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
