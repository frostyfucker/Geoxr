import React, { useState } from 'react';
import { UserCoordinates } from '../types';
import { audioManager } from '../utils/audio';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Compass,
  MapPin,
  Minimize2,
  Maximize2,
} from 'lucide-react';

interface SimulatorControlsProps {
  userCoords: UserCoordinates;
  heading: number;
  onWalk: (directionDeg: number, stepMeters: number) => void;
  onTeleport: (lat: number, lon: number, alt?: number) => void;
  stepMeters?: number;
}

const PRESET_LOCATIONS = [
  { name: 'SF Ferry Plaza', lat: 37.7955, lon: -122.3937, alt: 5 },
  { name: 'Tokyo Shibuya', lat: 35.6595, lon: 139.7005, alt: 15 },
  { name: 'NYC Central Park', lat: 40.7711, lon: -73.9742, alt: 25 },
  { name: 'Paris Eiffel Tower', lat: 48.8584, lon: 2.2945, alt: 35 },
  { name: 'London Trafalgar', lat: 51.508, lon: -0.1281, alt: 18 },
];

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  userCoords,
  heading,
  onWalk,
  onTeleport,
  stepMeters = 2,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentStep, setCurrentStep] = useState(stepMeters);

  const handleWalk = (offsetDeg: number) => {
    const walkHeading = (heading + offsetDeg + 360) % 360;
    onWalk(walkHeading, currentStep);
    audioManager.playButtonTick();
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/20 text-xs font-medium text-cyan-300 shadow-lg active:scale-95 transition-all"
      >
        <Footprints className="w-3.5 h-3.5 text-cyan-400" />
        <span>Virtual Walk</span>
      </button>
    );
  }

  return (
    <div className="bg-slate-950/85 backdrop-blur-xl border border-white/15 rounded-3xl p-3.5 shadow-2xl text-white w-64">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <Footprints className="w-4 h-4 text-cyan-400" />
          <span>Virtual GPS Nav</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Step size pills */}
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setCurrentStep(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono-ar tabular-nums transition-colors ${
                currentStep === s
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {s}m
            </button>
          ))}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* D-Pad Navigation */}
      <div className="flex flex-col items-center justify-center my-1.5">
        {/* Forward */}
        <button
          onClick={() => handleWalk(0)}
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-cyan-500/20 active:bg-cyan-500 active:text-slate-950 text-white flex items-center justify-center transition-all border border-white/10 active:scale-90"
          title="Walk Forward"
        >
          <ChevronUp className="w-5 h-5" />
        </button>

        {/* Left, Center Indicator, Right */}
        <div className="flex items-center gap-2 my-1">
          <button
            onClick={() => handleWalk(-90)}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-cyan-500/20 active:bg-cyan-500 active:text-slate-950 text-white flex items-center justify-center transition-all border border-white/10 active:scale-90"
            title="Strafe Left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="w-8 h-8 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-[10px] font-mono-ar text-cyan-300">
            {currentStep}m
          </div>

          <button
            onClick={() => handleWalk(90)}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-cyan-500/20 active:bg-cyan-500 active:text-slate-950 text-white flex items-center justify-center transition-all border border-white/10 active:scale-90"
            title="Strafe Right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Backward */}
        <button
          onClick={() => handleWalk(180)}
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-cyan-500/20 active:bg-cyan-500 active:text-slate-950 text-white flex items-center justify-center transition-all border border-white/10 active:scale-90"
          title="Walk Backward"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Teleport Preset */}
      <div className="mt-2 pt-2 border-t border-white/10">
        <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">
          Teleport Coordinates
        </label>
        <select
          onChange={(e) => {
            const loc = PRESET_LOCATIONS.find((l) => l.name === e.target.value);
            if (loc) {
              onTeleport(loc.lat, loc.lon, loc.alt);
              audioManager.playAnchorPlaced();
            }
          }}
          className="w-full px-2 py-1 rounded-lg bg-white/10 border border-white/15 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
          defaultValue=""
        >
          <option value="" disabled className="bg-slate-900 text-slate-400">
            Select a world landmark...
          </option>
          {PRESET_LOCATIONS.map((loc) => (
            <option key={loc.name} value={loc.name} className="bg-slate-900 text-white">
              {loc.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
