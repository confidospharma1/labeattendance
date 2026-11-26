'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polygon, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Search,
  Loader2,
  Navigation,
  Maximize2,
  Minimize2,
  PenLine,
  Undo2,
  Trash2,
  Check,
  Upload,
  Crosshair,
  CircleDot,
  Hexagon,
  Info,
} from 'lucide-react';
import { apiClient, apiErrorMessage } from '@/lib/api';
import { TILES, BOUNDARY_STYLE, CIRCLE_STYLE, MapLayer } from '@/lib/mapTiles';
import {
  BoundaryGeometry,
  FenceValue,
  toLatLngs,
  boundaryCenter,
  countVertices,
  polygonFromPoints,
  parseBoundaryFile,
  polygonsOf,
} from '@/lib/geo';
import { findAndhraCoordinates } from '@/lib/districts';

/** Pin drawn with CSS so no marker images have to be downloaded. */
export const pinIcon = (color = '#DC2626') =>
  L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });

interface BoundaryOption {
  id: string;
  name: string;
  displayName: string;
  kind: string;
  note?: string;
  vertexCount: number;
  center: { latitude: number; longitude: number };
  boundary: BoundaryGeometry;
}

export interface GeofenceEditorProps {
  value: FenceValue;
  onChange: (v: FenceValue) => void;
  allowCircle?: boolean;
  allowPolygon?: boolean;
  maxRadius?: number;
  /** Hint shown in polygon mode, e.g. "Sales executives can mark anywhere inside this area". */
  polygonHint?: string;
  heightClass?: string;
}

function FitTo({ target, nonce }: { target: L.LatLngBoundsExpression | [number, number] | null; nonce: number }) {
  const map = useMap();
  useEffect(() => {
    if (!target || !nonce) return;
    if (Array.isArray(target) && typeof target[0] === 'number') map.flyTo(target as [number, number], Math.max(map.getZoom(), 15), { duration: 0.8 });
    else map.fitBounds(target as L.LatLngBoundsExpression, { padding: [24, 24] });
  }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Resize({ dep }: { dep: unknown }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [dep, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

const boundsOf = (g: BoundaryGeometry): L.LatLngBoundsExpression => {
  const pts: [number, number][] = [];
  for (const poly of polygonsOf(g)) for (const [lng, lat] of poly[0]) pts.push([lat, lng]);
  return L.latLngBounds(pts);
};

export default function GeofenceEditor({
  value,
  onChange,
  allowCircle = true,
  allowPolygon = true,
  maxRadius = 5000,
  polygonHint,
  heightClass = 'h-80',
}: GeofenceEditorProps) {
  const [layer, setLayer] = useState<MapLayer>('satellite');
  const [maximized, setMaximized] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [options, setOptions] = useState<BoundaryOption[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [locating, setLocating] = useState(false);
  const [fit, setFit] = useState<{ target: any; nonce: number }>({ target: null, nonce: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const shape = !allowCircle ? 'POLYGON' : !allowPolygon ? 'CIRCLE' : value.shape;
  const center: [number, number] = [value.latitude || 14.4673, value.longitude || 78.8242];
  const polygonLatLngs = useMemo(() => (value.boundary ? toLatLngs(value.boundary) : null), [value.boundary]);

  const set = (patch: Partial<FenceValue>) => onChange({ ...value, ...patch });
  const flyTo = (target: any) => setFit((f) => ({ target, nonce: f.nonce + 1 }));

  // Fit an existing boundary once when the editor opens
  useEffect(() => {
    if (value.boundary) flyTo(boundsOf(value.boundary));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickBoundary = (b: BoundaryGeometry, label: string | null) => {
    const c = boundaryCenter(b);
    onChange({ ...value, shape: 'POLYGON', boundary: b, boundaryLabel: label, latitude: c.latitude, longitude: c.longitude });
    flyTo(boundsOf(b));
  };

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setMsg(null);
    if (shape === 'CIRCLE') {
      // Pin mode: just move the map / pin to the place
      const local = findAndhraCoordinates(q);
      if (local) {
        set({ latitude: local.latitude, longitude: local.longitude });
        flyTo([local.latitude, local.longitude]);
        return;
      }
    }
    setSearching(true);
    try {
      const res = await apiClient.get(`/geo/boundaries/search?q=${encodeURIComponent(q)}`);
      const list: BoundaryOption[] = res.data.data || [];
      if (shape === 'CIRCLE') {
        if (list[0]) {
          set({ latitude: list[0].center.latitude, longitude: list[0].center.longitude });
          flyTo([list[0].center.latitude, list[0].center.longitude]);
        } else setMsg(`No place found for "${q}".`);
      } else {
        setOptions(list);
        if (!list.length) setMsg(`No mapped boundary found for "${q}". Draw it on the map or import a KML file.`);
      }
    } catch (err) {
      setMsg(apiErrorMessage(err, 'Search failed.'));
    } finally {
      setSearching(false);
    }
  };

  const areasAtPin = async () => {
    setMsg(null);
    setSearching(true);
    try {
      const res = await apiClient.get(`/geo/boundaries/at?lat=${value.latitude}&lng=${value.longitude}`);
      const list: BoundaryOption[] = res.data.data || [];
      setOptions(list);
      if (!list.length) setMsg('No mapped boundaries contain this point. Draw the boundary instead.');
    } catch (err) {
      setMsg(apiErrorMessage(err, 'Lookup failed.'));
    } finally {
      setSearching(false);
    }
  };

  const myLocation = () => {
    if (!navigator.geolocation) return setMsg('This browser cannot read your location.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        if (shape === 'CIRCLE') set({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        flyTo([p.coords.latitude, p.coords.longitude]);
      },
      (e) => {
        setLocating(false);
        setMsg(`Could not read your location: ${e.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const onMapClick = (lat: number, lng: number) => {
    if (drawing) setDraft((d) => [...d, [lat, lng]]);
    else if (shape === 'CIRCLE') set({ latitude: lat, longitude: lng });
  };

  const finishDrawing = () => {
    const poly = polygonFromPoints(draft);
    if (!poly) return setMsg('Add at least 3 points to make a boundary.');
    setDrawing(false);
    setDraft([]);
    pickBoundary(poly, value.boundaryLabel || 'Custom boundary');
  };

  const importFile = async (file: File) => {
    setMsg(null);
    try {
      const { boundary, label } = parseBoundaryFile(await file.text());
      if (countVertices(boundary) > 25000) throw new Error('This boundary has too many points (max 25,000). Simplify it first.');
      pickBoundary(boundary, label || file.name.replace(/\.(kml|geojson|json)$/i, ''));
    } catch (err: any) {
      setMsg(err?.message || 'Could not read the file.');
    }
  };

  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors';

  return (
    <div className={maximized ? 'fixed inset-0 z-[100] bg-black/70 p-2 sm:p-5 flex' : 'relative w-full'}>
      <div className={`${maximized ? 'w-full h-full' : ''} flex flex-col bg-white rounded-xl border border-[#E2E8F0] overflow-hidden`}>
        {/* Toolbar */}
        <div className="p-2 border-b border-[#E2E8F0] space-y-2 bg-[#F8FAFC]">
          <div className="flex flex-wrap items-center gap-1.5">
            {allowCircle && allowPolygon && (
              <div className="flex rounded-lg bg-[#EEF2F7] p-0.5">
                <button
                  type="button"
                  onClick={() => set({ shape: 'CIRCLE' })}
                  className={`${btn} border-transparent ${shape === 'CIRCLE' ? 'bg-blue-600 text-white' : 'text-[#475569]'}`}
                >
                  <CircleDot className="w-3.5 h-3.5" /> Radius
                </button>
                <button
                  type="button"
                  onClick={() => set({ shape: 'POLYGON' })}
                  className={`${btn} border-transparent ${shape === 'POLYGON' ? 'bg-red-600 text-white' : 'text-[#475569]'}`}
                >
                  <Hexagon className="w-3.5 h-3.5" /> Exact boundary
                </button>
              </div>
            )}
            <div className="flex rounded-lg bg-[#EEF2F7] p-0.5 ml-auto">
              {(['satellite', 'streets'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayer(l)}
                  className={`${btn} border-transparent capitalize ${layer === l ? 'bg-brand-700 text-white' : 'text-[#475569]'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button type="button" onClick={myLocation} className={`${btn} border-emerald-200 text-emerald-700 bg-emerald-50`} title="My location">
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            </button>
            <button type="button" onClick={() => setMaximized((m) => !m)} className={`${btn} border-[#E2E8F0] text-ink`} title="Full screen">
              {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Not a <form>: the editor sits inside other forms, and nested forms are invalid HTML */}
          <div className="flex gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 px-2 border border-[#E2E8F0] rounded-lg bg-white">
              <Search className="w-3.5 h-3.5 text-[#64748B]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                placeholder={shape === 'POLYGON' ? 'Search city / village / mandal boundary, e.g. Kadapa' : 'Search a place to move the pin'}
                className="flex-1 py-1.5 text-xs bg-transparent focus:outline-none"
              />
            </div>
            <button type="button" onClick={() => runSearch()} disabled={searching} className={`${btn} border-brand-700 bg-brand-700 text-white`}>
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
            </button>
          </div>

          {shape === 'POLYGON' && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={areasAtPin} className={`${btn} border-[#E2E8F0] text-ink bg-white`}>
                <Crosshair className="w-3.5 h-3.5" /> Boundaries at map centre pin
              </button>
              {!drawing ? (
                <button
                  type="button"
                  onClick={() => {
                    setDrawing(true);
                    setDraft([]);
                    setOptions(null);
                  }}
                  className={`${btn} border-red-200 text-red-700 bg-red-50`}
                >
                  <PenLine className="w-3.5 h-3.5" /> Draw on map
                </button>
              ) : (
                <>
                  <button type="button" onClick={finishDrawing} className={`${btn} border-emerald-600 bg-emerald-600 text-white`}>
                    <Check className="w-3.5 h-3.5" /> Finish ({draft.length} pts)
                  </button>
                  <button type="button" onClick={() => setDraft((d) => d.slice(0, -1))} className={`${btn} border-[#E2E8F0] bg-white`}>
                    <Undo2 className="w-3.5 h-3.5" /> Undo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawing(false);
                      setDraft([]);
                    }}
                    className={`${btn} border-[#E2E8F0] bg-white`}
                  >
                    Cancel
                  </button>
                </>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} className={`${btn} border-[#E2E8F0] text-ink bg-white`}>
                <Upload className="w-3.5 h-3.5" /> Import KML / GeoJSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".kml,.geojson,.json,application/vnd.google-earth.kml+xml,application/geo+json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFile(f);
                  e.target.value = '';
                }}
              />
              {value.boundary && (
                <button
                  type="button"
                  onClick={() => set({ boundary: null, boundaryLabel: null })}
                  className={`${btn} border-[#E2E8F0] text-red-600 bg-white`}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>
          )}

          {options && shape === 'POLYGON' && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white divide-y divide-[#EEF2F7]">
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    pickBoundary(o.boundary, o.name);
                    setOptions(null);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-red-50 text-xs"
                >
                  <div className="font-semibold text-ink">
                    {o.name} <span className="font-normal text-[#64748B]">· {o.kind.replace(/_/g, ' ')}</span>
                    {o.note && <span className="ml-1 text-[10px] text-amber-700">({o.note})</span>}
                  </div>
                  <div className="text-[10px] text-[#64748B] truncate">{o.displayName}</div>
                </button>
              ))}
            </div>
          )}

          {msg && <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">{msg}</div>}
        </div>

        {/* Map */}
        <div className={`${maximized ? 'flex-1' : heightClass} relative`}>
          <MapContainer center={center} zoom={value.boundary ? 13 : 16} scrollWheelZoom className="w-full h-full">
            {layer === 'satellite' ? (
              <>
                <TileLayer url={TILES.satellite.url} attribution={TILES.satellite.attribution} maxZoom={TILES.satellite.maxZoom} />
                <TileLayer url={TILES.labels.url} attribution={TILES.labels.attribution} maxZoom={TILES.labels.maxZoom} />
              </>
            ) : (
              <TileLayer url={TILES.streets.url} attribution={TILES.streets.attribution} maxZoom={TILES.streets.maxZoom} />
            )}
            <ClickHandler onClick={onMapClick} />
            <FitTo target={fit.target} nonce={fit.nonce} />
            <Resize dep={maximized} />

            {shape === 'CIRCLE' && (
              <>
                <Marker
                  position={center}
                  icon={pinIcon('#2563EB')}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const p = (e.target as L.Marker).getLatLng();
                      set({ latitude: p.lat, longitude: p.lng });
                    },
                  }}
                />
                <Circle center={center} radius={value.radiusMetres} pathOptions={CIRCLE_STYLE} />
              </>
            )}

            {shape === 'POLYGON' && polygonLatLngs && <Polygon positions={polygonLatLngs} pathOptions={BOUNDARY_STYLE} />}
            {shape === 'POLYGON' && !drawing && <Marker position={center} icon={pinIcon('#DC2626')} />}
            {drawing && draft.length > 0 && (
              <>
                <Polyline positions={draft.length > 2 ? [...draft, draft[0]] : draft} pathOptions={{ color: '#DC2626', weight: 2, dashArray: '4 4' }} />
                {draft.map((p, i) => (
                  <CircleMarker key={i} center={p} radius={4} pathOptions={{ color: '#fff', weight: 2, fillColor: '#DC2626', fillOpacity: 1 }} />
                ))}
              </>
            )}
          </MapContainer>
          {drawing && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[500] bg-red-600 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow">
              Tap along the boundary line, then press Finish
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-[#E2E8F0] bg-[#F4F6FB] text-[11px] text-[#475569] space-y-1.5">
          {shape === 'CIRCLE' ? (
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap">Radius</span>
              <input
                type="range"
                min={10}
                max={Math.min(maxRadius, 2000)}
                step={10}
                value={Math.min(value.radiusMetres, 2000)}
                onChange={(e) => set({ radiusMetres: Number(e.target.value) })}
                className="flex-1 accent-blue-600"
              />
              <input
                type="number"
                min={10}
                max={maxRadius}
                value={value.radiusMetres}
                onChange={(e) => set({ radiusMetres: Math.max(10, Math.min(maxRadius, Number(e.target.value) || 10)) })}
                className="w-20 px-2 py-1 border border-[#E2E8F0] rounded text-right"
              />
              <span>m</span>
            </div>
          ) : (
            <div className="flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-600" />
              <span>
                {value.boundary ? (
                  <>
                    <strong className="text-ink">{value.boundaryLabel || 'Boundary'}</strong> · {countVertices(value.boundary)} points.{' '}
                    {polygonHint || 'Attendance is accepted anywhere inside this outline.'}
                  </>
                ) : (
                  'Search a place to load its official outline (OpenStreetMap), draw it on the satellite map, or import a KML from Google My Maps / Google Earth.'
                )}
              </span>
            </div>
          )}
          <div className="font-mono text-[10px] text-[#64748B]">
            Pin {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
          </div>
          {maximized && (
            <button type="button" onClick={() => setMaximized(false)} className="w-full py-1.5 rounded-lg bg-brand-700 text-white font-semibold">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
