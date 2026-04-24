import React, { useState, useEffect } from 'react';
import { generateSharingUrl, trackSharingEvent, getSharingAnalytics } from '../../utils/socialSharingConfig';
import { Share2, ExternalLink, Copy, Check, X, BarChart3, Users, TrendingUp, Clock } from 'lucide-react';

const SocialSharingManager = ({ 
  cardData, 
  onShareComplete, 
  onShareError,
  showAnalytics = false 
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  useEffect(() => {
    if (showAnalytics) {
      setAnalytics(getSharingAnalytics());
    }
  }, [showAnalytics]);

  const handleShare = async (platform) => {
    if (!cardData) return;
    
    setIsSharing(true);
    setSelectedPlatform(platform);
    setShowShareDialog(true);
    
    try {
      // Track share initiation
      trackSharingEvent('share_initiated', { platform, template: cardData.template });
      
      // Generate sharing URL
      const shareUrl = generateSharingUrl(platform, {
        url: cardData.url,
        title: cardData.title,
        description: cardData.description,
        hashtags: cardData.hashtags,
        customText: cardData.customText || cardData.description,
        via: 'aegishealth'
      });
      
      if (shareUrl) {
        // Open sharing dialog or new window
        const windowFeatures = 'width=600,height=400,scrollbars=yes,resizable=yes';
        const shareWindow = window.open(shareUrl, '_blank', windowFeatures);
        
        // Track share completion after window opens
        setTimeout(() => {
          trackSharingEvent('share_completed', { platform, template: cardData.template });
          setShareResult({ success: true, platform });
          onShareComplete?.(platform, cardData);
        }, 1000);
        
        // Monitor window closure
        const checkClosed = setInterval(() => {
          if (shareWindow.closed) {
            clearInterval(checkClosed);
            trackSharingEvent('share_cancelled', { platform, template: cardData.template });
          }
        }, 1000);
        
        // Cleanup after 30 seconds
        setTimeout(() => {
          clearInterval(checkClosed);
        }, 30000);
      } else {
        throw new Error('Failed to generate sharing URL');
      }
    } catch (error) {
      console.error('Sharing error:', error);
      trackSharingEvent('share_failed', { platform, error: error.message, template: cardData.template });
      setShareResult({ success: false, error: error.message });
      onShareError?.(platform, error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!cardData?.url) return;
    
    try {
      await navigator.clipboard.writeText(cardData.url);
      setShowCopySuccess(true);
      trackSharingEvent('link_copied', { template: cardData.template });
      
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  const handleNativeShare = async () => {
    if (!cardData || !navigator.share) return;
    
    try {
      setIsSharing(true);
      trackSharingEvent('share_initiated', { platform: 'native', template: cardData.template });
      
      await navigator.share({
        title: cardData.title,
        text: cardData.customText || cardData.description,
        url: cardData.url
      });
      
      trackSharingEvent('share_completed', { platform: 'native', template: cardData.template });
      setShareResult({ success: true, platform: 'native' });
      onShareComplete?.('native', cardData);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Native share error:', error);
        trackSharingEvent('share_failed', { platform: 'native', error: error.message, template: cardData.template });
        setShareResult({ success: false, error: error.message });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const getPlatformIcon = (platform) => {
    const icons = {
      facebook: 'f',
      twitter: 't',
      linkedin: 'in',
      whatsapp: 'w',
      telegram: 't',
      reddit: 'r',
      pinterest: 'p',
      email: '@'
    };
    return icons[platform] || platform[0];
  };

  const getPlatformColor = (platform) => {
    const colors = {
      facebook: '#1877f2',
      twitter: '#1da1f2',
      linkedin: '#0077b5',
      whatsapp: '#25d366',
      telegram: '#0088cc',
      reddit: '#ff4500',
      pinterest: '#bd081c',
      email: '#6b7280'
    };
    return colors[platform] || '#6b7280';
  };

  const renderShareDialog = () => {
    if (!showShareDialog || !selectedPlatform) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Share to {selectedPlatform}</h3>
            <button
              onClick={() => setShowShareDialog(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundColor: getPlatformColor(selectedPlatform) }}
              >
                {getPlatformIcon(selectedPlatform)}
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-gray-300 mb-2">
                {isSharing ? 'Opening sharing dialog...' : 'Share this content'}
              </p>
              <p className="text-gray-500 text-sm">
                {cardData?.title}
              </p>
            </div>
            
            {shareResult && (
              <div className={`p-3 rounded-lg text-center ${
                shareResult.success ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
              }`}>
                {shareResult.success ? 'Share completed!' : 'Share failed. Please try again.'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    if (!showAnalytics || !analytics) return null;

    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Sharing Analytics</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-400">{analytics.total_shares || 0}</div>
            <div className="text-gray-400 text-sm">Total Shares</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{analytics.card_generations || 0}</div>
            <div className="text-gray-400 text-sm">Cards Generated</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{analytics.card_downloads || 0}</div>
            <div className="text-gray-400 text-sm">Downloads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{analytics.most_popular_platform || 'N/A'}</div>
            <div className="text-gray-400 text-sm">Top Platform</div>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="text-white font-medium">Platform Breakdown</h4>
          {Object.entries(analytics).filter(([key]) => key.includes('share_completed_')).map(([key, value]) => {
            const platform = key.replace('share_completed_', '');
            return (
              <div key={platform} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: getPlatformColor(platform) }}
                  >
                    {getPlatformIcon(platform)}
                  </div>
                  <span className="text-gray-300 capitalize">{platform}</span>
                </div>
                <span className="text-white font-medium">{value}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Quick Share Actions */}
      <div className="flex flex-wrap gap-3">
        {navigator.share && (
          <button
            onClick={handleNativeShare}
            disabled={isSharing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white rounded-lg transition-colors"
          >
            <Share2 size={16} />
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
        )}
        
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          {showCopySuccess ? <Check size={16} /> : <Copy size={16} />}
          {showCopySuccess ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Platform Grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {['facebook', 'twitter', 'linkedin', 'whatsapp', 'telegram', 'reddit', 'pinterest', 'email'].map(platform => (
          <button
            key={platform}
            onClick={() => handleShare(platform)}
            disabled={isSharing}
            className="relative overflow-hidden group"
          >
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: getPlatformColor(platform) }}
            ></div>
            <div className="relative p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all duration-300 group-hover:scale-105">
              <div className="flex flex-col items-center">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold mb-2"
                  style={{ backgroundColor: getPlatformColor(platform) }}
                >
                  {getPlatformIcon(platform)}
                </div>
                <span className="text-white text-sm capitalize">{platform}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Analytics Section */}
      {renderAnalytics()}

      {/* Share Dialog */}
      {renderShareDialog()}
    </div>
  );
};

export default SocialSharingManager;
