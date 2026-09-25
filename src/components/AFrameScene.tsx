import React, { useEffect, useRef } from 'react';
import { AnchorPin, ARSettings, DeviceHeading, UserCoordinates } from '../types';
import { formatDistance, gpsToLocalENU } from '../utils/geo';
import { AlertTriangle, Layers, Navigation } from 'lucide-react';

interface AFrameSceneProps {
  userCoords: UserCoordinates;
  orientation: DeviceHeading;
  pins: AnchorPin[];
  settings: ARSettings;
  selectedPinId: string | null;
  onSelectPin: (pin: AnchorPin) => void;
  onSwitchMode: () => void;
}

export const AFrameScene: React.FC<AFrameSceneProps> = ({
  userCoords,
  pins,
  settings,
  selectedPinId,
  onSelectPin,
  onSwitchMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-render A-Frame entities whenever pins or user coordinates change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if A-Frame is loaded on window
    const hasAFrame = typeof window !== 'undefined' && 'AFRAME' in window;
    if (!hasAFrame) return;

    const sceneEl = container.querySelector('a-scene');
    if (!sceneEl) return;

    // Remove old pin entities
    const oldEntities = sceneEl.querySelectorAll('.gps-anchor-entity');
    oldEntities.forEach((el) => el.parentNode?.removeChild(el));

    // Append new pin entities
    pins.forEach((pin) => {
      const enu = gpsToLocalENU(
        userCoords,
        pin.latitude,
        pin.longitude,
        pin.altitude ?? 0,
        settings.horizonCompression
      );

      const entity = document.createElement('a-entity');
      entity.className = 'gps-anchor-entity';
      entity.setAttribute('position', `${enu.x.toFixed(2)} ${enu.y.toFixed(2)} ${enu.z.toFixed(2)}`);

      // 1. Floating Diamond / Marker
      const diamond = document.createElement('a-octahedron');
      diamond.setAttribute('radius', '0.6');
      diamond.setAttribute('color', pin.color || '#06b6d4');
      diamond.setAttribute('position', '0 1.2 0');
      diamond.setAttribute(
        'animation',
        'property: rotation; to: 0 360 0; loop: true; dur: 4000; easing: linear'
      );
      entity.appendChild(diamond);

      // 2. Sky Beacon Cylinder
      if (settings.showSkyBeacons) {
        const beacon = document.createElement('a-cylinder');
        beacon.setAttribute('radius', '0.2');
        beacon.setAttribute('height', '30');
        beacon.setAttribute('color', pin.color || '#06b6d4');
        beacon.setAttribute('opacity', '0.25');
        beacon.setAttribute('position', '0 15 0');
        beacon.setAttribute('material', 'transparent: true; side: double');
        entity.appendChild(beacon);
      }

      // 3. Ground ring
      const ring = document.createElement('a-ring');
      ring.setAttribute('radius-inner', '0.4');
      ring.setAttribute('radius-outer', '0.8');
      ring.setAttribute('rotation', '-90 0 0');
      ring.setAttribute('color', pin.color || '#06b6d4');
      ring.setAttribute('opacity', '0.7');
      ring.setAttribute('position', '0 0.05 0');
      entity.appendChild(ring);

      // 4. 3D Information Label Billboarding toward user
      const label = document.createElement('a-text');
      const distStr = formatDistance(enu.distance);
      label.setAttribute('value', `${pin.title}\n[ ${distStr} ]`);
      label.setAttribute('align', 'center');
      label.setAttribute('position', '0 2.2 0');
      label.setAttribute('scale', '1.2 1.2 1.2');
      label.setAttribute('color', '#ffffff');
      label.setAttribute('baseline', 'bottom');
      entity.appendChild(label);

      // Click event
      entity.addEventListener('click', () => {
        onSelectPin(pin);
      });

      sceneEl.appendChild(entity);
    });
  }, [pins, userCoords, settings.horizonCompression, settings.showSkyBeacons, onSelectPin]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
      {/* Mode Switcher Banner */}
      <div className="absolute top-16 left-4 right-4 z-30 flex items-center justify-between p-3 rounded-2xl bg-purple-950/80 backdrop-blur-md border border-purple-500/40 text-purple-200 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-400 shrink-0" />
          <span>A-Frame Declarative WebXR Scene Active</span>
        </div>
        <button
          onClick={onSwitchMode}
          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-colors active:scale-95"
        >
          Switch to Spatial AR
        </button>
      </div>

      {/* Declarative A-Frame Scene */}
      <div
        dangerouslySetInnerHTML={{
          __html: `
            <a-scene embedded vr-mode-ui="enabled: true" style="width: 100%; height: 100%;">
              <a-camera look-controls wasd-controls position="0 1.6 0">
                <a-cursor color="#06b6d4" fuse="false" raycaster="objects: .gps-anchor-entity"></a-cursor>
              </a-camera>
              <a-light type="ambient" color="#ffffff" intensity="0.8"></a-light>
              <a-light type="directional" color="#ffffff" intensity="1.2" position="5 15 5"></a-light>
              <!-- Spatial Skybox -->
              <a-sky color="#030712"></a-sky>
              <a-plane position="0 0 0" rotation="-90 0 0" width="200" height="200" color="#0f172a" opacity="0.8"></a-plane>
            </a-scene>
          `,
        }}
        className="w-full h-full"
      />
    </div>
  );
};
