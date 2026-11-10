import { useState, useCallback } from 'react';

export interface GPSState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  timestamp: number | null;
}

export function useGPS() {
  const [gps, setGps] = useState<GPSState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: false,
    error: null,
    timestamp: null,
  });

  const requestCoordinates = useCallback((): Promise<{ latitude: number; longitude: number; accuracy: number }> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        const errMsg = 'Geolocation is not supported by your browser.';
        setGps((prev) => ({ ...prev, loading: false, error: errMsg }));
        return reject(new Error(errMsg));
      }

      setGps((prev) => ({ ...prev, loading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const coords = { latitude, longitude, accuracy };
          setGps({
            latitude,
            longitude,
            accuracy,
            loading: false,
            error: null,
            timestamp: position.timestamp,
          });
          resolve(coords);
        },
        (error) => {
          let errMsg = 'Failed to acquire GPS location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errMsg = 'Location permission was denied. Please allow location access in your browser settings to mark attendance.';
              break;
            case error.POSITION_UNAVAILABLE:
              errMsg = 'Location information is unavailable. Ensure GPS / Location is turned ON in your device settings.';
              break;
            case error.TIMEOUT:
              errMsg = 'Location request timed out. Please stand near an open window and try again.';
              break;
          }
          setGps((prev) => ({ ...prev, loading: false, error: errMsg }));
          reject(new Error(errMsg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  return {
    ...gps,
    requestCoordinates,
  };
}

