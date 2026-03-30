import React from 'react';
import { createRoot } from 'react-dom/client';
import './i18n'; // Import i18n configuration
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

