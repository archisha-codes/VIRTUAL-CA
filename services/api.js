/**
 * API Client for Virtual CA GSTR Processing System
 * Uses Axios for HTTP communication with FastAPI backend
 */

import axios from 'axios';

// Configure axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 60000, // 60 seconds for file uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Login to get JWT token
 */
export const login = async (username, password) => {
  const response = await api.post('/login', { username, password });
  return response.data;
};

/**
 * Get current user info from token
 */
export const getCurrentUser = async (token) => {
  const response = await api.get('/me');
  return response.data;
};

/**
 * Logout (clear local storage)
 */
export const logout = () => {
  localStorage.removeItem('token');
};

/**
 * Upload GSTR Excel file for processing
 */
export const uploadExcel = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await api.post('/upload-sales-excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      return error.response.data;
    }
    throw error;
  }
};

/**
 * Download GSTR-1 data as JSON
 */
export const downloadGSTR1JSON = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/download-gstr1-json', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    responseType: 'blob',
  });
  
  return response.data;
};

/**
 * Download GSTR-1 data as Excel
 */
export const downloadGSTR1Excel = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/download-gstr1-excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    responseType: 'blob',
  });
  
  return response.data;
};

/**
 * Download GSTR-3B Excel
 */
export const downloadGSTR3BExcel = async () => {
  const response = await api.get('/download-gstr3b-excel', {
    responseType: 'blob',
  });
  
  return response.data;
};

/**
 * Download GSTR-3B JSON
 */
export const downloadGSTR3BJSON = async () => {
  const response = await api.get('/download-gstr1-json', {
    responseType: 'blob',
  });
  
  return response.data;
};

/**
 * Download GSTR-1 Excel template
 */
export const downloadTemplate = async () => {
  const response = await api.get('/gstr1-template-download', {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Get template format specification
 */
export const getTemplateFormat = async () => {
  const response = await api.get('/gstr1-template-format');
  return response.data;
};

/**
 * Get validation error codes reference
 */
export const getValidationErrors = async () => {
  const response = await api.get('/validation-errors');
  return response.data;
};

/**
 * Health check endpoint
 */
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

/**
 * Get audit logs (admin only)
 */
export const getAuditLogs = async (action = null, limit = 100) => {
  const params = { limit };
  if (action) params.action = action;
  const response = await api.get('/audit-logs', { params });
  return response.data;
};

/**
 * Download errors as CSV
 */
export const downloadErrorsCSV = async (errors) => {
  const response = await api.post('/export-errors-csv', 
    { errors },
    { responseType: 'blob' }
  );
  return response.data;
};

// Helper function to trigger file download
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export default api;
