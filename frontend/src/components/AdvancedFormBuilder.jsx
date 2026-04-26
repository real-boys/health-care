import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, ChevronRight, ChevronLeft, CheckCircle,
  Eye, BarChart2, Settings, AlertCircle, GripVertical
} from 'lucide-react';

// ── Field types supported ──────────────────────────────────────────────────
const FIELD_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'email',    label: 'Email' },
  { value: 'number',   label: 'Number' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'radio',    label: 'Radio' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'date',     label: 'Date' },
];

// ── Validation helpers ─────────────────────────────────────────────────────
function validateField(field, value) {
  if (field.required && !value && value !== 0) return `${field.label} is required`;
  if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    return 'Invalid email address';
  if (field.type === 'number' && value !== '' && isNaN(Number(value)))
    return 'Must be a number';
  if (field.minLength && value && value.length < field.minLength)
    return `Minimum ${field.minLength} characters`;
  if (field.maxLength && value && value.length > field.maxLength)
    return `Maximum ${field.maxLength} characters`;
  return null;
}

function validateStep(fields, values) {
  const errors = {};
  fields.forEach(f => {
    const err = validateField(f, values[f.id] ?? '');
    if (err) errors[f.id] = err;
  });
  return errors;
}

// ── Condition evaluator ────────────────────────────────────────────────────
function fieldVisible(field, values) {
  if (!field.condition) return true;
  const { dependsOn, operator, value } = field.condition;
  const actual = values[dependsOn] ?? '';
  if (operator === 'equals')    return String(actual) === String(value);
  if (operator === 'notEquals') return String(actual) !== String(value);
  if (operator === 'contains')  return String(actual).includes(value);
  return true;
}

// ── Unique id helper ───────────────────────────────────────────────────────
let _id = 0;
const uid = () => `f_${++_id}_${Date.now()}`;

// ── Default new field ──────────────────────────────────────────────────────
const newField = () => ({
  id: uid(), label: 'New Field', type: 'text',
  required: false, placeholder: '', options: [],
  minLength: '', maxLength: '', condition: null,
});

// ── Default new step ──────────────────────────────────────────────────────
const newStep = (n) => ({ id: uid(), title: `Step ${n}`, fields: [] });

// ══════════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════════

function FieldInput({ field, value, onChange, error, allFields }) {
  if (!fieldVisible(field, allFields)) return null;

  const base = `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {field.type === 'textarea' && (
        <textarea rows={3} className={base} placeholder={field.placeholder}
          value={value ?? ''} onChange={e => onChange(field.id, e.target.value)} />
      )}

      {field.type === 'select' && (
        <select className={base} value={value ?? ''} onChange={e => onChange(field.id, e.target.value)}>
          <option value="">Select…</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {field.type === 'radio' && (
        <div className="space-y-1">
          {field.options.map(o => (
            <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name={field.id} value={o}
                checked={value === o} onChange={() => onChange(field.id, o)} />
              {o}
            </label>
          ))}
        </div>
      )}

      {field.type === 'checkbox' && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!value}
            onChange={e => onChange(field.id, e.target.checked)} />
          {field.placeholder || field.label}
        </label>
      )}

      {['text','email','number','date'].includes(field.type) && (
        <input type={field.type} className={base} placeholder={field.placeholder}
          value={value ?? ''} onChange={e => onChange(field.id, e.target.value)} />
      )}

      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

// ── Field editor row ───────────────────────────────────────────────────────
function FieldEditor({ field, allFields, onChange, onRemove }) {
  const [open, setOpen] = useState(false);

  const update = (key, val) => onChange({ ...field, [key]: val });

  return (
    <div className="border border-gray-200 rounded-lg mb-2 bg-white">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}>
        <GripVertical size={14} className="text-gray-400" />
        <span className="flex-1 text-sm font-medium truncate">{field.label}</span>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{field.type}</span>
        {field.required && <span className="text-xs text-red-500">required</span>}
        <button onClick={e => { e.stopPropagation(); onRemove(field.id); }}
          className="text-red-400 hover:text-red-600 ml-1">
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-3 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Label</label>
            <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-0.5"
              value={field.label} onChange={e => update('label', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Type</label>
            <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-0.5"
              value={field.type} onChange={e => update('type', e.target.value)}>
              {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Placeholder</label>
            <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-0.5"
              value={field.placeholder} onChange={e => update('placeholder', e.target.value)} />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" id={`req_${field.id}`} checked={field.required}
              onChange={e => update('required', e.target.checked)} />
            <label htmlFor={`req_${field.id}`} className="text-sm">Required</label>
          </div>

          {['select','radio'].includes(field.type) && (
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500">Options (comma-separated)</label>
              <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-0.5"
                value={field.options.join(',')}
                onChange={e => update('options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </div>
          )}

          {/* Conditional logic */}
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-500 font-medium">Conditional Logic</label>
            <div className="flex flex-wrap gap-2 mt-1 items-center">
              <select className="border border-gray-300 rounded px-2 py-1 text-xs"
                value={field.condition?.dependsOn ?? ''}
                onChange={e => update('condition', e.target.value
                  ? { dependsOn: e.target.value, operator: 'equals', value: '' }
                  : null)}>
                <option value="">No condition</option>
                {allFields.filter(f => f.id !== field.id).map(f =>
                  <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              {field.condition && (
                <>
                  <select className="border border-gray-300 rounded px-2 py-1 text-xs"
                    value={field.condition.operator}
                    onChange={e => update('condition', { ...field.condition, operator: e.target.value })}>
                    <option value="equals">equals</option>
                    <option value="notEquals">not equals</option>
                    <option value="contains">contains</option>
                  </select>
                  <input className="border border-gray-300 rounded px-2 py-1 text-xs w-24"
                    placeholder="value"
                    value={field.condition.value}
                    onChange={e => update('condition', { ...field.condition, value: e.target.value })} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics panel ────────────────────────────────────────────────────────
function Analytics({ submissions }) {
  if (!submissions.length) return (
    <div className="text-center py-12 text-gray-400">
      <BarChart2 size={40} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">No submissions yet</p>
    </div>
  );

  const total = submissions.length;
  const completed = submissions.filter(s => s.completed).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Submissions', value: total },
          { label: 'Completed', value: completed },
          { label: 'Completion Rate', value: `${total ? Math.round(completed / total * 100) : 0}%` },
        ].map(s => (
          <div key={s.label} className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Submissions</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {submissions.slice(-5).reverse().map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
              <span className="text-gray-500">{new Date(s.timestamp).toLocaleString()}</span>
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                s.completed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>{s.completed ? 'Completed' : 'Partial'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════
export default function AdvancedFormBuilder() {
  const [tab, setTab] = useState('builder'); // builder | preview | analytics
  const [steps, setSteps] = useState([newStep(1)]);
  const [activeStep, setActiveStep] = useState(0);
  const [formValues, setFormValues] = useState({});
  const [errors, setErrors] = useState({});
  const [previewStep, setPreviewStep] = useState(0);
  const [submissions, setSubmissions] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  // ── Builder helpers ──────────────────────────────────────────────────
  const addField = () => {
    setSteps(prev => prev.map((s, i) =>
      i === activeStep ? { ...s, fields: [...s.fields, newField()] } : s));
  };

  const removeField = useCallback((fieldId) => {
    setSteps(prev => prev.map(s => ({ ...s, fields: s.fields.filter(f => f.id !== fieldId) })));
  }, []);

  const updateField = useCallback((stepIdx, updated) => {
    setSteps(prev => prev.map((s, i) =>
      i === stepIdx ? { ...s, fields: s.fields.map(f => f.id === updated.id ? updated : f) } : s));
  }, []);

  const addStep = () => {
    setSteps(prev => [...prev, newStep(prev.length + 1)]);
    setActiveStep(steps.length);
  };

  const removeStep = (idx) => {
    if (steps.length === 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx));
    setActiveStep(s => Math.min(s, steps.length - 2));
  };

  const updateStepTitle = (idx, title) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, title } : s));
  };

  // ── Preview helpers ──────────────────────────────────────────────────
  const allFields = steps.flatMap(s => s.fields);

  const handleValueChange = (id, val) => {
    setFormValues(prev => ({ ...prev, [id]: val }));
    if (errors[id]) setErrors(prev => { const e = { ...prev }; delete e[id]; return e; });
  };

  const handleNext = () => {
    const errs = validateStep(
      steps[previewStep].fields.filter(f => fieldVisible(f, formValues)),
      formValues
    );
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setPreviewStep(s => s + 1);
  };

  const handleSubmit = () => {
    const errs = validateStep(
      steps[previewStep].fields.filter(f => fieldVisible(f, formValues)),
      formValues
    );
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmissions(prev => [...prev, { values: formValues, completed: true, timestamp: Date.now() }]);
    setSubmitted(true);
  };

  const resetPreview = () => {
    setFormValues({});
    setErrors({});
    setPreviewStep(0);
    setSubmitted(false);
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Advanced Form Builder</h1>
          <p className="text-sm text-gray-500 mt-1">
            Build dynamic forms with conditional logic, validation, and multi-step flows
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
          {[
            { id: 'builder',   label: 'Builder',   icon: Settings },
            { id: 'preview',   label: 'Preview',   icon: Eye },
            { id: 'analytics', label: 'Analytics', icon: BarChart2 },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id}
              onClick={() => { setTab(id); if (id === 'preview') resetPreview(); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* ── BUILDER TAB ── */}
        {tab === 'builder' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Step list */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Steps</p>
                {steps.map((s, i) => (
                  <div key={s.id}
                    onClick={() => setActiveStep(i)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg mb-1 cursor-pointer text-sm transition-colors ${
                      activeStep === i ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                    }`}>
                    <span className="truncate">{s.title}</span>
                    {steps.length > 1 && (
                      <button onClick={e => { e.stopPropagation(); removeStep(i); }}
                        className="text-gray-300 hover:text-red-400 ml-1 flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addStep}
                  className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-800 py-1.5 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
                  <Plus size={12} /> Add Step
                </button>
              </div>
            </div>

            {/* Field editor */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <input
                    className="text-lg font-semibold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none bg-transparent"
                    value={steps[activeStep]?.title ?? ''}
                    onChange={e => updateStepTitle(activeStep, e.target.value)}
                  />
                  <span className="text-xs text-gray-400">
                    {steps[activeStep]?.fields.length ?? 0} field(s)
                  </span>
                </div>

                {steps[activeStep]?.fields.length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <p className="text-sm">No fields yet. Add one below.</p>
                  </div>
                )}

                {steps[activeStep]?.fields.map(field => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    allFields={steps[activeStep].fields}
                    onChange={updated => updateField(activeStep, updated)}
                    onRemove={removeField}
                  />
                ))}

                <button onClick={addField}
                  className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 px-3 py-2 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors w-full justify-center">
                  <Plus size={15} /> Add Field
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PREVIEW TAB ── */}
        {tab === 'preview' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              {submitted ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8">
                  <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-800">Form Submitted!</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-4">Thank you for your response.</p>
                  <button onClick={resetPreview}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    Submit Again
                  </button>
                </motion.div>
              ) : (
                <>
                  {/* Step progress */}
                  {steps.length > 1 && (
                    <div className="flex items-center gap-1 mb-6">
                      {steps.map((s, i) => (
                        <React.Fragment key={s.id}>
                          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                            i < previewStep ? 'bg-green-500 text-white'
                            : i === previewStep ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-500'
                          }`}>{i < previewStep ? <CheckCircle size={14} /> : i + 1}</div>
                          {i < steps.length - 1 && (
                            <div className={`flex-1 h-0.5 ${i < previewStep ? 'bg-green-400' : 'bg-gray-200'}`} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    {steps[previewStep]?.title}
                  </h2>

                  <AnimatePresence mode="wait">
                    <motion.div key={previewStep}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                      {steps[previewStep]?.fields.map(field => (
                        <FieldInput
                          key={field.id}
                          field={field}
                          value={formValues[field.id]}
                          onChange={handleValueChange}
                          error={errors[field.id]}
                          allFields={formValues}
                        />
                      ))}
                    </motion.div>
                  </AnimatePresence>

                  <div className="flex justify-between mt-6">
                    <button
                      onClick={() => setPreviewStep(s => s - 1)}
                      disabled={previewStep === 0}
                      className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                      <ChevronLeft size={15} /> Back
                    </button>
                    {previewStep < steps.length - 1 ? (
                      <button onClick={handleNext}
                        className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Next <ChevronRight size={15} />
                      </button>
                    ) : (
                      <button onClick={handleSubmit}
                        className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                        <CheckCircle size={15} /> Submit
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Form Analytics</h2>
            <Analytics submissions={submissions} />
          </div>
        )}
      </div>
    </div>
  );
}
