import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AuthGate from './components/AuthGate';
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
    <AuthGate>
      {({ user, signOut }) => (
        <DbProvider db={db}>
          <App userEmail={user.email} onSignOut={signOut} />
        </DbProvider>
      )}
    </AuthGate>
  </React.StrictMode>
);