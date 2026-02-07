/**
 * Download Page
 * Download templates and sample files with TailwindCSS styling
 */

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';

const DownloadPage = () => {
  const [loading, setLoading] = useState({});

  const handleDownload = async (type, filename) => {
    setLoading(prev => ({ ...prev, [type]: true }));
    try {
      let blob;
      switch (type) {
        case 'template':
          blob = await api.downloadTemplate();
          break;
        default:
          toast.error('Unknown download type');
          return;
      }
      api.triggerFileDownload(blob, filename);
      toast.success(`${filename} downloaded successfully`);
    } catch (error) {
      toast.error(`Failed to download ${filename}`);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const downloadItems = [
    {
      id: 'template',
      title: 'GSTR-1 Excel Template',
      description: 'Official GSTN template for uploading sales data. Contains sheets for B2B, B2CL, B2CS, EXP, and CDNR.',
      icon: (
        <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      filename: 'GSTR1_Template.xlsx',
      color: 'blue',
    },
    {
      id: 'sample',
      title: 'Sample Data File',
      description: 'Example Excel file with sample sales data for testing the upload functionality.',
      icon: (
        <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
        </svg>
      ),
      filename: 'Sample_Sales_Data.xlsx',
      color: 'green',
    },
    {
      id: 'documentation',
      title: 'User Guide',
      description: 'Comprehensive documentation on using the Virtual CA platform for GST compliance.',
      icon: (
        <svg className="w-12 h-12 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      filename: 'User_Guide.pdf',
      color: 'cyan',
    },
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
      green: 'bg-green-50 hover:bg-green-100 border-green-200',
      cyan: 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200',
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Downloads</h1>
          <p className="text-gray-600">Download templates and documentation for GST compliance</p>
        </div>

        {/* Download Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {downloadItems.map(item => (
            <div
              key={item.id}
              className={`rounded-xl border p-6 transition-all ${getColorClasses(item.color)}`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                <button
                  onClick={() => handleDownload(item.id, item.filename)}
                  disabled={loading[item.id]}
                  className={`w-full py-2 px-4 rounded-lg font-medium text-white transition-all
                    ${loading[item.id]
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                    }`}
                >
                  {loading[item.id] ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Downloading...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Start Guide */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Quick Start Guide</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                1
              </div>
              <div className="ml-4">
                <h4 className="font-semibold text-gray-800">Download Template</h4>
                <p className="text-sm text-gray-600 mt-1">Download the official GSTR-1 Excel template</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                2
              </div>
              <div className="ml-4">
                <h4 className="font-semibold text-gray-800">Fill Your Data</h4>
                <p className="text-sm text-gray-600 mt-1">Enter sales data in respective sheets</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                3
              </div>
              <div className="ml-4">
                <h4 className="font-semibold text-gray-800">Upload File</h4>
                <p className="text-sm text-gray-600 mt-1">Upload completed Excel on Upload page</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                4
              </div>
              <div className="ml-4">
                <h4 className="font-semibold text-gray-800">Download Reports</h4>
                <p className="text-sm text-gray-600 mt-1">Get GSTR-3B summary and GSTR-1 JSON</p>
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Need Help?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h4 className="font-semibold text-gray-800 mb-1">Documentation</h4>
              <p className="text-sm text-gray-600">Check our comprehensive user guide</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="font-semibold text-gray-800 mb-1">FAQ</h4>
              <p className="text-sm text-gray-600">Find answers to common questions</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <svg className="w-8 h-8 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h4 className="font-semibold text-gray-800 mb-1">Support</h4>
              <p className="text-sm text-gray-600">Contact our support team</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
