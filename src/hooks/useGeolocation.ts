import { useState, useEffect, useCallback, useRef } from 'react';
import { UserCoordinates } from '../types';
import { offsetCoordinates } from '../utils/geo';

// Default fallback coordinates: San Francisco Ferry Building Plaza (spacious landmark plaza)
const DEFAULT_COORDS: UserCoordinates = {
  latitude: 37.7955,
  longitude: -122.3937,
  altitude: 5,
  accuracy: 4,
  heading: 0,
  speed: 0,
  timestamp: Date.now(),
};

export interface GeolocationState {
  coords: UserCoordinates;
  status: 'initializing' | 'active' | 'denied' | 'simulated';
  error: string | null;
  satellitesEstimated: number;
  isSimulated: boolean;
  walkStep: (directionDeg: number, stepMeters: number) => void;
  teleport: (lat: number, lon: number, alt?: number) => void;
  refreshGPS: () => void;
  toggleSimulation: () => void;
}

export function useGeolocation(initialSimulated: boolean = false): GeolocationState {
  const [coords, setCoords] = useState<UserCoordinates>(DEFAULT_COORDS);
  const [status, setStatus] = useState<GeolocationState['status']>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState<boolean>(initialSimulated);
  const watchIdRef = useRef<number | null>(null);

  // Walk in virtual simulation
  const walkStep = useCallback((directionDeg: number, stepMeters: number) => {
    setCoords((prev) => {
      const rad = (directionDeg * Math.PI) / 180;
      const east = Math.sin(rad) * stepMeters;
      const north = Math.cos(rad) * stepMeters;
      const next = offsetCoordinates(prev.latitude, prev.longitude, east, north);

      return {
        ...prev,
        latitude: next.latitude,
        longitude: next.longitude,
        heading: directionDeg,
        timestamp: Date.now(),
      };
    });
  }, []);

  const teleport = useCallback((lat: number, lon: number, alt?: number) => {
    setCoords((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
      altitude: alt ?? prev.altitude,
      timestamp: Date.now(),
    }));
  }, []);

  const toggleSimulation = useCallback(() => {
    setIsSimulated((prev) => !prev);
  }, []);

  const startWatching = useCallback(() => {
    if (isSimulated) {
      setStatus('simulated');
      return;
    }

    if (!('geolocation' in navigator)) {
      setStatus('simulated');
      setError('Geolocation is not supported by this browser environment.');
      return;
    }

    setStatus('initializing');
    setError(null);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: Math.round(pos.coords.accuracy),
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
        setStatus('active');
        setError(null);
      },
      (err) => {
        console.warn('Geolocation warning:', err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied');
          setError('Location permission denied. Running in physical simulation mode.');
        } else {
          setError(err.message);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );
  }, [isSimulated]);

  useEffect(() => {
    startWatching();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startWatching]);

  // Satellite estimation based on accuracy
  const satellitesEstimated =
    coords.accuracy <= 5 ? 12 : coords.accuracy <= 10 ? 8 : coords.accuracy <= 20 ? 5 : 3;

  return {
    coords,
    status,
    error,
    satellitesEstimated,
    isSimulated,
    walkStep,
    teleport,
    refreshGPS: startWatching,
    toggleSimulation,
  };
}
