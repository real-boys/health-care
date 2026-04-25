import React from 'react';
import './DesignSystem.css';
import './Input.css';

const Input = ({ 
  label, 
  error, 
  helperText, 
  id, 
  required = false,
  ...props 
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="input-group">
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label} {required && <span className="required" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`input-field ${error ? 'has-error' : ''}`}
        aria-invalid={!!error}
        aria-describedby={`${error ? errorId : ''} ${helperText ? helperId : ''}`}
        required={required}
        {...props}
      />
      {error && (
        <p id={errorId} className="input-error" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="input-helper">
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
