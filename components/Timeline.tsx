
import React, { useEffect, useRef, useState } from 'react';
import { Place } from '../types';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';

interface TimelineProps {
  places: Place[];
  onBack: () => void;
  onSelect: (id: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ places, onSelect }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;
    const map = L.map(mapContainer.current, { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || places.length === 0) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) map.removeLayer(layer);
    });

    const anchors = places.filter(p => p.type === 'anchor').sort((a, b) => a.createdAt - b.createdAt);
    const latLngs = anchors.map(p => [p.location.latitude, p.location.longitude] as [number, number]);

    if (latLngs.length > 1) {
      L.polyline(latLngs, { color: '#D4FF3F', weight: 3, opacity: 0.5, dashArray: '10, 10', lineCap: 'round' }).addTo(map);
    }

    anchors.forEach((place) => {
      const isSelected = place.id === activePlaceId;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width: 14px; height: 14px; background: ${isSelected ? '#D4FF3F' : '#FFF'}; border-radius: 50%; border: 3px solid #000; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      L.marker([place.location.latitude, place.location.longitude], { icon })
        .addTo(map)
        .on('click', () => setActivePlaceId(place.id));
    });

    if (!activePlaceId && latLngs.length > 0) map.fitBounds(L.latLngBounds(latLngs).pad(0.2));
  }, [places, activePlaceId]);

  return (
    <div className="h-full w-full relative bg-black">
      <div ref={mapContainer} className="h-full w-full opacity-60" />

      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-8 pt-16 pointer-events-none">
        <h1 className="text-3xl font-title text-white drop-shadow-lg">Spatial History</h1>
      </div>

      {/* Floating Card */}
      <AnimatePresence>
        {activePlaceId && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute bottom-36 left-4 right-4 z-[1000]"
          >
            <div 
              onClick={() => onSelect(activePlaceId)}
              className="bg-[#1A1A1A] p-4 rounded-[28px] border border-white/10 flex items-center gap-4 shadow-2xl cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black shrink-0">
                <img src={places.find(p => p.id === activePlaceId)?.image} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-title text-white truncate text-lg">{places.find(p => p.id === activePlaceId)?.note}</h3>
                <span className="font-metadata text-zinc-400">Tap to navigate</span>
              </div>
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-[#D4FF3F]">
                <span className="material-symbols-outlined">north_east</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
