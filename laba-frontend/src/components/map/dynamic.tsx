'use client';

import dynamic from 'next/dynamic';

const Placeholder = ({ h = 'h-56' }: { h?: string }) => <div className={`w-full ${h} rounded-xl bg-[#F0EFEB] animate-pulse`} />;

/** Leaflet touches `window`, so maps are loaded on the client only. */
export const GeofenceEditor = dynamic(() => import('./GeofenceEditor'), { ssr: false, loading: () => <Placeholder h="h-96" /> });
export const FenceMap = dynamic(() => import('./FenceMap'), { ssr: false, loading: () => <Placeholder /> });
