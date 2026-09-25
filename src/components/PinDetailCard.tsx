import React, { useState } from 'react';
import { AnchorPin, LocalENUCoords, UserCoordinates } from '../types';
import { formatBearing, formatCoordinateString, formatDistance, gpsToLocalENU } from '../utils/geo';
import { audioManager } from '../utils/audio';
import {
  Volume2,
  Trash2,
  Edit3,
  Copy,
  Check,
  X,
  Compass,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface PinDetailCardProps {
  pin: AnchorPin;
  userCoords: UserCoordinates;
  heading: number;
  onClose: () => void;
  onEdit: (pin: AnchorPin) => void;
  onDelete: (id: string) => void;
}

export const PinDetailCard: React.FC<PinDetailCardProps> = ({
  pin,
  userCoords,
  heading,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);

  const enu: LocalENUCoords = gpsToLocalENU(
    userCoords,
    pin.latitude,
    pin.longitude,
    pin.altitude ?? 0,
    false
  );

  // Angle difference between current heading and pin bearing
  let deltaDeg = (enu.bearing - heading) % 360;
  if (deltaDeg > 180) deltaDeg -= 360;
  if (deltaDeg < -180) deltaDeg += 360;
  const isFacing = Math.abs(deltaDeg) < 15;

  const handleCopy = () => {
    navigator.clipboard.writeText(`${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}`);
    setCopied(true);
    audioManager.playButtonTick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSonarPing = () => {
    audioManager.playSonarPing(enu.distance);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-950/90 backdrop-blur-xl border border-white/15 rounded-3xl p-5 shadow-2xl text-white">
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
            style={{ backgroundColor: pin.color || '#06b6d4' }}
          >
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {pin.category}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-mono-ar tabular-nums">
                {new Date(pin.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">{pin.title}</h3>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-colors text-slate-300"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-3 gap-2.5 my-4">
        {/* Distance */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Distance</span>
          <span className="text-lg font-bold font-mono-ar tabular-nums text-cyan-300 mt-0.5">
            {formatDistance(enu.distance)}
          </span>
          <span className="text-[10px] text-slate-400">horizontal {formatDistance(enu.horizontalDistance)}</span>
        </div>

        {/* Bearing & Aim */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Bearing</span>
          <span className="text-base font-bold font-mono-ar tabular-nums text-white mt-0.5">
            {formatBearing(enu.bearing)}
          </span>
          <span
            className={`text-[10px] font-semibold ${
              isFacing ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {isFacing ? 'Aligned in view' : `Turn ${Math.abs(Math.round(deltaDeg))}° ${deltaDeg < 0 ? 'L' : 'R'}`}
          </span>
        </div>

        {/* Altitude Offset */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Altitude</span>
          <span className="text-base font-bold font-mono-ar tabular-nums text-white mt-0.5">
            {enu.y >= 0 ? `+${enu.y.toFixed(1)}m` : `${enu.y.toFixed(1)}m`}
          </span>
          <span className="text-[10px] text-slate-400">
            {pin.altitude ? `${pin.altitude}m MSL` : 'Ground level'}
          </span>
        </div>
      </div>

      {/* Coordinates String with Copy */}
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono-ar tabular-nums text-slate-300 mb-3.5">
        <div className="flex items-center gap-2 truncate">
          <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">{formatCoordinateString(pin.latitude, pin.longitude)}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors ml-2 shrink-0 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Description / Notes */}
      {pin.description && (
        <p className="text-xs text-slate-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 mb-3.5">
          {pin.description}
        </p>
      )}

      {/* Tags */}
      {pin.tags && pin.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {pin.tags.map((tag, i) => (
            <span
              key={i}
              className="text-[10px] text-slate-300 bg-white/10 px-2 py-0.5 rounded-md"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
        <button
          onClick={handleSonarPing}
          className="flex-1 h-11 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-cyan-500/40 active:scale-95 transition-transform"
        >
          <Volume2 className="w-4 h-4 text-cyan-400" />
          <span>Sonar Ping</span>
        </button>

        <button
          onClick={() => onEdit(pin)}
          className="h-11 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs flex items-center justify-center gap-1.5 border border-white/15 active:scale-95 transition-transform"
        >
          <Edit3 className="w-4 h-4" />
          <span>Edit</span>
        </button>

        <button
          onClick={() => onDelete(pin.id)}
          className="h-11 px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs flex items-center justify-center gap-1.5 border border-rose-500/30 active:scale-95 transition-transform"
          aria-label="Delete pin"
        >
          <Trash2 className="w-4 h-4 text-rose-400" />
        </button>
      </div>
    </div>
  );
};
