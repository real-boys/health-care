import { useState, useEffect, useSyncExternalStore } from 'react';

// A simple, optimized state management system inspired by Zustand
const createStore = (initialState) => {
  let state = initialState;
  const listeners = new Set();

  const getState = () => state;

  const setState = (nextStateOrFn) => {
    const nextState = typeof nextStateOrFn === 'function' ? nextStateOrFn(state) : nextStateOrFn;
    
    if (!Object.is(state, nextState)) {
      const start = performance.now();
      state = { ...state, ...nextState };
      
      // Persistence
      localStorage.setItem('aegis-app-storage', JSON.stringify(state));
      
      listeners.forEach((listener) => listener(state));
      
      const end = performance.now();
      if (end - start > 10) {
        console.warn(`[Store Update] Long-running state update: ${(end - start).toFixed(2)}ms`);
      }
    }
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // Load from persistence
  const saved = localStorage.getItem('aegis-app-storage');
  if (saved) {
    try {
      state = { ...state, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Failed to load persisted state", e);
    }
  }

  return { getState, setState, subscribe };
};

const store = createStore({
  user: {
    name: 'John Smith',
    level: 4,
    role: 'Admin',
    points: 1250,
  },
  points: 1250,
  badges: [
    { id: 1, name: 'First Audit', icon: '🛡️', date: '2024-01-15' },
    { id: 2, name: 'Fraud Hunter', icon: '🔍', date: '2024-02-10' }
  ],
  achievements: [
    { id: 1, name: 'Verified 100 Claims', progress: 100, total: 100, completed: true },
    { id: 2, name: 'Detected 5 Anomalies', progress: 3, total: 5, completed: false }
  ],
  content: [],
  recommendations: [
    { id: 1, title: 'Investigate Provider X', type: 'High Priority', confidence: 0.95 },
    { id: 2, title: 'Audit Claim #882', type: 'Anomaly', confidence: 0.88 },
    { id: 3, title: 'Review Patient History #212', type: 'Insight', confidence: 0.72 }
  ],
});

// Custom hook to use the store with selector support for performance
export const useAppStore = (selector = (s) => s) => {
  const state = useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );
  
  // Merge actions into the returned object if it's the whole state
  if (typeof state === 'object' && state !== null && !Array.isArray(state)) {
    return { ...state, ...actions };
  }
  
  return state;
};

// Actions
export const actions = {
  setUser: (user) => store.setState({ user }),
  addPoints: (amount) => store.setState((s) => ({ points: s.points + amount })),
  addContent: (item) => store.setState((s) => ({ 
    content: [{ ...item, id: Date.now(), version: 1, createdAt: new Date() }, ...s.content] 
  })),
  updateContent: (id, updates) => store.setState((s) => ({
    content: s.content.map(c => 
      c.id === id ? { ...c, ...updates, version: c.version + 1, updatedAt: new Date() } : c
    )
  })),
  provideFeedback: (id, rating) => store.setState((s) => ({
    recommendations: s.recommendations.filter(r => r.id !== id)
  })),
};

export default useAppStore;
