
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  timestamp: number;
}

export interface ARData {
  heading: number;
  pitch: number;
  roll: number;
}

export interface Place {
  id: string;
  image: string; // Base64 data URL (poster frame for video)
  video?: string; // Base64 data URL for video content
  mediaType: 'image' | 'video';
  location: GeoLocation;
  arData?: ARData; // Orientation data for AR relocalization
  note: string;
  createdAt: number;
  type: 'anchor' | 'object';
}

export type AppView = 'dashboard' | 'capture' | 'detail' | 'timeline' | 'ar';

export interface PlaceContextType {
  places: Place[];
  addPlace: (place: Place) => void;
  removePlace: (id: string) => void;
  selectedPlaceId: string | null;
  selectPlace: (id: string | null) => void;
}

export type GuidancePhase = 'FAR' | 'APPROACHING' | 'NEAR' | 'ARRIVED';

export interface GuidanceResponse {
  phase: GuidancePhase;
  phaseDescription: string;
  confidence: number; // 0-1
  rawSimilarity: number;
  roomMatch: {
    targetRoom: string;
    likelyCurrentRoom: string;
    similarity: number;
  };
  direction: {
    hint: string;
    action: 'FORWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'TURN_AROUND' | 'SCAN' | 'EXPLORE';
    relativeBearing: number | null;
    confidence: number;
  };
  object: {
    id: string;
    label: string;
    description?: string;
    elevationHint?: string;
    referencePhoto?: string;
  };
  showGhostImage: boolean;
  showDirectionalArrow: boolean;
}
