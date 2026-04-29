import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const GamificationContext = createContext();

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return context;
};

export const GamificationProvider = ({ children }) => {
  const [gamificationData, setGamificationData] = useState({
    points: null,
    badges: [],
    achievements: [],
    tier: null,
    streaks: [],
    leaderboardRank: null,
    challenges: [],
    loading: true,
    error: null
  });

  const userId = localStorage.getItem('userId');

  // Fetch user gamification data
  const fetchGamificationData = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await axios.get(`/api/gamification/user/${userId}`);
      setGamificationData(prev => ({
        ...prev,
        ...response.data,
        loading: false,
        error: null
      }));
    } catch (error) {
      setGamificationData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  }, [userId]);

  // Award points
  const awardPoints = useCallback(async (points, activityType, description = '', metadata = {}) => {
    if (!userId) return;

    try {
      const response = await axios.post(
        `/api/gamification/user/${userId}/award-points`,
        { points, activityType, description, metadata }
      );
      
      // Refresh gamification data
      await fetchGamificationData();
      return response.data;
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }
  }, [userId, fetchGamificationData]);

  // Join challenge
  const joinChallenge = useCallback(async (challengeId) => {
    if (!userId) return;

    try {
      const response = await axios.post(
        `/api/gamification/user/${userId}/challenges/${challengeId}/join`
      );
      
      // Refresh gamification data
      await fetchGamificationData();
      return response.data;
    } catch (error) {
      console.error('Error joining challenge:', error);
      throw error;
    }
  }, [userId, fetchGamificationData]);

  // Update challenge progress
  const updateChallengeProgress = useCallback(async (challengeId, progressValue) => {
    if (!userId) return;

    try {
      const response = await axios.post(
        `/api/gamification/user/${userId}/challenges/${challengeId}/progress`,
        { progressValue }
      );
      
      // Refresh gamification data
      await fetchGamificationData();
      return response.data;
    } catch (error) {
      console.error('Error updating challenge progress:', error);
      throw error;
    }
  }, [userId, fetchGamificationData]);

  // Initial fetch
  useEffect(() => {
    fetchGamificationData();
  }, [fetchGamificationData]);

  const value = {
    ...gamificationData,
    fetchGamificationData,
    awardPoints,
    joinChallenge,
    updateChallengeProgress
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
};

export default GamificationContext;
