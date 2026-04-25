import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ABTestingProvider } from './contexts/ABTestingContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ABTestingProvider>
      <App />
    </ABTestingProvider>
  </React.StrictMode>
);
