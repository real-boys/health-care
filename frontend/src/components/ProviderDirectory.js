import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Star,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  User,
  Award,
  CheckCircle,
  DollarSign,
  Heart,
  MessageSquare,
  ChevronDown,
  X,
  Users,
  Briefcase,
  GraduationCap
} from 'lucide-react';

const ProviderDirectory = ({ account, contract }) => {
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [selectedRating, setSelectedRating] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [loading, setLoading] = useState(false);

  const specialties = [
    'all', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 
    'Dermatology', 'Psychiatry', 'General Practice', 'Oncology', 
    'Gynecology', 'Ophthalmology', 'ENT', 'Urology', 'Radiology'
  ];

  const mockProviders = [
    {
      id: 1,
      name: 'Dr. Sarah Chen',
      specialty: 'Cardiology',
      rating: 4.8,
      reviews: 124,
      experience: 12,
      education: 'Harvard Medical School',
      location: '123 Medical Center Dr, Boston, MA',
      phone: '+1 (555) 123-4567',
      email: 'sarah.chen@healthcare.com',
      price: 250,
      availability: ['Mon', 'Tue', 'Wed', 'Thu'],
      image: '👩‍⚕️',
      verified: true,
      languages: ['English', 'Mandarin'],
      hospital: 'Boston General Hospital',
      bio: 'Dr. Chen is a board-certified cardiologist with over 12 years of experience in treating heart diseases and performing cardiac catheterizations.',
      services: ['Cardiac Consultation', 'Echocardiogram', 'Stress Test', 'Cardiac Catheterization'],
      insurance: ['Blue Cross', 'Aetna', 'Medicare']
    },
    {
      id: 2,
      name: 'Dr. Michael Ross',
      specialty: 'Neurology',
      rating: 4.6,
      reviews: 89,
      experience: 8,
      education: 'Johns Hopkins University',
      location: '456 Neurology Center, New York, NY',
      phone: '+1 (555) 234-5678',
      email: 'michael.ross@healthcare.com',
      price: 300,
      availability: ['Tue', 'Wed', 'Thu', 'Fri'],
      image: '👨‍⚕️',
      verified: true,
      languages: ['English', 'Spanish'],
      hospital: 'NYU Medical Center',
      bio: 'Dr. Ross specializes in treating neurological disorders including epilepsy, stroke, and neurodegenerative diseases.',
      services: ['Neurological Consultation', 'EEG', 'MRI Review', 'Botox Injections'],
      insurance: ['UnitedHealth', 'Cigna', 'Medicare']
    },
    {
      id: 3,
      name: 'Dr. Emily Johnson',
      specialty: 'Pediatrics',
      rating: 4.9,
      reviews: 156,
      experience: 10,
      education: 'Stanford Medical School',
      location: '789 Children\'s Hospital, San Francisco, CA',
      phone: '+1 (555) 345-6789',
      email: 'emily.johnson@healthcare.com',
      price: 200,
      availability: ['Mon', 'Tue', 'Thu', 'Fri'],
      image: '👩‍⚕️',
      verified: true,
      languages: ['English', 'French'],
      hospital: 'San Francisco Children\'s Hospital',
      bio: 'Dr. Johnson is dedicated to providing comprehensive healthcare for children from newborns to adolescents.',
      services: ['Well Child Exams', 'Vaccinations', 'Sick Visits', 'Developmental Screening'],
      insurance: ['Kaiser', 'Blue Shield', 'Medi-Cal']
    },
    {
      id: 4,
      name: 'Dr. James Wilson',
      specialty: 'Orthopedics',
      rating: 4.7,
      reviews: 98,
      experience: 15,
      education: 'Mayo Clinic College of Medicine',
      location: '321 Orthopedic Center, Chicago, IL',
      phone: '+1 (555) 456-7890',
      email: 'james.wilson@healthcare.com',
      price: 350,
      availability: ['Mon', 'Wed', 'Thu', 'Fri'],
      image: '👨‍⚕️',
      verified: true,
      languages: ['English'],
      hospital: 'Chicago Medical Center',
      bio: 'Dr. Wilson specializes in joint replacement surgery and sports medicine injuries.',
      services: ['Joint Replacement', 'Arthroscopy', 'Fracture Care', 'Sports Medicine'],
      insurance: ['Blue Cross', 'Aetna', 'UnitedHealth']
    },
    {
      id: 5,
      name: 'Dr. Lisa Martinez',
      specialty: 'Dermatology',
      rating: 4.5,
      reviews: 67,
      experience: 6,
      education: 'UCLA Medical School',
      location: '654 Skin Care Center, Los Angeles, CA',
      phone: '+1 (555) 567-8901',
      email: 'lisa.martinez@healthcare.com',
      price: 225,
      availability: ['Tue', 'Wed', 'Fri'],
      image: '👩‍⚕️',
      verified: true,
      languages: ['English', 'Spanish'],
      hospital: 'UCLA Medical Center',
      bio: 'Dr. Martinez provides comprehensive dermatological care including medical, surgical, and cosmetic treatments.',
      services: ['Skin Cancer Screening', 'Acne Treatment', 'Botox', 'Chemical Peels'],
      insurance: ['Blue Shield', 'Kaiser', 'Cigna']
    }
  ];

  useEffect(() => {
    setProviders(mockProviders);
    setFilteredProviders(mockProviders);
  }, []);

  useEffect(() => {
    filterProviders();
  }, [searchTerm, selectedSpecialty, selectedRating, priceRange, availability, providers]);

  const filterProviders = () => {
    let filtered = providers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(provider =>
        provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.hospital.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Specialty filter
    if (selectedSpecialty !== 'all') {
      filtered = filtered.filter(provider => provider.specialty === selectedSpecialty);
    }

    // Rating filter
    if (selectedRating !== 'all') {
      const minRating = parseFloat(selectedRating);
      filtered = filtered.filter(provider => provider.rating >= minRating);
    }

    // Price range filter
    if (priceRange !== 'all') {
      const [min, max] = priceRange.split('-').map(p => parseInt(p));
      filtered = filtered.filter(provider => {
        if (max) {
          return provider.price >= min && provider.price <= max;
        }
        return provider.price >= min;
      });
    }

    // Availability filter
    if (availability !== 'all') {
      filtered = filtered.filter(provider => provider.availability.includes(availability));
    }

    setFilteredProviders(filtered);
  };

  const handleBooking = async () => {
    if (!selectedProvider || !bookingDate || !bookingTime || !bookingReason) {
      alert('Please fill in all booking details');
      return;
    }

    setLoading(true);
    try {
      // Simulate booking API call
      const bookingData = {
        providerId: selectedProvider.id,
        patientAddress: account,
        date: bookingDate,
        time: bookingTime,
        reason: bookingReason,
        timestamp: new Date().toISOString()
      };

      // In a real app, this would interact with the smart contract
      console.log('Booking appointment:', bookingData);
      
      alert(`Appointment booked successfully with ${selectedProvider.name} on ${bookingDate} at ${bookingTime}`);
      
      // Reset booking form
      setBookingDate('');
      setBookingTime('');
      setBookingReason('');
      setShowBookingModal(false);
      setSelectedProvider(null);
    } catch (error) {
      console.error('Error booking appointment:', error);
      alert('Error booking appointment. Please try again.');
    }
    setLoading(false);
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  const ProviderCard = ({ provider }) => (
    <div className="provider-card bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start space-x-4">
        <div className="text-4xl">{provider.image}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
              <p className="text-sm text-gray-600">{provider.specialty}</p>
            </div>
            {provider.verified && (
              <div className="flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span className="text-xs">Verified</span>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center space-x-4">
            <div className="flex items-center">
              {renderStars(provider.rating)}
              <span className="ml-1 text-sm text-gray-600">{provider.rating}</span>
            </div>
            <span className="text-sm text-gray-500">({provider.reviews} reviews)</span>
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2" />
              {provider.location}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Briefcase className="w-4 h-4 mr-2" />
              {provider.hospital}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <GraduationCap className="w-4 h-4 mr-2" />
              {provider.education}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Users className="w-4 h-4 mr-2" />
              {provider.experience} years experience
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center text-lg font-semibold text-blue-600">
              <DollarSign className="w-5 h-5" />
              {provider.price}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedProvider(provider)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                View Profile
              </button>
              <button
                onClick={() => {
                  setSelectedProvider(provider);
                  setShowBookingModal(true);
                }}
                className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="provider-directory">
      <div className="directory-header">
        <h2>Provider Directory</h2>
        <p>Find and book appointments with qualified healthcare providers</p>
      </div>

      {/* Search and Filters */}
      <div className="search-filters-section">
        <div className="search-bar">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, specialty, or hospital..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-2 rounded-lg ${
              showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            <ChevronDown className={`w-4 h-4 ml-2 transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="filters-panel">
            <div className="filter-group">
              <label>Specialty</label>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {specialties.map(specialty => (
                  <option key={specialty} value={specialty}>
                    {specialty === 'all' ? 'All Specialties' : specialty}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Rating</label>
              <select
                value={selectedRating}
                onChange={(e) => setSelectedRating(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Ratings</option>
                <option value="4.5">4.5+ Stars</option>
                <option value="4">4+ Stars</option>
                <option value="3.5">3.5+ Stars</option>
                <option value="3">3+ Stars</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Price Range</label>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Prices</option>
                <option value="0-200">$0 - $200</option>
                <option value="200-300">$200 - $300</option>
                <option value="300-400">$300 - $400</option>
                <option value="400">$400+</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Availability</label>
              <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Any Day</option>
                <option value="Mon">Monday</option>
                <option value="Tue">Tuesday</option>
                <option value="Wed">Wednesday</option>
                <option value="Thu">Thursday</option>
                <option value="Fri">Friday</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="results-count">
        <p>Found {filteredProviders.length} providers</p>
      </div>

      {/* Providers Grid */}
      <div className="providers-grid">
        {filteredProviders.map(provider => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>

      {/* Provider Detail Modal */}
      {selectedProvider && !showBookingModal && (
        <div className="modal-overlay">
          <div className="modal-content provider-detail-modal">
            <div className="modal-header">
              <h3>Provider Profile</h3>
              <button onClick={() => setSelectedProvider(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="provider-detail-header">
                <div className="text-5xl">{selectedProvider.image}</div>
                <div className="provider-detail-info">
                  <h2>{selectedProvider.name}</h2>
                  <p className="specialty">{selectedProvider.specialty}</p>
                  <div className="rating-section">
                    <div className="flex items-center">
                      {renderStars(selectedProvider.rating)}
                      <span className="ml-2">{selectedProvider.rating} ({selectedProvider.reviews} reviews)</span>
                    </div>
                    {selectedProvider.verified && (
                      <div className="verified-badge">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Verified Provider
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="provider-detail-sections">
                <div className="detail-section">
                  <h4>About</h4>
                  <p>{selectedProvider.bio}</p>
                </div>

                <div className="detail-section">
                  <h4>Contact Information</h4>
                  <div className="contact-info">
                    <div className="contact-item">
                      <Phone className="w-4 h-4" />
                      <span>{selectedProvider.phone}</span>
                    </div>
                    <div className="contact-item">
                      <Mail className="w-4 h-4" />
                      <span>{selectedProvider.email}</span>
                    </div>
                    <div className="contact-item">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedProvider.location}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Services</h4>
                  <div className="services-list">
                    {selectedProvider.services.map((service, index) => (
                      <span key={index} className="service-tag">{service}</span>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Insurance Accepted</h4>
                  <div className="insurance-list">
                    {selectedProvider.insurance.map((insurance, index) => (
                      <span key={index} className="insurance-tag">{insurance}</span>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Availability</h4>
                  <div className="availability-days">
                    {selectedProvider.availability.map((day, index) => (
                      <span key={index} className="day-badge">{day}</span>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Languages</h4>
                  <div className="languages-list">
                    {selectedProvider.languages.map((language, index) => (
                      <span key={index} className="language-tag">{language}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="provider-detail-footer">
                <div className="consultation-price">
                  <span>Consultation Price:</span>
                  <div className="price-display">
                    <DollarSign className="w-5 h-5" />
                    <span>{selectedProvider.price}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="book-appointment-btn"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Book Appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && selectedProvider && (
        <div className="modal-overlay">
          <div className="modal-content booking-modal">
            <div className="modal-header">
              <h3>Book Appointment</h3>
              <button onClick={() => setShowBookingModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="booking-provider-info">
                <div className="text-3xl">{selectedProvider.image}</div>
                <div>
                  <h4>{selectedProvider.name}</h4>
                  <p>{selectedProvider.specialty}</p>
                </div>
              </div>

              <div className="booking-form">
                <div className="form-group">
                  <label>Select Date</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="form-group">
                  <label>Select Time</label>
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a time</option>
                    <option value="09:00">9:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                    <option value="11:00">11:00 AM</option>
                    <option value="14:00">2:00 PM</option>
                    <option value="15:00">3:00 PM</option>
                    <option value="16:00">4:00 PM</option>
                    <option value="17:00">5:00 PM</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Reason for Visit</label>
                  <textarea
                    value={bookingReason}
                    onChange={(e) => setBookingReason(e.target.value)}
                    placeholder="Please describe the reason for your appointment..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="booking-summary">
                  <div className="summary-item">
                    <span>Consultation Fee:</span>
                    <span className="fee-amount">${selectedProvider.price}</span>
                  </div>
                  <div className="summary-item">
                    <span>Payment Method:</span>
                    <span>Insurance/Cash</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowBookingModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleBooking}
                disabled={loading}
                className="confirm-booking-btn"
              >
                {loading ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .provider-directory {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .directory-header h2 {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 8px;
          color: #1f2937;
        }

        .directory-header p {
          color: #6b7280;
          margin-bottom: 24px;
        }

        .search-filters-section {
          margin-bottom: 24px;
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .filters-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-top: 16px;
        }

        .filter-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 4px;
        }

        .results-count {
          margin-bottom: 20px;
        }

        .results-count p {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .providers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 24px;
        }

        .provider-card {
          border: 1px solid #e5e7eb;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .provider-detail-modal {
          max-width: 800px;
        }

        .booking-modal {
          max-width: 500px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
        }

        .modal-body {
          padding: 20px;
        }

        .provider-detail-header {
          display: flex;
          gap: 20px;
          margin-bottom: 24px;
        }

        .provider-detail-info h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .provider-detail-info .specialty {
          color: #6b7280;
          margin-bottom: 8px;
        }

        .rating-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .verified-badge {
          display: flex;
          align-items: center;
          color: #10b981;
          font-size: 0.875rem;
        }

        .provider-detail-sections {
          display: grid;
          gap: 24px;
        }

        .detail-section h4 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 12px;
          color: #1f2937;
        }

        .contact-info {
          display: grid;
          gap: 8px;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b7280;
        }

        .services-list,
        .insurance-list,
        .languages-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .service-tag,
        .insurance-tag,
        .language-tag {
          padding: 4px 12px;
          background: #f3f4f6;
          border-radius: 16px;
          font-size: 0.875rem;
          color: #374151;
        }

        .availability-days {
          display: flex;
          gap: 8px;
        }

        .day-badge {
          padding: 4px 12px;
          background: #dbeafe;
          color: #1d4ed8;
          border-radius: 16px;
          font-size: 0.875rem;
        }

        .provider-detail-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          margin-top: 24px;
        }

        .consultation-price {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .consultation-price span:first-child {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .price-display {
          display: flex;
          align-items: center;
          font-size: 1.25rem;
          font-weight: bold;
          color: #1d4ed8;
        }

        .book-appointment-btn {
          display: flex;
          align-items: center;
          padding: 12px 24px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        }

        .booking-provider-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .booking-form {
          display: grid;
          gap: 16px;
        }

        .form-group label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 4px;
        }

        .booking-summary {
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          display: grid;
          gap: 8px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }

        .fee-amount {
          font-weight: 600;
          color: #1d4ed8;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .cancel-btn {
          padding: 8px 16px;
          background: #f3f4f6;
          color: #374151;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .confirm-booking-btn {
          padding: 8px 16px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .confirm-booking-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ProviderDirectory;
