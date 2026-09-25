import React from 'react';
import { ARSettings } from '../types';
import { audioManager } from '../utils/audio';
import {
  X,
  Sliders,
  Compass,
  Volume2,
  VolumeX,
  Vibrate,
  Eye,
  Layers,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ARSettings;
  onUpdateSettings: (newSettings: Partial<ARSettings>) => void;
  onResetPins: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetPins,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-950 border border-white/15 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">AR System Settings</h2>
              <span className="text-xs text-slate-400">Sensor calibration & visual geometry</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Heading Offset Calibration */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Compass North Calibration</span>
              </div>
              <span className="text-xs font-mono-ar tabular-nums text-cyan-300">
                {settings.headingOffset > 0 ? `+${settings.headingOffset}°` : `${settings.headingOffset}°`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Adjust if magnetic interference or indoor structures rotate your compass azimuth.
            </p>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.headingOffset}
              onChange={(e) => {
                onUpdateSettings({ headingOffset: parseInt(e.target.value, 10) });
              }}
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>-180° (West)</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ headingOffset: 0 })}
                className="text-cyan-400 hover:underline"
              >
                Reset 0°
              </button>
              <span>+180° (East)</span>
            </div>
          </div>

          {/* Render Mode Switcher */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 mb-1.5">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Spatial Engine Mode</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Toggle between the Three.js Spatial AR camera pipeline and the native A-Frame WebXR entity engine.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({ renderMode: 'threejs' });
                  audioManager.playButtonTick();
                }}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                  settings.renderMode === 'threejs'
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                Spatial AR Engine
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({ renderMode: 'aframe' });
                  audioManager.playButtonTick();
                }}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                  settings.renderMode === 'aframe'
                    ? 'bg-purple-600 text-white font-bold border-purple-400 shadow-md shadow-purple-600/20'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                A-Frame WebXR
              </button>
            </div>
          </div>

          {/* Visual Horizon Compression */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="pr-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>AR Horizon Compression</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Compress distant anchors (&gt;35m) so they remain visible and crisp in the camera viewport while keeping their true bearing.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.horizonCompression}
              onChange={(e) => onUpdateSettings({ horizonCompression: e.target.checked })}
              className="w-5 h-5 rounded accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Sky Light Beacons */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="pr-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Vertical Sky Beacons</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Cast towering light pillars into the physical sky above each anchor pin.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showSkyBeacons}
              onChange={(e) => onUpdateSettings({ showSkyBeacons: e.target.checked })}
              className="w-5 h-5 rounded accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Audio & Haptic Toggles */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                const next = !settings.enableAudio;
                onUpdateSettings({ enableAudio: next });
                audioManager.isEnabled = next;
                if (next) audioManager.playButtonTick();
              }}
              className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-colors ${
                settings.enableAudio
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              {settings.enableAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-xs font-semibold">
                {settings.enableAudio ? 'Audio: On' : 'Audio: Muted'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !settings.enableHaptics;
                onUpdateSettings({ enableHaptics: next });
                audioManager.hapticsEnabled = next;
                if (next) audioManager.triggerHaptic(20);
              }}
              className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-colors ${
                settings.enableHaptics
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <Vibrate className="w-4 h-4" />
              <span className="text-xs font-semibold">
                {settings.enableHaptics ? 'Haptics: On' : 'Haptics: Off'}
              </span>
            </button>
          </div>

          {/* Reset Pins to Initial Sample Data */}
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset all pins and generate fresh nearby sample anchors?')) {
                  onResetPins();
                  onClose();
                }
              }}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Regenerate Sample Anchors Around My GPS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
