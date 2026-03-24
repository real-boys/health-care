import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Phone, Mail, CreditCard, Check, AlertCircle, ChevronLeft, ChevronRight, Video, MapPin } from 'lucide-react';
import { format, addDays, addWeeks, startOfWeek, addMonths, isSameDay, isToday, isBefore, isAfter, setHours, setMinutes } from 'date-fns';

const AppointmentScheduler = ({ provider, onClose, onAppointmentBooked }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [appointmentType, setAppointmentType] = useState('in-person');
  const [reason, setReason] = useState('');
  const [patientInfo, setPatientInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    insurance: ''
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [confirmation, setConfirmation] = useState(null);

  const appointmentTypes = [
    { value: 'in-person', label: 'In-Person Visit', icon: MapPin, price: provider.price },
    { value: 'video', label: 'Video Consultation', icon: Video, price: provider.price - 50 }
  ];

  const timeSlots = [
    '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM'
  ];

  useEffect(() => {
    generateAvailableSlots();
  }, [currentMonth]);

  const generateAvailableSlots = () => {
    const slots = [];
    const startDate = startOfWeek(currentMonth);
    
    for (let i = 0; i < 35; i++) {
      const date = addDays(startDate, i);
      
      if (isBefore(date, new Date()) && !isToday(date)) continue;
      
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      const daySlots = timeSlots.map(time => ({
        date,
        time,
        available: Math.random() > 0.3
      }));
      
      slots.push(...daySlots);
    }
    
    setAvailableSlots(slots);
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const isDateAvailable = (date) => {
    if (!date || isBefore(date, new Date()) && !isToday(date)) return false;
    if (date.getDay() === 0 || date.getDay() === 6) return false;
    
    return availableSlots.some(slot => 
      isSameDay(slot.date, date) && slot.available
    );
  };

  const getTimeSlotsForDate = (date) => {
    return availableSlots.filter(slot => 
      isSameDay(slot.date, date) && slot.available
    );
  };

  const handleDateSelect = (date) => {
    if (isDateAvailable(date)) {
      setSelectedDate(date);
      setSelectedTime(null);
    }
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
  };

  const handleNext = () => {
    if (step === 1 && selectedDate && selectedTime) {
      setStep(2);
    } else if (step === 2 && appointmentType) {
      setStep(3);
    } else if (step === 3 && validatePatientInfo()) {
      setStep(4);
    }
  };

  const validatePatientInfo = () => {
    return patientInfo.firstName && patientInfo.lastName && 
           patientInfo.email && patientInfo.phone && patientInfo.dateOfBirth;
  };

  const handleBooking = async () => {
    setLoading(true);
    
    try {
      const appointment = {
        provider: provider.name,
        providerId: provider.id,
        date: selectedDate,
        time: selectedTime,
        type: appointmentType,
        reason,
        patientInfo,
        price: appointmentTypes.find(t => t.value === appointmentType).price,
        createdAt: new Date()
      };
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setConfirmation(appointment);
      setStep(5);
      
      if (onAppointmentBooked) {
        onAppointmentBooked(appointment);
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCalendar = () => {
    const days = getDaysInMonth();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <h3 className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => (
            <div key={index} className="aspect-square">
              {day && (
                <button
                  onClick={() => handleDateSelect(day)}
                  disabled={!isDateAvailable(day)}
                  className={`w-full h-full rounded-lg border-2 transition-all ${
                    selectedDate && isSameDay(day, selectedDate)
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : isDateAvailable(day)
                      ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <div className="text-sm font-medium">
                    {format(day, 'd')}
                  </div>
                  {isToday(day) && (
                    <div className="text-xs text-blue-600">Today</div>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTimeSlots = () => {
    const slots = selectedDate ? getTimeSlotsForDate(selectedDate) : [];
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">
          Available Times for {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          {slots.map((slot, index) => (
            <button
              key={index}
              onClick={() => handleTimeSelect(slot.time)}
              className={`py-3 px-4 rounded-lg border-2 transition-all ${
                selectedTime === slot.time
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{slot.time}</span>
              </div>
            </button>
          ))}
        </div>
        
        {slots.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No available time slots for this date</p>
          </div>
        )}
      </div>
    );
  };

  const renderAppointmentType = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Select Appointment Type</h3>
        
        <div className="space-y-4">
          {appointmentTypes.map(type => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                onClick={() => setAppointmentType(type.value)}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  appointmentType === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Icon className="w-6 h-6 text-gray-600" />
                    <div className="text-left">
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-gray-600">
                        {type.value === 'video' ? 'Online video consultation' : 'In-person visit at office'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${type.price}</div>
                    {type.value === 'video' && (
                      <div className="text-sm text-green-600">Save $50</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Visit (Optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please describe your symptoms or reason for this visit..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>
      </div>
    );
  };

  const renderPatientInfo = () => {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Patient Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              value={patientInfo.firstName}
              onChange={(e) => setPatientInfo({...patientInfo, firstName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="John"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              value={patientInfo.lastName}
              onChange={(e) => setPatientInfo({...patientInfo, lastName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Doe"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={patientInfo.email}
              onChange={(e) => setPatientInfo({...patientInfo, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="john.doe@email.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone *
            </label>
            <input
              type="tel"
              value={patientInfo.phone}
              onChange={(e) => setPatientInfo({...patientInfo, phone: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="(555) 123-4567"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date of Birth *
            </label>
            <input
              type="date"
              value={patientInfo.dateOfBirth}
              onChange={(e) => setPatientInfo({...patientInfo, dateOfBirth: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Insurance Provider
            </label>
            <input
              type="text"
              value={patientInfo.insurance}
              onChange={(e) => setPatientInfo({...patientInfo, insurance: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Blue Cross Blue Shield"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmation = () => {
    if (!confirmation) return null;
    
    const selectedType = appointmentTypes.find(t => t.value === appointmentType);
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Appointment Confirmed!</h3>
          <p className="text-gray-600">Your appointment has been successfully booked</p>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-600">Provider:</span>
            <span className="font-semibold">{confirmation.provider}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-600">Date:</span>
            <span className="font-semibold">{format(confirmation.date, 'MMMM d, yyyy')}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-600">Time:</span>
            <span className="font-semibold">{confirmation.time}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-600">Type:</span>
            <span className="font-semibold">{selectedType.label}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-600">Patient:</span>
            <span className="font-semibold">
              {confirmation.patientInfo.firstName} {confirmation.patientInfo.lastName}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-600">Total Cost:</span>
            <span className="font-semibold text-lg">${confirmation.price}</span>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">What happens next?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>You'll receive a confirmation email shortly</li>
                <li>Add this appointment to your calendar</li>
                <li>Arrive 15 minutes early for your first visit</li>
                <li>Bring your insurance card and photo ID</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex space-x-3">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Print Confirmation
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Book Appointment</h2>
                <p className="text-gray-600 mt-1">
                  with {provider.name} • {provider.credentials}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center mt-4 space-x-4">
              {[1, 2, 3, 4, 5].map(num => (
                <div
                  key={num}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    num <= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-6">
            {step === 1 && (
              <div className="space-y-6">
                {renderCalendar()}
                {selectedDate && renderTimeSlots()}
                
                <div className="flex justify-end">
                  <button
                    onClick={handleNext}
                    disabled={!selectedDate || !selectedTime}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            
            {step === 2 && (
              <div className="space-y-6">
                {renderAppointmentType()}
                
                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!appointmentType}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            
            {step === 3 && (
              <div className="space-y-6">
                {renderPatientInfo()}
                
                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!validatePatientInfo()}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            
            {step === 4 && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Review & Confirm</h3>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Appointment Details</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Provider:</span>
                          <p className="font-medium">{provider.name}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Date & Time:</span>
                          <p className="font-medium">
                            {selectedDate && format(selectedDate, 'MMMM d, yyyy')} at {selectedTime}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <p className="font-medium">
                            {appointmentTypes.find(t => t.value === appointmentType)?.label}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Cost:</span>
                          <p className="font-medium">
                            ${appointmentTypes.find(t => t.value === appointmentType)?.price}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Patient Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Name:</span>
                          <p className="font-medium">
                            {patientInfo.firstName} {patientInfo.lastName}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Email:</span>
                          <p className="font-medium">{patientInfo.email}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Phone:</span>
                          <p className="font-medium">{patientInfo.phone}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Date of Birth:</span>
                          <p className="font-medium">{patientInfo.dateOfBirth}</p>
                        </div>
                      </div>
                    </div>
                    
                    {reason && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">Reason for Visit</h4>
                        <p className="text-sm text-gray-700">{reason}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(3)}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleBooking}
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Booking...
                      </>
                    ) : (
                      'Confirm Appointment'
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {step === 5 && renderConfirmation()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentScheduler;
