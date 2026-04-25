import React from 'react';
import './DesignSystem.css';
import './Card.css';

const Card = ({ children, title, footer, elevation = 'md', className = '', ...props }) => {
  return (
    <div className={`card card-shadow-${elevation} ${className}`} {...props}>
      {title && (
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
