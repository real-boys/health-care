import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Search, Navigation, MapPin, Filter, X, Layers, Maximize2, Locate } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapView = ({ providers, onProviderSelect, selectedProvider, userLocation, onLocationUpdate }) => {
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default to NYC
  const [zoom, setZoom] = useState(12);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(10);
  const [mapLayer, setMapLayer] = useState('street');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef();

  const providerLocations = providers.map(provider => ({
    ...provider,
    position: [provider.latitude || 40.7128 + (Math.random() - 0.5) * 0.1, 
                provider.longitude || -74.0060 + (Math.random() - 0.5) * 0.1]
  }));

  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
    }
  }, [userLocation]);

  const MapEvents = () => {
    useMapEvents({
      moveend: (e) => {
        const center = e.target.getCenter();
        setMapCenter([center.lat, center.lng]);
      },
      zoomend: (e) => {
        setZoom(e.target.getZoom());
      }
    });
    return null;
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        setZoom(14);
        
        if (onLocationUpdate) {
          onLocationUpdate({ lat: parseFloat(lat), lng: parseFloat(lon), address: data[0].display_name });
        }
      }
    } catch (error) {
      console.error('Error searching location:', error);
    }
  };

  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setZoom(14);
          
          if (onLocationUpdate) {
            onLocationUpdate({ lat: latitude, lng: longitude });
          }
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const getProviderIcon = (provider) => {
    const availability = provider.availability === 'same-day' ? 'green' : 
                        provider.availability === 'next-day' ? 'yellow' : 'blue';
    
    return L.divIcon({
      html: `
        <div style="
          background-color: ${availability};
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
        ">
          ${provider.rating ? provider.rating.toFixed(1) : '★'}
        </div>
      `,
      className: 'custom-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  };

  const UserLocationMarker = () => {
    if (!userLocation) return null;
    
    return (
      <Marker position={[userLocation.lat, userLocation.lng]}>
        <Popup>
          <div className="text-center">
            <div className="font-semibold">Your Location</div>
            <div className="text-sm text-gray-600">
              {userLocation.address || 'Current location'}
            </div>
          </div>
        </Popup>
      </Marker>
    );
  };

  const ProviderMarkers = () => {
    return providerLocations.map(provider => (
      <Marker
        key={provider.id}
        position={provider.position}
        icon={getProviderIcon(provider)}
        eventHandlers={{
          click: () => onProviderSelect && onProviderSelect(provider)
        }}
      >
        <Popup>
          <div className="p-3 min-w-64">
            <div className="flex items-start space-x-3">
              <img 
                src={provider.image} 
                alt={provider.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                <p className="text-sm text-gray-600">{provider.credentials}</p>
                <div className="flex items-center mt-1">
                  <span className="text-yellow-400">★</span>
                  <span className="text-sm ml-1">{provider.rating}</span>
                  <span className="text-sm text-gray-500 ml-1">({provider.reviews})</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {provider.specialty}
                </div>
                <div className="text-sm text-gray-600">
                  {provider.address}
                </div>
                <div className="text-sm font-medium text-blue-600 mt-1">
                  ${provider.price} consultation
                </div>
                {provider.availability === 'same-day' && (
                  <div className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full mt-2">
                    Same Day Available
                  </div>
                )}
              </div>
            </div>
          </div>
        </Popup>
      </Marker>
    ));
  };

  const MapControls = () => {
    return (
      <div className="absolute top-4 left-4 z-10 space-y-2">
        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-lg p-3 w-80">
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <button
              onClick={handleSearch}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2 mt-2">
            <button
              onClick={handleLocateUser}
              className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Locate className="w-3 h-3" />
              <span>Use My Location</span>
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <Filter className="w-3 h-3" />
              <span>Filters</span>
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-lg p-4 w-80">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-900">Map Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Radius: {selectedRadius} miles
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={selectedRadius}
                  onChange={(e) => setSelectedRadius(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Map Style
                </label>
                <select
                  value={mapLayer}
                  onChange={(e) => setMapLayer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="street">Street</option>
                  <option value="satellite">Satellite</option>
                  <option value="terrain">Terrain</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Show Providers
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
                    <span className="text-sm">Available Today</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
                    <span className="text-sm">Highly Rated (4+ stars)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
                    <span className="text-sm">Accepting New Patients</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Provider Count */}
        <div className="bg-white rounded-lg shadow-lg p-3">
          <div className="text-sm text-gray-600">
            <div className="font-semibold text-gray-900">{providers.length} Providers</div>
            <div>within {selectedRadius} miles</div>
          </div>
        </div>
      </div>
    );
  };

  const getTileLayerUrl = () => {
    switch (mapLayer) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : 'h-96 rounded-lg overflow-hidden'}`}>
      <MapControls />
      
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        className={`h-full ${isFullscreen ? 'w-full' : 'w-full'}`}
        ref={mapRef}
      >
        <TileLayer
          url={getTileLayerUrl()}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapEvents />
        <UserLocationMarker />
        <ProviderMarkers />
        
        {/* Search Radius Circle */}
        {userLocation && (
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={selectedRadius * 1609.34} // Convert miles to meters
            fillColor="blue"
            fillOpacity={0.1}
            color="blue"
            weight={2}
          />
        )}
      </MapContainer>
      
      {/* Selected Provider Info */}
      {selectedProvider && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src={selectedProvider.image} 
                alt={selectedProvider.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <h3 className="font-semibold text-gray-900">{selectedProvider.name}</h3>
                <p className="text-sm text-gray-600">{selectedProvider.specialty}</p>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-yellow-400">★</span>
                  <span>{selectedProvider.rating}</span>
                  <span className="text-gray-500">({selectedProvider.reviews} reviews)</span>
                  <span className="text-gray-400">•</span>
                  <span>{selectedProvider.distance} mi</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onProviderSelect && onProviderSelect(null)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
