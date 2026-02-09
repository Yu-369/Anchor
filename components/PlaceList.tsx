
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

  // Physics/Event Handlers removed in favor of native CSS scroll snap

  const handleDeleteConfirm = () => {
    if (placeToDelete) {
      onDelete(placeToDelete);
      setPlaceToDelete(null);
    }
  };

  return (
    <div className="h-full w-full bg-[#050505] flex flex-col relative overflow-hidden font-body text-white">
      {/* CSS Injection for noise and scrollbar hiding */}
      <style>{`
        .noise-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="0.04"/%3E%3C/svg%3E');
            pointer-events: none; z-index: 0;
        }
        .card-shadow { box-shadow: 0 0 0 1px rgba(255,255,255,0.06); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="noise-overlay" />

      {/* Header */}
      <div className="pt-16 px-8 pb-4 z-10 shrink-0">
        <h1 className="font-title text-3xl text-white drop-shadow-md">Saved Anchors</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-metadata text-zinc-400 tracking-wider text-xs uppercase">{visiblePlaces.length} LOCATIONS</span>
        </div>
      </div>

      {/* Native Scroll Carousel */}
      <div className="flex-1 w-full overflow-x-auto snap-x snap-mandatory flex items-center px-8 gap-4 pb-8 hide-scrollbar z-10">
        {visiblePlaces.length === 0 ? (
          <div className="w-[300px] h-[400px] flex-shrink-0 rounded-[32px] bg-[#1a1a1a] border border-white/5 flex flex-col items-center justify-center text-white/20 gap-4 snap-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
              <MapPin size={24} />
            </div>
            <span className="font-body font-medium text-sm">No anchors yet</span>
          </div>
        ) : (
          <>
            {visiblePlaces.map(place => {
              const dist = userLoc ? calculateDistance(userLoc, place.location) : 0;
              return (
                <div
                  key={place.id}
                  className="w-[300px] h-[450px] flex-shrink-0 rounded-[32px] relative bg-[#1a1a1a] overflow-hidden card-shadow group snap-center transition-transform duration-300 active:scale-95"
                  onClick={() => onSelect(place.id)}
                >
                  {/* Static Image */}
                  <div className="absolute top-0 left-0 w-full h-full">
                    <img
                      src={place.image}
                      alt=""
                      className="w-full h-full object-cover brightness-50 contrast-110 transition-[filter] duration-500 group-hover:brightness-75"
                      loading="lazy"
                    />
                  </div>

                  {/* Gradient Overlay */}
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/0 via-black/10 to-black/80 pointer-events-none" />

                  {/* Content Layer */}
                  <div className="absolute inset-0 p-6 flex flex-col justify-between z-20">

                    {/* Top Row: Distance & Delete */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                        <div className={`w-1.5 h-1.5 rounded-full ${dist < 20 ? 'bg-[#D4FF3F] shadow-[0_0_8px_rgba(212,255,63,0.6)]' : 'bg-white/80'}`} />
                        <span className="text-xs font-bold text-white tracking-wide uppercase">
                          {dist < 20 ? 'Arrived' : formatDistance(dist)}
                        </span>
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); setPlaceToDelete(place.id); }}
                        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/5 flex items-center justify-center text-white/60 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all active:scale-90"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Bottom Row: Title & Action */}
                    <div className="flex items-end justify-between gap-4">
                      <div className="flex flex-col min-w-0">
                        <h3 className="text-2xl font-medium text-white font-body leading-tight truncate drop-shadow-sm">
                          {place.note}
                        </h3>
                        <div className="flex items-center gap-2 mt-2 text-zinc-400 text-xs font-metadata">
                          <span className="opacity-70">{getRelativeTime(place.createdAt)}</span>
                        </div>
                      </div>

                      <div className="w-12 h-12 rounded-full bg-[#D4FF3F] text-black flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.3)] group-hover:scale-110 group-hover:rotate-[-15deg] transition-all duration-300">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Right padding spacer for scrolling */}
            <div className="w-4 flex-shrink-0 snap-align-none" />
          </>
        )}
      </div>

      {/* Delete Confirmation (AnimatePresence) */}
      <AnimatePresence>
        {placeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 px-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setPlaceToDelete(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              className="relative w-full max-w-sm bg-[#1A1A1A] border border-white/10 rounded-[28px] p-6 shadow-2xl z-10 flex flex-col items-center text-center gap-4"
            >
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-1">
                <Trash2 size={24} strokeWidth={2} />
              </div>

              <div>
                <h3 className="text-xl font-medium text-white mb-2">Delete this anchor?</h3>
                <p className="text-sm text-zinc-400 leading-relaxed px-4">
                  You won't be able to recover this location tag.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full mt-2">
                <button
                  onClick={() => setPlaceToDelete(null)}
                  className="py-3.5 rounded-2xl font-medium text-white bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="py-3.5 rounded-2xl font-medium text-black bg-white hover:bg-zinc-200 active:scale-95 transition-all text-sm shadow-lg"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
