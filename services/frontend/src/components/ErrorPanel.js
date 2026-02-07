/**
 * ErrorPanel Component
 * Display validation errors with TailwindCSS styling
 */

import React, { useState } from 'react';
import { ErrorPanelPropTypes } from './propTypes';

const ErrorPanel = ({ errors, onDismiss, onExport }) => {
  const [filter, setFilter] = useState('all');

  if (!errors || errors.length === 0) return null;

  const errorCounts = {
    all: errors.length,
    critical: errors.filter(e => ['CRITICAL', 'ERROR'].includes(e.severity)).length,
    warning: errors.filter(e => e.severity === 'WARNING').length,
  };

  const filteredErrors = errors.filter(error => {
    if (filter === 'all') return true;
    if (filter === 'critical') return ['CRITICAL', 'ERROR'].includes(error.severity);
    if (filter === 'warning') return error.severity === 'WARNING';
    return true;
  });

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'ERROR':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'ERROR':
        return (
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'WARNING':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h2 className="text-white text-lg font-semibold">
                  Validation Errors Found
                </h2>
                <p className="text-red-100 text-sm">
                  {errors.length} error{errors.length !== 1 ? 's' : ''} detected in your file
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              {onExport && (
                <button
                  onClick={onExport}
                  className="px-4 py-2 bg-white text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="p-2 text-white hover:text-red-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="border-b border-gray-200 px-6 py-3 bg-gray-50">
          <div className="flex space-x-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${filter === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
            >
              All ({errorCounts.all})
            </button>
            <button
              onClick={() => setFilter('critical')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${filter === 'critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-red-50 border border-red-200'
                }`}
            >
              Critical ({errorCounts.critical})
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${filter === 'warning'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-yellow-50 border border-yellow-200'
                }`}
            >
              Warnings ({errorCounts.warning})
            </button>
          </div>
        </div>

        {/* Error List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredErrors.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No errors match the current filter</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredErrors.map((error, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-0.5">
                      {getSeverityIcon(error.severity)}
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(error.severity)}`}>
                            {error.severity}
                          </span>
                          {error.row && (
                            <span className="text-sm text-gray-500">
                              Row {error.row}
                            </span>
                          )}
                          {error.section && (
                            <span className="text-sm text-gray-500">
                              ({error.section})
                            </span>
                          )}
                        </div>
                        {error.error_code && (
                          <span className="text-xs text-gray-400 font-mono">
                            {error.error_code}
                          </span>
                        )}
                      </div>
                      {error.field && (
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">Field:</span> {error.field}
                        </p>
                      )}
                      <p className="text-sm text-gray-800">
                        {error.error || error.message}
                      </p>
                      {error.suggestion && (
                        <p className="text-xs text-blue-600 mt-2">
                          💡 {error.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

ErrorPanel.propTypes = ErrorPanelPropTypes;

export default ErrorPanel;
