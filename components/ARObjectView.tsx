import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Place, GeoLocation, GuidancePhase } from '../types';
import { getCurrentPosition, calculateDistance } from '../utils/geo';
import { useGuidance } from '../hooks/useGuidance';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Navigation, ArrowUp, ChevronUp, ChevronDown, Camera, Check, Eye, MapPin, Wifi, Signal } from 'lucide-react';

interface ARObjectViewProps {
  existingObjects: Place[];
  onSave: (place: Place) => void;
  triggerCreation?: boolean;
  onCreationTriggerHandled?: () => void;
  onInteractionStateChange?: (isInteracting: boolean) => void;
}

// --- DIRECTIONAL MATH UTILITIES ---

function toRad(deg: number) {
  return deg * Math.PI / 180;
}

function toDeg(rad: number) {
  return rad * 180 / Math.PI;
}

function bearingFromTo(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dLng = toRad(toLng - fromLng);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// --- COMPONENT ---

export const ARObjectView: React.FC<ARObjectViewProps> = ({
  existingObjects,
  onSave,
  triggerCreation,
  onCreationTriggerHandled,
  onInteractionStateChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // State
  const [mode, setMode] = useState<'BROWSE' | 'GUIDING' | 'PLACING' | 'REVIEW'>('BROWSE');
  const [activeObj, setActiveObj] = useState<Place | null>(null);

  // Sensors
  const [userLoc, setUserLoc] = useState<GeoLocation | null>(null);
  const [heading, setHeading] = useState<number>(0);

  // Placement
  const [capturedImg, setCapturedImg] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [selectedElevation, setSelectedElevation] = useState<'floor' | 'eye' | 'overhead'>('eye');

  // New Guidance Hook
  const { guidance, error } = useGuidance({
    targetObjectId: activeObj?.id || null,
    currentHeading: heading,
    isEnabled: mode === 'GUIDING'
  });

  // Report interaction state up to App to toggle BottomNav
  useEffect(() => {
    if (onInteractionStateChange) {
      onInteractionStateChange(mode === 'PLACING' || mode === 'REVIEW');
    }
  }, [mode, onInteractionStateChange]);

  // Handle external trigger (e.g. from BottomFAB)
  useEffect(() => {
    if (triggerCreation && mode !== 'PLACING' && mode !== 'REVIEW') {
      setMode('PLACING');
      if (onCreationTriggerHandled) onCreationTriggerHandled();
    }
  }, [triggerCreation, mode, onCreationTriggerHandled]);

  // --- Init Camera & Sensors ---
  useEffect(() => {
    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) { console.error(e); }
    };
    startCam();

    // Get GPS
    getCurrentPosition().then(setUserLoc);
    const gpsInterval = setInterval(() => {
      getCurrentPosition().then(setUserLoc).catch(() => { });
    }, 5000);

    // Compass
    const handleOrient = (e: DeviceOrientationEvent) => {
      const alpha = (e as any).webkitCompassHeading || (360 - (e.alpha || 0));
      setHeading(alpha % 360);
    };

    if (typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
      window.addEventListener('deviceorientation', handleOrient);
    }

    return () => {
      clearInterval(gpsInterval);
      window.removeEventListener('deviceorientation', handleOrient);
    };
  }, []);

  // --- Handlers ---
  const handleCapture = () => {
    if (!videoRef.current) return;
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 256;
    const vid = videoRef.current;
    const min = Math.min(vid.videoWidth, vid.videoHeight);
    cvs.getContext('2d')?.drawImage(vid, (vid.videoWidth - min) / 2, (vid.videoHeight - min) / 2, min, min, 0, 0, 256, 256);
    setCapturedImg(cvs.toDataURL('image/jpeg', 0.7));
    setMode('REVIEW');
  };

  const handleSaveObj = () => {
    if (capturedImg && userLoc) {
      onSave({
        id: crypto.randomUUID(),
        type: 'object',
        mediaType: 'image',
        image: capturedImg,
        location: {
          ...userLoc,
          heading: heading
        },
        note: newNote || "New Object",
        createdAt: Date.now()
      });
      setCapturedImg(null);
      setNewNote('');
      setMode('BROWSE');
    }
  };

  const getRadarCoords = (obj: Place) => {
    if (!userLoc) return { x: 0, y: 0 };
    const bearing = bearingFromTo(
      userLoc.latitude, userLoc.longitude,
      obj.location.latitude, obj.location.longitude
    );
    const relBearing = (bearing - heading + 360) % 360;
    const r = 32;
    const rad = (relBearing - 90) * (Math.PI / 180);
    return {
      x: Math.cos(rad) * r,
      y: Math.sin(rad) * r
    };
  };

  const getPhaseColor = (phase: GuidancePhase | undefined) => {
    switch (phase) {
      case 'ARRIVED': return '#D4FF3F'; // Lime
      case 'NEAR': return '#6EE7B7';   // Emerald
      case 'APPROACHING': return '#FBBF24'; // Amber
      case 'FAR':
      default: return '#E5E7EB'; // Gary/White
    }
  };

  return (
    <div className="absolute inset-0 bg-black select-none font-body">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

      {/* --- HEADER: Radar + Heading --- */}
      <div className="absolute top-0 left-0 right-0 p-6 pt-16 flex justify-between items-start z-20 pointer-events-none">
        {/* Radar Widget (Existing logic for browsing) */}
        {(mode === 'BROWSE' || mode === 'GUIDING') && (
          <div
            className="w-20 h-20 bg-black/40 backdrop-blur-md rounded-full border border-white/10 relative pointer-events-auto shadow-lg"
            onClick={() => { setMode('BROWSE'); setActiveObj(null); }}
          >
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,transparent_30%,#D4FF3F_30%,transparent_31%)]" />
            <div className="absolute top-0 left-1/2 w-[1px] h-3 bg-white/50 -translate-x-1/2" />
            {existingObjects.map(obj => {
              const { x, y } = getRadarCoords(obj);
              const isActive = activeObj?.id === obj.id;
              return (
                <div
                  key={obj.id}
                  className={`absolute w-3 h-3 rounded-full -ml-1.5 -mt-1.5 transition-all duration-300 ${isActive ? 'bg-[#D4FF3F] scale-125 shadow-[0_0_10px_#D4FF3F] z-10' : 'bg-white/50'}`}
                  style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
                />
              );
            })}
          </div>
        )}

        {/* Heading */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
            <span className="text-white font-mono text-sm">{Math.round(heading)}°</span>
          </div>
        </div>
      </div>



      {/* --- MODE: BROWSE (Object Selection) --- */}
      {mode === 'BROWSE' && (
        <div className="absolute bottom-32 left-0 right-0 px-6 flex gap-4 overflow-x-auto snap-x snap-mandatory py-4 no-scrollbar z-20 touch-pan-x overscroll-contain">
          {existingObjects.length === 0 ? (
            <div className="w-full text-center text-white/50 font-body text-xs uppercase pt-8">
              No AR objects saved nearby.
            </div>
          ) : existingObjects.map(obj => (
            <button
              key={obj.id}
              onClick={() => { setActiveObj(obj); setMode('GUIDING'); }}
              className="shrink-0 snap-center w-64 h-20 bg-[#1A1A1A] border border-white/10 rounded-2xl flex items-center p-2 gap-4 text-left active:scale-95 transition-transform"
            >
              <img src={obj.image} className="w-16 h-16 rounded-xl object-cover bg-black" />
              <div>
                <div className="text-white font-bold text-sm truncate w-32 font-body">{obj.note}</div>
                <div className="text-[#D4FF3F] text-xs uppercase font-body mt-1 flex items-center gap-1">
                  <Navigation size={10} />
                  Navigate
                </div>
              </div>
            </button>
          ))}
          <div className="w-6 shrink-0" />
        </div>
      )}

      {/* --- MODE: GUIDING (WiFi + Sensor Guidance) --- */}
      {mode === 'GUIDING' && activeObj && guidance && (
        <div className="absolute inset-0 z-10">
          <button
            onClick={() => setMode('BROWSE')}
            className="absolute top-28 right-6 bg-black/40 text-white p-3 rounded-full backdrop-blur pointer-events-auto active:scale-95"
          >
            <X size={20} />
          </button>

          {/* New Guidance Visualizer */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              layout
              className="flex flex-col items-center gap-6"
            >
              {/* Main Visual: Arrow or Ghost Image */}
              <div className="relative flex items-center justify-center">

                {/* RING: Removed as per user request for cleaner UI */}
                {/* <motion.div className="absolute w-48 h-48 rounded-full border-4 opacity-30" ... /> */}

                {/* CONTENT: Direction Arrow (Far) or Ghost (Near) */}
                <AnimatePresence mode='wait'>
                  {guidance.showDirectionalArrow ? (
                    <motion.div
                      key="arrow"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1, rotate: guidance.direction.relativeBearing || 0 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: "spring", bounce: 0.5 }}
                    >
                      <svg width="64" height="64" viewBox="0 0 316 278" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M271.57 122.2C257.552 100.62 243.535 79.0103 229.517 57.4303C220.423 43.4203 211.167 29.2204 198.872 18.0904C186.576 6.94042 170.648 -0.939579 154.316 0.0904215C139.976 1.01042 126.684 8.72037 116.191 18.7904C105.698 28.8604 97.5464 41.2604 89.5284 53.5404C67.8424 86.7204 46.1303 119.9 24.4443 153.1C14.1393 168.86 3.56535 185.31 0.713353 204.09C-2.73065 226.78 6.55235 249.89 23.0183 264.98C40.2373 280.76 68.1384 279.48 89.0984 275.16C112.075 270.41 134.541 261.48 157.975 261.51C178.047 261.51 197.446 268.11 216.979 272.91C236.485 277.68 257.445 280.62 276.279 273.52C299.659 264.73 316.448 239.73 315.991 214.07C315.56 190.66 302.457 169.75 289.839 150.27C283.758 140.92 277.678 131.55 271.597 122.2H271.57Z"
                          fill={getPhaseColor(guidance.phase)}
                        />
                      </svg>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="ghost"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: guidance.phase === 'ARRIVED' ? 1 : 0.6 }}
                      exit={{ opacity: 0 }}
                      className="w-40 h-40 rounded-full overflow-hidden border-2 border-white/50 shadow-2xl relative"
                    >
                      <img src={activeObj.image} className="w-full h-full object-cover" />
                      {guidance.phase === 'ARRIVED' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Check size={48} className="text-[#D4FF3F] drop-shadow-md" />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Text Instructions */}
              {/* Text Instructions - Simplified */}
              <div className="flex flex-col items-center gap-2 text-center mt-8">
                {/* Primary Hint */}
                <h2 className="text-xl font-body font-medium text-white drop-shadow-md max-w-xs">
                  {guidance.direction.hint}
                </h2>

                {/* Distance/Phase Indicator */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[#D4FF3F] font-bold text-sm tracking-widest uppercase">
                    {guidance.phase}
                  </span>
                  <span className="text-white/40 text-xs">
                    {Math.round(guidance.confidence * 100)}% MATCH
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* --- MODE: PLACING (Capture) --- */}
      {mode === 'PLACING' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="relative mb-8">
            <div className="w-64 h-64 border-2 border-[#D4FF3F] rounded-3xl flex items-center justify-center">
              <div className="w-1 h-1 bg-white rounded-full opacity-50" />
            </div>

            {/* Elevation Selector */}
            <div className="absolute -bottom-16 left-0 right-0 flex justify-center gap-2">
              {(['floor', 'eye', 'overhead'] as const).map(elev => (
                <button
                  key={elev}
                  onClick={() => setSelectedElevation(elev)}
                  className={`px-3 py-1.5 rounded-full text-xs uppercase flex items-center gap-1 transition-all ${selectedElevation === elev
                    ? 'bg-[#D4FF3F] text-black'
                    : 'bg-white/10 text-white/60'
                    }`}
                >
                  {elev === 'floor' && <ChevronDown size={12} />}
                  {elev === 'eye' && <Eye size={12} />}
                  {elev === 'overhead' && <ChevronUp size={12} />}
                  {elev}
                </button>
              ))}
            </div>
          </div>

          <div className="absolute bottom-24 w-full flex justify-center gap-8 items-center">
            <button onClick={() => setMode('BROWSE')} className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white">
              <X size={24} />
            </button>
            <button
              onClick={handleCapture}
              className="w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center bg-white transition-all active:scale-95"
            >
              <Camera size={32} className="text-black" />
            </button>
          </div>
        </div>
      )}

      {/* --- MODE: REVIEW --- */}
      {mode === 'REVIEW' && capturedImg && (
        <div className="absolute inset-0 z-40 bg-black flex flex-col items-center pt-24 px-8">
          <h2 className="text-white font-title text-2xl mb-8">Save AR Object</h2>
          <div className="w-64 h-64 rounded-3xl border border-white/20 overflow-hidden mb-4 shadow-2xl">
            <img src={capturedImg} className="w-full h-full object-cover" />
          </div>

          <div className="text-white/50 text-xs mb-4 flex items-center gap-2">
            <Eye size={12} />
            Visual reminder only — not used for detection
          </div>

          <input
            autoFocus
            placeholder="Object Name..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            className="w-full max-w-sm bg-[#1A1A1A] border border-white/10 rounded-2xl px-6 py-4 text-white text-center text-lg focus:border-[#D4FF3F] outline-none mb-8 font-body"
          />

          <div className="flex gap-4 w-full max-w-sm">
            <button onClick={() => setMode('PLACING')} className="flex-1 py-4 rounded-xl bg-white/10 text-white font-bold font-body">Retake</button>
            <button onClick={handleSaveObj} className="flex-1 py-4 rounded-xl bg-[#D4FF3F] text-black font-bold shadow-[0_0_20px_rgba(212,255,63,0.3)] font-body flex items-center justify-center gap-2">
              <Check size={20} />
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
