import { Geolocation } from '@capacitor/geolocation';

export type ReliablePosition = GeolocationPosition | {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
};

const browserPosition = (
  options: PositionOptions,
  useWatch = false
): Promise<GeolocationPosition> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Geolocation unavailable'));
  }

  if (!useWatch) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    const timeout = window.setTimeout(() => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      reject(new Error('GPS timeout'));
    }, options.timeout ?? 60000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        window.clearTimeout(timeout);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        resolve(position);
      },
      (error) => {
        window.clearTimeout(timeout);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        reject(error);
      },
      options
    );
  });
};

export async function getReliablePosition(): Promise<ReliablePosition> {
  const attempts: Array<() => Promise<ReliablePosition>> = [
    () => Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 }),
    () => Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 45000, maximumAge: 60000 }),
    () => browserPosition({ enableHighAccuracy: true, timeout: 45000, maximumAge: 60000 }),
    () => browserPosition({ enableHighAccuracy: false, timeout: 60000, maximumAge: 120000 }),
    () => browserPosition({ enableHighAccuracy: true, timeout: 60000, maximumAge: 0 }, true),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to get GPS location');
}