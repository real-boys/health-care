import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, MapPin, Star, Calendar, Phone, Mail, Globe, Clock, DollarSign, Users, ChevronDown, X, Heart, Share2, Navigation } from 'lucide-react';
import Select from 'react-select';

const ProviderDirectory = () => {
  const [providers, setProviders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedInsurance, setSelectedInsurance] = useState([]);
  const [selectedRating, setSelectedRating] = useState(0);
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [availability, setAvailability] = useState('any');
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState('list');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [loading, setLoading] = useState(true);

  const specialties = [
    { value: 'cardiology', label: 'Cardiology' },
    { value: 'dermatology', label: 'Dermatology' },
    { value: 'endocrinology', label: 'Endocrinology' },
    { value: 'family-medicine', label: 'Family Medicine' },
    { value: 'gastroenterology', label: 'Gastroenterology' },
    { value: 'neurology', label: 'Neurology' },
    { value: 'obstetrics-gynecology', label: 'Obstetrics & Gynecology' },
    { value: 'oncology', label: 'Oncology' },
    { value: 'ophthalmology', label: 'Ophthalmology' },
    { value: 'orthopedics', label: 'Orthopedics' },
    { value: 'pediatrics', label: 'Pediatrics' },
    { value: 'psychiatry', label: 'Psychiatry' },
    { value: 'pulmonology', label: 'Pulmonology' },
    { value: 'radiology', label: 'Radiology' },
    { value: 'surgery', label: 'Surgery' },
    { value: 'urology', label: 'Urology' }
  ];

  const insuranceOptions = [
    { value: 'medicare', label: 'Medicare' },
    { value: 'medicaid', label: 'Medicaid' },
    { value: 'blue-cross', label: 'Blue Cross Blue Shield' },
    { value: 'aetna', label: 'Aetna' },
    { value: 'cigna', label: 'Cigna' },
    { value: 'humana', label: 'Humana' },
    { value: 'united-healthcare', label: 'United Healthcare' },
    { value: 'kaiser', label: 'Kaiser Permanente' }
  ];

  const sortOptions = [
    { value: 'relevance', label: 'Most Relevant' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'distance', label: 'Closest First' },
    { value: 'availability', label: 'Available Soonest' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' }
  ];

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const mockProviders = [
        {
          id: 1,
          name: 'Dr. Sarah Chen',
          specialty: 'cardiology',
          credentials: 'MD, FACC',
          rating: 4.8,
          reviews: 127,
          experience: 15,
          location: 'New York, NY',
          distance: 2.3,
          address: '123 5th Ave, New York, NY 10001',
          phone: '+1 (555) 123-4567',
          email: 'sarah.chen@healthcare.com',
          website: 'www.drsarahchen.com',
          price: 250,
          insurance: ['blue-cross', 'aetna', 'medicare'],
          availability: 'same-day',
          nextAvailable: 'Today, 2:00 PM',
          languages: ['English', 'Mandarin'],
          gender: 'Female',
          education: 'Harvard Medical School',
          hospital: 'Mount Sinai Hospital',
          bio: 'Dr. Chen is a board-certified cardiologist with expertise in preventive cardiology and heart disease management.',
          image: 'https://images.unsplash.com/photo-1559839734-49b0a7aa3b78?w=400&h=400&fit=crop&crop=face',
          specialties: ['Interventional Cardiology', 'Preventive Cardiology', 'Heart Failure'],
          awards: ['Top Doctor New York 2023', 'Patient Choice Award'],
          acceptsNewPatients: true
        },
        {
          id: 2,
          name: 'Dr. Michael Rodriguez',
          specialty: 'family-medicine',
          credentials: 'MD, FAAFP',
          rating: 4.9,
          reviews: 203,
          experience: 12,
          location: 'Brooklyn, NY',
          distance: 4.1,
          address: '456 Atlantic Ave, Brooklyn, NY 11201',
          phone: '+1 (555) 234-5678',
          email: 'm.rodriguez@healthcare.com',
          website: 'www.drmichaelrodriguez.com',
          price: 180,
          insurance: ['medicaid', 'blue-cross', 'cigna'],
          availability: 'next-day',
          nextAvailable: 'Tomorrow, 10:00 AM',
          languages: ['English', 'Spanish'],
          gender: 'Male',
          education: 'Johns Hopkins School of Medicine',
          hospital: 'NYU Langone Health',
          bio: 'Dr. Rodriguez provides comprehensive family medicine care for patients of all ages with a focus on preventive health.',
          image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop&crop=face',
          specialties: ['Family Medicine', 'Sports Medicine', 'Preventive Care'],
          awards: ['Best Family Doctor Brooklyn 2023'],
          acceptsNewPatients: true
        },
        {
          id: 3,
          name: 'Dr. Emily Johnson',
          specialty: 'pediatrics',
          credentials: 'MD, FAAP',
          rating: 4.7,
          reviews: 89,
          experience: 8,
          location: 'Manhattan, NY',
          distance: 1.8,
          address: '789 Broadway, New York, NY 10003',
          phone: '+1 (555) 345-6789',
          email: 'emily.johnson@healthcare.com',
          website: 'www.dremilyjohnson.com',
          price: 200,
          insurance: ['aetna', 'united-healthcare', 'cigna'],
          availability: 'same-day',
          nextAvailable: 'Today, 4:30 PM',
          languages: ['English', 'French'],
          gender: 'Female',
          education: 'Columbia University Vagelos College of Physicians and Surgeons',
          hospital: 'New York-Presbyterian Hospital',
          bio: 'Dr. Johnson specializes in pediatric care from newborns to adolescents, with expertise in developmental pediatrics.',
          image: 'https://images.unsplash.com/photo-1594824475063-17b1cda7b6f4?w=400&h=400&fit=crop&crop=face',
          specialties: ['General Pediatrics', 'Developmental Pediatrics', 'Adolescent Medicine'],
          awards: ['Rising Star in Pediatrics 2023'],
          acceptsNewPatients: false
        },
        {
          id: 4,
          name: 'Dr. James Wilson',
          specialty: 'orthopedics',
          credentials: 'MD, FAAOS',
          rating: 4.6,
          reviews: 156,
          experience: 20,
          location: 'Queens, NY',
          distance: 6.2,
          address: '321 Queens Blvd, Queens, NY 11375',
          phone: '+1 (555) 456-7890',
          email: 'j.wilson@healthcare.com',
          website: 'www.drjameswilson.com',
          price: 300,
          insurance: ['blue-cross', 'humana', 'medicare'],
          availability: 'week',
          nextAvailable: 'Next Monday, 9:00 AM',
          languages: ['English'],
          gender: 'Male',
          education: 'Stanford University School of Medicine',
          hospital: 'Hospital for Special Surgery',
          bio: 'Dr. Wilson is an orthopedic surgeon specializing in joint replacement and sports medicine injuries.',
          image: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop&crop=face',
          specialties: ['Joint Replacement', 'Sports Medicine', 'Arthroscopic Surgery'],
          awards: ['Top Orthopedic Surgeon NYC 2023'],
          acceptsNewPatients: true
        }
      ];
      setProviders(mockProviders);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = useMemo(() => {
    let filtered = providers.filter(provider => {
      const matchesSearch = searchQuery === '' || 
        provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.bio.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSpecialty = !selectedSpecialty || provider.specialty === selectedSpecialty.value;
      
      const matchesLocation = !selectedLocation || 
        provider.location.toLowerCase().includes(selectedLocation.toLowerCase());
      
      const matchesInsurance = selectedInsurance.length === 0 || 
        selectedInsurance.some(ins => provider.insurance.includes(ins.value));
      
      const matchesRating = provider.rating >= selectedRating;
      
      const matchesPrice = provider.price >= priceRange[0] && provider.price <= priceRange[1];
      
      const matchesAvailability = availability === 'any' || provider.availability === availability;
      
      return matchesSearch && matchesSpecialty && matchesLocation && matchesInsurance && 
             matchesRating && matchesPrice && matchesAvailability;
    });

    // Sort providers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'distance':
          return a.distance - b.distance;
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'availability':
          return new Date(a.nextAvailable) - new Date(b.nextAvailable);
        default:
          return 0;
      }
    });

    return filtered;
  }, [providers, searchQuery, selectedSpecialty, selectedLocation, selectedInsurance, 
      selectedRating, priceRange, availability, sortBy]);

  const ProviderCard = ({ provider }) => (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 cursor-pointer"
         onClick={() => setSelectedProvider(provider)}>
      <div className="flex items-start space-x-4">
        <img src={provider.image} alt={provider.name} 
             className="w-20 h-20 rounded-full object-cover" />
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
              <p className="text-sm text-gray-600">{provider.credentials}</p>
              <p className="text-sm font-medium text-blue-600 capitalize">
                {specialties.find(s => s.value === provider.specialty)?.label || provider.specialty}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="text-sm font-medium">{provider.rating}</span>
                <span className="text-sm text-gray-500">({provider.reviews})</span>
              </div>
              <p className="text-sm text-gray-600">{provider.distance} mi</p>
            </div>
          </div>
          
          <div className="mt-3 space-y-1">
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2" />
              {provider.address}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <DollarSign className="w-4 h-4 mr-2" />
              ${provider.price} consultation
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              Next: {provider.nextAvailable}
            </div>
          </div>
          
          <div className="mt-3 flex flex-wrap gap-2">
            {provider.acceptsNewPatients && (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                Accepting New Patients
              </span>
            )}
            {provider.availability === 'same-day' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Same Day Available
              </span>
            )}
            {provider.insurance.includes('medicare') && (
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                Medicare
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Healthcare Providers</h1>
        <p className="text-gray-600">Search our network of qualified healthcare professionals</p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, specialty, or condition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Filter className="w-5 h-5 mr-2" />
              Filters
              {showFilters ? <X className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
            </button>
            
            <Select
              value={sortOptions.find(option => option.value === sortBy)}
              onChange={(option) => setSortBy(option.value)}
              options={sortOptions}
              className="w-48"
              placeholder="Sort by..."
            />
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
                <Select
                  value={selectedSpecialty}
                  onChange={setSelectedSpecialty}
                  options={specialties}
                  placeholder="Select specialty..."
                  isClearable
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  placeholder="City, ZIP, or address..."
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Insurance</label>
                <Select
                  value={selectedInsurance}
                  onChange={setSelectedInsurance}
                  options={insuranceOptions}
                  placeholder="Select insurance..."
                  isMulti
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Rating: {selectedRating}+
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={selectedRating}
                  onChange={(e) => setSelectedRating(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range: ${priceRange[0]} - ${priceRange[1]}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="500"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="flex-1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="any">Any Time</option>
                  <option value="same-day">Same Day</option>
                  <option value="next-day">Next Day</option>
                  <option value="week">This Week</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-600">
          Found {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''}
        </p>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1 rounded ${viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Map View
          </button>
        </div>
      </div>

      {/* Provider List */}
      <div className="space-y-4">
        {filteredProviders.map(provider => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>

      {filteredProviders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Search className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No providers found</h3>
          <p className="text-gray-600">Try adjusting your search criteria or filters</p>
        </div>
      )}

      {selectedProvider && (
        <ProviderProfile 
          provider={selectedProvider} 
          onClose={() => setSelectedProvider(null)} 
        />
      )}
    </div>
  );
};

const ProviderProfile = ({ provider, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
            <div className="flex justify-between items-start">
              <div className="flex items-start space-x-4">
                <img src={provider.image} alt={provider.name} 
                     className="w-24 h-24 rounded-full object-cover" />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{provider.name}</h2>
                  <p className="text-gray-600">{provider.credentials}</p>
                  <div className="flex items-center mt-2 space-x-4">
                    <div className="flex items-center">
                      <Star className="w-5 h-5 text-yellow-400 fill-current" />
                      <span className="ml-1 font-medium">{provider.rating}</span>
                      <span className="text-gray-500 ml-1">({provider.reviews} reviews)</span>
                    </div>
                    <span className="text-gray-500">{provider.experience} years experience</span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <Heart className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <Share2 className="w-5 h-5" />
                </button>
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex space-x-6 mt-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-2 border-b-2 font-medium text-sm ${
                  activeTab === 'overview' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`pb-2 border-b-2 font-medium text-sm ${
                  activeTab === 'reviews' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Reviews ({provider.reviews})
              </button>
              <button
                onClick={() => setActiveTab('availability')}
                className={`pb-2 border-b-2 font-medium text-sm ${
                  activeTab === 'availability' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Availability
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">About</h3>
                  <p className="text-gray-600">{provider.bio}</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {provider.specialties.map((specialty, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Education & Training</h3>
                  <div className="space-y-2">
                    <p><strong>Medical School:</strong> {provider.education}</p>
                    <p><strong>Hospital Affiliation:</strong> {provider.hospital}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      {provider.address}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Phone className="w-4 h-4 mr-2" />
                      {provider.phone}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Mail className="w-4 h-4 mr-2" />
                      {provider.email}
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Globe className="w-4 h-4 mr-2" />
                      {provider.website}
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Insurance Accepted</h3>
                  <div className="flex flex-wrap gap-2">
                    {provider.insurance.map((insurance, index) => (
                      <span key={index} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        {insurance.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{provider.rating}</div>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-5 h-5 ${i < Math.floor(provider.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <div className="text-sm text-gray-500">{provider.reviews} reviews</div>
                    </div>
                  </div>
                </div>
                
                {/* Sample reviews would go here */}
                <div className="text-center py-8 text-gray-500">
                  Patient reviews will be displayed here
                </div>
              </div>
            )}
            
            {activeTab === 'availability' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Next Available Appointment</h3>
                  <p className="text-blue-800">{provider.nextAvailable}</p>
                </div>
                
                <button
                  onClick={() => setShowAppointmentModal(true)}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Book Appointment
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderDirectory;
