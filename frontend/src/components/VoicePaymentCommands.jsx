import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, CheckCircle2, AlertCircle } from 'lucide-react';

const COMMAND_EXAMPLES = [
  'Pay 120 dollars with card',
  'Send payment of 75 via paypal',
  'Pay 200 using bank transfer'
];

const PAYMENT_METHOD_PATTERNS = [
  { pattern: /\b(card|credit card|debit card)\b/i, method: 'card' },
  { pattern: /\b(paypal)\b/i, method: 'paypal' },
  { pattern: /\b(bank|bank transfer)\b/i, method: 'bank' }
];

const parsePaymentCommand = (commandText) => {
  const normalized = commandText.trim().toLowerCase();
  if (!normalized) {
    return { error: 'No command detected. Please try again.' };
  }

  if (!/\b(pay|payment|send)\b/.test(normalized)) {
    return { error: 'Only payment commands are supported in voice mode.' };
  }

  const amountMatch = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  if (!amountMatch) {
    return { error: 'No amount found. Say something like "Pay 50 with card".' };
  }

  const amount = Number.parseFloat(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Invalid amount in voice command.' };
  }

  const methodMatch = PAYMENT_METHOD_PATTERNS.find(({ pattern }) => pattern.test(normalized));
  const method = methodMatch ? methodMatch.method : 'card';

  return {
    amount,
    method,
    rawCommand: commandText
  };
};

const VoicePaymentCommands = ({ onExecutePayment }) => {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState({ type: 'idle', message: 'Voice command is ready.' });

  const SpeechRecognitionImpl = useMemo(
    () => window.SpeechRecognition || window.webkitSpeechRecognition,
    []
  );

  useEffect(() => {
    if (!SpeechRecognitionImpl) {
      setStatus({
        type: 'error',
        message: 'Voice recognition is not supported in this browser.'
      });
      return undefined;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus({ type: 'info', message: 'Listening... speak your payment command now.' });
    };

    recognition.onresult = (event) => {
      const spokenText = event.results?.[0]?.[0]?.transcript ?? '';
      setTranscript(spokenText);

      const parsed = parsePaymentCommand(spokenText);
      if (parsed.error) {
        setStatus({ type: 'error', message: parsed.error });
        return;
      }

      onExecutePayment(parsed);
      setStatus({
        type: 'success',
        message: `Payment command accepted: $${parsed.amount.toFixed(2)} via ${parsed.method}.`
      });
    };

    recognition.onerror = (event) => {
      setStatus({
        type: 'error',
        message: `Voice recognition error: ${event.error || 'unknown error'}.`
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [SpeechRecognitionImpl, onExecutePayment]);

  const startListening = () => {
    if (!recognitionRef.current || isListening) {
      return;
    }
    setTranscript('');
    recognitionRef.current.start();
  };

  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Voice Payment Commands</h2>
          <p className="text-sm text-slate-400 mt-1">
            Accessibility shortcut for creating payment actions without typing.
          </p>
        </div>
        <button
          onClick={startListening}
          disabled={isListening || !SpeechRecognitionImpl}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Start listening for payment voice command"
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          {isListening ? 'Listening...' : 'Start Voice Command'}
        </button>
      </div>

      <div className="mt-4 text-sm text-slate-300">
        <p className="font-medium text-slate-200 mb-2">Examples:</p>
        <ul className="space-y-1">
          {COMMAND_EXAMPLES.map((example) => (
            <li key={example}>- {example}</li>
          ))}
        </ul>
      </div>

      {transcript && (
        <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Last transcript</p>
          <p className="text-sm text-slate-200">{transcript}</p>
        </div>
      )}

      <div
        className={`mt-4 p-3 rounded-xl border text-sm flex items-center gap-2 ${
          status.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-600/40 text-emerald-300'
            : status.type === 'error'
              ? 'bg-rose-500/10 border-rose-600/40 text-rose-300'
              : 'bg-slate-950/70 border-slate-800 text-slate-300'
        }`}
        role="status"
        aria-live="polite"
      >
        {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        <span>{status.message}</span>
      </div>
    </section>
  );
};

export default VoicePaymentCommands;
