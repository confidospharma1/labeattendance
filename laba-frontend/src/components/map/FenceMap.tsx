'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Circle, Polygon, Polyline, Marker, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TILES, BOUNDARY_STYLE, CIRCLE_STYLE, TERRITORY_STYLE, MapLayer } from '@/lib/mapTiles';
import { BoundaryGeometry, isBoundary, polygonsOf, toLatLngs } from '@/lib/geo';

export interface MapFence {
  shape?: string;
  boundary?: BoundaryGeometry | null;
  latitude: number;
  longitude: number;
  radiusMetres: number;
  label?: string;
  territory?: boolean;
}

export interface MapPoint {
  latitude: number;
  longitude: number;
  label?: string;
  color?: string;
}

interface Props {
  fences?: MapFence[];
  me?: { latitude: number; longitude: number; accuracy?: number } | null;
  route?: MapPoint[];
  points?: MapPoint[];
  heightClass?: string;
}

const numberIcon = (n: number, color = '#4338CA') =>
  L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;font:700 12px system-ui;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

function FitAll({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  const key = bounds ? bounds.toBBoxString() : '';
  useEffect(() => {
    if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function FenceMap({ fences = [], me, route = [], points = [], heightClass = 'h-56' }: Props) {
  const [layer, setLayer] = useState<MapLayer>('satellite');

  const bounds = useMemo(() => {
    const pts: L.LatLngExpression[] = [];
    for (const f of fences) {
      if (f.shape === 'POLYGON' && isBoundary(f.boundary)) {
        for (const poly of polygonsOf(f.boundary)) for (const [lng, lat] of poly[0]) pts.push([lat, lng]);
      } else if (Number.isFinite(f.latitude)) {
        const c = L.latLng(f.latitude, f.longitude).toBounds(f.radiusMetres * 2.2);
        pts.push(c.getNorthWest(), c.getSouthEast());
      }
    }
    for (const p of [...route, ...points]) pts.push([p.latitude, p.longitude]);
    if (me) pts.push([me.latitude, me.longitude]);
    return pts.length ? L.latLngBounds(pts) : null;
  }, [fences, route, points, me]);

  const start: [number, number] = me ? [me.latitude, me.longitude] : fences[0] ? [fences[0].latitude, fences[0].longitude] : [14.4673, 78.8242];

  return (
    <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-200`}>
      <MapContainer center={start} zoom={15} scrollWheelZoom={false} className="w-full h-full">
        {layer === 'satellite' ? (
          <>
            <TileLayer url={TILES.satellite.url} attribution={TILES.satellite.attribution} maxZoom={TILES.satellite.maxZoom} />
            <TileLayer url={TILES.labels.url} attribution={TILES.labels.attribution} maxZoom={TILES.labels.maxZoom} />
          </>
        ) : (
          <TileLayer url={TILES.streets.url} attribution={TILES.streets.attribution} maxZoom={TILES.streets.maxZoom} />
        )}
        <FitAll bounds={bounds} />

        {fences.map((f, i) =>
          f.shape === 'POLYGON' && isBoundary(f.boundary) ? (
            <Polygon key={i} positions={toLatLngs(f.boundary)} pathOptions={f.territory ? TERRITORY_STYLE : BOUNDARY_STYLE}>
              {f.label && <Tooltip sticky>{f.label}</Tooltip>}
            </Polygon>
          ) : (
            <Circle key={i} center={[f.latitude, f.longitude]} radius={f.radiusMetres} pathOptions={CIRCLE_STYLE}>
              {f.label && <Tooltip>{f.label}</Tooltip>}
            </Circle>
          )
        )}

        {route.length > 1 && (
          <Polyline positions={route.map((p) => [p.latitude, p.longitude] as [number, number])} pathOptions={{ color: '#4338CA', weight: 3, dashArray: '8 6' }} />
        )}
        {route.map((p, i) => (
          <Marker key={`r${i}`} position={[p.latitude, p.longitude]} icon={numberIcon(i + 1, p.color)}>
            {p.label && <Tooltip>{p.label}</Tooltip>}
          </Marker>
        ))}
        {points.map((p, i) => (
          <CircleMarker key={`p${i}`} center={[p.latitude, p.longitude]} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: p.color || '#F59E0B', fillOpacity: 1 }}>
            {p.label && <Tooltip>{p.label}</Tooltip>}
          </CircleMarker>
        ))}

        {me && (
          <>
            {me.accuracy ? <Circle center={[me.latitude, me.longitude]} radius={me.accuracy} pathOptions={{ color: '#2563EB', weight: 1, fillOpacity: 0.1 }} /> : null}
            <CircleMarker center={[me.latitude, me.longitude]} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563EB', fillOpacity: 1 }}>
              <Tooltip>You are here</Tooltip>
            </CircleMarker>
          </>
        )}
      </MapContainer>
      <div className="absolute top-2 right-2 z-[500] flex rounded-lg bg-white/95 shadow p-0.5 text-[10px] font-semibold">
        {(['satellite', 'streets'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLayer(l)}
            className={`px-2 py-1 rounded-md capitalize ${layer === l ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
