import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/gamification.css';

const LeaderboardView = ({ userId }) => {
  const [leaderboardType, setLeaderboardType] = useState('all_time');
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const [leaderRes, rankRes, statsRes] = await Promise.all([
          axios.get(`/api/gamification/leaderboards/${leaderboardType}?limit=50`),
          axios.get(`/api/gamification/user/${userId}/rank/${leaderboardType}`),
          axios.get(`/api/gamification/leaderboards/${leaderboardType}/stats`)
        ]);

        setLeaderboard(leaderRes.data || []);
        setUserRank(rankRes.data);
        setStats(statsRes.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [leaderboardType, userId]);

  if (loading) return <div className="gamification-loading">Loading leaderboard...</div>;

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🏅';
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h3>Leaderboard</h3>
        <div className="leaderboard-types">
          {['all_time', 'monthly', 'weekly'].map(type => (
            <button
              key={type}
              className={`type-btn ${leaderboardType === type ? 'active' : ''}`}
              onClick={() => setLeaderboardType(type)}
            >
              {type.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="leaderboard-stats">
          <div className="stat-box">
            <span className="stat-label">Participants</span>
            <span className="stat-value">{stats.total_participants}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Highest Score</span>
            <span className="stat-value">{stats.highest_points?.toLocaleString()}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Average Score</span>
            <span className="stat-value">{Math.round(stats.average_points)}</span>
          </div>
        </div>
      )}

      {userRank && userRank.rank !== 'N/A' && (
        <div className="user-rank-card">
          <div className="rank-medal">{getMedalEmoji(userRank.rank)}</div>
          <div className="rank-info">
            <span className="rank-number">Your Rank: #{userRank.rank}</span>
            <span className="rank-points">{userRank.points.toLocaleString()} Points</span>
          </div>
        </div>
      )}

      <div className="leaderboard-list">
        <div className="leaderboard-header-row">
          <span className="rank-col">Rank</span>
          <span className="name-col">Player</span>
          <span className="points-col">Points</span>
        </div>

        {leaderboard.map((entry, index) => (
          <div 
            key={entry.user_id} 
            className={`leaderboard-row ${entry.user_id === parseInt(userId) ? 'current-user' : ''}`}
          >
            <span className="rank-col">
              <span className="medal-emoji">{getMedalEmoji(entry.rank)}</span>
              {entry.rank}
            </span>
            <span className="name-col">
              {entry.user_avatar_url && (
                <img src={entry.user_avatar_url} alt={entry.user_first_name} className="avatar" />
              )}
              <span className="player-name">
                {entry.user_first_name} {entry.user_last_name}
              </span>
            </span>
            <span className="points-col">
              <span className="points-badge">{entry.points.toLocaleString()}</span>
            </span>
          </div>
        ))}
      </div>

      {leaderboard.length === 0 && (
        <div className="empty-state">
          <p>No leaderboard data available yet</p>
        </div>
      )}
    </div>
  );
};

export default LeaderboardView;
