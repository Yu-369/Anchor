
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { averageGeolocation } from '../utils/geo';
import { Place, GeoLocation } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface CaptureFlowProps {
  onSave: (place: Place) => void;
  onCancel: () => void;
}

// --- Icons ---
const Icons = {
  FlashOn: ({ size = 28 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill="#e3e3e3"><path d="m480-336 128-184H494l80-280H360v320h120v144ZM400-80v-320H280v-480h400l-80 280h160L400-80Zm80-400H360h120Z" /></svg>
  ),
  FlashOff: ({ size = 28 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill="#e3e3e3"><path d="M280-880h400l-80 280h160L643-431l-57-57 22-32h-54l-47-47 67-233H360v86l-80-80v-86ZM400-80v-320H280v-166L55-791l57-57 736 736-57 57-241-241L400-80Zm73-521Z" /></svg>
  ),
  Cancel: ({ size = 28 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill="#e3e3e3"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></svg>
  ),
  Video: ({ fill = "#e3e3e3", size = 28 }: { fill?: string, size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill={fill}><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160H160Zm0-80h480v-480H160v480Zm0 0v-480 480Z" /></svg>
  ),
  Camera: ({ fill = "#e3e3e3", size = 28 }: { fill?: string, size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill={fill}><path d="M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM160-120q-33 0-56.5-23.5T80-200v-480q0-33 23.5-56.5T160-760h126l74-80h240l74 80h126q33 0 56.5 23.5T880-680v480q0 33-23.5 56.5T800-120H160Zm0-80h640v-480H638l-73-80H395l-73 80H160v480Zm320-240Z" /></svg>
  ),
  Flip: ({ size = 28 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill="#e3e3e3"><path d="M160-160v-80h110l-16-14q-52-46-73-105t-21-119q0-111 66.5-197.5T400-790v84q-72 26-116 88.5T240-478q0 45 17 87.5t53 78.5l10 10v-98h80v240H160Zm400-10v-84q72-26 116-88.5T720-482q0-45-17-87.5T650-648l-10-10v98h-80v-240h240v80H690l16 14q52 46 73 105t21 119q0 111-66.5 197.5T560-170Z" /></svg>
  ),
  Confirm: ({ size = 28 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" /></svg>
  )
};

// --- Haptics Helper ---
const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    switch (style) {
      case 'light': navigator.vibrate(10); break;
      case 'medium': navigator.vibrate(40); break;
      case 'heavy': navigator.vibrate(80); break;
    }
  }
};

export const CaptureFlow: React.FC<CaptureFlowProps> = ({ onSave, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [flashMode, setFlashMode] = useState<'on' | 'off'>('off');

  // Capture State
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Location State
  const [samples, setSamples] = useState<GeoLocation[]>([]);
  const [currentLoc, setCurrentLoc] = useState<GeoLocation | null>(null);
  const [note, setNote] = useState('');

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          // Use exact constraint if ideal fails, but start with ideal
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false // Audio not needed for photo, maybe for video? User said unable to record.
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Play failed", e));
        };
      }

      // Flash/Torch Handling
      if (flashMode === 'on') {
        const track = mediaStream.getVideoTracks()[0];
        if (track) {
          // Type assertion for torch capability
          const capabilities = track.getCapabilities() as any;
          if (capabilities.torch) {
            track.applyConstraints({ advanced: [{ torch: true }] } as any).catch(e => console.log(e));
          }
        }
      }

    } catch (err) {
      console.error("Camera access error", err);
      alert("Unable to access camera. Please check permissions.");
    }
  };

  useEffect(() => {
    startCamera();

    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track && (track.getCapabilities() as any).torch) {
        track.applyConstraints({ advanced: [{ torch: flashMode === 'on' }] } as any).catch(e => console.log(e));
      }
    }

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newLoc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            timestamp: pos.timestamp,
          };
          setCurrentLoc(newLoc);
          setSamples(prev => [...prev, newLoc]);
        },
        null,
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [flashMode]);

  const switchMode = (newMode: 'photo' | 'video') => {
    if (mode === newMode) return;
    triggerHaptic('light');
    setMode(newMode);
  };

  const handleShutter = () => {
    triggerHaptic('medium');
    if (mode === 'photo') {
      takePhoto();
    } else {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const takePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
      }
    }
  }, [stream]);

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    try {
      // Find supported mime type
      const mimeType = [
        'video/mp4',
        'video/webm;codecs=vp8',
        'video/webm',
      ].find(type => MediaRecorder.isTypeSupported(type)) || '';

      if (!mimeType) {
        alert("Video recording not supported on this device.");
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setCapturedVideo(reader.result as string);
          takePhoto(); // Thumbnail
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setIsRecording(true);
      mediaRecorderRef.current = recorder;
    } catch (e) {
      console.error("Recording failed", e);
      alert("Video recording not supported.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleConfirm = () => {
    triggerHaptic('medium');
    const finalLocation = averageGeolocation(samples) || currentLoc;
    if ((capturedImage || capturedVideo) && finalLocation) {
      onSave({
        id: crypto.randomUUID(),
        image: capturedImage!,
        video: capturedVideo || undefined,
        mediaType: capturedVideo ? 'video' : 'image',
        location: finalLocation,
        note: note || "Anchor",
        createdAt: Date.now(),
        type: 'anchor'
      });
    } else {
      alert("Waiting for GPS signal...");
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setCapturedVideo(null);
    setNote('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-[60] flex flex-col font-sans"
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* 
         Video Viewport
         - Flex 1 to take up all available space above the bottom bar
         - Contains the Shutter Button overlay
      */}
      <div className="relative flex-1 bg-black overflow-hidden rounded-b-[32px] z-10">
        <AnimatePresence mode="wait">
          {!capturedImage ? (
            <motion.div key="camera" className="absolute inset-0">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

              {/* Recording Timer */}
              {isRecording && (
                <div className="absolute top-8 left-0 right-0 flex justify-center z-20">
                  <div className="bg-red-500/80 px-4 py-1 rounded-full flex items-center gap-2 backdrop-blur-md">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold font-mono">REC</span>
                  </div>
                </div>
              )}

              {/* 
                  SHUTTER OVERLAY LAYER 
                  Positioned at the bottom of the video frame
                */}
              <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/60 to-transparent flex items-end pb-8 px-8 origin-bottom transform scale-90">
                <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center justify-items-center">
                  {/* Spacer Left */}
                  <div />

                  {/* Shutter Button - 96px (Balanced) */}
                  <button
                    onClick={handleShutter}
                    className="col-start-2 w-[96px] h-[96px] rounded-full border-[4px] border-white/20 flex items-center justify-center bg-white/10 backdrop-blur-sm active:scale-95 transition-transform"
                  >
                    {/* Animated Inner Shutter */}
                    <motion.div
                      animate={{
                        width: isRecording ? 36 : (mode === 'video' ? 72 : 80),
                        height: isRecording ? 36 : (mode === 'video' ? 72 : 80),
                        borderRadius: isRecording ? 6 : 9999,
                        backgroundColor: mode === 'video' || isRecording ? '#EF4444' : '#FFFFFF',
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25
                      }}
                      className="shadow-lg"
                    />
                  </button>

                  {/* Flip Button - 64px (Balanced) */}
                  <div className="col-start-3 justify-self-end">
                    <button
                      className="w-[64px] h-[64px] bg-[#2d2d2d]/80 backdrop-blur-md rounded-[20px] flex items-center justify-center border-none cursor-pointer active:scale-95 transition-transform text-white border border-white/10"
                      onClick={() => {/* Flip logic needs stream restart with different constraint */ }}
                    >
                      <Icons.Flip size={32} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="preview" className="absolute inset-0 bg-black">
              {capturedVideo ? (
                <video src={capturedVideo} className="w-full h-full object-cover opacity-60" autoPlay loop muted playsInline />
              ) : (
                <img src={capturedImage} className="w-full h-full object-cover opacity-60" />
              )}

              {/* Name Input Overlay */}
              <div className="absolute inset-0 flex flex-col justify-end pb-12 px-6 bg-black/40 backdrop-blur-xl">
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="w-full"
                >
                  <h3 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-2 ml-1">Name Anchor</h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="E.g. Parking Spot Level 2"
                      className="flex-1 bg-white/10 backdrop-blur-md text-white text-lg font-medium px-6 py-4 rounded-2xl border border-white/10 focus:border-[#D4FF3F] focus:outline-none placeholder:text-white/30"
                      autoFocus
                    />
                    <button
                      onClick={handleConfirm}
                      className="bg-[#D4FF3F] text-black w-16 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    >
                      <Icons.Confirm size={32} />
                    </button>
                  </div>
                </motion.div>
              </div>

              <div className="absolute top-12 right-8">
                <button onClick={resetCapture} className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                  <Icons.Flip size={32} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 
        Bottom Actions Bar 
        - Solid Black Background
        - Not overlaying video
        - Contains Flash, Mode, Cancel
      */}
      {!capturedImage && (
        <div className="w-full h-[140px] bg-black flex items-center justify-between px-8 pb-4 shrink-0 z-20 origin-bottom transform scale-90">

          {/* Flash Button - 64px */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setFlashMode(prev => prev === 'on' ? 'off' : 'on');
            }}
            className="w-[64px] h-[64px] rounded-full bg-[#2d2d2d] flex items-center justify-center border-none cursor-pointer active:scale-95 transition-transform text-white"
          >
            {flashMode === 'on' ? <Icons.FlashOn size={32} /> : <Icons.FlashOff size={32} />}
          </button>

          {/* Mode Toggle - Smooth Sliding Pill */}
          <div className="bg-[#2d2d2d] h-[64px] rounded-[32px] flex items-center p-[4px] relative box-border">
            {/* Active Indicator */}
            <motion.div
              layout
              className="absolute top-[4px] bottom-[4px] w-[56px] bg-[#D4FF3F] rounded-full shadow-sm z-0"
              animate={{ x: mode === 'photo' ? 0 : 64 }} // 56px width + 8px gap/spacer if needed. Simple layout calc.
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />

            {/* Camera Item */}
            <div
              className="w-[56px] h-[56px] rounded-full flex items-center justify-center cursor-pointer relative z-10"
              onClick={() => switchMode('photo')}
            >
              <Icons.Camera fill={mode === 'photo' ? '#000000' : '#ffffff'} size={28} />
            </div>

            {/* Spacer to define distance */}
            <div className="w-2" />

            {/* Video Item */}
            <div
              className="w-[56px] h-[56px] rounded-full flex items-center justify-center cursor-pointer relative z-10"
              onClick={() => switchMode('video')}
            >
              <Icons.Video fill={mode === 'video' ? '#000000' : '#ffffff'} size={28} />
            </div>
          </div>

          {/* Cancel Button - 64px */}
          <button
            onClick={() => {
              triggerHaptic('light');
              onCancel();
            }}
            className="w-[64px] h-[64px] rounded-full bg-[#2d2d2d] flex items-center justify-center border-none cursor-pointer active:scale-95 transition-transform text-white"
          >
            <Icons.Cancel size={32} />
          </button>
        </div>
      )}
    </motion.div>
  );
};
