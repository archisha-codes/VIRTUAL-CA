/**
 * DownloadButtons Component
 * Download GSTR files with TailwindCSS styling
 */

import React, { useState } from 'react';
import { DownloadButtonsPropTypes } from './propTypes';
import api from '../services/api';

const DownloadButtons = ({ 
  gstr1Data, 
  gstr3bData, 
  companyGstin, 
  returnPeriod,
  onError 
}) => {
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);

  const handleDownload = async (type) => {
    setDownloading(type);
    setError(null);

    try {
      let blob;
      let filename;

      if (type === 'gstr1') {
        blob = await api.downloadGSTR1JSON(companyGstin, returnPeriod);
        filename = `GSTR1_${companyGstin}_${returnPeriod.replace('/', '_')}.json`;
      } else if (type === 'gstr3b') {
        blob = await api.downloadGSTR3BExcel(companyGstin, returnPeriod);
        filename = `GSTR3B_${companyGstin}_${returnPeriod.replace('/', '_')}.xlsx`;
      }

      if (blob) {
        api.triggerFileDownload(blob, filename);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Download failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setDownloading(null);
    }
  };

  const hasData = (gstr1Data && Object.keys(gstr1Data).length > 0) || 
                  (gstr3bData && Object.keys(gstr3bData).length > 0);

  if (!hasData) return null;

  return (
    <div className="w-full max-w-6xl mx-auto mt-6">
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GSTR-1 JSON Download */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-800">GSTR-1 JSON</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Export GSTR-1 data in GSTN-compatible JSON format
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                {gstr1Data && Object.keys(gstr1Data).length > 0 
                  ? `${Object.keys(gstr1Data).length} sections` 
                  : 'No data'}
              </div>
              <button
                onClick={() => handleDownload('gstr1')}
                disabled={downloading === 'gstr1' || !gstr1Data}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center
                  ${!gstr1Data
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                {downloading === 'gstr1' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download JSON
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* GSTR-3B Excel Download */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-800">GSTR-3B Excel</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Export calculated GSTR-3B liability in Excel format
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                {gstr3bData && Object.keys(gstr3bData).length > 0 
                  ? `${Object.keys(gstr3bData).length} sections` 
                  : 'No data'}
              </div>
              <button
                onClick={() => handleDownload('gstr3b')}
                disabled={downloading === 'gstr3b' || !gstr3bData}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center
                  ${!gstr3bData
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
              >
                {downloading === 'gstr3b' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Options */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Additional Options</h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Summary
          </button>
          <button
            onClick={() => {
              const summary = {
                gstr1: gstr1Data,
                gstr3b: gstr3bData,
                company_gstin: companyGstin,
                return_period: returnPeriod,
                generated_at: new Date().toISOString(),
              };
              api.triggerFileDownload(
                new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' }),
                `summary_${companyGstin}_${returnPeriod.replace('/', '_')}.json`
              );
            }}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Full Summary
          </button>
        </div>
      </div>
    </div>
  );
};

DownloadButtons.propTypes = DownloadButtonsPropTypes;

export default DownloadButtons;
