import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/gamification.css';

const ChallengeTracker = ({ userId }) => {
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [upcomingChallenges, setUpcomingChallenges] = useState([]);
  const [userChallenges, setUserChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const [active, upcoming, userRes] = await Promise.all([
          axios.get('/api/gamification/challenges/active'),
          axios.get('/api/gamification/challenges/upcoming?limit=5'),
          axios.get(`/api/gamification/user/${userId}/challenges`)
        ]);

        setActiveChallenges(active.data || []);
        setUpcomingChallenges(upcoming.data || []);
        setUserChallenges(userRes.data || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching challenges:', error);
        setLoading(false);
      }
    };

    fetchChallenges();
  }, [userId]);

  const handleJoinChallenge = async (challengeId) => {
    try {
      await axios.post(`/api/gamification/user/${userId}/challenges/${challengeId}/join`);
      // Refresh challenges
      const userRes = await axios.get(`/api/gamification/user/${userId}/challenges`);
      setUserChallenges(userRes.data || []);
    } catch (error) {
      console.error('Error joining challenge:', error);
    }
  };

  const handleUpdateProgress = async (challengeId, newProgress) => {
    try {
      await axios.post(
        `/api/gamification/user/${userId}/challenges/${challengeId}/progress`,
        { progressValue: newProgress }
      );
      // Refresh challenges
      const userRes = await axios.get(`/api/gamification/user/${userId}/challenges`);
      setUserChallenges(userRes.data || []);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  if (loading) return <div className="gamification-loading">Loading challenges...</div>;

  const userChallengeIds = new Set(userChallenges.map(c => c.challenge_id));
  const availableChallenges = activeChallenges.filter(c => !userChallengeIds.has(c.id));

  const getDifficultyColor = (difficulty) => {
    switch(difficulty) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'hard': return '#f44336';
      default: return '#999';
    }
  };

  return (
    <div className="challenge-container">
      <div className="challenge-header">
        <h3>Challenges</h3>
        <span className="challenge-count">
          {userChallenges.filter(c => c.status === 'active').length} Active
        </span>
      </div>

      {/* Active Challenges Section */}
      <div className="challenges-section">
        <h4 className="section-title">Your Challenges</h4>
        {userChallenges.length > 0 ? (
          <div className="challenges-list">
            {userChallenges.slice(0, 5).map(challenge => (
              <div 
                key={challenge.challenge_id} 
                className={`challenge-item ${challenge.is_completed ? 'completed' : ''}`}
                onClick={() => setSelectedChallenge(challenge)}
              >
                <div className="challenge-header-item">
                  <h5>{challenge.name}</h5>
                  <span 
                    className="difficulty-badge"
                    style={{ backgroundColor: getDifficultyColor(challenge.difficulty_level) }}
                  >
                    {challenge.difficulty_level}
                  </span>
                </div>

                <p className="challenge-description">{challenge.description}</p>

                <div className="challenge-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${challenge.progress_percentage}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">
                    {challenge.progress_percentage}% Complete
                  </span>
                </div>

                <div className="challenge-footer">
                  <span className="points-reward">+{challenge.points_reward} pts</span>
                  {challenge.is_completed && <span className="completed-badge">✓ Completed</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-message">No active challenges yet. Join one below!</p>
        )}
      </div>

      {/* Available Challenges Section */}
      {availableChallenges.length > 0 && (
        <div className="challenges-section">
          <h4 className="section-title">Available Challenges</h4>
          <div className="challenges-list">
            {availableChallenges.map(challenge => (
              <div 
                key={challenge.id} 
                className="challenge-item available"
              >
                <div className="challenge-header-item">
                  <h5>{challenge.name}</h5>
                  <span 
                    className="difficulty-badge"
                    style={{ backgroundColor: getDifficultyColor(challenge.difficulty_level) }}
                  >
                    {challenge.difficulty_level}
                  </span>
                </div>

                <p className="challenge-description">{challenge.description}</p>

                <div className="challenge-meta">
                  <span className="meta-item">
                    👥 {challenge.participant_count} Participants
                  </span>
                  <span className="meta-item">
                    ⏱️ {challenge.challenge_type}
                  </span>
                </div>

                <button 
                  className="join-btn"
                  onClick={() => handleJoinChallenge(challenge.id)}
                >
                  Join Challenge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Challenges Section */}
      {upcomingChallenges.length > 0 && (
        <div className="challenges-section">
          <h4 className="section-title">Coming Soon</h4>
          <div className="challenges-list">
            {upcomingChallenges.map(challenge => (
              <div key={challenge.id} className="challenge-item upcoming">
                <div className="challenge-header-item">
                  <h5>{challenge.name}</h5>
                  <span className="status-badge upcoming-badge">Coming Soon</span>
                </div>
                <p className="challenge-description">{challenge.description}</p>
                <span className="start-date">
                  Starts: {new Date(challenge.start_date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenge Detail Modal */}
      {selectedChallenge && (
        <div className="challenge-modal" onClick={() => setSelectedChallenge(null)}>
          <div className="challenge-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedChallenge(null)}>✕</button>

            <h3>{selectedChallenge.name}</h3>
            <p className="description">{selectedChallenge.description}</p>

            <div className="modal-details">
              <div className="detail-item">
                <span className="label">Difficulty</span>
                <span 
                  className="value difficulty-badge"
                  style={{ backgroundColor: getDifficultyColor(selectedChallenge.difficulty_level) }}
                >
                  {selectedChallenge.difficulty_level}
                </span>
              </div>

              <div className="detail-item">
                <span className="label">Points Reward</span>
                <span className="value reward">+{selectedChallenge.points_reward}</span>
              </div>

              <div className="detail-item">
                <span className="label">Time Period</span>
                <span className="value">
                  {new Date(selectedChallenge.start_date).toLocaleDateString()} - 
                  {new Date(selectedChallenge.end_date).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="progress-section">
              <h4>Your Progress</h4>
              <div className="progress-bar-large">
                <div 
                  className="progress-fill-large" 
                  style={{ width: `${selectedChallenge.progress_percentage}%` }}
                ></div>
              </div>
              <span className="progress-info">
                {selectedChallenge.progress_value} / {selectedChallenge.completion_criteria?.target || 0}
                ({selectedChallenge.progress_percentage}%)
              </span>
            </div>

            {selectedChallenge.is_completed && (
              <div className="completion-message">
                ✓ Challenge Completed! You earned {selectedChallenge.points_earned} points.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChallengeTracker;
