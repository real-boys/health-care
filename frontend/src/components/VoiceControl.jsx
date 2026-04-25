import React, { useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useVoiceInterface } from '../hooks/useVoiceInterface';
import { motion, AnimatePresence } from 'framer-motion';

export const VoiceControl = ({ onCommand }) => {
  const [showTranscript, setShowTranscript] = useState(false);
  
  const commands = {
    'go to dashboard': () => {
      onCommand('navigate', '/dashboard');
      speak('Navigating to dashboard');
    },
    'show reports': () => {
      onCommand('navigate', '/reports');
      speak('Opening reports');
    },
    'help': () => {
      speak('Available commands: go to dashboard, show reports, help');
    }
  };

  const { isListening, transcript, startListening, speak, isSupported } = useVoiceInterface(commands);

  if (!isSupported) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isListening && transcript && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-black/80 text-white px-4 py-2 rounded-full backdrop-blur-md border border-white/20 shadow-2xl"
          >
            <span className="text-sm opacity-60">Listening:</span> {transcript}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={startListening}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-colors ${
          isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600'
        }`}
      >
        {isListening ? <Mic className="text-white" /> : <MicOff className="text-white" />}
      </motion.button>
    </div>
  );
};
