import React, { useState } from 'react';
import { Star, StarHalf } from 'lucide-react';

const StarRating = ({
  value = 0,
  max = 5,
  size = 'md',
  readonly = false,
  onChange,
  showValue = true,
  color = 'yellow',
  className = ''
}) => {
  const [hoverValue, setHoverValue] = useState(0);
  const [rating, setRating] = useState(value);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10'
  };

  const colorClasses = {
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    purple: 'text-purple-400'
  };

  const handleStarClick = (starValue) => {
    if (readonly) return;
    
    const newRating = starValue;
    setRating(newRating);
    if (onChange) {
      onChange(newRating);
    }
  };

  const handleStarHover = (starValue) => {
    if (readonly) return;
    setHoverValue(starValue);
  };

  const handleMouseLeave = () => {
    if (readonly) return;
    setHoverValue(0);
  };

  const renderStar = (index) => {
    const starValue = index + 1;
    const displayValue = hoverValue || rating;
    const isFilled = starValue <= displayValue;
    const isHalf = starValue === Math.ceil(displayValue) && displayValue % 1 !== 0;

    const StarComponent = isHalf ? StarHalf : Star;
    const starColor = isFilled ? colorClasses[color] : 'text-gray-300';

    return (
      <button
        key={index}
        type="button"
        className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
        onClick={() => handleStarClick(starValue)}
        onMouseEnter={() => handleStarHover(starValue)}
        onMouseLeave={handleMouseLeave}
        disabled={readonly}
      >
        <StarComponent
          className={`${sizeClasses[size]} ${starColor} ${className}`}
          fill={isFilled ? 'currentColor' : 'none'}
        />
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {Array.from({ length: max }, (_, index) => renderStar(index))}
      </div>
      {showValue && (
        <span className={`text-sm font-medium ${colorClasses[color]}`}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default StarRating;
