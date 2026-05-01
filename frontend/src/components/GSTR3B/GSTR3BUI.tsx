/**
 * GSTR-3B UI Components
 * 
 * Reusable UI components for the GSTR-3B form
 */

import React, { useState, useEffect } from 'react';
import {
  ToastMessage,
  ToastProps,
  ToastContainerProps,
  VarianceWarningModalProps,
  EditFieldProps,
  VarianceAlert,
} from '../types/gstr3b.types';
import {
  formatCurrency,
  formatPercent,
  getStatusColor,
  getStatusDisplayText,
  getVarianceWarningTooltip,
  getFieldHintText,
  isStatusUnavailable,
} from '../utils/gstr3b.utils';

// ============================================================================
// TOAST COMPONENT
// ============================================================================

export const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    if (message.duration && message.duration > 0) {
      const timer = setTimeout(() => onDismiss(message.id), message.duration);
      return () => clearTimeout(timer);
    }
  }, [message.duration, message.id, onDismiss]);

  const bgColorMap = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200',
    success: 'bg-green-50 border-green-200',
  };

  const textColorMap = {
    info: 'text-blue-800',
    warning: 'text-yellow-800',
    error: 'text-red-800',
    success: 'text-green-800',
  };

  const iconMap = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✓',
  };

  return (
    <div className={`p-4 border rounded-lg ${bgColorMap[message.type]} ${textColorMap[message.type]} flex items-start justify-between`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{iconMap[message.type]}</span>
        <div>
          <p className="font-medium">{message.message}</p>
          {message.action && (
            <button
              onClick={message.action.onClick}
              className="mt-2 underline hover:no-underline text-sm font-medium"
            >
              {message.action.label}
            </button>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(message.id)}
        className="text-lg hover:opacity-70 transition-opacity"
      >
        ×
      </button>
    </div>
  );
};

// ============================================================================
// TOAST CONTAINER COMPONENT
// ============================================================================

export const ToastContainer: React.FC<ToastContainerProps> = ({
  messages,
  onDismiss,
  position = 'top-right',
}) => {
  const positionMap = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={`fixed ${positionMap[position]} z-50 max-w-md space-y-2`}>
      {messages.map((message) => (
        <Toast key={message.id} message={message} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

// ============================================================================
// VARIANCE WARNING MODAL
// ============================================================================

export const VarianceWarningModal: React.FC<VarianceWarningModalProps> = ({
  isOpen,
  alert,
  onContinue,
  onRevert,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-yellow-700 mb-2">⚠️ Value Change Alert</h2>
          <p className="text-gray-700 mb-4">
            <strong>{alert.fieldLabel}</strong> has changed by <strong>{formatPercent(alert.variancePercent)}</strong>
          </p>
          
          <div className="bg-gray-50 p-3 rounded mb-4 space-y-2">
            <div>
              <p className="text-sm text-gray-600">Original Value</p>
              <p className="text-lg font-semibold text-gray-800">{formatCurrency(alert.originalValue)}</p>
            </div>
            <div className="text-center text-gray-400">↓</div>
            <div>
              <p className="text-sm text-gray-600">New Value</p>
              <p className="text-lg font-semibold text-gray-800">{formatCurrency(alert.editedValue)}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Variance exceeds the threshold of {formatPercent(alert.threshold)}. 
            Please review the changes to ensure accuracy.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onRevert}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300 transition-colors"
          >
            Revert Change
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded font-medium hover:bg-yellow-700 transition-colors"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// EDIT FIELD COMPONENT
// ============================================================================

export const EditField: React.FC<EditFieldProps> = ({
  label,
  value,
  originalValue,
  unit = '₹',
  onChange,
  hasVariance = false,
  status,
  tooltip,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(formatCurrency(value));
  const [showTooltip, setShowTooltip] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    const numValue = parseFloat(inputValue.replace(/[^\d.-]/g, '')) || 0;
    onChange(Math.max(0, numValue)); // Ensure non-negative
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setInputValue(formatCurrency(value));
      setIsEditing(false);
    }
  };

  const displayValue = formatCurrency(value);
  const isDifferent = value !== originalValue;
  const statusUnavailable = status && isStatusUnavailable(status);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {tooltip && (
          <div className="relative">
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              ?
            </button>
            {showTooltip && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-900 text-white text-xs p-2 rounded shadow-lg z-10">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className={`flex-1 px-3 py-2 border rounded font-mono text-sm ${
              hasVariance ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className={`flex-1 px-3 py-2 border rounded font-mono text-sm cursor-pointer transition-colors ${
              statusUnavailable
                ? 'bg-red-50 border-red-200 text-red-700'
                : hasVariance
                ? 'bg-yellow-50 border-yellow-500 text-yellow-900'
                : isDifferent
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : 'bg-gray-50 border-gray-300 text-gray-900 hover:bg-gray-100'
            }`}
          >
            {displayValue}
          </div>
        )}

        {statusUnavailable && (
          <span className="text-red-600 text-sm font-medium">{status}</span>
        )}
      </div>

      {isDifferent && !isEditing && (
        <p className="mt-1 text-xs text-gray-500">
          Original: {formatCurrency(originalValue)}
        </p>
      )}

      {statusUnavailable && (
        <p className="mt-1 text-xs text-red-600">
          {getFieldHintText(status)}
        </p>
      )}

      {hasVariance && (
        <p className="mt-1 text-xs text-yellow-700 font-medium">
          ⚠️ This value has changed significantly. Please review before saving.
        </p>
      )}
    </div>
  );
};

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colorClass = getStatusColor(status);
  const displayText = getStatusDisplayText(status);

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
      {displayText}
    </span>
  );
};

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================

export const SectionHeader: React.FC<{
  title: string;
  status?: string;
  description?: string;
  tooltip?: string;
}> = ({ title, status, description, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="mb-6 pb-4 border-b border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {tooltip && (
            <div className="relative">
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                ℹ️
              </button>
              {showTooltip && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900 text-white text-xs p-3 rounded shadow-lg z-10 whitespace-pre-wrap">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        {status && <StatusBadge status={status} />}
      </div>
      {description && <p className="text-sm text-gray-600">{description}</p>}
    </div>
  );
};

// ============================================================================
// TABLE DISPLAY COMPONENT
// ============================================================================

export const SupplyTableDisplay: React.FC<{
  label: string;
  data: any;
  hasVariance?: boolean;
  status?: string;
}> = ({ label, data, hasVariance, status }) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg mb-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-gray-900">{label}</h4>
        {status && <StatusBadge status={status} />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-600">Taxable Value</p>
          <p className={`text-lg font-semibold ${hasVariance ? 'text-yellow-700' : 'text-gray-900'}`}>
            {formatCurrency(data.taxable_value || 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600">IGST</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatCurrency(data.igst || 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600">CGST</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatCurrency(data.cgst || 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-600">SGST</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatCurrency(data.sgst || 0)}
          </p>
        </div>
      </div>

      {data.invoice_count !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
          📄 {data.invoice_count} invoice(s) {data.credit_note_count > 0 && `+ ${data.credit_note_count} credit note(s)`}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// LOADING SKELETON
// ============================================================================

export const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 p-6">
    <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
      ))}
    </div>
  </div>
);

// ============================================================================
// ERROR DISPLAY
// ============================================================================

export const ErrorDisplay: React.FC<{ error: string; onRetry?: () => void }> = ({
  error,
  onRetry,
}) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <h3 className="text-red-900 font-semibold mb-2">❌ Error</h3>
    <p className="text-red-700 text-sm mb-3">{error}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
      >
        Retry
      </button>
    )}
  </div>
);

// ============================================================================
// INFO BANNER
// ============================================================================

export const InfoBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <p className="text-blue-900 text-sm flex items-start gap-2">
      <span className="text-lg">ℹ️</span>
      <span>{message}</span>
    </p>
  </div>
);
