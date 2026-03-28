import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  MessageSquare, 
  Share, 
  FileText,
  User,
  Settings,
  Maximize,
  Minimize
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VideoConsultation = ({ roomId, patientName, onEndCall }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isDataSharing, setIsDataSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Mock WebRTC setup
    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    };

    setupMedia();

    return () => {
      clearInterval(timer);
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="video-consultation-container bg-slate-900 rounded-2xl overflow-hidden relative h-[600px]">
      {/* Remote Video (Main View) */}
      <div className="remote-video h-full w-full bg-slate-800 flex items-center justify-center">
        <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
        <div className="absolute top-6 left-6 flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white text-sm font-medium">{formatTime(callDuration)}</span>
        </div>
        <div className="absolute top-6 right-6 flex items-center gap-2">
          <button className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Local Video (Picture-in-Picture) */}
      <motion.div 
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        className="local-video absolute bottom-24 right-6 w-48 h-32 bg-slate-700 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 cursor-move"
      >
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
        {isVideoOff && (
          <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
            <User className="w-12 h-12 text-slate-500" />
          </div>
        )}
      </motion.div>

      {/* Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-xl px-8 py-4 rounded-3xl border border-white/10 shadow-2xl">
        <button 
          onClick={toggleMute}
          className={`p-4 rounded-full transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        
        <button 
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>

        <button 
          onClick={onEndCall}
          className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all shadow-lg shadow-red-600/20"
        >
          <PhoneOff className="w-6 h-6" />
        </button>

        <div className="w-[1px] h-8 bg-white/10 mx-2" />

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`p-4 rounded-full transition-all ${isChatOpen ? 'bg-blue-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          <MessageSquare className="w-6 h-6" />
        </button>

        <button 
          onClick={() => setIsDataSharing(!isDataSharing)}
          className={`p-4 rounded-full transition-all ${isDataSharing ? 'bg-purple-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          <FileText className="w-6 h-6" />
        </button>
      </div>

      {/* Floating Info */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
        <span className="text-white text-sm font-medium">Consultation with {patientName}</span>
      </div>
    </div>
  );
};

export default VideoConsultation;
