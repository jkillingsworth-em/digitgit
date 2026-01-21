import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { DbProvider } from './context/DbContext';
import { db } from './firebase';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <DbProvider db={db}>
      <App />
    </DbProvider>
  </React.StrictMode>
);