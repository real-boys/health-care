import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/gamification.css';

const PointsDisplay = ({ userId, showHistory = false }) => {
  const [pointsData, setPointsData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    const fetchPointsData = async () => {
      try {
        const [pointsRes, historyRes] = await Promise.all([
          axios.get(`/api/gamification/user/${userId}/points`),
          showHistory ? axios.get(`/api/gamification/user/${userId}/points-history?limit=10`) : null
        ]);

        setPointsData(pointsRes.data);
        if (historyRes) {
          setHistory(historyRes.data);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching points data:', error);
        setLoading(false);
      }
    };

    fetchPointsData();
  }, [userId, showHistory]);

  if (loading) return <div className="gamification-loading">Loading...</div>;
  if (!pointsData) return null;

  const progressPercentage = (pointsData.total_points / (pointsData.total_points + pointsData.points_to_next_level)) * 100;

  return (
    <div className="points-display-container">
      <div className="points-card main-card">
        <div className="points-header">
          <h3>Your Points</h3>
          <span className="total-points">{pointsData.total_points.toLocaleString()}</span>
        </div>

        <div className="level-section">
          <div className="level-badge">
            <span className="level-number">{pointsData.level}</span>
            <span className="level-label">LEVEL</span>
          </div>
          <div className="level-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(progressPercentage, 100)}%` }}></div>
            </div>
            <p className="progress-text">
              {pointsData.points_to_next_level} Points to Level {pointsData.level + 1}
            </p>
          </div>
        </div>

        <div className="points-stats">
          <div className="stat">
            <span className="stat-label">This Month</span>
            <span className="stat-value">{pointsData.points_this_month}</span>
          </div>
          <div className="stat">
            <span className="stat-label">This Week</span>
            <span className="stat-value">{pointsData.points_this_week}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Streak</span>
            <span className="stat-value">🔥 {pointsData.streak_days}</span>
          </div>
        </div>

        {showHistory && history.length > 0 && (
          <>
            <button 
              className="view-history-btn"
              onClick={() => setShowHistoryModal(!showHistoryModal)}
            >
              View Points History
            </button>

            {showHistoryModal && (
              <div className="history-modal">
                <div className="history-content">
                  <h4>Recent Points Activity</h4>
                  <div className="history-list">
                    {history.map((item) => (
                      <div key={item.id} className="history-item">
                        <div className="history-activity">
                          <span className="activity-type">{item.activity_type}</span>
                          <span className="activity-description">{item.activity_description}</span>
                        </div>
                        <span className={`activity-points ${item.points_earned > 0 ? 'positive' : 'negative'}`}>
                          {item.points_earned > 0 ? '+' : ''}{item.points_earned}
                        </span>
                        <span className="activity-date">
                          {new Date(item.earned_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PointsDisplay;
