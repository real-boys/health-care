import React from 'react';
import { createRoot } from 'react-dom/client';
import './i18n'; // Import i18n configuration
import './utils/seoAnalytics'; // Import SEO analytics for tracking
import App from './App';
import './App.css';
import { NetworkProvider } from './chain/NetworkContext';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <NetworkProvider>
      <App />
    </NetworkProvider>
  </React.StrictMode>
);

