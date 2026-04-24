import React, { useState, useRef, useEffect } from 'react';
import { Download, Share2, Copy, Eye, Heart, MessageCircle, TrendingUp, Calendar, User, Settings, X } from 'lucide-react';

const SharingCard = ({ 
  template = 'dashboard', 
  customizations = {}, 
  onShare, 
  onPreview,
  onDownload,
  compact = false 
}) => {
  const [cardData, setCardData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const canvasRef = useRef(null);
  const [customText, setCustomText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    generateCard();
  }, [template]);

  const generateCard = async () => {
    setIsGenerating(true);
    try {
      // Simulate card generation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const baseCard = {
        title: 'AEGIS Health Systems',
        description: 'Advanced healthcare platform with AI-powered fraud detection',
        image: '/images/sharing/dashboard-card.jpg',
        url: window.location.href,
        hashtags: ['HealthTech', 'Healthcare', 'FraudDetection'],
        template: template
      };

      setCardData({ ...baseCard, ...customizations });
      if (customizations.customText) {
        setCustomText(customizations.customText);
      }
    } catch (error) {
      console.error('Error generating sharing card:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = async (platform) => {
    if (!cardData) return;
    
    const shareData = {
      platform,
      title: cardData.title,
      description: cardData.description,
      url: cardData.url,
      hashtags: cardData.hashtags,
      customText: customText || cardData.description
    };

    onShare?.(platform, shareData);
  };

  const handleDownload = () => {
    if (!cardData) return;
    
    onDownload?.(cardData);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(cardData.url);
    // Show success feedback
  };

  const handlePreview = () => {
    setIsPreviewMode(!isPreviewMode);
    onPreview?.(cardData);
  };

  const updateCardData = (field, value) => {
    setCardData(prev => ({ ...prev, [field]: value }));
  };

  if (compact) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">Share this page</h3>
          <button
            onClick={() => setShowCustomization(!showCustomization)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
        
        {showCustomization && (
          <div className="mb-4 space-y-3">
            <input
              type="text"
              placeholder="Custom message..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-400 text-sm"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {['facebook', 'twitter', 'linkedin', 'whatsapp'].map(platform => (
            <button
              key={platform}
              onClick={() => handleShare(platform)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors capitalize"
            >
              {platform}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Social Sharing</h3>
          <p className="text-gray-400 text-sm">Create and share custom social media cards</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Preview"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => setShowCustomization(!showCustomization)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Customize"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Card Preview */}
      <div className="mb-6">
        {isGenerating ? (
          <div className="aspect-[16/9] bg-slate-900 rounded-xl flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : cardData ? (
          <div className="relative group">
            <div className="aspect-[16/9] bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl overflow-hidden">
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h4 className="text-xl font-bold mb-2">{cardData.title}</h4>
                <p className="text-sm opacity-90 mb-3">{cardData.description}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-white/20 px-2 py-1 rounded">AEGIS Health</span>
                  {cardData.hashtags.map((tag, i) => (
                    <span key={i} className="bg-white/20 px-2 py-1 rounded">#{tag}</span>
                  ))}
                </div>
              </div>
              <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1">
                <span className="text-white text-xs font-medium">Preview</span>
              </div>
            </div>
            
            {/* Hover Actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="p-3 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-colors"
                  title="Download"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={handleCopyLink}
                  className="p-3 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-colors"
                  title="Copy Link"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="aspect-[16/9] bg-slate-900 rounded-xl flex items-center justify-center">
            <p className="text-gray-400">Unable to generate sharing card</p>
          </div>
        )}
      </div>

      {/* Customization Panel */}
      {showCustomization && cardData && (
        <div className="mb-6 p-4 bg-slate-900/50 rounded-lg space-y-4">
          <h4 className="text-white font-semibold mb-3">Customize Card</h4>
          
          <div>
            <label className="block text-gray-400 text-sm mb-2">Title</label>
            <input
              type="text"
              value={cardData.title}
              onChange={(e) => updateCardData('title', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm mb-2">Description</label>
            <textarea
              value={cardData.description}
              onChange={(e) => updateCardData('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm resize-none"
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm mb-2">Custom Message</label>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Add a personal touch..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm resize-none placeholder-gray-500"
            />
          </div>
          
          <div>
            <label className="block text-gray-400 text-sm mb-2">Hashtags</label>
            <input
              type="text"
              value={cardData.hashtags.join(', ')}
              onChange={(e) => updateCardData('hashtags', e.target.value.split(', ').map(h => h.replace('#', '').trim()))}
              placeholder="healthcare, technology, innovation"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
        </div>
      )}

      {/* Sharing Options */}
      <div className="space-y-4">
        <div>
          <h4 className="text-white font-semibold mb-3">Share to Social Media</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { platform: 'facebook', color: '#1877f2', icon: 'f' },
              { platform: 'twitter', color: '#1da1f2', icon: 't' },
              { platform: 'linkedin', color: '#0077b5', icon: 'in' },
              { platform: 'whatsapp', color: '#25d366', icon: 'w' },
              { platform: 'telegram', color: '#0088cc', icon: 't' },
              { platform: 'reddit', color: '#ff4500', icon: 'r' },
              { platform: 'pinterest', color: '#bd081c', icon: 'p' },
              { platform: 'email', color: '#6b7280', icon: '@' }
            ].map(({ platform, color, icon }) => (
              <button
                key={platform}
                onClick={() => handleShare(platform)}
                className="relative overflow-hidden group"
              >
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: color }}
                ></div>
                <div className="relative px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all duration-300 group-hover:scale-105">
                  <div className="flex items-center justify-center">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: color }}
                    >
                      {icon}
                    </div>
                  </div>
                  <span className="block text-xs text-gray-300 mt-1 capitalize">{platform}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Download Card
          </button>
          <button
            onClick={handleCopyLink}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Copy size={16} />
            Copy Link
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {isPreviewMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Card Preview</h3>
                <button
                  onClick={() => setIsPreviewMode(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="aspect-[16/9] bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                  <h4 className="text-2xl font-bold mb-3">{cardData?.title}</h4>
                  <p className="text-lg opacity-90 mb-4">{cardData?.description}</p>
                  <div className="flex items-center gap-3">
                    <span className="bg-white/20 px-3 py-1 rounded-lg">AEGIS Health Systems</span>
                    {cardData?.hashtags.map((tag, i) => (
                      <span key={i} className="bg-white/20 px-3 py-1 rounded-lg">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-slate-900 rounded-lg">
                <p className="text-gray-400 text-sm mb-2">Custom Message:</p>
                <p className="text-white">{customText || cardData?.description}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharingCard;
