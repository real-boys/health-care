import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunks
export const fetchProviders = createAsyncThunk(
  'providers/fetchProviders',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const response = await axios.get('https://api.healthcare.com/providers', {
        params: filters,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const searchProviders = createAsyncThunk(
  'providers/searchProviders',
  async (searchParams, { rejectWithValue }) => {
    try {
      const response = await axios.get('https://api.healthcare.com/providers/search', {
        params: searchParams,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const getProviderById = createAsyncThunk(
  'providers/getProviderById',
  async (providerId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`https://api.healthcare.com/providers/${providerId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const getProviderReviews = createAsyncThunk(
  'providers/getProviderReviews',
  async (providerId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`https://api.healthcare.com/providers/${providerId}/reviews`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

export const submitReview = createAsyncThunk(
  'providers/submitReview',
  async ({ providerId, review }, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `https://api.healthcare.com/providers/${providerId}/reviews`,
        review
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const initialState = {
  providers: [],
  currentProvider: null,
  reviews: [],
  isLoading: false,
  error: null,
  filters: {
    specialty: '',
    rating: '',
    priceRange: '',
    availability: '',
    location: '',
  },
  searchResults: [],
  hasSearched: false,
};

const providerSlice = createSlice({
  name: 'providers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearCurrentProvider: (state) => {
      state.currentProvider = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.hasSearched = false;
    },
    updateProviderFavorite: (state, action) => {
      const { providerId, isFavorite } = action.payload;
      const provider = state.providers.find(p => p.id === providerId);
      if (provider) {
        provider.isFavorite = isFavorite;
      }
      if (state.currentProvider && state.currentProvider.id === providerId) {
        state.currentProvider.isFavorite = isFavorite;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Providers
      .addCase(fetchProviders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProviders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.providers = action.payload;
        state.error = null;
      })
      .addCase(fetchProviders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Search Providers
      .addCase(searchProviders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(searchProviders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.searchResults = action.payload;
        state.hasSearched = true;
        state.error = null;
      })
      .addCase(searchProviders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get Provider by ID
      .addCase(getProviderById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getProviderById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentProvider = action.payload;
        state.error = null;
      })
      .addCase(getProviderById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Get Provider Reviews
      .addCase(getProviderReviews.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getProviderReviews.fulfilled, (state, action) => {
        state.isLoading = false;
        state.reviews = action.payload;
        state.error = null;
      })
      .addCase(getProviderReviews.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Submit Review
      .addCase(submitReview.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(submitReview.fulfilled, (state, action) => {
        state.isLoading = false;
        state.reviews.unshift(action.payload);
        state.error = null;
      })
      .addCase(submitReview.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  clearError,
  setFilters,
  clearFilters,
  clearCurrentProvider,
  clearSearchResults,
  updateProviderFavorite,
} = providerSlice.actions;

export default providerSlice.reducer;
