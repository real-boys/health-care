import React, { useState } from 'react';
import PointsDisplay from './PointsDisplay';
import BadgeShowcase from './BadgeShowcase';
import LeaderboardView from './LeaderboardView';
import AchievementProgress from './AchievementProgress';
import ChallengeTracker from './ChallengeTracker';
import '../styles/gamification.css';

const GamificationDashboard = ({ userId = localStorage.getItem('userId') }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!userId) {
    return <div className="gamification-message">Please log in to view gamification features.</div>;
  }

  return (
    <div className="gamification-dashboard">
      <div className="dashboard-header">
        <h2>🎮 Gamification Center</h2>
        <p className="subtitle">Track your progress, earn badges, and compete with others</p>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'badges' ? 'active' : ''}`}
          onClick={() => setActiveTab('badges')}
        >
          🏆 Badges
        </button>
        <button
          className={`tab-btn ${activeTab === 'achievements' ? 'active' : ''}`}
          onClick={() => setActiveTab('achievements')}
        >
          ⭐ Achievements
        </button>
        <button
          className={`tab-btn ${activeTab === 'challenges' ? 'active' : ''}`}
          onClick={() => setActiveTab('challenges')}
        >
          🎯 Challenges
        </button>
        <button
          className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          🏅 Leaderboard
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="tab-content overview-content">
            <div className="overview-grid">
              <div className="overview-section">
                <PointsDisplay userId={userId} showHistory={true} />
              </div>
              <div className="overview-section">
                <div className="quick-stats">
                  <h3>Quick Stats</h3>
                  <div className="stats-container">
                    <div className="stat-card">
                      <span className="stat-icon">🏆</span>
                      <span className="stat-name">Badges Earned</span>
                      <span className="stat-count">--</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon">⭐</span>
                      <span className="stat-name">Achievements</span>
                      <span className="stat-count">--</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-icon">🎯</span>
                      <span className="stat-name">Challenges</span>
                      <span className="stat-count">--</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="recent-activity">
              <h3>Activity Highlights</h3>
              <div className="activity-placeholder">
                <p>Complete activities to earn points and unlock badges!</p>
                <ul className="activity-tips">
                  <li>✓ Attend appointments to earn points</li>
                  <li>✓ Complete health tracking to unlock badges</li>
                  <li>✓ Join challenges to compete with others</li>
                  <li>✓ Read articles and take surveys for bonuses</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="tab-content">
            <BadgeShowcase userId={userId} />
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="tab-content">
            <AchievementProgress userId={userId} />
          </div>
        )}

        {activeTab === 'challenges' && (
          <div className="tab-content">
            <ChallengeTracker userId={userId} />
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="tab-content">
            <LeaderboardView userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
};

export default GamificationDashboard;
