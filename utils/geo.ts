
import { GeoLocation } from '../types';
import { formatDistanceToNow } from 'date-fns';

export const calculateDistance = (loc1: GeoLocation, loc2: GeoLocation): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (loc1.latitude * Math.PI) / 180;
  const φ2 = (loc2.latitude * Math.PI) / 180;
  const Δφ = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const Δλ = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

export const calculateDestination = (start: GeoLocation, distance: number, bearing: number): GeoLocation => {
  const R = 6371e3; // Earth radius in meters
  const δ = distance / R; // angular distance in radians
  const θ = (bearing * Math.PI) / 180; // bearing in radians
  const φ1 = (start.latitude * Math.PI) / 180;
  const λ1 = (start.longitude * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );

  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return {
    ...start,
    latitude: (φ2 * 180) / Math.PI,
    longitude: (λ2 * 180) / Math.PI,
    timestamp: Date.now()
  };
};

export const formatDistance = (meters: number): string => {
  if (meters < 5) return "Nearby";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

export const getRelativeTime = (timestamp: number): string => {
  return formatDistanceToNow(timestamp, { addSuffix: true });
};

// Improved precision using Weighted Average based on accuracy
export const averageGeolocation = (locations: GeoLocation[]): GeoLocation | null => {
  if (locations.length === 0) return null;

  const goodSamples = locations.filter(l => l.accuracy < 50);
  const samplesToUse = goodSamples.length > 3 ? goodSamples : locations;

  let totalWeight = 0;
  let weightedLat = 0;
  let weightedLng = 0;
  let weightedAcc = 0;

  samplesToUse.forEach(loc => {
    const weight = 1 / (loc.accuracy + 0.1);

    weightedLat += loc.latitude * weight;
    weightedLng += loc.longitude * weight;
    weightedAcc += loc.accuracy * weight;
    totalWeight += weight;
  });

  return {
    latitude: weightedLat / totalWeight,
    longitude: weightedLng / totalWeight,
    accuracy: (weightedAcc / totalWeight) * 0.8,
    heading: locations[locations.length - 1].heading,
    timestamp: Date.now()
  };
};

export const getCurrentPosition = (): Promise<GeoLocation> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  });
};

// ============================================================================
// PROXIMITY GATING FOR AR OBJECT MATCHING
// ============================================================================

/**
 * Normalize angle to 0-360 range
 */
export const normalizeAngle = (angle: number): number => {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
};

/**
 * Calculate angular difference between two headings (0-180)
 */
export const headingDelta = (heading1: number | null | undefined, heading2: number | null | undefined): number => {
  if (heading1 == null || heading2 == null) return 180; // Max if unknown

  const h1 = normalizeAngle(heading1);
  const h2 = normalizeAngle(heading2);
  const diff = Math.abs(h1 - h2);

  return Math.min(diff, 360 - diff);
};

interface ARObjectLike {
  gps?: { lat: number; lng: number } | null;
  heading?: number | null;
}

/**
 * Filter AR objects by GPS proximity
 */
export const filterByProximity = <T extends ARObjectLike>(
  currentGps: { latitude: number; longitude: number },
  objects: T[],
  radiusMeters: number = 50
): T[] => {
  return objects.filter(obj => {
    if (!obj.gps) return false;

    const distance = calculateDistance(
      { latitude: currentGps.latitude, longitude: currentGps.longitude } as GeoLocation,
      { latitude: obj.gps.lat, longitude: obj.gps.lng } as GeoLocation
    );

    return distance <= radiusMeters;
  });
};

/**
 * Filter AR objects by heading cone
 */
export const filterByHeadingCone = <T extends ARObjectLike>(
  currentHeading: number | null | undefined,
  objects: T[],
  coneAngle: number = 60
): T[] => {
  if (currentHeading == null) return objects; // Can't filter if no heading

  return objects.filter(obj => {
    const delta = headingDelta(currentHeading, obj.heading);
    return delta <= coneAngle / 2;
  });
};

/**
 * Combined proximity gating: GPS + heading cone
 */
export const applyProximityGating = <T extends ARObjectLike>(
  currentGps: { latitude: number; longitude: number },
  currentHeading: number | null | undefined,
  objects: T[],
  radiusMeters: number = 50,
  coneAngle: number = 90
): T[] => {
  // First filter by GPS
  const nearbyObjects = filterByProximity(currentGps, objects, radiusMeters);

  // Then filter by heading cone
  return filterByHeadingCone(currentHeading, nearbyObjects, coneAngle);
};

