import React, { useState } from 'react';
import { AnchorPin, PinCategory, UserCoordinates } from '../types';
import { formatBearing, formatDistance, gpsToLocalENU } from '../utils/geo';
import { exportToGeoJSON, parseImportedPins } from '../utils/storage';
import { audioManager } from '../utils/audio';
import {
  X,
  Search,
  Download,
  Upload,
  Plus,
  Compass,
  MapPin,
  Trash2,
  Filter,
} from 'lucide-react';

interface PinListDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pins: AnchorPin[];
  userCoords: UserCoordinates;
  selectedPinId: string | null;
  onSelectPin: (pin: AnchorPin) => void;
  onDeletePin: (id: string) => void;
  onOpenCreate: () => void;
  onImportPins: (pins: AnchorPin[]) => void;
}

export const PinListDrawer: React.FC<PinListDrawerProps> = ({
  isOpen,
  onClose,
  pins,
  userCoords,
  selectedPinId,
  onSelectPin,
  onDeletePin,
  onOpenCreate,
  onImportPins,
}) => {
  if (!isOpen) return null;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PinCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'name' | 'date'>('distance');

  // Compute distances for all pins
  const pinsWithData = pins.map((pin) => {
    const enu = gpsToLocalENU(userCoords, pin.latitude, pin.longitude, pin.altitude ?? 0, false);
    return {
      pin,
      distance: enu.distance,
      bearing: enu.bearing,
    };
  });

  // Filter
  const filtered = pinsWithData.filter(({ pin }) => {
    const matchesSearch =
      pin.title.toLowerCase().includes(search.toLowerCase()) ||
      pin.description.toLowerCase().includes(search.toLowerCase()) ||
      pin.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesCat = selectedCategory === 'all' || pin.category === selectedCategory;

    return matchesSearch && matchesCat;
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortBy === 'distance') return a.distance - b.distance;
    if (sortBy === 'name') return a.pin.title.localeCompare(b.pin.title);
    return b.pin.createdAt - a.pin.createdAt;
  });

  const handleExport = () => {
    const geojson = exportToGeoJSON(pins);
    const blob = new Blob([geojson], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geoxr-anchors-${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    audioManager.playButtonTick();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = parseImportedPins(text);
        if (imported.length > 0) {
          onImportPins(imported);
          audioManager.playAnchorPlaced();
          alert(`Successfully imported ${imported.length} physical world anchor pins!`);
        } else {
          alert('No valid anchor pin coordinates found in file.');
        }
      } catch (err) {
        alert('Failed to parse file: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-xl h-[85vh] sm:h-[75vh] bg-slate-950 border border-white/15 rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Top Handle / Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  World Anchor Registry
                </h2>
                <span className="text-xs text-slate-400">
                  {pins.length} persistent physical anchors saved
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenCreate}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New Pin</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search bar & filter */}
          <div className="mt-3.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search anchors or tags..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'distance' | 'name' | 'date')}
              className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
            >
              <option value="distance" className="bg-slate-900 text-white">Nearest</option>
              <option value="name" className="bg-slate-900 text-white">Name</option>
              <option value="date" className="bg-slate-900 text-white">Recent</option>
            </select>
          </div>
        </div>

        {/* Pin List Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No matching anchor pins found.
            </div>
          ) : (
            filtered.map(({ pin, distance, bearing }) => {
              const isSelected = pin.id === selectedPinId;

              return (
                <div
                  key={pin.id}
                  onClick={() => {
                    onSelectPin(pin);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-400/60 shadow-lg shadow-cyan-950/50'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 text-xs font-bold"
                      style={{ backgroundColor: pin.color || '#06b6d4' }}
                    >
                      <MapPin className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">
                          {pin.category}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-[10px] text-slate-400 font-mono-ar">
                          {pin.latitude.toFixed(4)}°, {pin.longitude.toFixed(4)}°
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white truncate">{pin.title}</h4>
                      {pin.description && (
                        <p className="text-xs text-slate-400 truncate max-w-xs">
                          {pin.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono-ar tabular-nums text-cyan-300">
                        {formatDistance(distance)}
                      </div>
                      <div className="text-[10px] font-mono-ar text-slate-400">
                        {formatBearing(bearing)}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePin(pin.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete pin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Import / Export */}
        <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export GeoJSON</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Import</span>
              <input
                type="file"
                accept=".json,.geojson"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          </div>

          <span className="text-[11px] font-mono-ar text-slate-400">
            Stored locally in browser
          </span>
        </div>
      </div>
    </div>
  );
};
