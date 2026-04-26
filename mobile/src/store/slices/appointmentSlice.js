import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunks
export const fetchAppointments = createAsyncThunk(
  'appointments/fetchAppointments',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get('https://api.healthcare.com/appointments', {
        params,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const bookAppointment = createAsyncThunk(
  'appointments/bookAppointment',
  async (appointmentData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        'https://api.healthcare.com/appointments',
        appointmentData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const updateAppointment = createAsyncThunk(
  'appointments/updateAppointment',
  async ({ appointmentId, updateData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(
        `https://api.healthcare.com/appointments/${appointmentId}`,
        updateData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const cancelAppointment = createAsyncThunk(
  'appointments/cancelAppointment',
  async (appointmentId, { rejectWithValue }) => {
    try {
      await axios.delete(`https://api.healthcare.com/appointments/${appointmentId}`);
      return appointmentId;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const getAvailableSlots = createAsyncThunk(
  'appointments/getAvailableSlots',
  async ({ providerId, date }, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `https://api.healthcare.com/providers/${providerId}/available-slots`,
        { params: { date } }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const initialState = {
  appointments: [],
  currentAppointment: null,
  availableSlots: [],
  isLoading: false,
  error: null,
  bookingStep: 1,
  selectedProvider: null,
  selectedDate: null,
  selectedTime: null,
  bookingData: {},
};

const appointmentSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setBookingStep: (state, action) => {
      state.bookingStep = action.payload;
    },
    setSelectedProvider: (state, action) => {
      state.selectedProvider = action.payload;
    },
    setSelectedDate: (state, action) => {
      state.selectedDate = action.payload;
    },
    setSelectedTime: (state, action) => {
      state.selectedTime = action.payload;
    },
    setBookingData: (state, action) => {
      state.bookingData = { ...state.bookingData, ...action.payload };
    },
    clearBookingData: (state) => {
      state.bookingStep = 1;
      state.selectedProvider = null;
      state.selectedDate = null;
      state.selectedTime = null;
      state.bookingData = {};
      state.availableSlots = [];
    },
    clearCurrentAppointment: (state) => {
      state.currentAppointment = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Appointments
      .addCase(fetchAppointments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAppointments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appointments = action.payload;
        state.error = null;
      })
      .addCase(fetchAppointments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Book Appointment
      .addCase(bookAppointment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(bookAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appointments.unshift(action.payload);
        state.error = null;
        state.bookingData = {};
      })
      .addCase(bookAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Update Appointment
      .addCase(updateAppointment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.appointments.findIndex(
          apt => apt.id === action.payload.id
        );
        if (index !== -1) {
          state.appointments[index] = action.payload;
        }
        state.error = null;
      })
      .addCase(updateAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Cancel Appointment
      .addCase(cancelAppointment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(cancelAppointment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.appointments = state.appointments.filter(
          apt => apt.id !== action.payload
        );
        state.error = null;
      })
      .addCase(cancelAppointment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get Available Slots
      .addCase(getAvailableSlots.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAvailableSlots.fulfilled, (state, action) => {
        state.isLoading = false;
        state.availableSlots = action.payload;
        state.error = null;
      })
      .addCase(getAvailableSlots.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  clearError,
  setBookingStep,
  setSelectedProvider,
  setSelectedDate,
  setSelectedTime,
  setBookingData,
  clearBookingData,
  clearCurrentAppointment,
} = appointmentSlice.actions;

export default appointmentSlice.reducer;
