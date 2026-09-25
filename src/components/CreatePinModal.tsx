import React, { useState } from 'react';
import { AnchorPin, PinCategory, UserCoordinates } from '../types';
import { audioManager } from '../utils/audio';
import confetti from 'canvas-confetti';
import { X, MapPin, Compass, Sparkles, Navigation } from 'lucide-react';

interface CreatePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pin: AnchorPin) => void;
  userCoords: UserCoordinates;
  initialPin?: AnchorPin | null;
}

const CATEGORIES: { id: PinCategory; label: string; defaultColor: string }[] = [
  { id: 'waypoint', label: 'Waypoint', defaultColor: '#06b6d4' },
  { id: 'landmark', label: 'Landmark', defaultColor: '#10b981' },
  { id: 'geocache', label: 'GeoCache', defaultColor: '#f59e0b' },
  { id: 'note', label: 'Spatial Note', defaultColor: '#6366f1' },
  { id: 'hazard', label: 'Hazard', defaultColor: '#f43f5e' },
  { id: 'memory', label: 'Memory', defaultColor: '#a855f7' },
];

const COLOR_PALETTE = [
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#ec4899', // Pink
];

export const CreatePinModal: React.FC<CreatePinModalProps> = ({
  isOpen,
  onClose,
  onSave,
  userCoords,
  initialPin,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState(initialPin?.title ?? '');
  const [description, setDescription] = useState(initialPin?.description ?? '');
  const [latitude, setLatitude] = useState(initialPin?.latitude ?? userCoords.latitude);
  const [longitude, setLongitude] = useState(initialPin?.longitude ?? userCoords.longitude);
  const [altitude, setAltitude] = useState(initialPin?.altitude ?? 1.5);
  const [category, setCategory] = useState<PinCategory>(initialPin?.category ?? 'waypoint');
  const [color, setColor] = useState(initialPin?.color ?? '#06b6d4');
  const [tagsInput, setTagsInput] = useState(initialPin?.tags?.join(', ') ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleUseCurrentGPS = () => {
    setLatitude(userCoords.latitude);
    setLongitude(userCoords.longitude);
    setAltitude(userCoords.altitude ? Math.round(userCoords.altitude * 10) / 10 : 1.5);
    audioManager.playButtonTick();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for this anchor pin.');
      return;
    }
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      setError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      setError('Longitude must be a valid number between -180 and 180.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const pinToSave: AnchorPin = {
      id: initialPin?.id || `pin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      description: description.trim(),
      latitude,
      longitude,
      altitude: isNaN(altitude) ? 1.5 : altitude,
      category,
      color,
      createdAt: initialPin?.createdAt || Date.now(),
      tags,
    };

    onSave(pinToSave);
    audioManager.playAnchorPlaced();

    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // Confetti fail-safe
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-950 border border-white/15 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: color }}
            >
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                {initialPin ? 'Edit Anchor Pin' : 'Create 3D World Anchor'}
              </h2>
              <p className="text-xs text-slate-400">
                Anchors to exact latitude, longitude, and elevation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Quick GPS auto-fill button */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-cyan-950/40 border border-cyan-800/40">
            <div className="flex items-center gap-2 text-xs text-cyan-300">
              <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
              <span>Current GPS: {userCoords.latitude.toFixed(5)}, {userCoords.longitude.toFixed(5)}</span>
            </div>
            <button
              type="button"
              onClick={handleUseCurrentGPS}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors active:scale-95"
            >
              <Navigation className="w-3 h-3" />
              <span>Use Current GPS</span>
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Anchor Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. North Gate Observation Deck"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-cyan-400 focus:outline-none placeholder:text-slate-500"
              required
            />
          </div>

          {/* Coordinates inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Latitude (-90 to 90)
              </label>
              <input
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono-ar focus:border-cyan-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Longitude (-180 to 180)
              </label>
              <input
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono-ar focus:border-cyan-400 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Altitude offset */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
              <span className="font-semibold">Vertical Elevation Height ({altitude}m)</span>
              <span className="text-slate-400">Float above ground</span>
            </div>
            <input
              type="range"
              min="-2"
              max="20"
              step="0.5"
              value={altitude}
              onChange={(e) => setAltitude(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* Category selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => {
                    setCategory(cat.id);
                    if (!initialPin) setColor(cat.defaultColor);
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all ${
                    category === cat.id
                      ? 'bg-white/15 border-white text-white font-semibold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color palette */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Beacon Color
            </label>
            <div className="flex items-center gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform active:scale-90 ${
                    color === c ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Physical World Description / Field Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add observation details, survey markers, or spatial notes..."
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-cyan-400 focus:outline-none placeholder:text-slate-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Survey, SurveyPoint, Outdoor"
              className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-cyan-400 focus:outline-none placeholder:text-slate-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-xs active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{initialPin ? 'Update Anchor' : 'Anchor to Physical World'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
