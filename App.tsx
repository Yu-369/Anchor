
import React, { useState, useEffect } from 'react';
import { Place, AppView } from './types';
import { PlaceList } from './components/PlaceList';
import { CaptureFlow } from './components/CaptureFlow';
import { PlaceDetail } from './components/PlaceDetail';
import { Timeline } from './components/Timeline';
import { ARObjectView } from './components/ARObjectView';
import { BottomNav } from './components/BottomNav';
import { AnimatePresence, motion } from 'framer-motion';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // AR Specific State
  const [triggerARCreation, setTriggerARCreation] = useState(false);
  const [isARInteracting, setIsARInteracting] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('anchor_places');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((p: any) => ({
          ...p,
          type: p.type || 'anchor'
        }));
        setPlaces(migrated);
      } catch (e) {
        console.error("Failed to parse saved places", e);
      }
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('anchor_places', JSON.stringify(places));
    } catch (e) {
      console.error("Failed to save to localStorage (Quota exceeded?)", e);
      // Optional: Visual feedback to user?
    }
  }, [places]);

  // Reset AR state when leaving AR view
  useEffect(() => {
    if (view !== 'ar') {
      setIsARInteracting(false);
      setTriggerARCreation(false);
    }
  }, [view]);

  const handleSavePlace = (newPlace: Place) => {
    console.log('=== handleSavePlace called ===');
    console.log('newPlace:', newPlace);
    console.log('current view:', view);

    setPlaces(prev => {
      console.log('Previous places count:', prev.length);
      const updated = [newPlace, ...prev];
      console.log('Updated places count:', updated.length);
      return updated;
    });

    // If we were in AR creation, saving usually resets us to AR browsing.
    // If we were in CaptureFlow, we go to dashboard.
    if (view === 'ar') {
      // AR view handles its own mode reset, but we ensure interacting state is clear
      setIsARInteracting(false);
    } else {
      console.log('Setting view to dashboard');
      setView('dashboard');
    }
  };

  const handleDeletePlace = (id: string) => {
    setPlaces(prev => prev.filter(p => p.id !== id));
    if (selectedPlaceId === id) setSelectedPlaceId(null);
    if (view === 'detail') setView('dashboard');
  };

  const selectedPlace = places.find(p => p.id === selectedPlaceId);

  // Show Bottom Nav if in main views AND not currently in a fullscreen creation flow within AR
  const showNav = ['dashboard', 'timeline', 'ar'].includes(view) && !isARInteracting;

  const handleFabClick = () => {
    if (view === 'ar') {
      // In AR view, FAB triggers the internal creation mode
      setTriggerARCreation(true);
    } else {
      // In other views, FAB opens the standard Capture Flow
      setView('capture');
    }
  };

  // Material Design "Standard Spatial" Curve
  const pageVariants = {
    initial: {
      opacity: 0,
      scale: 0.96,
      filter: 'blur(4px)'
    },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.5, ease: [0.27, 1.06, 0.18, 1.00] as [number, number, number, number] }
    },
    exit: {
      opacity: 0,
      scale: 1.04,
      filter: 'blur(4px)',
      transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }
    }
  };

  console.log('=== App render === view:', view, 'places count:', places.length);

  return (
    <div className="h-full w-full bg-black overflow-hidden font-body">
      {view === 'dashboard' && (
        <div className="h-full w-full">
          <PlaceList
            places={places}
            onAdd={() => setView('capture')}
            onSaveObject={handleSavePlace}
            onSelect={(id) => { setSelectedPlaceId(id); setView('detail'); }}
            onTimeline={() => setView('timeline')}
            onDelete={handleDeletePlace}
          />
        </div>
      )}

      {view === 'timeline' && (
        <div className="h-full w-full">
          <Timeline
            places={places}
            onBack={() => setView('dashboard')}
            onSelect={(id) => { setSelectedPlaceId(id); setView('detail'); }}
          />
        </div>
      )}

      {view === 'ar' && (
        <div className="h-full w-full">
          <ARObjectView
            existingObjects={places.filter(p => p.type === 'object')}
            onSave={handleSavePlace}
            triggerCreation={triggerARCreation}
            onCreationTriggerHandled={() => setTriggerARCreation(false)}
            onInteractionStateChange={setIsARInteracting}
          />
        </div>
      )}

      {view === 'capture' && (
        <div className="h-full w-full">
          <CaptureFlow
            onSave={handleSavePlace}
            onCancel={() => setView('dashboard')}
          />
        </div>
      )}

      {view === 'detail' && selectedPlace && (
        <div className="h-full w-full">
          <PlaceDetail
            place={selectedPlace}
            onBack={() => setView('dashboard')}
            onDelete={handleDeletePlace}
          />
        </div>
      )}

      {/* Persistent Bottom Navigation */}
      <AnimatePresence>
        {showNav && (
          <BottomNav
            currentView={view}
            onViewChange={setView}
            onAdd={handleFabClick}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
