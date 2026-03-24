import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Star, MapPin, DollarSign, Calendar, Award, Users, ChevronDown, Check, AlertCircle } from 'lucide-react';

const ProviderComparison = ({ providers, onClose }) => {
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [comparisonCriteria, setComparisonCriteria] = useState([
    'rating', 'experience', 'price', 'availability', 'distance', 'reviews'
  ]);
  const [showWeights, setShowWeights] = useState(false);
  const [criteria, setCriteria] = useState({
    rating: { weight: 25, importance: 'high' },
    experience: { weight: 20, importance: 'medium' },
    price: { weight: 20, importance: 'high' },
    availability: { weight: 15, importance: 'medium' },
    distance: { weight: 10, importance: 'low' },
    reviews: { weight: 10, importance: 'low' }
  });

  const availableProviders = providers.slice(0, 6); // Limit to 6 for comparison

  useEffect(() => {
    // Auto-select first 2 providers for demo
    if (availableProviders.length >= 2 && selectedProviders.length === 0) {
      setSelectedProviders([availableProviders[0], availableProviders[1]]);
    }
  }, [availableProviders]);

  const addProviderToComparison = (provider) => {
    if (selectedProviders.length < 4 && !selectedProviders.find(p => p.id === provider.id)) {
      setSelectedProviders([...selectedProviders, provider]);
    }
  };

  const removeProviderFromComparison = (providerId) => {
    setSelectedProviders(selectedProviders.filter(p => p.id !== providerId));
  };

  const calculateScore = (provider) => {
    let totalScore = 0;
    let maxPossibleScore = 0;

    comparisonCriteria.forEach(criterion => {
      const weight = criteria[criterion].weight;
      maxPossibleScore += weight;

      switch (criterion) {
        case 'rating':
          totalScore += (provider.rating / 5) * weight;
          break;
        case 'experience':
          totalScore += Math.min((provider.experience / 20) * weight, weight);
          break;
        case 'price':
          // Lower price is better, invert the score
          const minPrice = Math.min(...selectedProviders.map(p => p.price));
          const maxPrice = Math.max(...selectedProviders.map(p => p.price));
          if (maxPrice !== minPrice) {
            totalScore += ((maxPrice - provider.price) / (maxPrice - minPrice)) * weight;
          } else {
            totalScore += weight;
          }
          break;
        case 'availability':
          const availabilityScore = provider.availability === 'same-day' ? weight :
                                  provider.availability === 'next-day' ? weight * 0.7 :
                                  provider.availability === 'week' ? weight * 0.3 : 0;
          totalScore += availabilityScore;
          break;
        case 'distance':
          // Lower distance is better
          const minDistance = Math.min(...selectedProviders.map(p => p.distance));
          const maxDistance = Math.max(...selectedProviders.map(p => p.distance));
          if (maxDistance !== minDistance) {
            totalScore += ((maxDistance - provider.distance) / (maxDistance - minDistance)) * weight;
          } else {
            totalScore += weight;
          }
          break;
        case 'reviews':
          totalScore += Math.min((provider.reviews / 200) * weight, weight);
          break;
      }
    });

    return maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
  };

  const getCriteriaIcon = (criterion) => {
    switch (criterion) {
      case 'rating': return <Star className="w-4 h-4" />;
      case 'experience': return <Award className="w-4 h-4" />;
      case 'price': return <DollarSign className="w-4 h-4" />;
      case 'availability': return <Calendar className="w-4 h-4" />;
      case 'distance': return <MapPin className="w-4 h-4" />;
      case 'reviews': return <Users className="w-4 h-4" />;
      default: return null;
    }
  };

  const getCriteriaLabel = (criterion) => {
    switch (criterion) {
      case 'rating': return 'Rating';
      case 'experience': return 'Experience';
      case 'price': return 'Price';
      case 'availability': return 'Availability';
      case 'distance': return 'Distance';
      case 'reviews': return 'Reviews';
      default: return criterion;
    }
  };

  const getImportanceColor = (importance) => {
    switch (importance) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getComparisonValue = (provider, criterion) => {
    switch (criterion) {
      case 'rating':
        return (
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="font-medium">{provider.rating}</span>
          </div>
        );
      case 'experience':
        return <span className="font-medium">{provider.experience} years</span>;
      case 'price':
        return <span className="font-medium">${provider.price}</span>;
      case 'availability':
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            provider.availability === 'same-day' ? 'bg-green-100 text-green-800' :
            provider.availability === 'next-day' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {provider.availability === 'same-day' ? 'Same Day' :
             provider.availability === 'next-day' ? 'Next Day' : 'This Week'}
          </span>
        );
      case 'distance':
        return (
          <div className="flex items-center space-x-1">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{provider.distance} mi</span>
          </div>
        );
      case 'reviews':
        return <span className="font-medium">{provider.reviews}</span>;
      default:
        return '-';
    }
  };

  const getBestProvider = (criterion) => {
    if (selectedProviders.length === 0) return null;
    
    switch (criterion) {
      case 'rating':
        return selectedProviders.reduce((best, current) => 
          current.rating > best.rating ? current : best
        );
      case 'experience':
        return selectedProviders.reduce((best, current) => 
          current.experience > best.experience ? current : best
        );
      case 'price':
        return selectedProviders.reduce((best, current) => 
          current.price < best.price ? current : best
        );
      case 'distance':
        return selectedProviders.reduce((best, current) => 
          current.distance < best.distance ? current : best
        );
      case 'reviews':
        return selectedProviders.reduce((best, current) => 
          current.reviews > best.reviews ? current : best
        );
      case 'availability':
        const availabilityOrder = { 'same-day': 3, 'next-day': 2, 'week': 1 };
        return selectedProviders.reduce((best, current) => 
          availabilityOrder[current.availability] > availabilityOrder[best.availability] ? current : best
        );
      default:
        return null;
    }
  };

  const sortedProviders = [...selectedProviders].sort((a, b) => {
    const scoreA = calculateScore(a);
    const scoreB = calculateScore(b);
    return scoreB - scoreA;
  });

  if (selectedProviders.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Compare Providers</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Providers Selected</h3>
                <p className="text-gray-600">Please select providers from the search results to compare them side by side.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Compare Providers</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Add Providers */}
            {selectedProviders.length < 4 && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Add more providers to compare:</p>
                <div className="flex flex-wrap gap-2">
                  {availableProviders
                    .filter(provider => !selectedProviders.find(p => p.id === provider.id))
                    .map(provider => (
                      <button
                        key={provider.id}
                        onClick={() => addProviderToComparison(provider)}
                        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <img 
                          src={provider.image} 
                          alt={provider.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="text-sm font-medium">{provider.name}</span>
                        <Plus className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Criteria Weights */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowWeights(!showWeights)}
                className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <span>Adjust Criteria Weights</span>
                <ChevronDown className={`w-4 h-4 transform transition-transform ${showWeights ? 'rotate-180' : ''}`} />
              </button>
              
              {selectedProviders.length > 0 && (
                <div className="text-sm text-gray-600">
                  {selectedProviders.length} of 4 providers selected
                </div>
              )}
            </div>
          </div>

          {/* Weight Adjustment Panel */}
          {showWeights && (
            <div className="bg-gray-50 p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Comparison Criteria Weights</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(criteria).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {getCriteriaIcon(key)}
                      <span className="text-sm font-medium">{getCriteriaLabel(key)}</span>
                    </div>
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={value.weight}
                        onChange={(e) => setCriteria({
                          ...criteria,
                          [key]: { ...value, weight: parseInt(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span>{value.weight}%</span>
                        <span className={`px-1 py-0.5 rounded text-xs ${getImportanceColor(value.importance)}`}>
                          {value.importance}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison Table */}
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-900 bg-gray-50">Criteria</th>
                    {sortedProviders.map((provider, index) => (
                      <th key={provider.id} className="p-3 text-center bg-gray-50">
                        <div className="space-y-2">
                          <div className="flex flex-col items-center">
                            <img 
                              src={provider.image} 
                              alt={provider.name}
                              className="w-12 h-12 rounded-full object-cover mb-2"
                            />
                            <div className="font-semibold text-gray-900">{provider.name}</div>
                            <div className="text-sm text-gray-600">{provider.specialty}</div>
                            {index === 0 && (
                              <div className="mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                                Best Match
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonCriteria.map(criterion => {
                    const bestProvider = getBestProvider(criterion);
                    
                    return (
                      <tr key={criterion} className="border-b border-gray-100">
                        <td className="p-3 font-medium bg-gray-50">
                          <div className="flex items-center space-x-2">
                            {getCriteriaIcon(criterion)}
                            <span>{getCriteriaLabel(criterion)}</span>
                            <span className={`text-xs px-2 py-1 rounded ${getImportanceColor(criteria[criterion].importance)}`}>
                              {criteria[criterion].weight}%
                            </span>
                          </div>
                        </td>
                        {sortedProviders.map(provider => (
                          <td key={provider.id} className="p-3 text-center">
                            <div className={`flex justify-center ${
                              bestProvider && bestProvider.id === provider.id ? 'text-blue-600 font-semibold' : ''
                            }`}>
                              {getComparisonValue(provider, criterion)}
                              {bestProvider && bestProvider.id === provider.id && (
                                <Check className="w-4 h-4 ml-2 text-green-500" />
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  
                  {/* Overall Score Row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <Award className="w-4 h-4" />
                        <span>Overall Score</span>
                      </div>
                    </td>
                    {sortedProviders.map(provider => (
                      <td key={provider.id} className="p-3 text-center">
                        <div className="flex justify-center items-center space-x-2">
                          <span className="text-lg font-bold text-blue-600">
                            {calculateScore(provider)}%
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Provider Details */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedProviders.map(provider => (
                <div key={provider.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3 mb-3">
                    <img 
                      src={provider.image} 
                      alt={provider.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                      <p className="text-sm text-gray-600">{provider.credentials}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-medium">{provider.rating}</span>
                        <span className="text-sm text-gray-500">({provider.reviews} reviews)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Experience:</span>
                      <span className="font-medium">{provider.experience} years</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultation:</span>
                      <span className="font-medium">${provider.price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Distance:</span>
                      <span className="font-medium">{provider.distance} mi</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Availability:</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        provider.availability === 'same-day' ? 'bg-green-100 text-green-800' :
                        provider.availability === 'next-day' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {provider.availability === 'same-day' ? 'Same Day' :
                         provider.availability === 'next-day' ? 'Next Day' : 'This Week'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                      Book Appointment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderComparison;
