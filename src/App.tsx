import React, { useState, useEffect, useCallback } from 'react';
import { AnchorPin, ARSettings } from './types';
import { useGeolocation } from './hooks/useGeolocation';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import {
  DEFAULT_SETTINGS,
  loadSavedPins,
  loadSavedSettings,
  savePinsToStorage,
  saveSettingsToStorage,
} from './utils/storage';
import { generateCuratedNearbyPins } from './utils/geo';
import { audioManager } from './utils/audio';
import { ARCanvas } from './components/ARCanvas';
import { AFrameScene } from './components/AFrameScene';
import { RadarCompass } from './components/RadarCompass';
import { OffScreenIndicators } from './components/OffScreenIndicators';
import { PinDetailCard } from './components/PinDetailCard';
import { CreatePinModal } from './components/CreatePinModal';
import { PinListDrawer } from './components/PinListDrawer';
import { SimulatorControls } from './components/SimulatorControls';
import { SettingsModal } from './components/SettingsModal';
import confetti from 'canvas-confetti';
import {
  MapPin,
  Plus,
  List,
  Sliders,
  Compass,
  Navigation,
  Sparkles,
  Footprints,
  Layers,
  ShieldAlert,
} from 'lucide-react';

export default function App() {
  // 1. Settings state
  const [settings, setSettings] = useState<ARSettings>(() => loadSavedSettings());

  // 2. Geolocation hook
  const {
    coords: userCoords,
    status: gpsStatus,
    satellitesEstimated,
    walkStep,
    teleport,
  } = useGeolocation();

  // 3. Device Orientation hook
  const {
    orientation,
    needsPermission: needsOrientationPermission,
    requestPermission: requestOrientationPermission,
    startDrag,
    moveDrag,
    endDrag,
  } = useDeviceOrientation(settings.headingOffset);

  // 4. Anchor Pins state
  const [pins, setPins] = useState<AnchorPin[]>([]);
  const [hasInitializedPins, setHasInitializedPins] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // 5. UI Modals & Drawers state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditingPin, setIsEditingPin] = useState<AnchorPin | null>(null);
  const [isListDrawerOpen, setIsListDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState(true);

  // Load saved pins or initialize nearby pins around user's initial GPS
  useEffect(() => {
    const saved = loadSavedPins();
    if (saved && saved.length > 0) {
      setPins(saved);
      setHasInitializedPins(true);
    } else if (userCoords.latitude && !hasInitializedPins) {
      // Seed default contextual pins around user's initial GPS
      const initialPresets = generateCuratedNearbyPins(userCoords.latitude, userCoords.longitude);
      setPins(initialPresets);
      savePinsToStorage(initialPresets);
      setHasInitializedPins(true);
    }
  }, [userCoords.latitude, userCoords.longitude, hasInitializedPins]);

  // Persist pins whenever modified
  const updatePins = useCallback((newPins: AnchorPin[]) => {
    setPins(newPins);
    savePinsToStorage(newPins);
  }, []);

  const handleUpdateSettings = useCallback((newSettings: Partial<ARSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveSettingsToStorage(updated);
      return updated;
    });
  }, []);

  // Quick 1-tap "Drop Anchor Here"
  const handleQuickDropAnchor = () => {
    const now = Date.now();
    const count = pins.length + 1;
    const colors = ['#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];
    const chosenColor = colors[count % colors.length];

    const newPin: AnchorPin = {
      id: `pin-quick-${now}`,
      title: `Anchor #${count}`,
      description: `Physical anchor dropped at ${userCoords.latitude.toFixed(5)}, ${userCoords.longitude.toFixed(5)}`,
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
      altitude: userCoords.altitude ? Math.round(userCoords.altitude * 10) / 10 : 1.5,
      category: 'waypoint',
      color: chosenColor,
      createdAt: now,
      tags: ['QuickDrop', 'PhysicalAnchor'],
    };

    const nextPins = [newPin, ...pins];
    updatePins(nextPins);
    setSelectedPinId(newPin.id);
    audioManager.playAnchorPlaced();

    try {
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.85 },
      });
    } catch {
      // Confetti fail-safe
    }
  };

  const handleSavePin = (pin: AnchorPin) => {
    const existingIndex = pins.findIndex((p) => p.id === pin.id);
    let nextPins: AnchorPin[];
    if (existingIndex >= 0) {
      nextPins = [...pins];
      nextPins[existingIndex] = pin;
    } else {
      nextPins = [pin, ...pins];
    }
    updatePins(nextPins);
    setSelectedPinId(pin.id);
    setIsEditingPin(null);
  };

  const handleDeletePin = (id: string) => {
    const nextPins = pins.filter((p) => p.id !== id);
    updatePins(nextPins);
    if (selectedPinId === id) {
      setSelectedPinId(null);
    }
    audioManager.playButtonTick();
  };

  const handleResetSamplePins = () => {
    const initialPresets = generateCuratedNearbyPins(userCoords.latitude, userCoords.longitude);
    updatePins(initialPresets);
    setSelectedPinId(null);
    audioManager.playAnchorPlaced();
  };

  const selectedPin = pins.find((p) => p.id === selectedPinId) || null;

  return (
    <div className="relative w-screen h-[100dvh] bg-black text-white font-sans overflow-hidden select-none">
      {/* 1. TOP APP BAR (Strict 3-zone contract) */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/85 via-black/50 to-transparent pointer-events-auto">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            <Compass className="w-4 h-4 text-cyan-300" />
          </div>
          <span className="text-base font-bold tracking-tight text-white font-mono-ar">
            GeoXR
          </span>
        </div>

        {/* Zone 2: Clean unboxed metadata indicators */}
        <div className="flex items-center gap-2 text-xs font-mono-ar text-slate-300">
          <span className="flex items-center gap-1 text-cyan-300">
            <Navigation className="w-3 h-3 text-cyan-400" />
            <span>±{userCoords.accuracy}m</span>
          </span>
          <span className="text-slate-500">·</span>
          <span>{satellitesEstimated} sats</span>
          <span className="text-slate-500 hidden sm:inline">·</span>
          <span className="hidden sm:inline text-slate-400">
            {gpsStatus === 'active' ? 'GPS Locked' : 'Simulated GPS'}
          </span>
        </div>

        {/* Zone 3: Primary Header Actions */}
        <div className="flex items-center gap-1.5">
          {/* Mode Switcher Shortcut */}
          <button
            onClick={() => {
              handleUpdateSettings({
                renderMode: settings.renderMode === 'threejs' ? 'aframe' : 'threejs',
              });
              audioManager.playButtonTick();
            }}
            title="Switch Render Engine"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-slate-300 hover:text-white"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Settings Button */}
          <button
            onClick={() => {
              setIsSettingsOpen(true);
              audioManager.playButtonTick();
            }}
            title="Settings & Calibration"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-slate-300 hover:text-white"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. MAIN 3D AR VIEWPORT */}
      <main className="relative w-full h-full">
        {settings.renderMode === 'threejs' ? (
          <ARCanvas
            userCoords={userCoords}
            orientation={orientation}
            pins={pins}
            settings={settings}
            selectedPinId={selectedPinId}
            onSelectPin={(pin) => {
              setSelectedPinId(pin.id);
              audioManager.playButtonTick();
            }}
            onDragStart={startDrag}
            onDragMove={moveDrag}
            onDragEnd={endDrag}
          />
        ) : (
          <AFrameScene
            userCoords={userCoords}
            orientation={orientation}
            pins={pins}
            settings={settings}
            selectedPinId={selectedPinId}
            onSelectPin={(pin) => {
              setSelectedPinId(pin.id);
              audioManager.playButtonTick();
            }}
            onSwitchMode={() => {
              handleUpdateSettings({ renderMode: 'threejs' });
              audioManager.playButtonTick();
            }}
          />
        )}

        {/* Off-screen edge guidance indicators */}
        <OffScreenIndicators
          userCoords={userCoords}
          heading={orientation.heading}
          pins={pins}
          selectedPinId={selectedPinId}
          onSelectPin={(pin) => {
            setSelectedPinId(pin.id);
            audioManager.playButtonTick();
          }}
        />

        {/* Top-Right Circular Radar & Compass */}
        {settings.showRadar && (
          <div className="absolute top-16 right-3 z-30 pointer-events-auto">
            <RadarCompass
              userCoords={userCoords}
              heading={orientation.heading}
              pins={pins}
              selectedPinId={selectedPinId}
              onSelectPin={(pin) => {
                setSelectedPinId(pin.id);
                audioManager.playButtonTick();
              }}
            />
          </div>
        )}

        {/* Virtual GPS Nav / Simulator Toggle & Controls */}
        <div className="absolute top-16 left-3 z-30 pointer-events-auto">
          {showSimulator ? (
            <SimulatorControls
              userCoords={userCoords}
              heading={orientation.heading}
              onWalk={walkStep}
              onTeleport={teleport}
              stepMeters={settings.simulatedWalkStepMeters}
            />
          ) : (
            <button
              onClick={() => {
                setShowSimulator(true);
                audioManager.playButtonTick();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/20 text-xs font-medium text-cyan-300 shadow-lg active:scale-95 transition-all"
            >
              <Footprints className="w-3.5 h-3.5 text-cyan-400" />
              <span>Virtual Walk</span>
            </button>
          )}
        </div>

        {/* iOS Gyroscope/Compass Permission Banner */}
        {needsOrientationPermission && permissionNotice && (
          <div className="absolute top-36 left-4 right-4 z-40 p-4 rounded-2xl bg-cyan-950/90 backdrop-blur-xl border border-cyan-500/50 text-white shadow-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Compass className="w-6 h-6 text-cyan-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-white">Enable Motion & Compass</h4>
                <p className="text-[11px] text-slate-300">
                  Required for real-world physical anchor alignment.
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                const granted = await requestOrientationPermission();
                if (granted) setPermissionNotice(false);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs shrink-0 active:scale-95 shadow-md"
            >
              Enable
            </button>
          </div>
        )}

        {/* 3. SELECTED PIN EXPANDED DETAIL CARD */}
        {selectedPin && (
          <div className="absolute bottom-20 left-4 right-4 z-30 pointer-events-auto max-w-md mx-auto">
            <PinDetailCard
              pin={selectedPin}
              userCoords={userCoords}
              heading={orientation.heading}
              onClose={() => setSelectedPinId(null)}
              onEdit={(pin) => {
                setIsEditingPin(pin);
                setIsCreateModalOpen(true);
              }}
              onDelete={handleDeletePin}
            />
          </div>
        )}
      </main>

      {/* 4. BOTTOM THUMB-ZONE ACTION BAR (Adhering to <15% sticky cap) */}
      <footer className="absolute bottom-0 inset-x-0 z-30 p-3 sm:p-4 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-auto">
        <div className="max-w-md mx-auto flex items-center gap-2.5">
          {/* Registry Drawer Button */}
          <button
            onClick={() => {
              setIsListDrawerOpen(true);
              audioManager.playButtonTick();
            }}
            className="h-12 px-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all text-xs font-semibold shrink-0"
          >
            <List className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline font-mono-ar tabular-nums">({pins.length})</span>
          </button>

          {/* PRIMARY CTA: Quick Drop Anchor Here */}
          <button
            onClick={handleQuickDropAnchor}
            className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95 transition-all"
          >
            <MapPin className="w-4 h-4 text-slate-950 fill-current" />
            <span className="tracking-tight">Drop Anchor Here</span>
          </button>

          {/* Add Custom Anchor Pin Button */}
          <button
            onClick={() => {
              setIsEditingPin(null);
              setIsCreateModalOpen(true);
              audioManager.playButtonTick();
            }}
            className="h-12 px-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all text-xs font-semibold shrink-0"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Custom</span>
          </button>
        </div>
      </footer>

      {/* 5. CREATE / EDIT PIN MODAL */}
      <CreatePinModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditingPin(null);
        }}
        onSave={handleSavePin}
        userCoords={userCoords}
        initialPin={isEditingPin}
      />

      {/* 6. PIN LIST DRAWER */}
      <PinListDrawer
        isOpen={isListDrawerOpen}
        onClose={() => setIsListDrawerOpen(false)}
        pins={pins}
        userCoords={userCoords}
        selectedPinId={selectedPinId}
        onSelectPin={(pin) => {
          setSelectedPinId(pin.id);
          audioManager.playButtonTick();
        }}
        onDeletePin={handleDeletePin}
        onOpenCreate={() => {
          setIsListDrawerOpen(false);
          setIsEditingPin(null);
          setIsCreateModalOpen(true);
        }}
        onImportPins={(imported) => {
          updatePins([...imported, ...pins]);
        }}
      />

      {/* 7. SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetPins={handleResetSamplePins}
      />
    </div>
  );
}
