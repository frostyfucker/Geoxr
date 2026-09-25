import { AnchorPin, ARSettings } from '../types';

const STORAGE_KEY_PINS = 'geoxr_anchor_pins_v1';
const STORAGE_KEY_SETTINGS = 'geoxr_settings_v1';

export const DEFAULT_SETTINGS: ARSettings = {
  enableAudio: true,
  enableHaptics: true,
  horizonCompression: true,
  maxVisibleDistanceMeters: 5000,
  headingOffset: 0,
  renderMode: 'threejs',
  showRadar: true,
  showReticle: true,
  showSkyBeacons: true,
  simulatedWalkStepMeters: 2.0,
};

export function loadSavedPins(): AnchorPin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PINS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load pins from storage:', err);
  }
  return [];
}

export function savePinsToStorage(pins: AnchorPin[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PINS, JSON.stringify(pins));
  } catch (err) {
    console.error('Failed to save pins to storage:', err);
  }
}

export function loadSavedSettings(): ARSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Failed to load settings from storage:', err);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettingsToStorage(settings: ARSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to storage:', err);
  }
}

/**
 * Export pins as standard GeoJSON FeatureCollection
 */
export function exportToGeoJSON(pins: AnchorPin[]): string {
  const geojson = {
    type: 'FeatureCollection',
    features: pins.map((pin) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pin.longitude, pin.latitude, pin.altitude ?? 0],
      },
      properties: {
        id: pin.id,
        title: pin.title,
        description: pin.description,
        category: pin.category,
        color: pin.color,
        createdAt: pin.createdAt,
        tags: pin.tags,
      },
    })),
  };
  return JSON.stringify(geojson, null, 2);
}

/**
 * Import pins from GeoJSON or raw JSON array
 */
export function parseImportedPins(jsonString: string): AnchorPin[] {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data)) {
      return data.filter(
        (p) =>
          typeof p.latitude === 'number' &&
          typeof p.longitude === 'number' &&
          typeof p.title === 'string'
      );
    }
    if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      return data.features
        .filter(
          (f: { geometry?: { coordinates?: number[] } }) =>
            f.geometry &&
            f.geometry.coordinates &&
            f.geometry.coordinates.length >= 2
        )
        .map((f: {
          properties?: Record<string, unknown>;
          geometry: { coordinates: number[] };
        }, idx: number) => {
          const props = f.properties || {};
          return {
            id: (props.id as string) || `imported-pin-${Date.now()}-${idx}`,
            title: (props.title as string) || 'Imported Anchor',
            description: (props.description as string) || '',
            latitude: f.geometry.coordinates[1],
            longitude: f.geometry.coordinates[0],
            altitude: f.geometry.coordinates[2] || 0,
            category: (props.category as AnchorPin['category']) || 'waypoint',
            color: (props.color as string) || '#06b6d4',
            createdAt: (props.createdAt as number) || Date.now(),
            tags: Array.isArray(props.tags) ? (props.tags as string[]) : [],
          };
        });
    }
  } catch (e) {
    throw new Error('Invalid JSON format: ' + (e as Error).message);
  }
  return [];
}
