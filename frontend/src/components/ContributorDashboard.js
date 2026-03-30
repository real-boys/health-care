import React, { useState, useEffect } from 'react';
import { 
  User, 
  Award, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  DollarSign,
  Activity,
  FileText,
  ExternalLink,
  Star,
  Trophy
} from 'lucide-react';
import ReputationDashboard from './ReputationDashboard';
import StarRating from './StarRating';

const ContributorDashboard = ({ contributorStats, availableIssues, onApplyToIssue, onReviewIssue }) => {
  const [activeTab, setActiveTab] = useState('available');
  const [selectedIssue, setSelectedIssue] = useState(null);

  const getLevelColor = (level) => {
    switch (level) {
      case 'JUNIOR':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'INTERMEDIATE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SENIOR':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'EXPERT':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MASTER':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'JUNIOR':
        return <Award className="w-4 h-4 text-green-500" />;
      case 'INTERMEDIATE':
        return <Award className="w-4 h-4 text-blue-500" />;
      case 'SENIOR':
        return <Award className="w-4 h-4 text-purple-500" />;
      case 'EXPERT':
        return <Award className="w-4 h-4 text-orange-500" />;
      case 'MASTER':
        return <Award className="w-4 h-4 text-red-500" />;
      default:
        return <Award className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLevelName = (level) => {
    switch (level) {
      case 'JUNIOR':
        return 'Junior Contributor';
      case 'INTERMEDIATE':
        return 'Intermediate Contributor';
      case 'SENIOR':
        return 'Senior Contributor';
      case 'EXPERT':
        return 'Expert Contributor';
      case 'MASTER':
        return 'Master Contributor';
      default:
        return 'Contributor';
    }
  };

  const getNextLevel = (currentLevel, reputation) => {
    const thresholds = {
      'JUNIOR': 50,
      'INTERMEDIATE': 150,
      'SENIOR': 300,
      'EXPERT': 500,
      'MASTER': 1000
    };
    
    const levels = ['JUNIOR', 'INTERMEDIATE', 'SENIOR', 'EXPERT', 'MASTER'];
    const currentIndex = levels.indexOf(currentLevel);
    
    for (let i = currentIndex + 1; i < levels.length; i++) {
      if (reputation >= thresholds[levels[i]]) {
        return levels[i];
      }
    }
    return currentLevel;
  };

  const nextLevel = contributorStats ? getNextLevel(contributorStats.level, contributorStats.reputation) : null;

  return (
    <div className="contributor-dashboard">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              Contributor Dashboard
            </h2>
            <p className="text-gray-600">
              Manage your contributions and track your reputation
            </p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Current Level</h3>
            {getLevelIcon(contributorStats.level)}
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(contributorStats.level)}`}>
            {getLevelName(contributorStats.level)}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Reputation</h3>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {contributorStats.reputation}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Next Level</h3>
            {nextLevel && getLevelIcon(nextLevel)}
          </div>
          <div className="text-sm text-gray-600">
            {nextLevel ? getLevelName(nextLevel) : 'Max Level'}
          </div>
        </div>

        {nextLevel && (
          <div className="text-sm text-green-600">
            {nextLevel && `${nextLevel.reputation - contributorStats.reputation} rep to next level`}
          </div>
        )}
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Issues Reviewed</h3>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {contributorStats.totalIssuesReviewed}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Issues Approved</h3>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {contributorStats.totalIssuesApproved}
          </div>
        </div>
      </div>

      {/* Total Contributed */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Total Contributed</h3>
          <DollarSign className="w-4 h-4 text-green-500" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {(contributorStats.totalContributed / 1e18).toFixed(2)} ETH
        </div>
      </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Member Since</h3>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-sm text-gray-600">
            {new Date(contributorStats.joined * 1000).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'available'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Available Issues
          </button>
          
          <button
            onClick={() => setActiveTab('your-applications')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'your-applications'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Activity className="w-4 h-4" />
            Your Applications
          </button>
          
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'reviews'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Reviews
          </button>
          
          <button
            onClick={() => setActiveTab('reputation')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md ${
              activeTab === 'reputation'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Reputation
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'available' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Issues to Review</h3>
          <div className="space-y-4">
            {availableIssues.map((issue) => (
              <div key={issue.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-md font-medium text-gray-900">{issue.title}</h4>
                    <p className="text-sm text-gray-600">{issue.issueType.replace('_', ' ')}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    Funding: {(issue.fundingAmount / 1e18).toFixed(2)} ETH
                  </span>
                </div>
                <button
                  onClick={() => onReviewIssue(issue.id)}
                  className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700"
                >
                  Review Issue
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'your-applications' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Applications</h3>
          <div className="text-gray-600">
            Your pending and approved applications will appear here.
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h3>
          <div className="text-gray-600">
            Your recent issue reviews and outcomes.
          </div>
        </div>
      )}

      {activeTab === 'reputation' && (
        <ReputationDashboard 
          userId={contributorStats?.id} 
          profileType="contributor" 
          currentUser={contributorStats}
        />
      )}
    </div>
  );
};

export default ContributorDashboard;
