import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { AnchorPin, ARSettings, DeviceHeading, LocalENUCoords, UserCoordinates } from '../types';
import { formatBearing, formatDistance, gpsToLocalENU } from '../utils/geo';
import { audioManager } from '../utils/audio';
import {
  Camera,
  Compass,
  Crosshair,
  Maximize2,
  AlertCircle,
  Sparkles,
  MapPin,
  Volume2,
} from 'lucide-react';

interface ProjectedPinCard {
  pin: AnchorPin;
  enu: LocalENUCoords;
  screenX: number;
  screenY: number;
  isVisible: boolean;
  isInFrustum: boolean;
  scale: number;
  isFocused: boolean;
}

interface ARCanvasProps {
  userCoords: UserCoordinates;
  orientation: DeviceHeading;
  pins: AnchorPin[];
  settings: ARSettings;
  selectedPinId: string | null;
  onSelectPin: (pin: AnchorPin) => void;
  onPlacePinAtReticle?: () => void;
  onDragStart: (x: number, y: number) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
}

export const ARCanvas: React.FC<ARCanvasProps> = ({
  userCoords,
  orientation,
  pins,
  settings,
  selectedPinId,
  onSelectPin,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [cameraStreamActive, setCameraStreamActive] = useState<boolean>(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [projectedCards, setProjectedCards] = useState<ProjectedPinCard[]>([]);
  const [lockedPinId, setLockedPinId] = useState<string | null>(null);
  const [webXRSupported, setWebXRSupported] = useState<boolean>(false);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pinMeshesGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastChirpPinRef = useRef<string | null>(null);

  // Check WebXR
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'xr' in navigator) {
      (navigator as unknown as { xr: { isSessionSupported: (mode: string) => Promise<boolean> } }).xr
        ?.isSessionSupported('immersive-ar')
        .then((supported: boolean) => setWebXRSupported(supported))
        .catch(() => setWebXRSupported(false));
    }
  }, []);

  // Initialize camera video stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    async function initCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermissionError('Camera API is not supported in this browser.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setCameraStreamActive(true);
            setCameraPermissionError(null);
          };
        }
      } catch (err) {
        console.warn('Camera access unavailable:', err);
        setCameraPermissionError(
          'Camera access paused or blocked. Using simulated spatial world environment.'
        );
        setCameraStreamActive(false);
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.set(0, 1.6, 0); // eye level 1.6m

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Ambient and directional lighting for 3D pins
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Group for pins
    const pinGroup = new THREE.Group();
    pinMeshesGroupRef.current = pinGroup;
    scene.add(pinGroup);

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      renderer.dispose();
    };
  }, []);

  // Update 3D Pins in scene whenever pins or userCoords change
  useEffect(() => {
    const group = pinMeshesGroupRef.current;
    if (!group) return;

    // Clear previous pin objects
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }

    // Build 3D mesh representations for each pin
    pins.forEach((pin) => {
      const enu = gpsToLocalENU(
        userCoords,
        pin.latitude,
        pin.longitude,
        pin.altitude ?? 0,
        settings.horizonCompression
      );

      const pinColor = new THREE.Color(pin.color || '#06b6d4');
      const pinContainer = new THREE.Group();
      pinContainer.name = pin.id;
      // Position at ENU coordinates (X: East, Y: Up, Z: -North)
      pinContainer.position.set(enu.x, enu.y, enu.z);

      // 1. Floating Diamond / Marker
      const markerGeo = new THREE.OctahedronGeometry(0.7, 0);
      const markerMat = new THREE.MeshStandardMaterial({
        color: pinColor,
        emissive: pinColor,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8,
      });
      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.y = 1.0;
      markerMesh.userData = { isMarker: true };
      pinContainer.add(markerMesh);

      // Inner Glowing Core
      const coreGeo = new THREE.SphereGeometry(0.3, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.y = 1.0;
      pinContainer.add(coreMesh);

      // 2. Vertical Sky Light Beacon (reaching into the sky)
      if (settings.showSkyBeacons) {
        const beaconHeight = 35;
        const beaconGeo = new THREE.CylinderGeometry(0.08, 0.45, beaconHeight, 16, 1, true);
        const beaconMat = new THREE.MeshBasicMaterial({
          color: pinColor,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        beaconMesh.position.y = beaconHeight / 2;
        pinContainer.add(beaconMesh);
      }

      // 3. Ground Anchor Rings (pulsing ripples)
      const ringGeo = new THREE.RingGeometry(0.5, 0.8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: pinColor,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.05;
      ringMesh.userData = { isPulseRing: true };
      pinContainer.add(ringMesh);

      // 4. Ground Connection Laser Rod
      const rodHeight = Math.max(0.1, 1.0);
      const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, rodHeight, 8);
      const rodMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
      });
      const rodMesh = new THREE.Mesh(rodGeo, rodMat);
      rodMesh.position.y = rodHeight / 2;
      pinContainer.add(rodMesh);

      group.add(pinContainer);
    });
  }, [pins, userCoords, settings.horizonCompression, settings.showSkyBeacons]);

  // Main Render & Projection Loop
  useEffect(() => {
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const pinGroup = pinMeshesGroupRef.current;

      if (!camera || !renderer || !scene) return;

      // Update camera rotation based on device orientation
      // Heading (azimuth): 0 = North (-Z), 90 = East (+X)
      // Pitch: looking up (+pitch) / down (-pitch)
      // Roll: device tilt
      const yawRad = THREE.MathUtils.degToRad(-orientation.heading);
      const pitchRad = THREE.MathUtils.degToRad(orientation.pitch);
      const rollRad = THREE.MathUtils.degToRad(orientation.roll);

      const euler = new THREE.Euler(pitchRad, yawRad, rollRad, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      // Animate pin pulsing & floating diamonds
      if (pinGroup) {
        pinGroup.children.forEach((container, i) => {
          container.children.forEach((child) => {
            if (child.userData.isMarker) {
              // Floating hover & spin
              child.position.y = 1.0 + Math.sin(elapsedTime * 2.5 + i) * 0.15;
              child.rotation.y = elapsedTime * 1.5 + i;
            }
            if (child.userData.isPulseRing) {
              // Pulsing expanding ring
              const phase = (elapsedTime * 1.2 + i * 0.4) % 1;
              const scale = 1 + phase * 2.2;
              child.scale.set(scale, scale, scale);
              (child as THREE.Mesh).material = (child as THREE.Mesh).material as THREE.Material;
              ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.7;
            }
          });
        });
      }

      // Render Three.js WebGL scene
      renderer.render(scene, camera);

      // 2D Screen Projection for Information Cards & Center Reticle Lock-on
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        let closestCenterPinId: string | null = null;
        let minCenterDist = Infinity;

        const updatedCards: ProjectedPinCard[] = pins.map((pin) => {
          const enu = gpsToLocalENU(
            userCoords,
            pin.latitude,
            pin.longitude,
            pin.altitude ?? 0,
            settings.horizonCompression
          );

          // 3D vector for the pin marker
          const pos = new THREE.Vector3(enu.x, enu.y + 1.6, enu.z);
          // Duplicate vector to project
          const projected = pos.clone().project(camera);

          // Check if point is in front of the camera (projected.z < 1)
          const isInFrustum = projected.z < 1;

          // Convert Normalized Device Coordinates (-1 to +1) to screen pixels
          const screenX = (projected.x * 0.5 + 0.5) * width;
          const screenY = (-(projected.y * 0.5) + 0.5) * height;

          // Screen center distance for lock-on reticle
          const distToCenter = Math.hypot(projected.x, projected.y);
          if (isInFrustum && distToCenter < 0.22 && distToCenter < minCenterDist) {
            minCenterDist = distToCenter;
            closestCenterPinId = pin.id;
          }

          // Visual scale based on distance
          const scale = Math.max(0.75, Math.min(1.15, 25 / Math.max(10, enu.distance)));

          return {
            pin,
            enu,
            screenX,
            screenY,
            isVisible: isInFrustum && screenX >= -50 && screenX <= width + 50 && screenY >= -50 && screenY <= height + 50,
            isInFrustum,
            scale,
            isFocused: pin.id === selectedPinId || pin.id === closestCenterPinId,
          };
        });

        setProjectedCards(updatedCards);

        // Reticle lock-on chirp when aiming directly at a pin
        if (closestCenterPinId && closestCenterPinId !== lastChirpPinRef.current) {
          lastChirpPinRef.current = closestCenterPinId;
          audioManager.playLockOn();
        } else if (!closestCenterPinId) {
          lastChirpPinRef.current = null;
        }

        setLockedPinId(closestCenterPinId);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [pins, userCoords, orientation, selectedPinId, settings.horizonCompression]);

  // Touch and Mouse drag handling for manual look-around
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag if not clicking an interactive card
    if ((e.target as HTMLElement).closest('.interactive-card')) return;
    onDragStart(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    onDragMove(e.clientX, e.clientY);
  };

  const handlePointerUp = () => {
    onDragEnd();
  };

  const handleLaunchWebXR = async () => {
    if (typeof navigator !== 'undefined' && 'xr' in navigator && rendererRef.current) {
      try {
        const xr = (navigator as unknown as { xr: { requestSession: (mode: string, options?: unknown) => Promise<unknown> } }).xr;
        await xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['dom-overlay'],
          domOverlay: { root: containerRef.current },
        });
      } catch (err) {
        alert('WebXR AR Session not supported on this device/browser: ' + (err as Error).message);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative w-full h-full overflow-hidden select-none touch-none bg-slate-950"
    >
      {/* 1. Camera Video Feed Background */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-700 ${
          cameraStreamActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 2. Simulated Environment Backdrop (fallback when camera stream is denied or loading) */}
      {!cameraStreamActive && (
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-950 via-slate-900 to-cyan-950/40">
          {/* Spatial Grid Floor */}
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(6, 182, 212, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(6, 182, 212, 0.15) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              perspective: '600px',
              transform: 'rotateX(60deg) translateY(20%)',
            }}
          />

          {/* Fallback info chip */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-amber-500/30 text-amber-300 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Simulated Environment Active · Drag screen to look around</span>
          </div>
        </div>
      )}

      {/* 3. Three.js Transparent WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      />

      {/* 4. Center Reticle & Target Lock-On Indicator */}
      {settings.showReticle && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center">
          <div
            className={`w-12 h-12 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
              lockedPinId
                ? 'border-cyan-400 scale-125 bg-cyan-500/15 shadow-[0_0_15px_#06b6d4]'
                : 'border-white/25 scale-100'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                lockedPinId ? 'bg-cyan-300' : 'bg-white/50'
              }`}
            />
          </div>

          {lockedPinId && (
            <div className="mt-2 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono-ar font-bold text-cyan-300 tracking-wider">
              TARGET LOCKED
            </div>
          )}
        </div>
      )}

      {/* 5. 3D Billboarded Spatial Information Cards */}
      <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
        {projectedCards
          .filter((c) => c.isVisible)
          .map(({ pin, enu, screenX, screenY, scale, isFocused }) => {
            const isSelected = pin.id === selectedPinId;

            return (
              <div
                key={`card-${pin.id}`}
                className="absolute pointer-events-auto transition-transform duration-75"
                style={{
                  left: `${screenX}px`,
                  top: `${screenY}px`,
                  transform: `translate(-50%, -100%) scale(${scale})`,
                }}
              >
                {/* Information Card Container */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPin(pin);
                    audioManager.playButtonTick();
                  }}
                  className={`interactive-card group cursor-pointer rounded-2xl bg-slate-950/85 backdrop-blur-md border p-3 shadow-xl transition-all ${
                    isSelected || isFocused
                      ? 'border-white ring-2 ring-cyan-400/80 scale-105 shadow-cyan-500/20'
                      : 'border-white/20 hover:border-white/50'
                  }`}
                  style={{
                    minWidth: '160px',
                    maxWidth: '220px',
                    borderLeftWidth: '4px',
                    borderLeftColor: pin.color || '#06b6d4',
                  }}
                >
                  {/* Card Header: Category & Distance */}
                  <div className="flex items-center justify-between text-[10px] font-mono-ar">
                    <span className="uppercase font-bold tracking-wider text-slate-400">
                      {pin.category}
                    </span>
                    <span className="font-bold text-cyan-300 tabular-nums">
                      {formatDistance(enu.distance)}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-xs font-bold text-white tracking-tight mt-0.5 truncate">
                    {pin.title}
                  </h4>

                  {/* Bearing & Elevation */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                    <Compass className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="font-mono-ar tabular-nums">{formatBearing(enu.bearing)}</span>
                    <span>·</span>
                    <span className="font-mono-ar tabular-nums">
                      {enu.y >= 0 ? `+${enu.y.toFixed(1)}m` : `${enu.y.toFixed(1)}m`}
                    </span>
                  </div>

                  {/* Interactive hint on hover/focus */}
                  {(isSelected || isFocused) && (
                    <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[9px] text-cyan-300 font-semibold">
                      <span>Tap to Inspect</span>
                      <Sparkles className="w-3 h-3" />
                    </div>
                  )}
                </div>

                {/* Downward indicator triangle */}
                <div
                  className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] mx-auto -mt-0.5"
                  style={{ borderTopColor: pin.color || '#06b6d4' }}
                />
              </div>
            );
          })}
      </div>

      {/* 6. WebXR Immersive Launch Button (if device supports WebXR) */}
      {webXRSupported && (
        <button
          onClick={handleLaunchWebXR}
          className="absolute bottom-24 right-4 z-30 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 active:scale-95 transition-all"
        >
          <Maximize2 className="w-4 h-4" />
          <span>Launch WebXR AR</span>
        </button>
      )}
    </div>
  );
};
