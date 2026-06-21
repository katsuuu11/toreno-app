import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const isCapacitorNativeRuntime = () =>
  window.Capacitor?.isNativePlatform?.() === true ||
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'ionic:';

if (!isCapacitorNativeRuntime() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
