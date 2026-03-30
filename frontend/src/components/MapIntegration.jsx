import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, Filter, Layers, Maximize2, Minimize2, Plus, Minus, Crosshair, Map as MapIcon } from 'lucide-react';

const MapIntegration = ({ providers, onProviderSelect, userLocation, onLocationUpdate }) => {
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 }); // Default: NYC
  const [zoom, setZoom] = useState(12);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [mapStyle, setMapStyle] = useState('default');
  const [showTraffic, setShowTraffic] = useState(false);
  const [searchRadius, setSearchRadius] = useState(10); // miles
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Mock map implementation (in production, this would use Google Maps, Mapbox, or similar)
  useEffect(() => {
    // Initialize map
    setMapLoaded(true);
    
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setMapCenter(userCoords);
          onLocationUpdate?.(userCoords);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, [onLocationUpdate]);

  // Filter providers within search radius
  const providersInRadius = providers.filter(provider => {
    if (!provider.coordinates) return false;
    const distance = calculateDistance(
      mapCenter.lat,
      mapCenter.lng,
      provider.coordinates.lat,
      provider.coordinates.lng
    );
    return distance <= searchRadius;
  });

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleMapClick = (event) => {
    // In production, this would get actual coordinates from the map
    const newCenter = {
      lat: mapCenter.lat + (Math.random() - 0.5) * 0.1,
      lng: mapCenter.lng + (Math.random() - 0.5) * 0.1
    };
    setMapCenter(newCenter);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 1, 20));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 1, 1));
  };

  const handleSearchLocation = (query) => {
    // In production, this would use a geocoding service
    const mockLocations = {
      'new york': { lat: 40.7128, lng: -74.0060 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'chicago': { lat: 41.8781, lng: -87.6298 },
      'houston': { lat: 29.7604, lng: -95.3698 },
      'philadelphia': { lat: 39.9526, lng: -75.1652 }
    };
    
    const location = mockLocations[query.toLowerCase()];
    if (location) {
      setMapCenter(location);
    }
  };

  const handleProviderMarkerClick = (provider) => {
    setSelectedProvider(provider);
    onProviderSelect?.(provider);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setMapCenter(userCoords);
          onLocationUpdate?.(userCoords);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  return (
    <div className="map-integration h-full flex flex-col">
      {/* Map Controls */}
      <div className="bg-white border-b p-4 space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search for a location..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearchLocation(e.target.value);
                }
              }}
            />
          </div>
          <button
            onClick={getCurrentLocation}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            My Location
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Radius Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Search Radius:</label>
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5 miles</option>
              <option value={10}>10 miles</option>
              <option value={25}>25 miles</option>
              <option value={50}>50 miles</option>
            </select>
          </div>

          {/* Map Style */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Map Style:</label>
            <select
              value={mapStyle}
              onChange={(e) => setMapStyle(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="default">Default</option>
              <option value="satellite">Satellite</option>
              <option value="terrain">Terrain</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          {/* Traffic Toggle */}
          <button
            onClick={() => setShowTraffic(!showTraffic)}
            className={`px-3 py-1 rounded-lg border ${
              showTraffic
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            Traffic
          </button>

          {/* Provider Count */}
          <div className="text-sm text-gray-600">
            {providersInRadius.length} providers in {searchRadius} miles
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative bg-gray-100">
        {/* Mock Map */}
        <div 
          ref={mapRef}
          className="w-full h-full relative cursor-crosshair"
          onClick={handleMapClick}
          style={{
            backgroundImage: mapStyle === 'satellite' 
              ? 'linear-gradient(45deg, #2d3748 25%, #4a5568 25%, #4a5568 50%, #2d3748 50%, #2d3748 75%, #4a5568 75%, #4a5568)'
              : mapStyle === 'dark'
              ? 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)'
              : mapStyle === 'terrain'
              ? 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)'
              : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%)',
            backgroundSize: '20px 20px'
          }}
        >
          {/* Map Center Indicator */}
          <div 
            className="absolute w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2"
            style={{ 
              left: '50%', 
              top: '50%',
              zIndex: 10
            }}
          >
            <div className="absolute inset-0 bg-blue-600 rounded-full animate-ping"></div>
          </div>

          {/* Provider Markers */}
          {providersInRadius.map((provider, index) => {
            const angle = (index / providersInRadius.length) * 2 * Math.PI;
            const distance = 0.2 + (index % 3) * 0.1; // Vary distance from center
            const x = 50 + distance * 30 * Math.cos(angle);
            const y = 50 + distance * 30 * Math.sin(angle);
            
            return (
              <div
                key={provider.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
                  selectedProvider?.id === provider.id ? 'scale-125 z-20' : 'hover:scale-110 z-10'
                }`}
                style={{ 
                  left: `${x}%`, 
                  top: `${y}%`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleProviderMarkerClick(provider);
                }}
              >
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg ${
                    selectedProvider?.id === provider.id ? 'bg-blue-600' : 'bg-red-600'
                  }`}>
                    <MapPin className="w-4 h-4" />
                  </div>
                  {selectedProvider?.id === provider.id && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white rounded-lg shadow-lg p-2 min-w-max">
                      <div className="font-semibold text-sm">{provider.name}</div>
                      <div className="text-xs text-gray-600">{provider.specialty}</div>
                      <div className="text-xs text-gray-500">{provider.distance} mi away</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Traffic Layer (Mock) */}
          {showTraffic && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-32 h-2 bg-red-500 opacity-60 rounded"></div>
              <div className="absolute top-1/2 right-1/4 w-24 h-2 bg-yellow-500 opacity-60 rounded"></div>
              <div className="absolute bottom-1/4 left-1/3 w-40 h-2 bg-green-500 opacity-60 rounded"></div>
            </div>
          )}

          {/* Loading Indicator */}
          {!mapLoaded && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>

        {/* Map Controls Overlay */}
        <div className="absolute top-4 right-4 space-y-2">
          {/* Zoom Controls */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-gray-100 border-b"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-gray-100"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Layer Controls */}
          <div className="bg-white rounded-lg shadow-lg p-2">
            <button
              onClick={() => setZoom(zoom === 20 ? 12 : 20)}
              className="p-2 hover:bg-gray-100"
              title="Toggle fullscreen"
            >
              {zoom === 20 ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Scale Indicator */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2">
          <div className="text-xs text-gray-600">Scale: 1:{1000 * Math.pow(2, 20 - zoom)}</div>
        </div>

        {/* Coordinates Display */}
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg px-3 py-2">
          <div className="text-xs text-gray-600">
            {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
          </div>
          <div className="text-xs text-gray-500">Zoom: {zoom}</div>
        </div>
      </div>

      {/* Selected Provider Details */}
      {selectedProvider && (
        <div className="bg-white border-t p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{selectedProvider.name}</h3>
              <p className="text-gray-600">{selectedProvider.specialty}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {selectedProvider.distance} mi away
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  {selectedProvider.rating}
                </span>
                <span>${selectedProvider.price.consultation} consultation</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onProviderSelect?.(selectedProvider)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Details
              </button>
              <button
                onClick={() => setSelectedProvider(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Map Legend Component
const MapLegend = ({ providers }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 space-y-2">
      <h4 className="font-semibold text-sm">Legend</h4>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
          <span className="text-xs">Your Location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-600 rounded-full"></div>
          <span className="text-xs">Healthcare Provider</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600 rounded-full"></div>
          <span className="text-xs">Available Now</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-600 rounded-full"></div>
          <span className="text-xs">Limited Availability</span>
        </div>
      </div>
      
      {/* Provider Type Breakdown */}
      <div className="pt-2 border-t">
        <h5 className="font-medium text-xs mb-2">Provider Types</h5>
        <div className="space-y-1">
          {Object.entries(
            providers.reduce((acc, provider) => {
              acc[provider.specialty] = (acc[provider.specialty] || 0) + 1;
              return acc;
            }, {})
          ).map(([specialty, count]) => (
            <div key={specialty} className="flex justify-between items-center">
              <span className="text-xs">{specialty}</span>
              <span className="text-xs font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Location Search Component
const LocationSearch = ({ onLocationSelect, recentSearches = [] }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const mockSuggestions = [
    { name: 'New York, NY', lat: 40.7128, lng: -74.0060 },
    { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
    { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
    { name: 'Houston, TX', lat: 29.7604, lng: -95.3698 },
    { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.0740 },
    { name: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652 },
    { name: 'San Antonio, TX', lat: 29.4241, lng: -98.4936 },
    { name: 'San Diego, CA', lat: 32.7157, lng: -117.1611 }
  ];

  useEffect(() => {
    if (query.length > 2) {
      const filtered = mockSuggestions.filter(location =>
        location.name.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [query]);

  const handleSelect = (location) => {
    setQuery(location.name);
    setShowSuggestions(false);
    onLocationSelect(location);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a city, address, or zip code..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-50">
          {suggestions.map((location, index) => (
            <button
              key={index}
              onClick={() => handleSelect(location)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
            >
              <MapPin className="w-4 h-4 text-gray-400" />
              <div>
                <div className="font-medium">{location.name}</div>
                <div className="text-sm text-gray-500">
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && !query && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-50">
          <div className="px-4 py-2 border-b">
            <h4 className="text-sm font-medium text-gray-700">Recent Searches</h4>
          </div>
          {recentSearches.map((location, index) => (
            <button
              key={index}
              onClick={() => handleSelect(location)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
            >
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>{location.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export { MapIntegration, MapLegend, LocationSearch };
