import React from 'react';
import './DesignSystem.css';
import './Button.css';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading = false, 
  disabled = false, 
  onClick,
  ariaLabel,
  ...props 
}) => {
  const className = `btn btn-${variant} btn-${size} ${isLoading ? 'is-loading' : ''}`;
  
  return (
    <button
      className={className}
      disabled={disabled || isLoading}
      onClick={onClick}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="spinner" aria-hidden="true"></span>
      ) : null}
      <span className="btn-content">{children}</span>
    </button>
  );
};

export default Button;
