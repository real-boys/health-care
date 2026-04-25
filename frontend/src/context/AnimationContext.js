import React, { createContext, useContext, useState, useEffect } from 'react';

const AnimationContext = createContext();

export const useAnimation = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimation must be used within an AnimationProvider');
  }
  return context;
};

export const AnimationProvider = ({ children }) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [animationIntensity, setAnimationIntensity] = useState('medium'); // low, medium, high

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (event) => setReducedMotion(event.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const value = {
    reducedMotion,
    animationIntensity,
    setAnimationIntensity,
    // Helper for framer-motion variants
    getVariants: (variants) => {
      if (reducedMotion) return {};
      return variants;
    },
    // Standard spring transition
    springTransition: {
      type: "spring",
      stiffness: 300,
      damping: 30
    },
    // Gentle fade transition
    fadeTransition: {
      duration: 0.2,
      ease: "easeInOut"
    }
  };

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
};
