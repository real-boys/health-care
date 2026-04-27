import React, { createContext, useContext, useState, useEffect } from 'react';

const ABTestingContext = createContext();

export const useABTesting = () => {
  const context = useContext(ABTestingContext);
  if (!context) {
    throw new Error('useABTesting must be used within an ABTestingProvider');
  }
  return context;
};

// Simple hashing function for stable assignment
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export const ABTestingProvider = ({ children, userId }) => {
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    // Load existing assignments from localStorage
    const stored = localStorage.getItem('ab_testing_assignments');
    if (stored) {
      setAssignments(JSON.parse(stored));
    }
  }, []);

  const getVariant = (experimentId, variants = ['A', 'B']) => {
    if (assignments[experimentId]) {
      return assignments[experimentId];
    }

    // Stable assignment based on userId and experimentId
    const seed = userId || 'anonymous';
    const hash = hashString(`${seed}_${experimentId}`);
    const variantIndex = hash % variants.length;
    const assignedVariant = variants[variantIndex];

    const newAssignments = { ...assignments, [experimentId]: assignedVariant };
    setAssignments(newAssignments);
    localStorage.setItem('ab_testing_assignments', JSON.stringify(newAssignments));

    // Log the assignment for analytics
    console.log(`[AB Testing] User ${seed} assigned to ${assignedVariant} for experiment ${experimentId}`);
    
    return assignedVariant;
  };

  const trackEvent = (experimentId, eventName, metadata = {}) => {
    const variant = assignments[experimentId];
    console.log(`[AB Testing] Event tracked: ${eventName} for experiment ${experimentId} (Variant: ${variant})`, metadata);
    // In a real app, send this to an analytics service
  };

  return (
    <ABTestingContext.Provider value={{ getVariant, trackEvent, assignments }}>
      {children}
    </ABTestingContext.Provider>
  );
};
