import React from 'react';
import { AnchorPin, LocalENUCoords, UserCoordinates } from '../types';
import { gpsToLocalENU } from '../utils/geo';
import { Compass, Navigation } from 'lucide-react';

interface RadarCompassProps {
  userCoords: UserCoordinates;
  heading: number; // Device heading in degrees (0 = North)
  pins: AnchorPin[];
  selectedPinId: string | null;
  onSelectPin: (pin: AnchorPin) => void;
  maxRadarRangeMeters?: number;
}

export const RadarCompass: React.FC<RadarCompassProps> = ({
  userCoords,
  heading,
  pins,
  selectedPinId,
  onSelectPin,
  maxRadarRangeMeters = 80,
}) => {
  const radarRadius = 56; // Radius in pixels

  return (
    <div className="relative flex flex-col items-center">
      {/* Radar Container */}
      <div className="relative w-32 h-32 rounded-full bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] flex items-center justify-center overflow-hidden">
        {/* Radar concentric sweep rings */}
        <div className="absolute inset-2 rounded-full border border-cyan-500/15" />
        <div className="absolute inset-6 rounded-full border border-cyan-500/10" />
        <div className="absolute inset-10 rounded-full border border-cyan-500/10" />

        {/* Crosshair lines */}
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-cyan-500/20 -translate-y-1/2 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-cyan-500/20 -translate-x-1/2 pointer-events-none" />

        {/* Rotating Compass Ring (rotates opposite of heading so North is true) */}
        <div
          className="absolute inset-0 transition-transform duration-100 ease-out pointer-events-none"
          style={{ transform: `rotate(${-heading}deg)` }}
        >
          {/* Cardinal Directions */}
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-rose-400 tracking-wider">
            N
          </span>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-medium text-slate-400">
            S
          </span>
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-medium text-slate-400">
            E
          </span>
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-medium text-slate-400">
            W
          </span>
        </div>

        {/* Center User Dot & Forward Vision Cone */}
        <div className="relative z-10 flex items-center justify-center">
          {/* Forward View Frustum Wedge */}
          <div
            className="absolute -top-12 w-12 h-12 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at bottom center, rgba(6, 182, 212, 0.35) 0%, transparent 70%)',
              clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)',
            }}
          />
          {/* Center User Dot */}
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] border border-white" />
        </div>

        {/* Anchor Pin Blips on Radar */}
        {pins.map((pin) => {
          const enu: LocalENUCoords = gpsToLocalENU(
            userCoords,
            pin.latitude,
            pin.longitude,
            pin.altitude ?? 0,
            false // exact 2D distance for radar
          );

          // Relative angle to current device heading
          // In ENU, X is East, -Z is North.
          // Compass bearing: 0 is North, 90 is East.
          const relAngleRad = ((pinBearingRel(enu.bearing, heading)) * Math.PI) / 180;

          // Normalized distance clamped to radar boundary
          const normalizedDist = Math.min(1, enu.horizontalDistance / maxRadarRangeMeters);
          const pxDist = normalizedDist * (radarRadius - 8);

          // In screen coords: 0 deg relative is UP (negative Y), 90 deg is RIGHT (positive X)
          const blipX = Math.sin(relAngleRad) * pxDist;
          const blipY = -Math.cos(relAngleRad) * pxDist;

          const isSelected = pin.id === selectedPinId;

          return (
            <button
              key={pin.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPin(pin);
              }}
              title={`${pin.title} (${Math.round(enu.horizontalDistance)}m)`}
              className={`absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform active:scale-125 z-20 ${
                isSelected
                  ? 'ring-2 ring-white scale-125 z-30'
                  : 'hover:scale-110'
              }`}
              style={{
                left: `calc(50% + ${blipX}px)`,
                top: `calc(50% + ${blipY}px)`,
                backgroundColor: pin.color || '#06b6d4',
                boxShadow: `0 0 6px ${pin.color || '#06b6d4'}`,
              }}
            />
          );
        })}
      </div>

      {/* Heading Readout Label */}
      <div className="mt-1 flex items-center gap-1 text-[11px] font-mono-ar tabular-nums text-cyan-300 bg-slate-950/70 px-2 py-0.5 rounded border border-cyan-500/20">
        <Navigation className="w-3 h-3 text-cyan-400" />
        <span>{Math.round((heading + 360) % 360).toString().padStart(3, '0')}°</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-300 font-semibold">{getCompassHeadingName(heading)}</span>
      </div>
    </div>
  );
};

function pinBearingRel(pinBearing: number, userHeading: number): number {
  return (pinBearing - userHeading + 360) % 360;
}

function getCompassHeadingName(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degrees % 360) + 360) % 360 / 45) % 8;
  return directions[index];
}
