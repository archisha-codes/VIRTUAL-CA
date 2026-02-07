/**
 * Summary Page
 * Displays GSTR-3B summary data with TailwindCSS styling
 */

import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { SummaryTable, DownloadButtons } from '../components';
import api from '../services/api';

const SummaryPage = () => {
  const location = useLocation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.summary) {
      setSummary(location.state.summary);
    } else {
      toast.error('No summary data available');
    }
  }, [location.state]);

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '0.00';
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Data Available</h2>
          <p className="text-gray-500 mb-4">Please upload a file first to generate the summary.</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">GSTR-3B Summary</h1>
          <p className="text-gray-600">Summary of supplies for the tax period</p>
        </div>

        {/* Download Buttons */}
        <DownloadButtons
          gstr1Data={summary}
          gstr3bData={summary.gstr3b}
          companyGstin=""
          returnPeriod=""
        />

        {/* Summary Table */}
        <SummaryTable
          gstr1Summary={summary}
          gstr3bSummary={summary.gstr3b}
        />

        {/* Summary Stats Cards */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 mb-1">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-800">
              {summary.total_invoices || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 mb-1">Total Taxable Value</p>
            <p className="text-2xl font-bold text-gray-800 font-mono">
              ₹{formatCurrency(summary.total_taxable_value)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 mb-1">Total IGST</p>
            <p className="text-2xl font-bold text-blue-600 font-mono">
              ₹{formatCurrency(summary.total_igst)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500 mb-1">Total CGST + SGST</p>
            <p className="text-2xl font-bold text-green-600 font-mono">
              ₹{formatCurrency(summary.total_cgst + summary.total_sgst)}
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-semibold text-blue-800 mb-1">Note</h4>
              <p className="text-sm text-blue-700">
                This is a summary generated from your uploaded data. Please verify all amounts before filing.
                For official filing, please login to the GST Portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
