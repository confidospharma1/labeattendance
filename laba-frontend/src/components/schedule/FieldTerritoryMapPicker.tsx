'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap, Popup } from 'react-leaflet';
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
  X,
  Sparkles,
} from 'lucide-react';
import { findTerritory, AP_VILLAGES_MANDALS } from '@/lib/geoData';

// Fix for default Leaflet marker icon paths under Webpack/Next.js bundler
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface FieldTerritoryMapPickerProps {
  initialLocationName?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  initialRadiusMetres?: number;
  dayName?: string;
  onConfirm: (location: {
    locationName: string;
    latitude: number;
    longitude: number;
    boundaryRadius: number;
  }) => void;
  onCancel: () => void;
}

// Controller component that fly-pans and bounds the entire village / mandal territory
function MapTerritoryBoundsController({
  latitude,
  longitude,
  radiusMetres,
  triggerCount,
}: {
  latitude: number;
  longitude: number;
  radiusMetres: number;
  triggerCount: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (latitude && longitude && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      // Calculate bounding box for the entire territory radius
      const center = L.latLng(latitude, longitude);
      const bounds = center.toBounds(radiusMetres * 2.2);
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 14,
        animate: true,
        duration: 1.2,
      });
    }
  }, [latitude, longitude, radiusMetres, triggerCount, map]);

  return null;
}

// Invalidates map size when maximized / restored
function MapResizeInvalidator({ isMaximized }: { isMaximized: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [isMaximized, map]);

  return null;
}

// Interactive map marker & boundary events
function TerritoryBoundaryMarker({
  position,
  radius,
  locationName,
  onChange,
}: {
  position: [number, number];
  radius: number;
  locationName: string;
  onChange: (coords: { latitude: number; longitude: number }) => void;
}) {
  const map = useMapEvents({
    click(e) {
      onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng });
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
      >
        <Popup>
          <div className="text-xs p-1">
            <strong className="text-red-700 block font-bold">{locationName || 'Village Center'}</strong>
            <span className="text-zinc-600">
              Whole Village Territory Boundary: ~{(radius / 1000).toFixed(0)} km coverage.
            </span>
          </div>
        </Popup>
      </Marker>

      {/* Prominent Red-Dashed Boundary Circle (Matches Google Maps Boundary) */}
      <Circle
        center={position}
        radius={radius}
        pathOptions={{
          color: '#DC2626', // Red boundary line
          dashArray: '8, 8', // Dashed border
          weight: 2.5,
          fillColor: '#EF4444',
          fillOpacity: 0.12,
        }}
      />
    </>
  );
}

export default function FieldTerritoryMapPicker({
  initialLocationName = 'Chagalamarri',
  initialLatitude = 14.9645,
  initialLongitude = 78.5891,
  initialRadiusMetres = 6000,
  dayName = 'Monday',
  onConfirm,
  onCancel,
}: FieldTerritoryMapPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [mapLayer, setMapLayer] = useState<'satellite' | 'streets'>('satellite');
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);

  const [locationName, setLocationName] = useState(initialLocationName);
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [radiusMetres, setRadiusMetres] = useState(initialRadiusMetres);
  const [searchQuery, setSearchQuery] = useState(initialLocationName);
  const [triggerCount, setTriggerCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Center coordinates
  const validLat = typeof latitude === 'number' && !Number.isNaN(latitude) ? latitude : 14.9645;
  const validLng = typeof longitude === 'number' && !Number.isNaN(longitude) ? longitude : 78.5891;
  const center: [number, number] = [validLat, validLng];

  // Navigate and bound territory
  const navigateToTerritory = (query: string) => {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    setSearching(true);

    const match = findTerritory(cleanQuery);
    if (match) {
      setLocationName(match.name);
      setLatitude(match.latitude);
      setLongitude(match.longitude);
      setRadiusMetres(match.boundaryRadius || 6000);
      setTriggerCount((c) => c + 1);
      setSearching(false);
      return;
    }

    // Direct Nominatim geocoding for any Andhra Pradesh village/mandal/district
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        cleanQuery + ', Andhra Pradesh, India'
      )}&limit=1`
    )
      .then((res) => res.json())
      .then((results) => {
        setSearching(false);
        if (results && results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          // Extract display name or use query
          const detectedName = results[0].display_name.split(',')[0] || cleanQuery;
          setLocationName(detectedName);
          setLatitude(lat);
          setLongitude(lon);
          setRadiusMetres(6000); // 6km village default
          setTriggerCount((c) => c + 1);
        } else {
          alert(`No village or district found for "${cleanQuery}". Try typing "Chagalamarri", "Allagadda", "Kurnool", etc.`);
        }
      })
      .catch(() => {
        setSearching(false);
        alert('Location search failed. You can click directly on the map or pick from preset villages.');
      });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToTerritory(searchQuery);
  };

  const handleSelectPreset = (villageName: string) => {
    setSearchQuery(villageName);
    navigateToTerritory(villageName);
  };

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
        setLatitude(lat);
        setLongitude(lng);
        setLocationName('My Current Location Territory');
        setRadiusMetres(6000);
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

  const handleConfirm = () => {
    onConfirm({
      locationName: locationName || 'Authorized Village Territory',
      latitude,
      longitude,
      boundaryRadius: radiusMetres,
    });
  };

  // Google Satellite Hybrid & Google Streets
  const googleHybridUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
  const googleStreetsUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

  if (!mounted) {
    return (
      <div className="w-full h-96 bg-[#F0EFEB] rounded-xl flex items-center justify-center text-xs text-[#737373]">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#171717]" />
        <span>Loading Territory Map...</span>
      </div>
    );
  }

  return (
    <div
      className={
        isMaximized
          ? 'fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex flex-col p-2 sm:p-4 animate-in fade-in duration-150'
          : 'relative w-full rounded-xl overflow-hidden border border-[#E5E5E5] shadow-lg flex flex-col bg-white'
      }
    >
      {/* Top Header */}
      <div className="p-3 bg-white border-b border-[#E5E5E5] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[#171717]">
              Map Territory Boundary Picker &bull; <span className="text-red-600">{dayName}</span>
            </h4>
            <p className="text-[11px] text-[#737373]">
              Enter village, mandal, or district to navigate and bound the entire territory.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setIsMaximized((m) => !m)}
            className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F0EFEB] rounded transition-colors"
            title={isMaximized ? 'Restore Map Window' : 'Maximize Map Window'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-[#737373] hover:text-[#171717] hover:bg-[#F0EFEB] rounded transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Map Container */}
      <div className={`relative w-full ${isMaximized ? 'flex-1' : 'h-[360px] sm:h-[420px]'}`}>
        {/* Floating Top Search & Control Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex flex-col gap-2 pointer-events-none">
          {/* Search bar & Layers */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Search Input */}
            <form
              onSubmit={handleSearchSubmit}
              className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-[#E5E5E5] px-2.5 py-1.5 text-xs flex-1 max-w-md"
            >
              <Search className="w-4 h-4 text-[#737373] mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Enter village, mandal, or district (e.g. Chagalamarri, Allagadda, Kurnool)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[#171717] focus:outline-none placeholder:text-[#737373] text-xs font-medium"
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded text-[11px] font-semibold ml-1.5 transition-colors shrink-0 flex items-center space-x-1"
              >
                {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                <span>Navigate & Bound</span>
              </button>
            </form>

            {/* Quick Map Controls (Satellite / Street / Current Location) */}
            <div className="pointer-events-auto flex items-center space-x-1.5 bg-white/95 backdrop-blur-sm p-1 rounded-lg shadow-md border border-[#E5E5E5]">
              {/* Satellite vs Streets */}
              <div className="flex rounded-md p-0.5 bg-[#F0EFEB] text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setMapLayer('satellite')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    mapLayer === 'satellite'
                      ? 'bg-white text-[#171717] shadow-xs font-semibold'
                      : 'text-[#737373] hover:text-[#171717]'
                  }`}
                >
                  Satellite
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayer('streets')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    mapLayer === 'streets'
                      ? 'bg-white text-[#171717] shadow-xs font-semibold'
                      : 'text-[#737373] hover:text-[#171717]'
                  }`}
                >
                  Streets
                </button>
              </div>

              {/* My Location */}
              <button
                type="button"
                onClick={handleCurrentLocation}
                disabled={locating}
                className="inline-flex items-center space-x-1 px-2 py-1 bg-white hover:bg-[#F0EFEB] text-[#171717] rounded text-[11px] font-medium border border-[#E5E5E5] transition-colors"
                title="Use Current Location"
              >
                {locating ? <Loader2 className="w-3 h-3 animate-spin text-blue-600" /> : <Navigation className="w-3 h-3 text-blue-600" />}
                <span className="hidden sm:inline">My GPS</span>
              </button>
            </div>
          </div>

          {/* Quick Village Presets Ribbon */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-sm p-1.5 rounded-lg shadow-md border border-[#E5E5E5] max-w-full overflow-x-auto">
            <span className="text-[10px] text-[#737373] font-semibold px-1">Quick Bound:</span>
            {['Chagalamarri', 'Allagadda', 'Koilkuntla', 'Banaganapalle', 'Sirvel', 'Nandyal', 'Dhone', 'Kurnool', 'Kadapa', 'Proddatur'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleSelectPreset(v)}
                className={`px-2 py-0.5 text-[10px] rounded-full border transition-all ${
                  locationName.toLowerCase() === v.toLowerCase()
                    ? 'bg-red-600 text-white border-red-600 font-bold shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Leaflet Map */}
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom={true}
          className="w-full h-full z-0"
        >
          {mapLayer === 'satellite' ? (
            <TileLayer
              attribution="Google Satellite Hybrid"
              url={googleHybridUrl}
              maxZoom={20}
            />
          ) : (
            <TileLayer
              attribution="Google Maps Standard"
              url={googleStreetsUrl}
              maxZoom={20}
            />
          )}

          <MapTerritoryBoundsController
            latitude={latitude}
            longitude={longitude}
            radiusMetres={radiusMetres}
            triggerCount={triggerCount}
          />

          <MapResizeInvalidator isMaximized={isMaximized} />

          <TerritoryBoundaryMarker
            position={[latitude, longitude]}
            radius={radiusMetres}
            locationName={locationName}
            onChange={(coords) => {
              setLatitude(coords.latitude);
              setLongitude(coords.longitude);
            }}
          />
        </MapContainer>

        {/* Floating Legend / Radius adjustment */}
        <div className="absolute bottom-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur-sm p-2 rounded-lg shadow-md border border-[#E5E5E5] text-[11px] space-y-1">
          <div className="font-semibold text-[#171717] flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-red-600 bg-red-400/40 inline-block" />
            <span>Red Dotted Line: Full Territory Boundary</span>
          </div>
          <div className="flex items-center space-x-1 text-[10px] text-[#737373]">
            <span>Boundary Radius:</span>
            {[4000, 6000, 8000, 10000].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadiusMetres(r)}
                className={`px-1.5 py-0.5 rounded border ${
                  radiusMetres === r
                    ? 'bg-red-600 text-white border-red-600 font-bold'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-zinc-200'
                }`}
              >
                {r / 1000}km
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Confirmation Bar */}
      <div className="p-3 bg-[#F9F9F8] border-t border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div className="text-xs">
          <div className="font-bold text-[#171717] flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-red-600 shrink-0" />
            <span>Bounded Territory: {locationName}</span>
          </div>
          <div className="text-[11px] text-[#737373] pl-5.5">
            Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)} &bull; Boundary: ~{(radiusMetres / 1000).toFixed(0)} km (Attendance accepted anywhere within boundary)
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 border border-[#E5E5E5] text-[#737373] hover:text-[#171717] rounded text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm {locationName || 'Village'} Location</span>
          </button>
        </div>
      </div>
    </div>
  );
}
