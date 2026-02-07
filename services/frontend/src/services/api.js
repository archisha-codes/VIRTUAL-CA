/**
 * API Service for GSTR operations
 * Handles all API calls to the backend
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Create axios instance with default config
 */
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Upload GSTR Excel file for processing
 * @param {File} file - Excel file to upload
 * @param {Object} params - Optional parameters (company_gstin, return_period)
 * @returns {Promise<Object>} - Response with summary and errors
 */
export const uploadGSTRFile = async (file, params = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  
  if (params.company_gstin) {
    formData.append('company_gstin', params.company_gstin);
  }
  
  if (params.return_period) {
    formData.append('return_period', params.return_period);
  }

  const response = await apiClient.post('/upload-sales-excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

/**
 * Download GSTR-1 JSON file
 * @param {string} gstin - GSTIN of taxpayer
 * @param {string} returnPeriod - Return period in MM/YYYY format
 * @returns {Promise<Blob>} - JSON file blob
 */
export const downloadGSTR1JSON = async (gstin, returnPeriod) => {
  const response = await apiClient.get('/download-gstr1-json', {
    params: {
      gstin,
      return_period: returnPeriod,
    },
    responseType: 'blob',
  });
  
  return response.data;
};

/**
 * Download GSTR-3B Excel file
 * @param {string} gstin - GSTIN of taxpayer
 * @param {string} returnPeriod - Return period in MM/YYYY format
 * @param {string} companyGstin - Company's GSTIN (optional)
 * @returns {Promise<Blob>} - Excel file blob
 */
export const downloadGSTR3BExcel = async (gstin, returnPeriod, companyGstin = '') => {
  const response = await apiClient.get('/download-gstr3b-excel', {
    params: {
      gstin,
      return_period: returnPeriod,
      company_gstin: companyGstin,
    },
    responseType: 'blob',
  });
  
  return response.data;
};

/**
 * Download template file
 * @param {string} type - Template type (gstr1, etc.)
 * @returns {Promise<Blob>} - Excel template blob
 */
export const downloadTemplate = async (type = 'gstr1') => {
  const response = await apiClient.get('/gstr1-template-download', {
    responseType: 'blob',
  });
  
  return response.data;
};

/**
 * Get template format information
 * @returns {Promise<Object>} - Template format details
 */
export const getTemplateFormat = async () => {
  const response = await apiClient.get('/gstr1-template-format');
  return response.data;
};

/**
 * Get list of validation error codes
 * @returns {Promise<Object>} - Error codes dictionary
 */
export const getValidationErrors = async () => {
  const response = await apiClient.get('/validation-errors');
  return response.data;
};

/**
 * Validate rows directly without file upload
 * @param {Array<Object>} rows - Array of row data to validate
 * @param {string} companyGstin - Company GSTIN (optional)
 * @param {string} sectionHint - Section hint for all rows (optional)
 * @returns {Promise<Object>} - Validation result
 */
export const validateRows = async (rows, companyGstin = '', sectionHint = '') => {
  const response = await apiClient.post('/validate-rows', {
    rows,
    company_gstin: companyGstin,
    section_hint: sectionHint,
  });
  
  return response.data;
};

/**
 * Export errors as CSV
 * @param {Array<Object>} errors - Array of error objects
 * @returns {Promise<Blob>} - CSV file blob
 */
export const exportErrorsCSV = async (errors) => {
  const response = await apiClient.post('/export-errors-csv', {
    errors,
  }, {
    responseType: 'blob',
  });
  
  return response.data;
};

/**
 * Helper function to trigger file download from blob
 * @param {Blob} blob - File blob
 * @param {string} filename - Desired filename
 */
export const triggerFileDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Helper to format file size
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size string
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default {
  uploadGSTRFile,
  downloadGSTR1JSON,
  downloadGSTR3BExcel,
  downloadTemplate,
  getTemplateFormat,
  getValidationErrors,
  validateRows,
  exportErrorsCSV,
  triggerFileDownload,
  formatFileSize,
};
