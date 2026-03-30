import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunks
export const fetchPayments = createAsyncThunk(
  'payments/fetchPayments',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get('https://api.healthcare.com/payments', {
        params,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const processPayment = createAsyncThunk(
  'payments/processPayment',
  async (paymentData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        'https://api.healthcare.com/payments/process',
        paymentData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const getPaymentMethods = createAsyncThunk(
  'payments/getPaymentMethods',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('https://api.healthcare.com/payments/methods');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const addPaymentMethod = createAsyncThunk(
  'payments/addPaymentMethod',
  async (methodData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        'https://api.healthcare.com/payments/methods',
        methodData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const deletePaymentMethod = createAsyncThunk(
  'payments/deletePaymentMethod',
  async (methodId, { rejectWithValue }) => {
    try {
      await axios.delete(`https://api.healthcare.com/payments/methods/${methodId}`);
      return methodId;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const getPremiumDrips = createAsyncThunk(
  'payments/getPremiumDrips',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('https://api.healthcare.com/payments/premium-drips');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const createPremiumDrip = createAsyncThunk(
  'payments/createPremiumDrip',
  async (dripData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        'https://api.healthcare.com/payments/premium-drips',
        dripData
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const initialState = {
  payments: [],
  paymentMethods: [],
  premiumDrips: [],
  isLoading: false,
  error: null,
  selectedPaymentMethod: null,
  paymentProcessing: false,
  paymentSuccess: null,
};

const paymentSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedPaymentMethod: (state, action) => {
      state.selectedPaymentMethod = action.payload;
    },
    clearPaymentSuccess: (state) => {
      state.paymentSuccess = null;
    },
    setPaymentProcessing: (state, action) => {
      state.paymentProcessing = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Payments
      .addCase(fetchPayments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payments = action.payload;
        state.error = null;
      })
      .addCase(fetchPayments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Process Payment
      .addCase(processPayment.pending, (state) => {
        state.paymentProcessing = true;
        state.error = null;
      })
      .addCase(processPayment.fulfilled, (state, action) => {
        state.paymentProcessing = false;
        state.payments.unshift(action.payload);
        state.paymentSuccess = true;
        state.error = null;
      })
      .addCase(processPayment.rejected, (state, action) => {
        state.paymentProcessing = false;
        state.error = action.payload;
        state.paymentSuccess = false;
      })
      // Get Payment Methods
      .addCase(getPaymentMethods.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getPaymentMethods.fulfilled, (state, action) => {
        state.isLoading = false;
        state.paymentMethods = action.payload;
        state.error = null;
      })
      .addCase(getPaymentMethods.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Add Payment Method
      .addCase(addPaymentMethod.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addPaymentMethod.fulfilled, (state, action) => {
        state.isLoading = false;
        state.paymentMethods.push(action.payload);
        state.error = null;
      })
      .addCase(addPaymentMethod.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Delete Payment Method
      .addCase(deletePaymentMethod.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deletePaymentMethod.fulfilled, (state, action) => {
        state.isLoading = false;
        state.paymentMethods = state.paymentMethods.filter(
          method => method.id !== action.payload
        );
        state.error = null;
      })
      .addCase(deletePaymentMethod.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get Premium Drips
      .addCase(getPremiumDrips.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getPremiumDrips.fulfilled, (state, action) => {
        state.isLoading = false;
        state.premiumDrips = action.payload;
        state.error = null;
      })
      .addCase(getPremiumDrips.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Create Premium Drip
      .addCase(createPremiumDrip.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPremiumDrip.fulfilled, (state, action) => {
        state.isLoading = false;
        state.premiumDrips.push(action.payload);
        state.error = null;
      })
      .addCase(createPremiumDrip.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  clearError,
  setSelectedPaymentMethod,
  clearPaymentSuccess,
  setPaymentProcessing,
} = paymentSlice.actions;

export default paymentSlice.reducer;
