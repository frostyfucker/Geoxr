import React from 'react';
import { AnchorPin, LocalENUCoords, UserCoordinates } from '../types';
import { formatDistance, gpsToLocalENU } from '../utils/geo';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface OffScreenIndicatorsProps {
  userCoords: UserCoordinates;
  heading: number; // Device heading 0-360
  pins: AnchorPin[];
  selectedPinId: string | null;
  onSelectPin: (pin: AnchorPin) => void;
  horizontalFOV?: number; // e.g. 65 degrees
}

export const OffScreenIndicators: React.FC<OffScreenIndicatorsProps> = ({
  userCoords,
  heading,
  pins,
  selectedPinId,
  onSelectPin,
  horizontalFOV = 65,
}) => {
  const halfFOV = horizontalFOV / 2;

  // Process pins to see which are outside current camera FOV
  const offscreenPins = pins.map((pin) => {
    const enu: LocalENUCoords = gpsToLocalENU(
      userCoords,
      pin.latitude,
      pin.longitude,
      pin.altitude ?? 0,
      false
    );

    // Compute relative delta angle from device heading to pin (-180 to +180)
    let delta = (enu.bearing - heading) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const isVisibleInFOV = Math.abs(delta) <= halfFOV;

    return {
      pin,
      enu,
      delta, // negative is LEFT, positive is RIGHT
      isVisibleInFOV,
      isLeft: delta < 0,
    };
  }).filter((item) => !item.isVisibleInFOV);

  // Group into left and right indicators (show top 2 closest per side to avoid clutter)
  const leftPins = offscreenPins
    .filter((p) => p.isLeft)
    .sort((a, b) => a.enu.distance - b.enu.distance)
    .slice(0, 2);

  const rightPins = offscreenPins
    .filter((p) => !p.isLeft)
    .sort((a, b) => a.enu.distance - b.enu.distance)
    .slice(0, 2);

  return (
    <>
      {/* Left Edge Indicators */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20 pointer-events-auto">
        {leftPins.map(({ pin, enu, delta }) => {
          const isSelected = pin.id === selectedPinId;
          const turnAngle = Math.abs(Math.round(delta));

          return (
            <button
              key={`off-left-${pin.id}`}
              onClick={() => onSelectPin(pin)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-r-xl rounded-l-md bg-slate-950/85 backdrop-blur-md border border-l-2 transition-all active:scale-95 text-left shadow-lg ${
                isSelected
                  ? 'border-white border-l-white ring-1 ring-white/50'
                  : 'border-white/10 hover:border-white/30'
              }`}
              style={{ borderLeftColor: pin.color || '#06b6d4' }}
            >
              <ChevronLeft className="w-4 h-4 shrink-0 animate-pulse" style={{ color: pin.color || '#06b6d4' }} />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-white truncate max-w-[90px]">
                  {pin.title}
                </span>
                <span className="text-[10px] font-mono-ar tabular-nums text-slate-300">
                  {formatDistance(enu.distance)} · turn {turnAngle}°
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right Edge Indicators */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20 pointer-events-auto">
        {rightPins.map(({ pin, enu, delta }) => {
          const isSelected = pin.id === selectedPinId;
          const turnAngle = Math.abs(Math.round(delta));

          return (
            <button
              key={`off-right-${pin.id}`}
              onClick={() => onSelectPin(pin)}
              className={`flex items-center justify-end gap-1.5 px-2.5 py-1.5 rounded-l-xl rounded-r-md bg-slate-950/85 backdrop-blur-md border border-r-2 transition-all active:scale-95 text-right shadow-lg ${
                isSelected
                  ? 'border-white border-r-white ring-1 ring-white/50'
                  : 'border-white/10 hover:border-white/30'
              }`}
              style={{ borderRightColor: pin.color || '#06b6d4' }}
            >
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-semibold text-white truncate max-w-[90px]">
                  {pin.title}
                </span>
                <span className="text-[10px] font-mono-ar tabular-nums text-slate-300">
                  {formatDistance(enu.distance)} · turn {turnAngle}°
                </span>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 animate-pulse" style={{ color: pin.color || '#06b6d4' }} />
            </button>
          );
        })}
      </div>
    </>
  );
};
