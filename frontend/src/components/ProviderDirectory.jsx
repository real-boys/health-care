import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Filter, MapPin, Star, Calendar, Clock, Phone, Mail, Globe, CheckCircle, AlertCircle, Heart, Share2, Bookmark, ChevronDown, X, Users, Award, PhoneCall, Video, MessageSquare, Camera, FileText, Shield, DollarSign, TrendingUp, Activity, Map, Navigation, Loader } from 'lucide-react';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// API service functions
const providerAPI = {
  search: async (params) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/providers/search?${query}`);
    if (!response.ok) throw new Error('Failed to search providers');
    return response.json();
  },
  
  getProvider: async (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const url = `${API_BASE_URL}/providers/${id}${query ? '?' + query : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to get provider');
    return response.json();
  },
  
  getAvailability: async (providerId, startDate, endDate) => {
    const query = new URLSearchParams({ start_date: startDate, end_date: endDate }).toString();
    const response = await fetch(`${API_BASE_URL}/providers/${providerId}/availability?${query}`);
    if (!response.ok) throw new Error('Failed to get availability');
    return response.json();
  },
  
  getSlots: async (providerId, date) => {
    const response = await fetch(`${API_BASE_URL}/providers/${providerId}/slots?date=${date}`);
    if (!response.ok) throw new Error('Failed to get slots');
    return response.json();
  },
  
  getReviews: async (providerId, page = 1, sortBy = 'date') => {
    const response = await fetch(`${API_BASE_URL}/providers/${providerId}/reviews?page=${page}&sort_by=${sortBy}`);
    if (!response.ok) throw new Error('Failed to get reviews');
    return response.json();
  },
  
  getSpecialties: async () => {
    const response = await fetch(`${API_BASE_URL}/providers/specialties/all`);
    if (!response.ok) throw new Error('Failed to get specialties');
    return response.json();
  },
  
  getLocations: async (state) => {
    const query = state ? `?state=${state}` : '';
    const response = await fetch(`${API_BASE_URL}/providers/locations/all${query}`);
    if (!response.ok) throw new Error('Failed to get locations');
    return response.json();
  },
  
  getInsurance: async () => {
    const response = await fetch(`${API_BASE_URL}/providers/insurance/all`);
    if (!response.ok) throw new Error('Failed to get insurance');
    return response.json();
  },
  
  addFavorite: async (providerId, patientId, notes) => {
    const response = await fetch(`${API_BASE_URL}/providers/${providerId}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, notes })
    });
    if (!response.ok) throw new Error('Failed to add favorite');
    return response.json();
  },
  
  removeFavorite: async (providerId, patientId) => {
    const response = await fetch(`${API_BASE_URL}/providers/${providerId}/favorite`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId })
    });
    if (!response.ok) throw new Error('Failed to remove favorite');
    return response.json();
  },
  
  shareProvider: async (providerId, sharedBy, method, email) => {
    const response = await fetch(`${API_BASE_URL}/providers/${providerId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shared_by: sharedBy, share_method: method, recipient_email: email })
    });
    if (!response.ok) throw new Error('Failed to share');
    return response.json();
  }
};

const appointmentAPI = {
  book: async (appointmentData) => {
    const response = await fetch(`${API_BASE_URL}/appointments/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointmentData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to book appointment');
    }
    return response.json();
  },
  
  getByPatient: async (patientId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/appointments/patient/${patientId}${query ? '?' + query : ''}`);
    if (!response.ok) throw new Error('Failed to get appointments');
    return response.json();
  }
};

const ProviderDirectory = ({ patientId, userLocation }) => {
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    specialty: [],
    location: [],
    rating: 0,
    availability: [],
    insurance: [],
    language: [],
    gender: [],
    consultationType: []
  });
  const [sortBy, setSortBy] = useState('relevance');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [comparisonList, setComparisonList] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  
  // Filter options from API
  const [filterOptions, setFilterOptions] = useState({
    specialties: [],
    locations: [],
    insuranceProviders: [],
    languages: []
  });
  const [favorites, setFavorites] = useState([]);

  // Fetch providers from API
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          sort_by: sortBy
        };
        
        // Add search query
        if (searchQuery) {
          params.q = searchQuery;
        }
        
        // Add filters
        if (selectedFilters.specialty.length > 0) {
          params.specialty = selectedFilters.specialty.join(',');
        }
        if (selectedFilters.location.length > 0) {
          params.city = selectedFilters.location.join(',');
        }
        if (selectedFilters.insurance.length > 0) {
          params.insurance = selectedFilters.insurance.join(',');
        }
        if (selectedFilters.language.length > 0) {
          params.language = selectedFilters.language.join(',');
        }
        if (selectedFilters.gender.length > 0) {
          params.gender = selectedFilters.gender.join(',');
        }
        if (selectedFilters.rating > 0) {
          params.min_rating = selectedFilters.rating;
        }
        if (selectedFilters.consultationType.includes('Video')) {
          params.telehealth_available = true;
        }
        if (userLocation) {
          params.latitude = userLocation.lat;
          params.longitude = userLocation.lng;
        }
        
        const data = await providerAPI.search(params);
        
        setProviders(data.providers || []);
        setFilteredProviders(data.providers || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.total || 0,
          pages: data.pagination?.pages || 0
        }));
      } catch (err) {
        console.error('Error fetching providers:', err);
        setError(err.message);
        // Fall back to mock data for development
        const mockProviders = [
          {
            id: 1,
            name: "Dr. Sarah Chen",
            first_name: "Sarah",
            last_name: "Chen",
            specialty: "Cardiology",
            primary_specialty: "Cardiology",
            specialties: ["Cardiology", "Interventional Cardiology"],
            subspecialty: "Interventional Cardiology",
            rating: 4.8,
            average_rating: 4.8,
            reviews: 156,
            total_reviews: 156,
            experience: 12,
            years_of_experience: 12,
            location: "New York, NY",
            distance: 2.3,
            address: "123 Medical Center Blvd, New York, NY 10016",
            address_line1: "123 Medical Center Blvd",
            city: "New York",
            state: "NY",
            zip_code: "10016",
            phone: "+1 (555) 123-4567",
            email: "sarah.chen@medcenter.com",
            website: "www.drsarahchen.com",
            education: ["Harvard Medical School", "Massachusetts General Hospital"],
            boardCertifications: ["American Board of Internal Medicine", "American Board of Cardiology"],
            languages: ["English", "Mandarin", "Spanish"],
            languages_spoken: ["English", "Mandarin", "Spanish"],
            gender: "Female",
            consultationTypes: ["In-Person", "Video", "Phone"],
            telehealth_available: true,
            insurance: ["Aetna", "Blue Cross Blue Shield", "Medicare", "UnitedHealth"],
            insurance_accepted: ["Aetna", "Blue Cross Blue Shield", "Medicare", "UnitedHealth"],
            availability: {
              monday: ["9:00 AM - 5:00 PM"],
              tuesday: ["9:00 AM - 5:00 PM"],
              wednesday: ["9:00 AM - 3:00 PM"],
              thursday: ["9:00 AM - 5:00 PM"],
              friday: ["9:00 AM - 2:00 PM"],
              saturday: [],
              sunday: []
            },
            nextAvailable: "2024-12-15",
            next_available: "2024-12-15",
            price: {
              consultation: 250,
              insurance: true
            },
            consultation_fee: 250,
            images: [
              "https://via.placeholder.com/400x300?text=Dr+Sarah+Chen",
              "https://via.placeholder.com/400x300?text=Clinic+Exterior",
              "https://via.placeholder.com/400x300?text=Waiting+Room"
            ],
            profile_image_url: "https://via.placeholder.com/400x300?text=Dr+Sarah+Chen",
            hospitalAffiliations: ["Mount Sinai Hospital", "NYU Langone Health"],
            hospital_affiliations: ["Mount Sinai Hospital", "NYU Langone Health"],
            bio: "Dr. Sarah Chen is a board-certified cardiologist with over 12 years of experience in interventional cardiology. She specializes in minimally invasive cardiac procedures and has performed over 3,000 cardiac catheterizations.",
            accepts_new_patients: true
          },
          {
            id: 2,
            name: "Dr. Michael Rodriguez",
            first_name: "Michael",
            last_name: "Rodriguez",
            specialty: "Orthopedic Surgery",
            primary_specialty: "Orthopedics",
            specialties: ["Orthopedics", "Sports Medicine"],
            subspecialty: "Sports Medicine",
            rating: 4.9,
            average_rating: 4.9,
            reviews: 203,
            total_reviews: 203,
            experience: 15,
            years_of_experience: 15,
            location: "Los Angeles, CA",
            distance: 5.7,
            address: "456 Sports Medicine Center, Los Angeles, CA 90024",
            address_line1: "456 Sports Medicine Center",
            city: "Los Angeles",
            state: "CA",
            zip_code: "90024",
            phone: "+1 (555) 987-6543",
            email: "m.rodriguez@sportsmed.com",
            website: "www.drmichaelrodriguez.com",
            education: ["Johns Hopkins University", "Mayo Clinic"],
            boardCertifications: ["American Board of Orthopaedic Surgery"],
            languages: ["English", "Spanish"],
            languages_spoken: ["English", "Spanish"],
            gender: "Male",
            consultationTypes: ["In-Person", "Video"],
            telehealth_available: true,
            insurance: ["Blue Cross Blue Shield", "Aetna", "Cigna"],
            insurance_accepted: ["Blue Cross Blue Shield", "Aetna", "Cigna"],
            availability: {
              monday: ["8:00 AM - 6:00 PM"],
              tuesday: ["8:00 AM - 6:00 PM"],
              wednesday: ["8:00 AM - 6:00 PM"],
              thursday: ["8:00 AM - 6:00 PM"],
              friday: ["8:00 AM - 4:00 PM"],
              saturday: ["9:00 AM - 12:00 PM"],
              sunday: []
            },
            nextAvailable: "2024-12-13",
            next_available: "2024-12-13",
            price: {
              consultation: 300,
              insurance: true
            },
            consultation_fee: 300,
            images: [
              "https://via.placeholder.com/400x300?text=Dr+Michael+Rodriguez",
              "https://via.placeholder.com/400x300?text=Sports+Facility"
            ],
            profile_image_url: "https://via.placeholder.com/400x300?text=Dr+Michael+Rodriguez",
            hospitalAffiliations: ["Cedars-Sinai Medical Center", "UCLA Medical Center"],
            hospital_affiliations: ["Cedars-Sinai Medical Center", "UCLA Medical Center"],
            bio: "Dr. Michael Rodriguez is a renowned orthopedic surgeon specializing in sports medicine. He has worked with professional athletes and is known for his innovative approaches to joint preservation and minimally invasive surgery.",
            accepts_new_patients: true
          },
          {
            id: 3,
            name: "Dr. Emily Johnson",
            first_name: "Emily",
            last_name: "Johnson",
            specialty: "Pediatrics",
            primary_specialty: "Pediatrics",
            specialties: ["Pediatrics", "Neonatology"],
            subspecialty: "Neonatology",
            rating: 4.7,
            average_rating: 4.7,
            reviews: 189,
            total_reviews: 189,
            experience: 10,
            years_of_experience: 10,
            location: "Chicago, IL",
            distance: 3.1,
            address: "789 Children's Hospital, Chicago, IL 60611",
            address_line1: "789 Children's Hospital",
            city: "Chicago",
            state: "IL",
            zip_code: "60611",
            phone: "+1 (555) 456-7890",
            email: "e.johnson@childrenshospital.org",
            website: "www.dremilyjohnson.com",
            education: ["Stanford University", "Children's Hospital of Philadelphia"],
            boardCertifications: ["American Board of Pediatrics", "American Board of Neonatology"],
            languages: ["English", "French", "German"],
            languages_spoken: ["English", "French", "German"],
            gender: "Female",
            consultationTypes: ["In-Person", "Video", "Phone"],
            telehealth_available: true,
            insurance: ["Blue Cross Blue Shield", "Medicaid", "UnitedHealth"],
            insurance_accepted: ["Blue Cross Blue Shield", "Medicaid", "UnitedHealth"],
            availability: {
              monday: ["7:00 AM - 7:00 PM"],
              tuesday: ["7:00 AM - 7:00 PM"],
              wednesday: ["7:00 AM - 7:00 PM"],
              thursday: ["7:00 AM - 7:00 PM"],
              friday: ["7:00 AM - 5:00 PM"],
              saturday: ["8:00 AM - 2:00 PM"],
              sunday: []
            },
            nextAvailable: "2024-12-14",
            next_available: "2024-12-14",
            price: {
              consultation: 200,
              insurance: true
            },
            consultation_fee: 200,
            images: [
              "https://via.placeholder.com/400x300?text=Dr+Emily+Johnson",
              "https://via.placeholder.com/400x300?text=PEDIATRIC+Ward"
            ],
            profile_image_url: "https://via.placeholder.com/400x300?text=Dr+Emily+Johnson",
            hospitalAffiliations: ["Lurie Children's Hospital", "Northwestern Memorial Hospital"],
            hospital_affiliations: ["Lurie Children's Hospital", "Northwestern Memorial Hospital"],
            bio: "Dr. Emily Johnson is a compassionate pediatrician dedicated to providing comprehensive care for children from birth through adolescence. She has special expertise in neonatal care and developmental pediatrics.",
            accepts_new_patients: true
          }
        ];
        
        setProviders(mockProviders);
        setFilteredProviders(mockProviders);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [searchQuery, selectedFilters, sortBy, pagination.page, userLocation]);

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [specialtiesData, locationsData, insuranceData] = await Promise.all([
          providerAPI.getSpecialties(),
          providerAPI.getLocations(),
          providerAPI.getInsurance()
        ]);
        
        setFilterOptions({
          specialties: specialtiesData.specialties || [],
          locations: locationsData.locations || [],
          insuranceProviders: insuranceData.insurance_providers || [],
          languages: ['English', 'Spanish', 'Mandarin', 'French', 'German']
        });
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };

    fetchFilterOptions();
  }, []);

  // Filter and search logic
  useEffect(() => {
    let filtered = providers;

    // Search query filter
    if (searchQuery) {
      filtered = filtered.filter(provider =>
        provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.subspecialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.specialties.some(spec => spec.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply all filters
    Object.entries(selectedFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        if (key === 'specialty') {
          filtered = filtered.filter(provider => values.includes(provider.specialty));
        } else if (key === 'location') {
          filtered = filtered.filter(provider => 
            values.some(loc => provider.location.toLowerCase().includes(loc.toLowerCase()))
          );
        } else if (key === 'rating') {
          filtered = filtered.filter(provider => provider.rating >= values);
        } else if (key === 'language') {
          filtered = filtered.filter(provider =>
            values.some(lang => provider.languages.includes(lang))
          );
        } else if (key === 'gender') {
          filtered = filtered.filter(provider => values.includes(provider.gender));
        } else if (key === 'consultationType') {
          filtered = filtered.filter(provider =>
            values.some(type => provider.consultationTypes.includes(type))
          );
        } else if (key === 'insurance') {
          filtered = filtered.filter(provider =>
            values.some(ins => provider.insurance.includes(ins))
          );
        }
      }
    });

    // Sort results
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'experience':
          return b.experience - a.experience;
        case 'distance':
          return a.distance - b.distance;
        case 'reviews':
          return b.reviews - a.reviews;
        default:
          return 0;
      }
    });

    setFilteredProviders(filtered);
  }, [searchQuery, selectedFilters, sortBy, providers]);

  const handleFilterChange = (filterType, value) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter(item => item !== value)
        : [...prev[filterType], value]
    }));
  };

  const clearFilters = () => {
    setSelectedFilters({
      specialty: [],
      location: [],
      rating: 0,
      availability: [],
      insurance: [],
      language: [],
      gender: [],
      consultationType: []
    });
    setSearchQuery('');
  };

  const addToComparison = (provider) => {
    if (comparisonList.length < 3 && !comparisonList.find(p => p.id === provider.id)) {
      setComparisonList([...comparisonList, provider]);
    }
  };

  const removeFromComparison = (providerId) => {
    setComparisonList(comparisonList.filter(p => p.id !== providerId));
  };

  // Derived filter options - use filterOptions from API, or fallback to provider data
  const specialtyOptions = filterOptions.specialties.length > 0 
    ? filterOptions.specialties.map(s => s.name)
    : [...new Set(providers.map(p => p.specialty || p.primary_specialty))];
  
  const locationOptions = filterOptions.locations.length > 0
    ? filterOptions.locations.map(l => `${l.city}, ${l.state}`)
    : [...new Set(providers.map(p => p.location || `${p.city}, ${p.state}`))];
  
  const languageOptions = filterOptions.languages.length > 0
    ? filterOptions.languages
    : [...new Set(providers.flatMap(p => p.languages || p.languages_spoken || []))];
  
  const insuranceOptions = filterOptions.insuranceProviders.length > 0
    ? filterOptions.insuranceProviders
    : [...new Set(providers.flatMap(p => p.insurance || p.insurance_accepted || []))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="provider-directory">
      {/* Search Header */}
      <div className="search-header bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, specialty, condition, or treatment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Filter className="w-5 h-5" />
            Filters
            {Object.values(selectedFilters).some(arr => arr.length > 0) && (
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                {Object.values(selectedFilters).reduce((acc, arr) => acc + arr.length, 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-t pt-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Specialty Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {specialtyOptions.map(specialty => (
                    <label key={specialty} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedFilters.specialty.includes(specialty)}
                        onChange={() => handleFilterChange('specialty', specialty)}
                        className="mr-2"
                      />
                      <span className="text-sm">{specialty}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Location Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {locationOptions.map(location => (
                    <label key={location} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedFilters.location.includes(location)}
                        onChange={() => handleFilterChange('location', location)}
                        className="mr-2"
                      />
                      <span className="text-sm">{location}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
                <div className="space-y-2">
                  {[4.5, 4.0, 3.5, 3.0].map(rating => (
                    <label key={rating} className="flex items-center">
                      <input
                        type="radio"
                        name="rating"
                        checked={selectedFilters.rating === rating}
                        onChange={() => setSelectedFilters(prev => ({ ...prev, rating }))}
                        className="mr-2"
                      />
                      <span className="text-sm flex items-center">
                        {rating}+ <Star className="w-4 h-4 text-yellow-400 ml-1" />
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Consultation Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Consultation Type</label>
                <div className="space-y-2">
                  {['In-Person', 'Video', 'Phone'].map(type => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedFilters.consultationType.includes(type)}
                        onChange={() => handleFilterChange('consultationType', type)}
                        className="mr-2"
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear all filters
              </button>
              <div className="text-sm text-gray-600">
                {filteredProviders.length} providers found
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="relevance">Sort by Relevance</option>
            <option value="rating">Sort by Rating</option>
            <option value="experience">Sort by Experience</option>
            <option value="distance">Sort by Distance</option>
            <option value="reviews">Sort by Reviews</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
            >
              <div className="grid grid-cols-2 gap-1 w-5 h-5">
                <div className="bg-current"></div>
                <div className="bg-current"></div>
                <div className="bg-current"></div>
                <div className="bg-current"></div>
              </div>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
            >
              <div className="space-y-1 w-5 h-5">
                <div className="bg-current h-1"></div>
                <div className="bg-current h-1"></div>
                <div className="bg-current h-1"></div>
              </div>
            </button>
          </div>
        </div>

        {comparisonList.length > 0 && (
          <button
            onClick={() => {/* Show comparison modal */}}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Users className="w-4 h-4" />
            Compare ({comparisonList.length})
          </button>
        )}
      </div>

      {/* Provider Cards */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {filteredProviders.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            viewMode={viewMode}
            onSelect={setSelectedProvider}
            onCompare={addToComparison}
            isInComparison={comparisonList.find(p => p.id === provider.id)}
          />
        ))}
      </div>

      {/* Provider Detail Modal */}
      {selectedProvider && (
        <ProviderDetailModal
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
          onBookAppointment={() => {/* Handle booking */}}
        />
      )}

      {/* Comparison Modal */}
      {comparisonList.length > 0 && (
        <ComparisonModal
          providers={comparisonList}
          onClose={() => setComparisonList([])}
          onRemove={removeFromComparison}
        />
      )}
    </div>
  );
};

// Provider Card Component
const ProviderCard = ({ provider, viewMode, onSelect, onCompare, isInComparison }) => {
  const isListView = viewMode === 'list';

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${isListView ? 'flex gap-4 p-4' : 'p-4'}`}>
      {/* Provider Image */}
      <div className={`${isListView ? 'w-24 h-24' : 'w-full h-48'} mb-4`}>
        <img
          src={provider.images[0]}
          alt={provider.name}
          className="w-full h-full object-cover rounded-lg"
        />
      </div>

      {/* Provider Info */}
      <div className={`flex-1 ${isListView ? '' : 'space-y-3'}`}>
        <div>
          <h3 className="font-semibold text-lg text-gray-900">{provider.name}</h3>
          <p className="text-gray-600">{provider.specialty} • {provider.subspecialty}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="text-sm font-medium ml-1">{provider.rating}</span>
            </div>
            <span className="text-sm text-gray-500">({provider.reviews} reviews)</span>
            <span className="text-sm text-gray-500">• {provider.experience} years exp.</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            <span>{provider.distance} mi</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>Next: {provider.nextAvailable}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {provider.consultationTypes.map(type => (
            <span key={type} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              {type}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-semibold">${provider.price.consultation}</span>
            <span className="text-sm text-gray-500"> / consultation</span>
            {provider.price.insurance && (
              <span className="ml-2 text-xs text-green-600 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" />
                Insurance accepted
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={`${isListView ? 'flex flex-col gap-2' : 'flex gap-2 mt-4'}`}>
        <button
          onClick={() => onSelect(provider)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          View Profile
        </button>
        <button
          onClick={() => onCompare(provider)}
          disabled={isInComparison}
          className={`px-4 py-2 rounded-lg text-sm ${
            isInComparison
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {isInComparison ? 'Added' : 'Compare'}
        </button>
      </div>
    </div>
  );
};

// Provider Detail Modal Component
const ProviderDetailModal = ({ provider, onClose, onBookAppointment }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{provider.name}</h2>
            <p className="text-gray-600">{provider.specialty} • {provider.subspecialty}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Image Gallery */}
          <div className="mb-6">
            <div className="relative">
              <img
                src={provider.images[currentImageIndex]}
                alt={`${provider.name} - Image ${currentImageIndex + 1}`}
                className="w-full h-96 object-cover rounded-lg"
              />
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {provider.images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full ${
                      index === currentImageIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b mb-6">
            <div className="flex gap-6">
              {['overview', 'availability', 'reviews', 'media'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 border-b-2 capitalize ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Star className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                  <div className="font-semibold">{provider.rating}</div>
                  <div className="text-sm text-gray-600">{provider.reviews} reviews</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <div className="font-semibold">{provider.experience}</div>
                  <div className="text-sm text-gray-600">Years experience</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <MapPin className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <div className="font-semibold">{provider.distance} mi</div>
                  <div className="text-sm text-gray-600">Distance</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                  <div className="font-semibold">${provider.price.consultation}</div>
                  <div className="text-sm text-gray-600">Consultation</div>
                </div>
              </div>

              {/* About */}
              <div>
                <h3 className="font-semibold text-lg mb-3">About</h3>
                <p className="text-gray-700 leading-relaxed">{provider.bio}</p>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Contact Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span>{provider.address}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span>{provider.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span>{provider.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-400" />
                    <span>{provider.website}</span>
                  </div>
                </div>
              </div>

              {/* Specialties */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Specialties & Conditions</h3>
                <div className="flex flex-wrap gap-2">
                  {provider.specialties.map(specialty => (
                    <span key={specialty} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>

              {/* Education & Certifications */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Education & Certifications</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Education</h4>
                    <ul className="space-y-1">
                      {provider.education.map((edu, index) => (
                        <li key={index} className="text-gray-700">• {edu}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Board Certifications</h4>
                    <ul className="space-y-1">
                      {provider.boardCertifications.map((cert, index) => (
                        <li key={index} className="text-gray-700">• {cert}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Languages */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Languages</h3>
                <div className="flex flex-wrap gap-2">
                  {provider.languages.map(language => (
                    <span key={language} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      {language}
                    </span>
                  ))}
                </div>
              </div>

              {/* Insurance */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Insurance Accepted</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {provider.insurance.map(insurance => (
                    <div key={insurance} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">{insurance}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'availability' && (
            <AvailabilityTab provider={provider} onBookAppointment={onBookAppointment} />
          )}

          {activeTab === 'reviews' && (
            <ReviewsTab provider={provider} />
          )}

          {activeTab === 'media' && (
            <MediaTab provider={provider} />
          )}
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t p-6 flex gap-4">
          <button
            onClick={onBookAppointment}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Book Appointment
          </button>
          <button className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
            <PhoneCall className="w-5 h-5" />
          </button>
          <button className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
            <Video className="w-5 h-5" />
          </button>
          <button className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Availability Tab Component
const AvailabilityTab = ({ provider, onBookAppointment }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg mb-4">Office Hours</h3>
        <div className="space-y-3">
          {weekDays.map((day, index) => (
            <div key={day} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="font-medium">{dayNames[index]}</span>
              <span className="text-gray-600">
                {provider.availability[day].length > 0 ? provider.availability[day][0] : 'Closed'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-4">Book Appointment</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a time</option>
              <option value="09:00">9:00 AM</option>
              <option value="09:30">9:30 AM</option>
              <option value="10:00">10:00 AM</option>
              <option value="10:30">10:30 AM</option>
              <option value="11:00">11:00 AM</option>
              <option value="11:30">11:30 AM</option>
              <option value="14:00">2:00 PM</option>
              <option value="14:30">2:30 PM</option>
              <option value="15:00">3:00 PM</option>
              <option value="15:30">3:30 PM</option>
              <option value="16:00">4:00 PM</option>
            </select>
          </div>
        </div>
        <button
          onClick={onBookAppointment}
          disabled={!selectedDate || !selectedTime}
          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Book Appointment
        </button>
      </div>
    </div>
  );
};

// Reviews Tab Component
const ReviewsTab = ({ provider }) => {
  const [newReview, setNewReview] = useState({ rating: 0, comment: '' });

  const mockReviews = [
    {
      id: 1,
      patient: "John D.",
      rating: 5,
      date: "2024-11-15",
      comment: "Dr. Chen is an exceptional cardiologist. She took the time to explain my condition thoroughly and made me feel comfortable throughout the entire process.",
      helpful: 23
    },
    {
      id: 2,
      patient: "Maria S.",
      rating: 4,
      date: "2024-10-28",
      comment: "Very professional and knowledgeable. The wait time was a bit long, but the quality of care was excellent.",
      helpful: 15
    }
  ];

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold">{provider.rating}</div>
            <div className="flex items-center justify-center mt-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-5 h-5 ${i < Math.floor(provider.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
              ))}
            </div>
            <div className="text-sm text-gray-600 mt-1">{provider.reviews} reviews</div>
          </div>
          <div className="flex-1">
            {[5, 4, 3, 2, 1].map(stars => (
              <div key={stars} className="flex items-center gap-2 mb-1">
                <span className="text-sm w-8">{stars}★</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-400 h-2 rounded-full"
                    style={{ width: `${stars === 5 ? 70 : stars === 4 ? 20 : 5}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-8">{stars === 5 ? 70 : stars === 4 ? 20 : 5}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Write Review */}
      <div>
        <h3 className="font-semibold text-lg mb-4">Write a Review</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                  className="p-1"
                >
                  <Star className={`w-6 h-6 ${star <= newReview.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
            <textarea
              value={newReview.comment}
              onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Share your experience with this provider..."
            />
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Submit Review
          </button>
        </div>
      </div>

      {/* Reviews List */}
      <div>
        <h3 className="font-semibold text-lg mb-4">Patient Reviews</h3>
        <div className="space-y-4">
          {mockReviews.map(review => (
            <div key={review.id} className="border-b pb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium">{review.patient}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <span className="text-sm text-gray-500">{review.date}</span>
                  </div>
                </div>
              </div>
              <p className="text-gray-700">{review.comment}</p>
              <div className="flex items-center gap-4 mt-3">
                <button className="text-sm text-gray-600 hover:text-gray-800">
                  Helpful ({review.helpful})
                </button>
                <button className="text-sm text-gray-600 hover:text-gray-800">
                  Report
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Media Tab Component
const MediaTab = ({ provider }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg mb-4">Photo Gallery</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {provider.images.map((image, index) => (
            <div key={index} className="relative group">
              <img
                src={image}
                alt={`Gallery image ${index + 1}`}
                className="w-full h-48 object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-4">Videos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Provider Introduction</p>
            </div>
          </div>
          <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Facility Tour</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Comparison Modal Component
const ComparisonModal = ({ providers, onClose, onRemove }) => {
  if (providers.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold">Compare Providers</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Feature</th>
                  {providers.map(provider => (
                    <th key={provider.id} className="text-left py-3 px-4">
                      <div className="relative">
                        {provider.name}
                        <button
                          onClick={() => onRemove(provider.id)}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Specialty</td>
                  {providers.map(provider => (
                    <td key={provider.id} className="py-3 px-4">{provider.specialty}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Rating</td>
                  {providers.map(provider => (
                    <td key={provider.id} className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        {provider.rating}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Experience</td>
                  {providers.map(provider => (
                    <td key={provider.id} className="py-3 px-4">{provider.experience} years</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Distance</td>
                  {providers.map(provider => (
                    <td key={provider.id} className="py-3 px-4">{provider.distance} mi</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Consultation Price</td>
                  {providers.map(provider => (
                    <td key={provider.id} className="py-3 px-4">${provider.price.consultation}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Languages</td>
                  {providers.map(provider => (
                    <td key={provider.id} className="py-3 px-4">{provider.languages.join(', ')}</td>
                  ))}
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4 font-medium">Insurance</td>
                  {providers.map(provider => (
                    <td key={provider.id} className="py-3 px-4">{provider.insurance.slice(0, 3).join(', ')}...</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderDirectory;
