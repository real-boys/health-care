import React, { useState, useCallback, useEffect } from 'react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to AEGIS',
    subtitle: 'Your intelligent healthcare management platform',
    description:
      'AEGIS helps you manage patient records, process claims, detect fraud, and generate compliance reports — all in one place.',
    tip: null,
    fields: [],
  },
  {
    id: 'profile',
    title: 'Set Up Your Profile',
    subtitle: 'Tell us about your role',
    description: 'This helps us personalize your dashboard and show the most relevant features.',
    tip: '💡 You can change these settings later in your profile.',
    fields: [
      {
        id: 'name',
        label: 'Full Name',
        type: 'text',
        placeholder: 'Dr. Jane Smith',
        required: true,
      },
      {
        id: 'role',
        label: 'Role',
        type: 'select',
        options: ['Administrator', 'Claims Processor', 'Provider', 'Auditor'],
        required: true,
      },
      {
        id: 'org',
        label: 'Organization',
        type: 'text',
        placeholder: 'City General Hospital',
        required: false,
      },
    ],
  },
  {
    id: 'features',
    title: 'Explore Key Features',
    subtitle: 'A quick tour of what AEGIS can do',
    description: null,
    tip: null,
    fields: [],
    features: [
      {
        icon: '🛡️',
        title: 'Fraud Detection',
        desc: 'AI-powered anomaly detection on claims data',
      },
      { icon: '📋', title: 'Claims Engine', desc: 'Automated claim validation and processing' },
      { icon: '📊', title: 'Analytics', desc: 'Interactive charts and drill-down reports' },
      { icon: '🌐', title: 'Multi-language', desc: 'Full i18n support including RTL languages' },
    ],
  },
  {
    id: 'preferences',
    title: 'Customize Your Experience',
    subtitle: 'Choose what matters to you',
    description: 'Select the modules you use most — we will prioritize them on your dashboard.',
    tip: '💡 You can always add more modules later.',
    fields: [],
    checkboxes: [
      { id: 'pref-claims', label: 'Claims Processing' },
      { id: 'pref-fraud', label: 'Fraud Intelligence' },
      { id: 'pref-analytics', label: 'Data Analytics' },
      { id: 'pref-patients', label: 'Patient Records' },
      { id: 'pref-reports', label: 'Compliance Reports' },
    ],
  },
  {
    id: 'complete',
    title: "You're All Set! 🎉",
    subtitle: 'Your workspace is ready',
    description:
      'Your personalized dashboard is configured. You can revisit this onboarding guide anytime from the Help menu.',
    tip: null,
    fields: [],
  },
];

const STORAGE_KEY = 'aegis-onboarding';

const loadProgress = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { step: 0, data: {}, prefs: [] };
  } catch {
    return { step: 0, data: {}, prefs: [] };
  }
};

const saveProgress = state => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
};

const ProgressBar = ({ current, total }) => (
  <div
    className="w-full"
    role="progressbar"
    aria-valuenow={current}
    aria-valuemin={0}
    aria-valuemax={total}
    aria-label={`Step ${current} of ${total}`}
  >
    <div className="flex justify-between text-xs text-slate-400 mb-2">
      <span>
        Step {current} of {total}
      </span>
      <span>{Math.round((current / total) * 100)}% complete</span>
    </div>
    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  </div>
);

const StepDots = ({ steps, current }) => (
  <div className="flex gap-2 justify-center" role="list" aria-label="Onboarding steps">
    {steps.map((step, i) => (
      <div
        key={step.id}
        role="listitem"
        aria-label={`${step.title}${i < current ? ' (completed)' : i === current ? ' (current)' : ''}`}
        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          i < current ? 'bg-indigo-500' : i === current ? 'bg-indigo-400 scale-125' : 'bg-slate-700'
        }`}
      />
    ))}
  </div>
);

const OnboardingFlow = () => {
  const [state, setState] = useState(loadProgress);
  const { step, data, prefs } = state;
  const currentStep = STEPS[step];
  const [errors, setErrors] = useState({});

  useEffect(() => {
    saveProgress(state);
  }, [state]);

  const updateData = useCallback((field, value) => {
    setState(s => ({ ...s, data: { ...s.data, [field]: value } }));
    setErrors(e => ({ ...e, [field]: undefined }));
  }, []);

  const togglePref = useCallback(id => {
    setState(s => ({
      ...s,
      prefs: s.prefs.includes(id) ? s.prefs.filter(p => p !== id) : [...s.prefs, id],
    }));
  }, []);

  const validate = useCallback(() => {
    const errs = {};
    (currentStep.fields || []).forEach(f => {
      if (f.required && !data[f.id]) errs[f.id] = `${f.label} is required`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [currentStep, data]);

  const next = useCallback(() => {
    if (!validate()) return;
    setState(s => ({ ...s, step: Math.min(s.step + 1, STEPS.length - 1) }));
  }, [validate]);

  const back = useCallback(() => {
    setState(s => ({ ...s, step: Math.max(s.step - 1, 0) }));
    setErrors({});
  }, []);

  const restart = useCallback(() => {
    setState({ step: 0, data: {}, prefs: [] });
    setErrors({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <div className="p-6 flex flex-col items-center" role="main" aria-label="Onboarding Flow">
      <div className="w-full max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-black text-white">Onboarding</h1>
          <p className="text-slate-400 text-sm mt-1">
            Progress is saved automatically — you can resume anytime
          </p>
        </div>

        <ProgressBar current={step + 1} total={STEPS.length} />
        <StepDots steps={STEPS} current={step} />

        {/* Step card */}
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
          role="region"
          aria-label={currentStep.title}
          aria-live="polite"
        >
          <div>
            <h2 className="text-white font-black text-xl">{currentStep.title}</h2>
            <p className="text-indigo-400 text-sm font-semibold mt-0.5">{currentStep.subtitle}</p>
          </div>

          {currentStep.description && (
            <p className="text-slate-300 text-sm leading-relaxed">{currentStep.description}</p>
          )}

          {/* Form fields */}
          {(currentStep.fields || []).length > 0 && (
            <div className="space-y-4">
              {currentStep.fields.map(field => (
                <div key={field.id}>
                  <label
                    htmlFor={field.id}
                    className="block text-slate-300 text-sm font-semibold mb-1"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-red-400 ml-1" aria-hidden="true">
                        *
                      </span>
                    )}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      id={field.id}
                      value={data[field.id] || ''}
                      onChange={e => updateData(field.id, e.target.value)}
                      aria-required={field.required}
                      aria-invalid={!!errors[field.id]}
                      aria-describedby={errors[field.id] ? `${field.id}-error` : undefined}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="">Select {field.label}</option>
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={field.id}
                      type={field.type}
                      value={data[field.id] || ''}
                      onChange={e => updateData(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      aria-required={field.required}
                      aria-invalid={!!errors[field.id]}
                      aria-describedby={errors[field.id] ? `${field.id}-error` : undefined}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  )}
                  {errors[field.id] && (
                    <p id={`${field.id}-error`} role="alert" className="text-red-400 text-xs mt-1">
                      {errors[field.id]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Feature tour */}
          {currentStep.features && (
            <div className="grid grid-cols-2 gap-3">
              {currentStep.features.map(f => (
                <div key={f.title} className="bg-slate-800 rounded-xl p-3 flex gap-3 items-start">
                  <span className="text-2xl" aria-hidden="true">
                    {f.icon}
                  </span>
                  <div>
                    <p className="text-white font-semibold text-sm">{f.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preferences checkboxes */}
          {currentStep.checkboxes && (
            <fieldset>
              <legend className="sr-only">Select your preferred modules</legend>
              <div className="space-y-2">
                {currentStep.checkboxes.map(cb => (
                  <label key={cb.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      id={cb.id}
                      checked={prefs.includes(cb.id)}
                      onChange={() => togglePref(cb.id)}
                      className="w-4 h-4 rounded accent-indigo-500 focus:ring-2 focus:ring-indigo-400"
                    />
                    <span className="text-slate-300 text-sm group-hover:text-white transition-colors">
                      {cb.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* Completion summary */}
          {isLast && (
            <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-4 space-y-2">
              {data.name && (
                <p className="text-slate-300 text-sm">
                  <span className="text-slate-400">Name:</span>{' '}
                  <span className="font-semibold">{data.name}</span>
                </p>
              )}
              {data.role && (
                <p className="text-slate-300 text-sm">
                  <span className="text-slate-400">Role:</span>{' '}
                  <span className="font-semibold">{data.role}</span>
                </p>
              )}
              {prefs.length > 0 && (
                <p className="text-slate-300 text-sm">
                  <span className="text-slate-400">Modules:</span>{' '}
                  <span className="font-semibold">{prefs.length} selected</span>
                </p>
              )}
            </div>
          )}

          {currentStep.tip && (
            <p className="text-slate-500 text-xs bg-slate-800 rounded-xl px-3 py-2">
              {currentStep.tip}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={back}
            disabled={isFirst}
            className="px-4 py-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-xl transition-colors"
            aria-label="Go to previous step"
          >
            ← Back
          </button>

          {isLast ? (
            <button
              onClick={restart}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
              aria-label="Restart onboarding"
            >
              Restart Tour
            </button>
          ) : (
            <button
              onClick={next}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
              aria-label={`Continue to ${STEPS[step + 1]?.title}`}
            >
              {step === 0 ? 'Get Started' : 'Continue'} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;
