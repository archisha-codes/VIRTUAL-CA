/**
 * Upload Page
 * Upload Excel files for GSTR processing with TailwindCSS styling
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { UploadForm, ErrorPanel, DownloadButtons } from '../components';
import api from '../services/api';

const UploadPage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const navigate = useNavigate();

  const handleUpload = useCallback(async (result) => {
    if (result.errors && result.errors.length > 0) {
      setErrors(result.errors);
      if (result.warnings) {
        setWarnings(result.warnings);
      }
      toast.warning(`Processed with ${result.errors.length} validation errors`);
      // Stay on page to show errors
    } else {
      setSummary(result.summary);
      toast.success('File processed successfully!');
      // Navigate to summary page
      navigate('/summary', { state: { summary: result.summary } });
    }
  }, [navigate]);

  const handleError = useCallback((errorList) => {
    setErrors(errorList);
  }, []);

  const handleSuccess = useCallback((result) => {
    setSummary(result.summary || result);
    setErrors([]);
  }, []);

  const handleDismissErrors = useCallback(() => {
    setErrors([]);
    setWarnings([]);
  }, []);

  const handleExportErrors = useCallback(async () => {
    try {
      const blob = await api.exportErrorsCSV(errors);
      api.triggerFileDownload(blob, `validation_errors_${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('Errors exported successfully');
    } catch (error) {
      toast.error('Failed to export errors');
    }
  }, [errors]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Upload GSTR Excel File
          </h1>
          <p className="text-gray-600">
            Upload your sales data Excel file to generate GSTR-1 and GSTR-3B summaries
          </p>
        </div>

        {/* Upload Form */}
        <UploadForm
          onUpload={handleUpload}
          onSuccess={handleSuccess}
          onError={handleError}
          uploading={uploading}
          setUploading={setUploading}
        />

        {/* Error Panel */}
        {errors.length > 0 && (
          <ErrorPanel
            errors={errors}
            onDismiss={handleDismissErrors}
            onExport={handleExportErrors}
          />
        )}

        {/* Download Buttons */}
        {summary && (
          <DownloadButtons
            gstr1Data={summary}
            gstr3bData={summary.gstr3b}
            companyGstin=""
            returnPeriod=""
          />
        )}

        {/* Tips Section */}
        {!selectedFile && !summary && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Tips for Successful Upload
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-600">
                  Use the official GSTN template for best results
                </p>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-600">
                  Ensure all required columns are present
                </p>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-600">
                  GSTIN should be in valid 15-character format
                </p>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-600">
                  Invoice dates should be in DD/MM/YYYY format
                </p>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-600">
                  Tax amounts should match calculated values
                </p>
              </div>
              <div className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-gray-600">
                  All numeric fields should be positive numbers
                </p>
              </div>
            </div>

            {/* Required Sheets */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Required Excel Sheets:
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <span className="font-semibold text-blue-700">B2B</span>
                  <p className="text-xs text-blue-600 mt-1">Business to Business invoices</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <span className="font-semibold text-green-700">B2CL</span>
                  <p className="text-xs text-green-600 mt-1">B2C Large (&gt;₹2.5 lakh)</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <span className="font-semibold text-purple-700">B2CS</span>
                  <p className="text-xs text-purple-600 mt-1">B2C Small/Others</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <span className="font-semibold text-orange-700">EXP</span>
                  <p className="text-xs text-orange-600 mt-1">Export invoices</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-semibold text-yellow-800">
                Warnings ({warnings.length})
              </h3>
            </div>
            <ul className="text-sm text-yellow-700 space-y-1">
              {warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
