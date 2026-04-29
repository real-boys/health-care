import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/gamification.css';

const AchievementProgress = ({ userId }) => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [filterTier, setFilterTier] = useState('all');

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const response = await axios.get(`/api/gamification/user/${userId}/achievements`);
        setAchievements(response.data || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching achievements:', error);
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [userId]);

  if (loading) return <div className="gamification-loading">Loading achievements...</div>;

  const tiers = ['all', 'bronze', 'silver', 'gold', 'platinum'];
  const tierColors = {
    1: 'bronze',
    2: 'silver',
    3: 'gold',
    4: 'platinum'
  };

  const filteredAchievements = filterTier === 'all'
    ? achievements
    : achievements.filter(a => tierColors[a.tier_level] === filterTier);

  const unlockedCount = filteredAchievements.filter(a => a.isUnlocked).length;
  const totalCount = filteredAchievements.length;

  return (
    <div className="achievement-container">
      <div className="achievement-header">
        <h3>Achievements</h3>
        <span className="achievement-count">{unlockedCount}/{totalCount}</span>
      </div>

      <div className="tier-filter">
        {tiers.map(tier => (
          <button
            key={tier}
            className={`tier-btn ${filterTier === tier ? 'active' : ''} ${tier !== 'all' ? tier : ''}`}
            onClick={() => setFilterTier(tier)}
          >
            {tier.charAt(0).toUpperCase() + tier.slice(1)}
          </button>
        ))}
      </div>

      <div className="achievements-grid">
        {filteredAchievements.map(achievement => (
          <div
            key={achievement.achievementId}
            className={`achievement-card ${achievement.isUnlocked ? 'unlocked' : 'locked'}`}
            onClick={() => setSelectedAchievement(achievement)}
          >
            <div className="achievement-visual">
              {achievement.icon_url ? (
                <img 
                  src={achievement.icon_url} 
                  alt={achievement.name}
                  style={{ opacity: achievement.isUnlocked ? 1 : 0.3 }}
                />
              ) : (
                <div className="achievement-placeholder">
                  {achievement.isUnlocked ? '⭐' : '🔓'}
                </div>
              )}
              {achievement.isUnlocked && <div className="unlock-badge">✓</div>}
            </div>

            <div className="achievement-meta">
              <h5>{achievement.name}</h5>
              <span className={`tier-badge ${tierColors[achievement.tier_level]}`}>
                {tierColors[achievement.tier_level]}
              </span>
            </div>

            {!achievement.isUnlocked && (
              <div className="achievement-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${achievement.progressValue?.percentage || 0}%` }}
                  ></div>
                </div>
                <span className="progress-text">
                  {achievement.progressValue?.percentage || 0}%
                </span>
              </div>
            )}

            <div className="points-reward">
              +{achievement.points_reward} pts
            </div>
          </div>
        ))}
      </div>

      {selectedAchievement && (
        <div className="achievement-modal" onClick={() => setSelectedAchievement(null)}>
          <div className="achievement-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedAchievement(null)}>✕</button>

            <div className="modal-left">
              {selectedAchievement.icon_url ? (
                <img src={selectedAchievement.icon_url} alt={selectedAchievement.name} />
              ) : (
                <div className="achievement-placeholder-large">
                  {selectedAchievement.isUnlocked ? '⭐' : '🔓'}
                </div>
              )}
            </div>

            <div className="modal-right">
              <h3>{selectedAchievement.name}</h3>
              <p className="description">{selectedAchievement.description}</p>

              <div className="achievement-meta-info">
                <div className="meta-item">
                  <span className="meta-label">Tier</span>
                  <span className={`tier-badge ${tierColors[selectedAchievement.tier_level]}`}>
                    {tierColors[selectedAchievement.tier_level]}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Reward</span>
                  <span className="reward-value">+{selectedAchievement.points_reward} Points</span>
                </div>
              </div>

              {selectedAchievement.isUnlocked ? (
                <div className="unlocked-status">
                  <span className="unlocked-icon">✓</span>
                  <span className="unlocked-text">
                    Unlocked on {new Date(selectedAchievement.unlockedAt).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <div className="progress-section">
                  <h4>Progress</h4>
                  <div className="progress-bar-large">
                    <div 
                      className="progress-fill-large" 
                      style={{ width: `${selectedAchievement.progressValue?.percentage || 0}%` }}
                    ></div>
                  </div>
                  <span className="progress-details">
                    {selectedAchievement.progressValue?.current || 0} / {selectedAchievement.progressValue?.target || 0}
                    ({selectedAchievement.progressValue?.percentage || 0}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AchievementProgress;
