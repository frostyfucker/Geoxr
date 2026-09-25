export type PinCategory =
  | 'landmark'
  | 'note'
  | 'geocache'
  | 'waypoint'
  | 'hazard'
  | 'memory';

export interface AnchorPin {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  altitude?: number; // relative or sea-level in meters
  category: PinCategory;
  color: string;
  createdAt: number;
  tags?: string[];
  author?: string;
}

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface DeviceHeading {
  heading: number; // 0-360 degrees (0 = North, 90 = East)
  pitch: number;   // -90 to 90 degrees (looking down/up)
  roll: number;    // -180 to 180 degrees
  isCalibrated: boolean;
  source: 'magnetometer' | 'simulated' | 'fallback';
}

export interface LocalENUCoords {
  x: number; // East in meters
  y: number; // Up in meters
  z: number; // -North in meters (Three.js convention: -Z is North)
  distance: number; // 3D distance in meters
  horizontalDistance: number; // 2D ground distance in meters
  bearing: number; // 0-360 degrees bearing from user to pin
  elevationAngle: number; // degrees elevation relative to user horizon
}

export interface ARSettings {
  enableAudio: boolean;
  enableHaptics: boolean;
  horizonCompression: boolean; // Compress distant pins so 1km away is visually positioned at 45m with true bearing
  maxVisibleDistanceMeters: number;
  headingOffset: number; // -180 to +180 deg manual calibration offset
  renderMode: 'threejs' | 'aframe';
  showRadar: boolean;
  showReticle: boolean;
  showSkyBeacons: boolean;
  simulatedWalkStepMeters: number;
}
