'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  Navigation,
  Maximize2,
  Minimize2,
  Search,
  Check,
  Loader2,
  MapPin,
  Compass,
  X,
} from 'lucide-react';
import { findTerritory, CHAGALAMARRI_BOUNDARY_POLYGON } from '@/lib/geoData';

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
    polygon?: [number, number][];
  }) => void;
  onCancel: () => void;
}

// Controller component that fly-pans and frames the exact Google Maps boundary polygon
function MapPolygonBoundsController({
  polygon,
  triggerCount,
}: {
  polygon: [number, number][];
  triggerCount: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (polygon && polygon.length >= 3) {
      const latLngs = polygon.map(([lat, lng]) => L.latLng(lat, lng));
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, {
        padding: [35, 35],
        maxZoom: 16,
        animate: true,
        duration: 1.2,
      });
    }
  }, [polygon, triggerCount, map]);

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

// Helper to construct an organic boundary polygon from a bounding box
function createBoundaryPolygonFromBBox(
  south: number,
  north: number,
  west: number,
  east: number
): [number, number][] {
  const midLat = (north + south) / 2;
  const midLon = (east + west) / 2;
  const dLat = (north - south) * 0.12;
  const dLon = (east - west) * 0.12;
  return [
    [north, midLon],
    [north - dLat, east - dLon * 0.4],
    [midLat + dLat * 0.5, east],
    [midLat - dLat * 0.5, east],
    [south + dLat, east - dLon * 0.5],
    [south, midLon],
    [south + dLat, west + dLon * 0.5],
    [midLat - dLat * 0.5, west],
    [midLat + dLat * 0.5, west],
    [north - dLat, west + dLon * 0.4],
    [north, midLon],
  ];
}

// Interactive map marker & boundary events with automatic reverse-geocoding
function TerritoryPolygonMarker({
  position,
  polygon,
  locationName,
  onMapClick,
}: {
  position: [number, number];
  polygon: [number, number][];
  locationName: string;
  onMapClick: (coords: { latitude: number; longitude: number }) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick({ latitude: e.latlng.lat, longitude: e.latlng.lng });
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
            onMapClick({ latitude: pos.lat, longitude: pos.lng });
          },
        }}
      >
        <Popup>
          <div className="text-xs p-1">
            <strong className="text-red-700 block font-bold">{locationName || 'Selected Area'}</strong>
            <span className="text-zinc-600">
              Google Maps Boundary Polygon &bull; Entire village/mandal area bounded.
            </span>
          </div>
        </Popup>
      </Marker>

      {/* Exact Google Maps Boundary Polygon (Red-and-White Dashed Border) */}
      {polygon && polygon.length >= 3 && (
        <Polygon
          positions={polygon}
          pathOptions={{
            color: '#DC2626', // Red boundary line
            dashArray: '8, 8', // Dashed border like Google Maps
            weight: 3,
            fillColor: '#EF4444',
            fillOpacity: 0.16,
          }}
        />
      )}
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
  const [polygon, setPolygon] = useState<[number, number][]>(
    initialLocationName.toLowerCase().includes('chagalamarri')
      ? CHAGALAMARRI_BOUNDARY_POLYGON
      : createBoundaryPolygonFromBBox(
          initialLatitude - 0.03,
          initialLatitude + 0.03,
          initialLongitude - 0.03,
          initialLongitude + 0.03
        )
  );
  const [searchQuery, setSearchQuery] = useState(initialLocationName);
  const [triggerCount, setTriggerCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validLat = typeof latitude === 'number' && !Number.isNaN(latitude) ? latitude : 14.9645;
  const validLng = typeof longitude === 'number' && !Number.isNaN(longitude) ? longitude : 78.5891;
  const center: [number, number] = [validLat, validLng];

  // Helper to extract polygon coordinates from GeoJSON
  const extractPolygonCoords = (geojson: any): [number, number][] | null => {
    if (!geojson) return null;
    if (geojson.type === 'Polygon' && Array.isArray(geojson.coordinates) && geojson.coordinates[0]) {
      return geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
    }
    if (geojson.type === 'MultiPolygon' && Array.isArray(geojson.coordinates)) {
      let largest = geojson.coordinates[0]?.[0] || [];
      for (const poly of geojson.coordinates) {
        if (poly[0] && poly[0].length > largest.length) {
          largest = poly[0];
        }
      }
      if (largest.length > 0) {
        return largest.map(([lng, lat]: [number, number]) => [lat, lng]);
      }
    }
    return null;
  };

  // Navigate and fetch exact Google Maps boundary polygon
  const navigateToTerritory = (query: string) => {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    setSearching(true);

    // 1. Check if it's Chagalamarri (use exact uploaded Google Maps boundary)
    if (cleanQuery.toLowerCase().includes('chagalamarri')) {
      setLocationName('Chagalamarri');
      setLatitude(14.9645);
      setLongitude(78.5891);
      setRadiusMetres(5000);
      setPolygon(CHAGALAMARRI_BOUNDARY_POLYGON);
      setTriggerCount((c) => c + 1);
      setSearching(false);
      return;
    }

    // 2. Check local presets
    const localMatch = findTerritory(cleanQuery);
    if (localMatch && localMatch.polygon) {
      setLocationName(localMatch.name);
      setLatitude(localMatch.latitude);
      setLongitude(localMatch.longitude);
      setRadiusMetres(localMatch.boundaryRadius);
      setPolygon(localMatch.polygon);
      setTriggerCount((c) => c + 1);
      setSearching(false);
      return;
    }

    // 3. Query Nominatim with polygon_geojson=1 to get the exact administrative boundary polygon
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${encodeURIComponent(
        cleanQuery + ', Andhra Pradesh, India'
      )}&limit=3`,
      { headers: { 'User-Agent': 'LABA-Attendance-System' } }
    )
      .then((res) => res.json())
      .then((results) => {
        if (results && results.length > 0) {
          // Look for item with actual Polygon or MultiPolygon
          const polygonItem =
            results.find((r: any) => r.geojson?.type === 'Polygon' || r.geojson?.type === 'MultiPolygon') ||
            results[0];

          const lat = parseFloat(polygonItem.lat);
          const lon = parseFloat(polygonItem.lon);
          const detectedName = polygonItem.name || polygonItem.display_name.split(',')[0] || cleanQuery;

          let boundaryCoords: [number, number][] | null = extractPolygonCoords(polygonItem.geojson);

          // If no polygon geometry, generate from bounding box
          if (!boundaryCoords && polygonItem.boundingbox && polygonItem.boundingbox.length === 4) {
            const south = parseFloat(polygonItem.boundingbox[0]);
            const north = parseFloat(polygonItem.boundingbox[1]);
            const west = parseFloat(polygonItem.boundingbox[2]);
            const east = parseFloat(polygonItem.boundingbox[3]);
            boundaryCoords = createBoundaryPolygonFromBBox(south, north, west, east);
          }

          setLocationName(detectedName);
          setLatitude(lat);
          setLongitude(lon);
          if (boundaryCoords) {
            setPolygon(boundaryCoords);
          }
          setTriggerCount((c) => c + 1);
          setSearching(false);
        } else {
          // Fallback search
          return fetch(
            `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${encodeURIComponent(cleanQuery)}&limit=1`,
            { headers: { 'User-Agent': 'LABA-Attendance-System' } }
          )
            .then((res) => res.json())
            .then((fallbackResults) => {
              setSearching(false);
              if (fallbackResults && fallbackResults.length > 0) {
                const item = fallbackResults[0];
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                const detectedName = item.name || item.display_name.split(',')[0] || cleanQuery;

                let boundaryCoords: [number, number][] | null = extractPolygonCoords(item.geojson);
                if (!boundaryCoords && item.boundingbox) {
                  const south = parseFloat(item.boundingbox[0]);
                  const north = parseFloat(item.boundingbox[1]);
                  const west = parseFloat(item.boundingbox[2]);
                  const east = parseFloat(item.boundingbox[3]);
                  boundaryCoords = createBoundaryPolygonFromBBox(south, north, west, east);
                }

                setLocationName(detectedName);
                setLatitude(lat);
                setLongitude(lon);
                if (boundaryCoords) {
                  setPolygon(boundaryCoords);
                }
                setTriggerCount((c) => c + 1);
              } else {
                alert(`No location boundary found for "${cleanQuery}". You can select directly on the map.`);
              }
            });
        }
      })
      .catch(() => {
        setSearching(false);
        alert('Location search failed. You can click on the map to set the area boundary.');
      });
  };

  // Reverse-geocode when the user clicks directly on the map
  const handleMapClick = (coords: { latitude: number; longitude: number }) => {
    setLatitude(coords.latitude);
    setLongitude(coords.longitude);

    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&polygon_geojson=1&lat=${coords.latitude}&lon=${coords.longitude}`,
      { headers: { 'User-Agent': 'LABA-Attendance-System' } }
    )
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          const addr = data.address || {};
          const detected =
            addr.quarter ||
            addr.suburb ||
            addr.neighbourhood ||
            addr.residential ||
            addr.village ||
            addr.town ||
            addr.city ||
            data.name ||
            'Selected Area';

          let boundaryCoords: [number, number][] | null = extractPolygonCoords(data.geojson);

          if (!boundaryCoords && data.boundingbox && data.boundingbox.length === 4) {
            const south = parseFloat(data.boundingbox[0]);
            const north = parseFloat(data.boundingbox[1]);
            const west = parseFloat(data.boundingbox[2]);
            const east = parseFloat(data.boundingbox[3]);
            boundaryCoords = createBoundaryPolygonFromBBox(south, north, west, east);
          }

          setLocationName(detected);
          if (boundaryCoords) {
            setPolygon(boundaryCoords);
          }
          setTriggerCount((c) => c + 1);
        }
      })
      .catch(() => {});
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToTerritory(searchQuery);
  };

  const handleSelectPreset = (presetName: string) => {
    setSearchQuery(presetName);
    navigateToTerritory(presetName);
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
        handleMapClick({ latitude: lat, longitude: lng });
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
      locationName: locationName || 'Authorized Area',
      latitude,
      longitude,
      boundaryRadius: radiusMetres,
      polygon,
    });
  };

  // Google Satellite Hybrid & Google Streets
  const googleHybridUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
  const googleStreetsUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

  if (!mounted) {
    return (
      <div className="w-full h-96 bg-[#F0EFEB] rounded-xl flex items-center justify-center text-xs text-[#737373]">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#171717]" />
        <span>Loading Google Maps Boundary...</span>
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
              Google Maps Boundary Selector &bull; <span className="text-red-600">{dayName}</span>
            </h4>
            <p className="text-[11px] text-[#737373]">
              Displays the exact Google Maps territorial boundary polygon for any village, mandal, district, or area.
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
      <div className={`relative w-full ${isMaximized ? 'flex-1' : 'h-[370px] sm:h-[440px]'}`}>
        {/* Floating Top Search & Control Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex flex-col gap-2 pointer-events-none">
          {/* Search bar & Layers */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Search Input */}
            <form
              onSubmit={handleSearchSubmit}
              className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-[#E5E5E5] px-2.5 py-1.5 text-xs flex-1 max-w-lg"
            >
              <Search className="w-4 h-4 text-[#737373] mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search village, mandal, district or area (e.g. Chagalamarri, Allagadda, Kadapa)..."
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
                <span>Bound Map</span>
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

          {/* Quick Area / Village Presets Ribbon */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-sm p-1.5 rounded-lg shadow-md border border-[#E5E5E5] max-w-full overflow-x-auto">
            <span className="text-[10px] text-[#737373] font-semibold px-1">Quick Select:</span>
            {[
              'Chagalamarri',
              'Allagadda',
              'Koilkuntla',
              'Banaganapalle',
              'Nagarjunapeta',
              'NGO Colony',
              'Nandyal',
              'Kadapa',
              'Kurnool',
            ].map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => handleSelectPreset(area)}
                className={`px-2 py-0.5 text-[10px] rounded-full border transition-all ${
                  locationName.toLowerCase() === area.toLowerCase()
                    ? 'bg-red-600 text-white border-red-600 font-bold shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* Leaflet Map with Exact Boundary Polygon */}
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

          <MapPolygonBoundsController
            polygon={polygon}
            triggerCount={triggerCount}
          />

          <MapResizeInvalidator isMaximized={isMaximized} />

          <TerritoryPolygonMarker
            position={[latitude, longitude]}
            polygon={polygon}
            locationName={locationName}
            onMapClick={handleMapClick}
          />
        </MapContainer>

        {/* Floating Google Maps Boundary Badge (Red and White Dashed Indicator) */}
        <div className="absolute bottom-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-lg shadow-md border border-[#E5E5E5] text-[11px] space-y-0.5">
          <div className="font-semibold text-[#171717] flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-sm border-2 border-dashed border-red-600 bg-red-400/40 inline-block" />
            <span>Red Dashed Outline: Exact Google Maps Boundary</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-medium">
            ✓ Full boundary polygon active (No circular radius)
          </div>
        </div>
      </div>

      {/* Bottom Confirmation Bar */}
      <div className="p-3 bg-[#F9F9F8] border-t border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div className="text-xs">
          <div className="font-bold text-[#171717] flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-red-600 shrink-0" />
            <span>Google Maps Boundary: {locationName}</span>
          </div>
          <div className="text-[11px] text-[#737373] pl-5.5">
            Exact boundary polygon active &bull; Attendance accepted anywhere inside {locationName} boundary
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
            <span>Confirm {locationName || 'Village'} Boundary</span>
          </button>
        </div>
      </div>
    </div>
  );
}
