import { useState, useEffect, useCallback } from 'react';

export const useVoiceInterface = (commands = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsSupported(true);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onerror = (event) => {
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const resultTranscript = event.results[current][0].transcript.toLowerCase();
      setTranscript(resultTranscript);

      if (event.results[current].isFinal) {
        // Check for commands
        Object.keys(commands).forEach(command => {
          if (resultTranscript.includes(command.toLowerCase())) {
            commands[command]();
          }
        });
      }
    };

    recognition.start();
  }, [isSupported, commands]);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    speak
  };
};
