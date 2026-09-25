import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceHeading } from '../types';

export interface DeviceOrientationState {
  orientation: DeviceHeading;
  hasSensors: boolean;
  needsPermission: boolean;
  requestPermission: () => Promise<boolean>;
  manualHeading: number;
  setManualHeading: (val: number | ((prev: number) => number)) => void;
  manualPitch: number;
  setManualPitch: (val: number | ((prev: number) => number)) => void;
  isDragging: boolean;
  startDrag: (clientX: number, clientY: number) => void;
  moveDrag: (clientX: number, clientY: number) => void;
  endDrag: () => void;
}

export function useDeviceOrientation(headingOffset: number = 0): DeviceOrientationState {
  const [heading, setHeading] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(0);
  const [roll, setRoll] = useState<number>(0);
  const [hasSensors, setHasSensors] = useState<boolean>(false);
  const [needsPermission, setNeedsPermission] = useState<boolean>(false);
  const [source, setSource] = useState<DeviceHeading['source']>('fallback');

  // Manual look-around angles (used in desktop or drag override)
  const [manualHeading, setManualHeading] = useState<number>(0);
  const [manualPitch, setManualPitch] = useState<number>(0);

  const dragStartRef = useRef<{ x: number; y: number; startHeading: number; startPitch: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Check iOS permission requirement
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function'
    ) {
      setNeedsPermission(true);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const DeviceOrientationEventAny = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof DeviceOrientationEventAny.requestPermission === 'function') {
        const response = await DeviceOrientationEventAny.requestPermission();
        if (response === 'granted') {
          setNeedsPermission(false);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.warn('Orientation permission error:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    let sensorReceived = false;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let currentHeading: number | null = null;

      // iOS provides accurate compass heading via webkitCompassHeading
      const iosHeading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof iosHeading === 'number' && !isNaN(iosHeading)) {
        currentHeading = iosHeading;
        setSource('magnetometer');
      } else if (e.alpha !== null && !isNaN(e.alpha)) {
        // Android / standard absolute orientation
        // alpha: 0 is North if absolute, or relative to initial direction
        // In standard W3C, alpha is counter-clockwise rotation around Z
        currentHeading = (360 - e.alpha) % 360;
        setSource('magnetometer');
      }

      if (currentHeading !== null) {
        sensorReceived = true;
        setHasSensors(true);
        setHeading(currentHeading);
      }

      if (e.beta !== null) {
        // Beta: front-to-back tilt in degrees (-180 to 180). When phone is vertical upright, beta ~ 90
        // Pitch: -90 (looking down) to +90 (looking up)
        const computedPitch = (e.beta - 90);
        setPitch(Math.max(-85, Math.min(85, computedPitch)));
      }

      if (e.gamma !== null) {
        setRoll(e.gamma);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation, true);
      window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation, true);
        window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
      }
    };
  }, []);

  // Drag interaction handlers for touch or mouse look-around
  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      dragStartRef.current = {
        x: clientX,
        y: clientY,
        startHeading: manualHeading,
        startPitch: manualPitch,
      };
      setIsDragging(true);
    },
    [manualHeading, manualPitch]
  );

  const moveDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragStartRef.current) return;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;

      // Sensitivity: 0.25 degrees per pixel
      const newHeading = (dragStartRef.current.startHeading - dx * 0.25 + 360) % 360;
      const newPitch = Math.max(-85, Math.min(85, dragStartRef.current.startPitch + dy * 0.25));

      setManualHeading(newHeading);
      setManualPitch(newPitch);
    },
    []
  );

  const endDrag = useCallback(() => {
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  // Compute final effective heading combining sensor, manual override, and offset
  const baseHeading = hasSensors ? heading : manualHeading;
  const effectiveHeading = (baseHeading + headingOffset + 360) % 360;
  const effectivePitch = hasSensors ? pitch : manualPitch;

  return {
    orientation: {
      heading: effectiveHeading,
      pitch: effectivePitch,
      roll,
      isCalibrated: hasSensors,
      source: hasSensors ? source : 'simulated',
    },
    hasSensors,
    needsPermission,
    requestPermission,
    manualHeading,
    setManualHeading,
    manualPitch,
    setManualPitch,
    isDragging,
    startDrag,
    moveDrag,
    endDrag,
  };
}
