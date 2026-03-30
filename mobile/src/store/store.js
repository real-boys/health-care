import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import providerSlice from './slices/providerSlice';
import appointmentSlice from './slices/appointmentSlice';
import paymentSlice from './slices/paymentSlice';
import notificationSlice from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    providers: providerSlice,
    appointments: appointmentSlice,
    payments: paymentSlice,
    notifications: notificationSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
