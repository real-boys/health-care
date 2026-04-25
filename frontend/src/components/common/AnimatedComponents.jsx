import React from 'react';
import { motion } from 'framer-motion';
import { useAnimation } from '../../context/AnimationContext';

export const AnimatedCard = ({ children, className = '', ...props }) => {
  const { springTransition } = useAnimation();
  
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={springTransition}
      className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const AnimatedButton = ({ children, className = '', ...props }) => {
  const { springTransition } = useAnimation();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={springTransition}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export const LoadingSpinner = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4'
  };

  return (
    <div className="flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className={`${sizes[size]} border-blue-500 border-t-transparent rounded-full`}
      />
    </div>
  );
};

export const SkeletonLoader = ({ className = '' }) => {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className={`bg-gray-200 rounded ${className}`}
    />
  );
};

export const PageTransition = ({ children }) => {
  const { fadeTransition } = useAnimation();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={fadeTransition}
    >
      {children}
    </motion.div>
  );
};

export const GestureContainer = ({ children, onSwipeLeft, onSwipeRight }) => {
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(e, { offset, velocity }) => {
        const swipe = offset.x > 100 ? 'right' : offset.x < -100 ? 'left' : null;
        if (swipe === 'right' && onSwipeRight) onSwipeRight();
        if (swipe === 'left' && onSwipeLeft) onSwipeLeft();
      }}
    >
      {children}
    </motion.div>
  );
};
