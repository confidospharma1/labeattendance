import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  isMockLocation?: boolean;
}

/** Native plugin shipped in android/app (LabeLocationPlugin.java): returns a fresh fix with Android's mock flag. */
interface LabeLocationPlugin {
  getCurrentPosition(options: { timeout: number }): Promise<GpsFix>;
}
const LabeLocation = registerPlugin<LabeLocationPlugin>('LabeLocation');

export const isNativeApp = () => Capacitor.isNativePlatform();

const friendly = (msg: string) => {
  const m = msg.toLowerCase();
  if (m.includes('denied') || m.includes('permission'))
    return 'Location permission was denied. Allow location access for J-Track in your phone settings.';
  if (m.includes('disabled') || m.includes('unavailable') || m.includes('off'))
    return 'Location is turned off. Switch on GPS / Location in your phone settings.';
  if (m.includes('timeout') || m.includes('timed out'))
    return 'Could not get a GPS fix in time. Move to an open area and try again.';
  return msg || 'Could not get your location.';
};

/** Gets one high-accuracy GPS fix. On the Android app the result includes mock-location detection. */
export async function getCurrentFix(timeoutMs = 20000): Promise<GpsFix> {
  if (isNativeApp()) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (req.location !== 'granted') throw new Error('permission denied');
      }
      try {
        return await LabeLocation.getCurrentPosition({ timeout: timeoutMs });
      } catch (nativeErr: any) {
        if (String(nativeErr?.message || '').toLowerCase().includes('not implemented')) {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 });
          return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        }
        throw nativeErr;
      }
    } catch (err: any) {
      throw new Error(friendly(String(err?.message || err)));
    }
  }

  return new Promise<GpsFix>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('This browser does not support location.'));
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => {
        const map: Record<number, string> = { 1: 'permission denied', 2: 'position unavailable', 3: 'timeout' };
        reject(new Error(friendly(map[e.code] || e.message)));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

/** Great-circle distance in metres (for the live "you are X m away" hint; the server makes the real decision). */
export function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
