import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/gamification.css';

const BadgeShowcase = ({ userId }) => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const response = await axios.get(`/api/gamification/user/${userId}/badges`);
        setBadges(response.data || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching badges:', error);
        setLoading(false);
      }
    };

    fetchBadges();
  }, [userId]);

  if (loading) return <div className="gamification-loading">Loading badges...</div>;

  const categories = ['all', ...new Set(badges.map(b => b.category))];
  const filteredBadges = filterCategory === 'all' 
    ? badges 
    : badges.filter(b => b.category === filterCategory);

  const earnedBadges = filteredBadges.filter(b => b.isEarned);
  const lockedBadges = filteredBadges.filter(b => !b.isEarned);

  return (
    <div className="badge-showcase-container">
      <div className="showcase-header">
        <h3>Badges ({earnedBadges.length}/{filteredBadges.length})</h3>
        <div className="category-filter">
          {categories.map(cat => (
            <button
              key={cat}
              className={`filter-btn ${filterCategory === cat ? 'active' : ''}`}
              onClick={() => setFilterCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="badges-grid">
        {earnedBadges.length > 0 && (
          <div className="badge-section">
            <h4 className="section-title">Earned Badges</h4>
            <div className="badges-collection">
              {earnedBadges.map(badge => (
                <div
                  key={badge.badgeId}
                  className="badge-tile earned"
                  onClick={() => setSelectedBadge(badge)}
                >
                  <div className="badge-image">
                    {badge.icon_url ? (
                      <img src={badge.icon_url} alt={badge.name} />
                    ) : (
                      <div className="badge-placeholder">🏆</div>
                    )}
                  </div>
                  <div className="badge-info">
                    <h5>{badge.name}</h5>
                    <span className={`rarity-badge ${badge.rarity_level}`}>
                      {badge.rarity_level}
                    </span>
                  </div>
                  <span className="earned-date">
                    {new Date(badge.earned_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {lockedBadges.length > 0 && (
          <div className="badge-section">
            <h4 className="section-title">Locked Badges</h4>
            <div className="badges-collection">
              {lockedBadges.map(badge => (
                <div
                  key={badge.badgeId}
                  className="badge-tile locked"
                  onClick={() => setSelectedBadge(badge)}
                >
                  <div className="badge-image locked-image">
                    {badge.icon_url ? (
                      <img src={badge.icon_url} alt={badge.name} style={{ opacity: 0.3 }} />
                    ) : (
                      <div className="badge-placeholder">🔒</div>
                    )}
                  </div>
                  <div className="badge-info">
                    <h5>{badge.name}</h5>
                    <span className={`rarity-badge ${badge.rarity_level}`}>
                      {badge.rarity_level}
                    </span>
                  </div>
                  <div className="progress-indicator">
                    <div className="mini-progress-bar">
                      <div 
                        className="mini-progress-fill" 
                        style={{ width: `${badge.progressValue?.percentage || 0}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">
                      {badge.progressValue?.current || 0}/{badge.progressValue?.target || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedBadge && (
        <div className="badge-detail-modal" onClick={() => setSelectedBadge(null)}>
          <div className="badge-detail-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedBadge(null)}>✕</button>
            
            <div className="detail-left">
              {selectedBadge.icon_url ? (
                <img src={selectedBadge.icon_url} alt={selectedBadge.name} />
              ) : (
                <div className="badge-placeholder-large">🏆</div>
              )}
            </div>

            <div className="detail-right">
              <h3>{selectedBadge.name}</h3>
              <span className={`rarity-badge large ${selectedBadge.rarity_level}`}>
                {selectedBadge.rarity_level.toUpperCase()}
              </span>
              <p className="description">{selectedBadge.description}</p>

              {selectedBadge.isEarned ? (
                <div className="earned-info">
                  <span className="earned-label">🎉 Earned on {new Date(selectedBadge.earned_at).toLocaleDateString()}</span>
                </div>
              ) : (
                <div className="lock-info">
                  <h4>How to Unlock:</h4>
                  <p>{JSON.stringify(selectedBadge.criteria)}</p>
                  <div className="progress-large">
                    <div className="progress-bar-large">
                      <div 
                        className="progress-fill-large" 
                        style={{ width: `${selectedBadge.progressValue?.percentage || 0}%` }}
                      ></div>
                    </div>
                    <span className="percentage">
                      {selectedBadge.progressValue?.percentage || 0}% Complete
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeShowcase;
