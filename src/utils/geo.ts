import { AnchorPin, LocalENUCoords, UserCoordinates } from '../types';

// WGS84 ellipsoid Earth radius in meters
export const EARTH_RADIUS_METERS = 6378137;

/**
 * Calculates great circle distance between two points in meters using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates initial compass bearing (azimuth) from point 1 to point 2 in degrees (0-360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const deltaLambda = (lon2 - lon1) * toRad;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  let bearing = Math.atan2(y, x) * toDeg;
  return (bearing + 360) % 360;
}

/**
 * Converts pin GPS coordinates to local Cartesian East-North-Up (ENU) coordinates
 * relative to the user's current GPS position.
 * Three.js coordinate system:
 * +X: East
 * +Y: Up
 * -Z: North (Three.js camera looks down -Z by default)
 */
export function gpsToLocalENU(
  user: UserCoordinates,
  pinLat: number,
  pinLon: number,
  pinAlt: number = 0,
  horizonCompression: boolean = true
): LocalENUCoords {
  const toRad = Math.PI / 180;
  const midLat = ((user.latitude + pinLat) / 2) * toRad;

  // East offset (X in meters)
  const dLon = (pinLon - user.longitude) * toRad;
  const eastMeters = dLon * EARTH_RADIUS_METERS * Math.cos(midLat);

  // North offset (Z in meters)
  const dLat = (pinLat - user.latitude) * toRad;
  const northMeters = dLat * EARTH_RADIUS_METERS;

  // Up offset (Y in meters)
  const userAlt = user.altitude ?? 0;
  const upMeters = pinAlt - userAlt;

  const horizontalDistance = Math.hypot(eastMeters, northMeters);
  const actual3DDistance = Math.hypot(horizontalDistance, upMeters);
  const bearing = calculateBearing(user.latitude, user.longitude, pinLat, pinLon);
  const elevationAngle = (Math.atan2(upMeters, Math.max(1, horizontalDistance)) * 180) / Math.PI;

  // In WebXR / Three.js, -Z is North, +X is East, +Y is Up
  let x = eastMeters;
  let z = -northMeters;
  let y = upMeters;

  // Visual horizon compression:
  // If pin is very far (e.g., 200m or 5km), compress the 3D visual distance
  // so it remains visible within the camera frustum without clipping through the far plane,
  // while preserving its exact angular bearing!
  if (horizonCompression && horizontalDistance > 35) {
    // Logarithmic scale above 35 meters, capping at 70 meters visual distance
    const visualDist = 35 + Math.log10(1 + (horizontalDistance - 35) / 10) * 12;
    const clampedVisualDist = Math.min(visualDist, 75);
    const scale = clampedVisualDist / horizontalDistance;
    x = eastMeters * scale;
    z = -northMeters * scale;
    y = Math.max(-4, Math.min(10, upMeters * scale));
  }

  return {
    x,
    y,
    z,
    distance: actual3DDistance,
    horizontalDistance,
    bearing,
    elevationAngle,
  };
}

/**
 * Converts a delta offset in meters (East, North) from a base coordinate to new Lat/Lng
 */
export function offsetCoordinates(
  lat: number,
  lon: number,
  eastMeters: number,
  northMeters: number
): { latitude: number; longitude: number } {
  const dLat = (northMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const dLon =
    (eastMeters / (EARTH_RADIUS_METERS * Math.cos((lat * Math.PI) / 180))) *
    (180 / Math.PI);

  return {
    latitude: lat + dLat,
    longitude: lon + dLon,
  };
}

export function formatDistance(meters: number): string {
  if (meters < 1) return '< 1 m';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatBearing(degrees: number): string {
  const deg = Math.round((degrees + 360) % 360);
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(deg / 45) % 8;
  return `${deg.toString().padStart(3, '0')}° ${directions[index]}`;
}

export function formatCoordinateString(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lon).toFixed(5)}° ${lonDir}`;
}

/**
 * Creates contextual anchor pins around user's initial location
 */
export function generateCuratedNearbyPins(
  userLat: number,
  userLon: number
): AnchorPin[] {
  const now = Date.now();

  const presets = [
    {
      title: 'North Sky Anchor',
      description: 'Primary navigational datum aligned with geographic North.',
      east: 0,
      north: 18,
      alt: 1.5,
      category: 'waypoint' as const,
      color: '#06b6d4', // Cyan
      tags: ['Navigation', 'Datum'],
    },
    {
      title: 'Observation Point Alpha',
      description: 'Elevated viewpoint anchor with clear physical line of sight.',
      east: 24,
      north: 12,
      alt: 2.0,
      category: 'landmark' as const,
      color: '#10b981', // Emerald
      tags: ['Viewpoint', 'Survey'],
    },
    {
      title: 'Physical World GeoCache',
      description: 'Hidden spatial coordinate container left for explorers.',
      east: -16,
      north: 22,
      alt: 0.5,
      category: 'geocache' as const,
      color: '#f59e0b', // Amber
      tags: ['Treasure', 'Discovery'],
    },
    {
      title: 'Spatial Meeting Hub',
      description: 'Designated rendezvous anchor for collaborative rendezvous.',
      east: 15,
      north: -18,
      alt: 1.2,
      category: 'memory' as const,
      color: '#a855f7', // Purple
      tags: ['Rendezvous', 'Hub'],
    },
    {
      title: 'Perimeter Hazard Flag',
      description: 'Physical perimeter marker indicating caution zone.',
      east: -22,
      north: -15,
      alt: 0.8,
      category: 'hazard' as const,
      color: '#f43f5e', // Rose
      tags: ['Safety', 'Perimeter'],
    },
  ];

  return presets.map((p, index) => {
    const coords = offsetCoordinates(userLat, userLon, p.east, p.north);
    return {
      id: `pin-preset-${index}-${now}`,
      title: p.title,
      description: p.description,
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: p.alt,
      category: p.category,
      color: p.color,
      createdAt: now - index * 60000,
      tags: p.tags,
      author: 'GeoXR World Registry',
    };
  });
}
