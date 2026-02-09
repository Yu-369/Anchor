
import React, { useEffect, useState, useRef } from 'react';
import { Place } from '../types';
import { calculateDistance } from '../utils/geo';
import { ArrowLeft, Flashlight, Eye, Play, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlaceDetailProps {
  place: Place;
  onBack: () => void;
  onDelete: (id: string) => void;
}

const BlobSVG = ({ className }: { className?: string }) => (
    <svg width="100%" height="100%" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M125.261 13.3825C126.991 11.9525 127.851 11.2425 128.641 10.6425C147.191 -3.5475 172.811 -3.5475 191.361 10.6425C192.151 11.2425 193.011 11.9525 194.741 13.3825C195.511 14.0125 195.891 14.3325 196.271 14.6425C205.001 21.5825 215.711 25.5227 226.821 25.8727C227.301 25.8827 227.801 25.8925 228.791 25.9025C231.021 25.9325 232.141 25.9426 233.121 25.9926C256.361 27.1826 275.981 43.8226 281.171 66.7326C281.391 67.7026 281.601 68.8126 282.021 71.0226C282.201 72.0126 282.291 72.5026 282.391 72.9826C284.661 83.9826 290.361 93.9425 298.641 101.423C299.011 101.753 299.381 102.083 300.141 102.733C301.831 104.203 302.671 104.943 303.391 105.623C320.441 121.613 324.891 147.113 314.291 168.033C313.841 168.923 313.291 169.903 312.201 171.863C311.711 172.743 311.471 173.183 311.241 173.613C305.991 183.503 304.011 194.843 305.601 205.953C305.671 206.443 305.751 206.933 305.911 207.923C306.271 210.153 306.451 211.263 306.571 212.253C309.451 235.573 296.641 257.992 275.211 267.132C274.301 267.522 273.251 267.923 271.171 268.723C270.241 269.073 269.771 269.253 269.321 269.433C259.001 273.603 250.281 281.003 244.421 290.543C244.171 290.963 243.921 291.393 243.411 292.253C242.271 294.193 241.701 295.163 241.161 296.003C228.531 315.733 204.461 324.593 182.221 317.673C181.281 317.383 180.221 317.013 178.121 316.263C177.181 315.933 176.711 315.763 176.251 315.613C165.701 312.103 154.301 312.103 143.751 315.613C143.291 315.763 142.821 315.933 141.881 316.263C139.781 317.013 138.721 317.383 137.781 317.673C115.541 324.593 91.4712 315.733 78.8412 296.003C78.3012 295.163 77.7312 294.193 76.5912 292.253C76.0812 291.393 75.8312 290.963 75.5812 290.543C69.7212 281.003 61.0013 273.603 50.6813 269.433C50.2313 269.253 49.7612 269.073 48.8312 268.723C46.7512 267.923 45.7013 267.522 44.7913 267.132C23.3613 257.992 10.5513 235.573 13.4313 212.253C13.5513 211.263 13.7312 210.153 14.0912 207.923C14.2512 206.933 14.3313 206.443 14.4013 205.953C15.9913 194.843 14.0113 183.503 8.76126 173.613C8.53126 173.183 8.2913 172.743 7.8013 171.863C6.7113 169.903 6.16121 168.923 5.71121 168.033C-4.88879 147.113 -0.438763 121.613 16.6112 105.623C17.3312 104.943 18.1712 104.203 19.8612 102.733C20.6212 102.083 20.9912 101.753 21.3612 101.423C29.6412 93.9425 35.3412 83.9826 37.6112 72.9826C37.7112 72.5026 37.8012 72.0126 37.9812 71.0226C38.4012 68.8126 38.6112 67.7026 38.8312 66.7326C44.0212 43.8226 63.6413 27.1826 86.8813 25.9926C87.8613 25.9426 88.9812 25.9325 91.2112 25.9025C92.2012 25.8925 92.7013 25.8827 93.1813 25.8727C104.291 25.5227 115.001 21.5825 123.731 14.6425C124.111 14.3325 124.491 14.0125 125.261 13.3825Z" fill="currentColor"/>
    </svg>
);

const ArrowSVG = ({ className }: { className?: string }) => (
  <svg width="316" height="278" viewBox="0 0 316 278" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M271.57 122.2C257.552 100.62 243.535 79.0103 229.517 57.4303C220.423 43.4203 211.167 29.2204 198.872 18.0904C186.576 6.94042 170.648 -0.939579 154.316 0.0904215C139.976 1.01042 126.684 8.72037 116.191 18.7904C105.698 28.8604 97.5464 41.2604 89.5284 53.5404C67.8424 86.7204 46.1303 119.9 24.4443 153.1C14.1393 168.86 3.56535 185.31 0.713353 204.09C-2.73065 226.78 6.55235 249.89 23.0183 264.98C40.2373 280.76 68.1384 279.48 89.0984 275.16C112.075 270.41 134.541 261.48 157.975 261.51C178.047 261.51 197.446 268.11 216.979 272.91C236.485 277.68 257.445 280.62 276.279 273.52C299.659 264.73 316.448 239.73 315.991 214.07C315.56 190.66 302.457 169.75 289.839 150.27C283.758 140.92 277.678 131.55 271.597 122.2H271.57Z" fill="#D4FF3F"/>
  </svg>
);

// --- The 'Move Around' / Filling Shape (< 10m) ---
const ScallopedShape = ({ distance }: { distance: number | null }) => {
  const maxReactivityDistance = 10; // 10 meters
  const d = Math.max(0, Math.min(distance ?? maxReactivityDistance, maxReactivityDistance));
  const intensity = 1 - (d / maxReactivityDistance);

  // Generate a wavy circle path
  const generateWavyCircle = (radius: number, waves: number, amplitude: number) => {
    let d = "";
    for (let i = 0; i <= 360; i++) {
      const angle = (i * Math.PI) / 180;
      const r = radius + Math.sin(angle * waves) * amplitude;
      const x = 50 + r * Math.cos(angle);
      const y = 50 + r * Math.sin(angle);
      d += (i === 0 ? "M" : "L") + x + "," + y;
    }
    return d + "Z";
  };

  const waves = 12; 
  const outerPath = generateWavyCircle(45, waves, 2);
  const innerPath = generateWavyCircle(20, waves, 2);

  return (
    <div className="relative w-80 h-80 flex flex-col items-center justify-center">
      {/* Spinning Outer Ring (Target Zone) */}
      <motion.div
        className="absolute inset-0 text-white/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
         <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
            <path d={outerPath} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
         </svg>
      </motion.div>

      {/* Filling Blob */}
      <motion.div 
        className="relative z-10 text-[#D4FF3F]" // Replaced Purple with Lime
        animate={{ 
            scale: 0.2 + (intensity * 1.8), // Grows as you get closer
            rotate: -360
        }}
        transition={{ 
            scale: { duration: 0.5, ease: "easeOut" },
            rotate: { duration: 60, repeat: Infinity, ease: "linear" }
        }}
      >
        <svg viewBox="0 0 100 100" className="w-64 h-64 overflow-visible drop-shadow-[0_0_30px_rgba(212,255,63,0.3)]">
           <path d={innerPath} fill="currentColor" />
        </svg>
      </motion.div>
      
      {/* Distance Text Overlay */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-40 flex flex-col items-center">
         <div className="text-4xl font-bold text-white font-body">
            {distance ? Math.round(distance) : '--'} <span className="text-lg opacity-50">m</span>
         </div>
      </div>
    </div>
  );
};

// --- Navigation Compass Component (> 10m) ---
const NavigationCompass = ({ targetLat, targetLng, distance }: { targetLat: number, targetLng: number, distance: number | null }) => {
  const [heading, setHeading] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Calculate Bearing relative to North
  const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
    const startLatRad = (startLat * Math.PI) / 180;
    const startLngRad = (startLng * Math.PI) / 180;
    const destLatRad = (destLat * Math.PI) / 180;
    const destLngRad = (destLng * Math.PI) / 180;

    const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
              Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360; 
  };

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition((pos) => {
        const b = calculateBearing(pos.coords.latitude, pos.coords.longitude, targetLat, targetLng);
        setBearing(b);
    }, null, { enableHighAccuracy: true });

    const handleOrientation = (event: DeviceOrientationEvent) => {
        const compass = (event as any).webkitCompassHeading || (360 - (event.alpha || 0));
        setHeading(compass);
    };

    if (typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
        setPermissionGranted(true);
        window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
        navigator.geolocation.clearWatch(watchId);
        window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [targetLat, targetLng]);

  const requestPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
            const response = await (DeviceOrientationEvent as any).requestPermission();
            if (response === 'granted') {
                setPermissionGranted(true);
                window.addEventListener('deviceorientation', (event: DeviceOrientationEvent) => {
                    const compass = (event as any).webkitCompassHeading || (360 - (event.alpha || 0));
                    setHeading(compass);
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
  };

  // Rotation logic: Arrow points to bearing relative to device heading
  const rotation = bearing - heading;

  return (
    <div className="relative w-72 h-72 flex items-center justify-center">
        {!permissionGranted && (
            <button 
                onClick={requestPermission}
                className="absolute z-50 bg-[#2C2C2C] text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg"
            >
                Enable Compass
            </button>
        )}
        
        {/* Ring of Dots (Static reference frame) */}
        <div className="absolute inset-0 pointer-events-none">
           {[...Array(12)].map((_, i) => (
             <div 
                key={i} 
                className="absolute w-1.5 h-1.5 rounded-full bg-[#4A5568]"
                style={{
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${i * 30}deg) translateY(-120px)`
                }} 
             />
           ))}
        </div>

        {/* The Blob Target Indicator (Orbits the ring) */}
        <motion.div 
            className="absolute inset-0"
            animate={{ rotate: rotation }}
            transition={{ type: "spring", stiffness: 40, damping: 10 }}
        >
             <div 
                className="absolute top-1/2 left-1/2 w-8 h-8 -ml-4 -mt-4 flex items-center justify-center"
                style={{ transform: `translateY(-120px)` }}
             >
                 {/* Counter-rotate the icon so it stays upright */}
                 <motion.div 
                    animate={{ rotate: -rotation }}
                    transition={{ type: "spring", stiffness: 40, damping: 10 }}
                    className="w-full h-full text-[#D4FF3F]" // Replaced Purple with Lime
                 >
                    <BlobSVG />
                 </motion.div>
             </div>
        </motion.div>

        {/* Central Element - Navigation Arrow */}
        <motion.div 
            className="relative z-10 w-32 h-32 flex items-center justify-center"
            animate={{ rotate: rotation }}
            transition={{ type: "spring", stiffness: 50, damping: 15 }}
        >
             <ArrowSVG className="w-24 h-24" />
        </motion.div>
        
        {/* Distance Text - Always upright below the center */}
        <div className="absolute mt-36 font-body font-bold text-3xl text-white tracking-tight flex items-baseline justify-center gap-1">
             {distance ? (distance >= 1000 ? (distance / 1000).toFixed(1) : Math.round(distance)) : '-'} 
             <span className="text-white/40 text-lg font-medium">{distance && distance >= 1000 ? 'km' : 'm'}</span>
        </div>
    </div>
  );
};

export const PlaceDetail: React.FC<PlaceDetailProps> = ({ place, onBack }) => {
  const [distance, setDistance] = useState<number | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        };
        // Calculate distance in meters
        setDistance(calculateDistance(newLoc, place.location));
      },
      null,
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [place.location]);

  const toggleVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const openGoogleMaps = () => {
    // We use the latitude and longitude directly to avoid any ambiguity 
    // or reverse-geocoding errors. 
    const destination = `${place.location.latitude},${place.location.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
    window.open(url, '_blank');
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Anchor Location',
      text: `Navigating to: ${place.note}`,
      url: `https://www.google.com/maps/search/?api=1&query=${place.location.latitude},${place.location.longitude}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing', err);
      }
    } else {
      navigator.clipboard.writeText(`${place.note}: ${shareData.url}`);
      alert('Location link copied to clipboard!');
    }
  };

  // Switch to "Move around" mode when closer than 10 meters
  const isNearby = distance !== null && distance < 10; 

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col items-center overflow-hidden"
    >
      <AnimatePresence>
        {showFullImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black flex items-center justify-center p-6"
            onClick={() => setShowFullImage(false)}
          >
             {place.mediaType === 'video' && place.video ? (
               <div className="relative w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                 <video 
                   ref={videoRef}
                   src={place.video} 
                   className="w-full h-full object-cover"
                   loop
                   playsInline
                   poster={place.image}
                   onClick={toggleVideo}
                 />
                 {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
                        <Play fill="currentColor" size={24} />
                      </div>
                    </div>
                 )}
               </div>
             ) : (
               <img src={place.image} className="max-w-full max-h-[70vh] rounded-[32px] shadow-2xl" alt="Context" />
             )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full px-8 pt-16 flex items-center justify-between z-20">
        <button onClick={onBack} className="p-2 -ml-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-lg font-title text-white uppercase tracking-widest">{place.note}</h2>
          <p className="font-metadata text-[#D4FF3F] mt-1">
             {isNearby ? 'NEARBY' : 'NAVIGATING'}
          </p>
        </div>
        <button onClick={handleShare} className="p-2 -mr-2 text-white/60 hover:text-white transition-colors">
            <Share size={24} />
        </button>
      </div>

      {/* Proximity / Navigation Core */}
      <div className="flex-1 w-full flex flex-col items-center justify-center pb-20">
        <AnimatePresence mode="wait">
            {isNearby ? (
                <motion.div 
                    key="arrival"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex flex-col items-center"
                >
                    <ScallopedShape distance={distance} />
                    <div className="mt-12 text-center max-w-[280px]">
                      <p className="text-white font-body text-sm leading-relaxed opacity-80">
                         Move around. The shape fills as you get closer to the destination.
                      </p>
                    </div>
                </motion.div>
            ) : (
                <motion.div 
                    key="nav"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <NavigationCompass 
                        targetLat={place.location.latitude} 
                        targetLng={place.location.longitude}
                        distance={distance}
                    />
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Primary Navigation Trigger */}
      <div className="absolute bottom-12 left-0 right-0 px-8 flex items-center justify-center gap-6">
           <button 
             onClick={() => setFlashlightOn(!flashlightOn)}
             className={`h-16 w-16 rounded-[24px] border transition-all flex items-center justify-center ${flashlightOn ? 'bg-[#D4FF3F] border-[#D4FF3F] text-black shadow-[0_0_20px_rgba(212,255,63,0.3)]' : 'bg-[#1A1A1A] border-white/5 text-white/40'}`}
           >
             <Flashlight size={24} />
           </button>

           <motion.button 
             whileTap={{ scale: 0.95 }}
             onClick={openGoogleMaps}
             className="h-16 px-10 bg-[#D4FF3F] text-black rounded-[24px] shadow-xl flex items-center gap-3 active:scale-95 transition-transform flex-1 justify-center"
           >
             <span className="material-symbols-outlined font-bold text-[28px]">ar_stickers</span>
             <span className="text-base uppercase tracking-wider font-bold font-body">AR View</span>
           </motion.button>

           <button 
             onClick={() => setShowFullImage(true)} 
             className="h-16 w-16 rounded-[24px] bg-[#1A1A1A] border border-white/5 text-white/60 flex items-center justify-center active:scale-95 transition-transform hover:bg-[#2A2A2A] hover:text-white"
           >
             <Eye size={28} />
           </button>
      </div>
    </motion.div>
  );
};
