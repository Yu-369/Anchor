
import React, { useState, useEffect, useRef } from 'react';
import { Place } from '../types';
import { formatDistance, getCurrentPosition, getRelativeTime, calculateDistance } from '../utils/geo';
import { Trash2, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlaceListProps {
  places: Place[];
  onAdd: () => void;
  onSaveObject: (place: Place) => void;
  onSelect: (id: string) => void;
  onTimeline: () => void;
  onDelete: (id: string) => void;
}

export const PlaceList: React.FC<PlaceListProps> = ({ places, onSelect, onDelete }) => {
  console.log('=== PlaceList render === places:', places.length, 'types:', places.map(p => p.type));

  const [userLoc, setUserLoc] = useState<any>(null);
  const [placeToDelete, setPlaceToDelete] = useState<string | null>(null);

  // Filter: Only show 'anchor' types on the dashboard. 
  // 'object' types are now exclusive to the AR view.
  const visiblePlaces = places
    .filter(p => p.type === 'anchor')
    .sort((a, b) => b.createdAt - a.createdAt);

  console.log('visiblePlaces count:', visiblePlaces.length);

  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  // Physics State
  const state = useRef({
    currentX: 0,
    targetX: 0,
    isDragging: false,
    startX: 0,
    dragStartX: 0, // To detect clicks vs drags
    velocity: 0,
  });

  // Fetch Location
  useEffect(() => {
    const updateLoc = () => getCurrentPosition().then(setUserLoc).catch(() => { });
    updateLoc();
    const interval = setInterval(updateLoc, 10000);
    return () => clearInterval(interval);
  }, []);

  // Physics Loop
  useEffect(() => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) return;

    const config = {
      lerp: 0.12,
      skewStrength: 0.25,
      maxSkew: 10,
    };

    let trackWidth = track.scrollWidth;
    let viewportWidth = viewport.offsetWidth;
    let maxScroll = -(trackWidth - viewportWidth);

    // Handle resize
    const handleResize = () => {
      if (track && viewport) {
        trackWidth = track.scrollWidth;
        viewportWidth = viewport.offsetWidth;
        maxScroll = -(trackWidth - viewportWidth);
        // If content is smaller than viewport, clamp to 0
        if (maxScroll > 0) maxScroll = 0;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial

    const animate = () => {
      if (!state.current.isDragging) {
        // Snap bounds
        if (state.current.targetX > 0) {
          state.current.targetX *= 0.1;
        } else if (state.current.targetX < maxScroll) {
          state.current.targetX = maxScroll + (state.current.targetX - maxScroll) * 0.1;
        }
      }

      // Interpolate
      const newX = state.current.currentX + (state.current.targetX - state.current.currentX) * config.lerp;
      state.current.velocity = newX - state.current.currentX;
      state.current.currentX = newX;

      // Skew
      let skew = state.current.velocity * config.skewStrength;
      skew = Math.max(Math.min(skew, config.maxSkew), -config.maxSkew);

      if (track) {
        track.style.transform = `translate3d(${state.current.currentX}px, 0, 0) skewX(${-skew}deg)`;
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [visiblePlaces.length]);

  // Input Handlers
  const handleStart = (clientX: number) => {
    state.current.isDragging = true;
    state.current.startX = clientX - state.current.targetX;
    state.current.dragStartX = clientX;
    if (viewportRef.current) viewportRef.current.style.cursor = 'grabbing';
  };

  const handleMove = (clientX: number) => {
    if (!state.current.isDragging) return;
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) return;

    let x = clientX - state.current.startX;

    // Recalc bounds for safety
    const trackWidth = track.scrollWidth;
    const viewportWidth = viewport.offsetWidth;
    let maxScroll = -(trackWidth - viewportWidth);
    if (maxScroll > 0) maxScroll = 0;

    // Friction
    if (x > 0) x = x * 0.3;
    if (x < maxScroll) x = maxScroll + (x - maxScroll) * 0.3;

    state.current.targetX = x;
  };

  const handleEnd = () => {
    state.current.isDragging = false;
    if (viewportRef.current) viewportRef.current.style.cursor = 'grab';
  };

  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => handleEnd();

  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  const handleCardClick = (id: string) => {
    if (Math.abs(state.current.velocity) < 1) {
      onSelect(id);
    }
  };

  const handleDeleteConfirm = () => {
    if (placeToDelete) {
      onDelete(placeToDelete);
      setPlaceToDelete(null);
    }
  };

  return (
    <div className="h-full w-full bg-[#050505] flex flex-col relative overflow-hidden font-body text-white">
      {/* CSS Injection */}
      <style>{`
        .noise-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="0.04"/%3E%3C/svg%3E');
            pointer-events: none; z-index: 0;
        }
        .card-shadow { box-shadow: 0 0 0 1px rgba(255,255,255,0.06); }
      `}</style>

      <div className="noise-overlay" />

      {/* Header - Aligned top with correct typography */}
      <div className="pt-16 px-6 pb-2 z-10 shrink-0">
        <h1 className="font-title text-3xl text-white drop-shadow-md">Saved Anchors</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-metadata text-zinc-400">{visiblePlaces.length} LOCATIONS</span>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={viewportRef}
        id="viewport"
        className="flex-1 relative z-10 flex items-start pt-8 cursor-grab active:cursor-grabbing"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          ref={trackRef}
          id="track"
          className="flex pl-6 pr-6 will-change-transform"
        >
          {visiblePlaces.length === 0 ? (
            <div className="w-[300px] h-[400px] flex-shrink-0 mr-4 rounded-[32px] bg-[#1a1a1a] border border-white/5 flex flex-col items-center justify-center text-white/20 gap-4 card">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <MapPin size={24} />
              </div>
              <span className="font-body font-medium text-sm">No anchors yet</span>
            </div>
          ) : (
            visiblePlaces.map(place => {
              const dist = userLoc ? calculateDistance(userLoc, place.location) : 0;
              return (
                <div
                  key={place.id}
                  className="card w-[300px] h-[400px] flex-shrink-0 mr-4 rounded-[32px] relative bg-[#1a1a1a] overflow-hidden card-shadow group transition-transform select-none"
                  onClick={() => handleCardClick(place.id)}
                >
                  {/* Static Image */}
                  <div className="absolute top-0 left-0 w-full h-full">
                    <img
                      src={place.image}
                      alt=""
                      className="w-full h-full object-cover brightness-50 contrast-110 transition-[filter] duration-300 group-hover:brightness-75"
                      draggable={false}
                    />
                  </div>
                  {/* Gradient */}
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-black/20 to-black/90 pointer-events-none" />

                  {/* UI Layer */}
                  <div className="absolute top-0 left-0 w-full h-full p-5 flex flex-col justify-between z-20">
                    {/* Top Row */}
                    <div className="flex justify-between items-start">
                      {/* Distance Pill - Updated Colors */}
                      <div className="flex items-center gap-2 bg-[#1E1E1E]/60 backdrop-blur-md px-3.5 py-2 rounded-full border border-white/10">
                        {/* Status Dot */}
                        <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${dist < 100 ? 'bg-[#D4FF3F] shadow-[#D4FF3F]/60' : 'bg-white shadow-white/40'}`} />
                        <span className="text-[13px] font-bold text-white tracking-wide font-body">
                          {dist < 100 ? 'Nearby' : formatDistance(dist)}
                        </span>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setPlaceToDelete(place.id); }}
                        className="w-11 h-11 rounded-full bg-[#1E1E1E]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:bg-white hover:text-black transition-all active:scale-95"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* Bottom Row */}
                    <div className="flex justify-between items-end">
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-4">
                        <h3 className="text-[26px] font-medium text-white tracking-tight font-body m-0 leading-tight truncate">
                          {place.note}
                        </h3>
                        <div className="flex items-center gap-1.5 font-metadata text-zinc-400">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-80"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                          <span>{getRelativeTime(place.createdAt)}</span>
                        </div>
                      </div>

                      <div className="w-16 h-16 bg-[#D4FF3F] rounded-full flex items-center justify-center text-black shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-45deg] group-hover:shadow-[0_10px_25px_rgba(212,255,63,0.3)] shrink-0">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {/* Spacer */}
          <div className="w-6 flex-shrink-0" />
        </div>
      </div>

      {/* Delete Confirmation Modal - Minimal & Clean */}
      <AnimatePresence>
        {placeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPlaceToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative w-full max-w-xs bg-[#121212] border border-white/10 rounded-[32px] p-6 overflow-hidden shadow-2xl z-10"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                  <Trash2 size={20} />
                </div>

                <div>
                  <h3 className="text-lg font-title text-white mb-1">Delete Anchor?</h3>
                  <p className="text-xs font-body text-zinc-400 leading-relaxed px-2">
                    This action cannot be undone.
                  </p>
                </div>

                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setPlaceToDelete(null)}
                    className="flex-1 py-3 rounded-xl font-body font-bold text-white bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 py-3 rounded-xl font-body font-bold text-black bg-white hover:bg-zinc-200 active:scale-95 transition-all text-xs shadow-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
