/**
 * Virtual CA - GST Compliance System
 * Main React Application Entry Point
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import UploadPage from './pages/UploadPage';
import SummaryPage from './pages/SummaryPage';
import ErrorLogPage from './pages/ErrorLogPage';
import DownloadPage from './pages/DownloadPage';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Styles
import './index.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
              <Route path="/summary" element={<ProtectedRoute><SummaryPage /></ProtectedRoute>} />
              <Route path="/errors" element={<ProtectedRoute><ErrorLogPage /></ProtectedRoute>} />
              <Route path="/download" element={<ProtectedRoute><DownloadPage /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
