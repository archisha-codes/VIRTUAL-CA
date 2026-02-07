/**
 * Error Log Page
 * Displays validation errors from file processing with TailwindCSS styling
 */

import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ErrorPanel } from '../components';
import api from '../services/api';

const ErrorLogPage = () => {
  const location = useLocation();
  const [errors, setErrors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.errors) {
      setErrors(location.state.errors);
      setSummary(location.state.summary);
    } else {
      toast.error('No error data available');
    }
  }, [location.state]);

  const handleExportErrors = async () => {
    setLoading(true);
    try {
      const blob = await api.exportErrorsCSV(errors);
      api.triggerFileDownload(blob, `Validation_Errors_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('Error log downloaded');
    } catch (error) {
      toast.error('Failed to download error log');
    } finally {
      setLoading(false);
    }
  };

  if (!errors.length && !summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Errors</h2>
          <p className="text-gray-500 mb-4">Your file was processed without any validation errors.</p>
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go to Upload
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Upload
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Validation Errors</h1>
          <p className="text-gray-600">Issues found during file processing</p>
        </div>

        {/* Error Panel */}
        <ErrorPanel
          errors={errors}
          onDismiss={() => setErrors([])}
          onExport={handleExportErrors}
        />

        {/* Summary Link */}
        {summary && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700">
                File was partially processed. View the generated summary:
              </p>
              <Link
                to="/summary"
                state={{ summary }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                View Summary
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorLogPage;
