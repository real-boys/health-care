import React, { useState } from 'react';
import { 
  Share2, 
  BarChart3, 
  Settings, 
  Download, 
  Eye, 
  TrendingUp, 
  Users, 
  Clock,
  Filter,
  Calendar,
  Globe,
  Heart,
  MessageCircle,
  Zap,
  Target
} from 'lucide-react';
import SharingCard from './SharingCard';
import SocialSharingManager from './SocialSharingManager';
import SharingAnalytics from './SharingAnalytics';

const SharingDashboard = ({ compact = false }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [cardData, setCardData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('dashboard');

  const handleCardGenerated = (data) => {
    setCardData(data);
  };

  const handleShare = (platform, shareData) => {
    console.log(`Sharing to ${platform}:`, shareData);
    // Track share completion
  };

  const handleShareError = (platform, error) => {
    console.error(`Share error for ${platform}:`, error);
    // Handle error display
  };

  const handleDownload = (cardData) => {
    // Simulate card download
    const link = document.createElement('a');
    link.download = `sharing-card-${cardData.template}.png`;
    link.href = cardData.image;
    link.click();
  };

  const tabs = [
    { id: 'create', label: 'Create Card', icon: Share2 },
    { id: 'share', label: 'Share', icon: Globe },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'optimize', label: 'Optimize', icon: Target }
  ];

  const templates = [
    { id: 'dashboard', name: 'Dashboard', description: 'Main healthcare dashboard' },
    { id: 'fraud', name: 'Fraud Detection', description: 'AI-powered fraud detection' },
    { id: 'payments', name: 'Payments', description: 'Secure payment processing' },
    { id: 'providers', name: 'Providers', description: 'Healthcare provider directory' },
    { id: 'patients', name: 'Patients', description: 'Patient records management' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'create':
        return (
          <div className="space-y-6">
            {/* Template Selection */}
            <div>
              <h4 className="text-white font-semibold mb-4">Choose Template</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`p-4 rounded-lg border transition-all ${
                      selectedTemplate === template.id
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-left">
                      <div className="text-white font-medium mb-1">{template.name}</div>
                      <div className="text-gray-400 text-sm">{template.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Card Creation */}
            <SharingCard
              template={selectedTemplate}
              onShare={handleShare}
              onPreview={() => setShowPreview(true)}
              onDownload={handleDownload}
              compact={compact}
            />
          </div>
        );

      case 'share':
        return (
          <div className="space-y-6">
            {cardData ? (
              <>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <h4 className="text-white font-semibold mb-4">Ready to Share</h4>
                  <div className="mb-4">
                    <div className="aspect-[16/9] bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl overflow-hidden">
                      <div className="absolute inset-0 bg-black/20"></div>
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <h5 className="text-xl font-bold mb-2">{cardData.title}</h5>
                        <p className="text-sm opacity-90">{cardData.description}</p>
                      </div>
                    </div>
                  </div>
                  <SocialSharingManager
                    cardData={cardData}
                    onShareComplete={handleShare}
                    onShareError={handleShareError}
                  />
                </div>
              </>
            ) : (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
                <Share2 className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-400">Create a sharing card first to enable sharing options</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  Create Card
                </button>
              </div>
            )}
          </div>
        );

      case 'analytics':
        return (
          <SharingAnalytics realTime={true} />
        );

      case 'optimize':
        return (
          <div className="space-y-6">
            {/* Performance Tips */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-4">Optimization Tips</h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Zap className="text-green-400" size={16} />
                  </div>
                  <div>
                    <div className="text-white font-medium">Optimal Image Size</div>
                    <div className="text-gray-400 text-sm">Use 1200x630px images for best social media display</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Target className="text-blue-400" size={16} />
                  </div>
                  <div>
                    <div className="text-white font-medium">Engaging Titles</div>
                    <div className="text-gray-400 text-sm">Keep titles under 60 characters for maximum impact</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Heart className="text-purple-400" size={16} />
                  </div>
                  <div>
                    <div className="text-white font-medium">Call to Action</div>
                    <div className="text-gray-400 text-sm">Include clear CTAs to increase engagement by 45%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-4">Current Performance</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">85%</div>
                  <div className="text-gray-400 text-sm">Optimization Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">2.3s</div>
                  <div className="text-gray-400 text-sm">Avg. Load Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">94%</div>
                  <div className="text-gray-400 text-sm">Mobile Score</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-400">A+</div>
                  <div className="text-gray-400 text-sm">SEO Rating</div>
                </div>
              </div>
            </div>

            {/* A/B Testing */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-4">A/B Testing Results</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                  <div>
                    <div className="text-white">Title A vs Title B</div>
                    <div className="text-gray-400 text-sm">Title B performed 23% better</div>
                  </div>
                  <div className="text-green-400">+23%</div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                  <div>
                    <div className="text-white">Image A vs Image B</div>
                    <div className="text-gray-400 text-sm">Image A performed 15% better</div>
                  </div>
                  <div className="text-green-400">+15%</div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Social Sharing</h3>
          <button className="text-gray-400 hover:text-white transition-colors">
            <Settings size={16} />
          </button>
        </div>
        <SharingCard compact={true} />
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Social Sharing Hub</h2>
            <p className="text-gray-400">Create, share, and optimize social media content</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Preview"
            >
              <Eye size={20} />
            </button>
            <button className="p-2 text-gray-400 hover:text-white transition-colors" title="Settings">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {renderTabContent()}
      </div>

      {/* Preview Modal */}
      {showPreview && cardData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Card Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="aspect-[16/9] bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl overflow-hidden mb-4">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                  <h4 className="text-2xl font-bold mb-3">{cardData.title}</h4>
                  <p className="text-lg opacity-90 mb-4">{cardData.description}</p>
                  <div className="flex items-center gap-3">
                    <span className="bg-white/20 px-3 py-1 rounded-lg">AEGIS Health Systems</span>
                    {cardData.hashtags.map((tag, i) => (
                      <span key={i} className="bg-white/20 px-3 py-1 rounded-lg">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleDownload(cardData);
                    setShowPreview(false);
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Download Card
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharingDashboard;
