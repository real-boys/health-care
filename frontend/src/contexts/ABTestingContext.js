import React, { createContext, useContext, useState, useEffect } from 'react';

const ABTestingContext = createContext();

export const ABTestingProvider = ({ children }) => {
  const [variants, setVariants] = useState({});

  useEffect(() => {
    // Load existing variants from localStorage
    const savedVariants = JSON.parse(localStorage.getItem('ab_test_variants') || '{}');
    setVariants(savedVariants);
  }, []);

  const getVariant = (experimentId, availableVariants = ['A', 'B']) => {
    if (variants[experimentId]) {
      return variants[experimentId];
    }

    // Assign a random variant
    const randomIndex = Math.floor(Math.random() * availableVariants.length);
    const assignedVariant = availableVariants[randomIndex];
    
    const newVariants = { ...variants, [experimentId]: assignedVariant };
    setVariants(newVariants);
    localStorage.setItem('ab_test_variants', JSON.stringify(newVariants));
    
    console.log(`[AB Testing] Assigned variant ${assignedVariant} for experiment ${experimentId}`);
    return assignedVariant;
  };

  const trackEvent = (experimentId, eventName, metadata = {}) => {
    const variant = variants[experimentId];
    console.log(`[AB Testing] Track: ${eventName} | Experiment: ${experimentId} | Variant: ${variant}`, metadata);
    // Here you would integrate with an actual analytics service
  };

  return (
    <ABTestingContext.Provider value={{ getVariant, trackEvent }}>
      {children}
    </ABTestingContext.Provider>
  );
};

export const useABTest = () => {
  const context = useContext(ABTestingContext);
  if (!context) {
    throw new Error('useABTest must be used within an ABTestingProvider');
  }
  return context;
};
