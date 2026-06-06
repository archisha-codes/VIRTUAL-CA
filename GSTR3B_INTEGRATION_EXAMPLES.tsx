/**
 * GSTR-3B Form Integration Example
 * 
 * This file demonstrates how to use the GSTR3BAutoPopulationForm component
 * in a real-world React application with proper error handling, loading states,
 * and integration with your backend API.
 */

import React, { useState, useCallback } from 'react';
import GSTR3BAutoPopulationForm from './components/GSTR3B/GSTR3BAutoPopulationForm';
import { GSTR3BAutoPopulateResponse } from './types/gstr3b.types';

/**
 * Example 1: Simple Usage with Minimal Configuration
 * 
 * Best for: Quick integration with default settings
 */
export const GSTR3BFormPageSimple: React.FC = () => {
  const gstin = '27AAHFU5055K1Z0';
  const returnPeriod = '202401';

  const handleSave = async (data: GSTR3BAutoPopulateResponse) => {
    console.log('Saving draft:', data);
    // TODO: Make API call to save draft
    // await fetch('/api/v1/gstr3b/draft', { method: 'POST', body: JSON.stringify(data) });
  };

  const handleSubmit = async (data: GSTR3BAutoPopulateResponse) => {
    console.log('Filing GSTR-3B:', data);
    // TODO: Make API call to file
    // await fetch('/api/v1/gstr3b/file', { method: 'POST', body: JSON.stringify(data) });
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto">
        <GSTR3BAutoPopulationForm
          gstin={gstin}
          returnPeriod={returnPeriod}
          onSave={handleSave}
          onSubmit={handleSubmit}
          varianceThreshold={10}
        />
      </div>
    </div>
  );
};

/**
 * Example 2: Advanced Usage with State Management
 * 
 * Best for: Complex applications with state management needs
 */
export const GSTR3BFormPageAdvanced: React.FC = () => {
  const [gstin] = useState('27AAHFU5055K1Z0');
  const [returnPeriod] = useState('202401');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async (data: GSTR3BAutoPopulateResponse) => {
    setIsSaving(true);
    setSaveStatus('idle');
    setSaveError(null);

    try {
      const response = await fetch('/api/v1/gstr3b/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`, // Your auth token
        },
        body: JSON.stringify({
          gstin,
          return_period: returnPeriod,
          data,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Save failed: ${response.statusText}`);
      }

      setSaveStatus('success');
      console.log('Draft saved successfully');

      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSaveError(errorMessage);
      setSaveStatus('error');
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [gstin, returnPeriod]);

  const handleSubmit = useCallback(async (data: GSTR3BAutoPopulateResponse) => {
    if (!confirm('Are you sure you want to file this GSTR-3B?')) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setSaveError(null);

    try {
      // First save as draft
      await handleSave(data);

      // Then submit
      const response = await fetch('/api/v1/gstr3b/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          gstin,
          return_period: returnPeriod,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error(`Filing failed: ${response.statusText}`);
      }

      setSaveStatus('success');
      console.log('GSTR-3B filed successfully');

      // Redirect to confirmation page
      // navigate('/gstr3b/confirmation', { state: { gstin, returnPeriod } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSaveError(errorMessage);
      setSaveStatus('error');
      console.error('Error filing GSTR-3B:', error);
    } finally {
      setIsSaving(false);
    }
  }, [gstin, returnPeriod, handleSave]);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Status Messages */}
        {saveStatus === 'success' && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">✓ Changes saved successfully</p>
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">❌ Error: {saveError}</p>
          </div>
        )}

        {/* Form */}
        <GSTR3BAutoPopulationForm
          gstin={gstin}
          returnPeriod={returnPeriod}
          onSave={handleSave}
          onSubmit={handleSubmit}
          varianceThreshold={10}
        />

        {isSaving && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6">
              <p className="text-gray-800">Saving...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Example 3: Integration with React Router
 * 
 * Best for: Multi-page applications with navigation
 */
import { useParams, useNavigate } from 'react-router-dom';

export const GSTR3BFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { gstin = '', returnPeriod = '' } = useParams<{
    gstin: string;
    returnPeriod: string;
  }>();

  if (!gstin || !returnPeriod) {
    return (
      <div className="p-6 bg-red-50 rounded-lg">
        <p className="text-red-800">Missing GSTIN or return period</p>
      </div>
    );
  }

  const handleSave = useCallback(async (data: GSTR3BAutoPopulateResponse) => {
    try {
      const response = await fetch(`/api/v1/gstr3b/${gstin}/${returnPeriod}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Save failed');
    } catch (error) {
      console.error('Error saving draft:', error);
      throw error;
    }
  }, [gstin, returnPeriod]);

  const handleSubmit = useCallback(async (data: GSTR3BAutoPopulateResponse) => {
    try {
      const response = await fetch(`/api/v1/gstr3b/${gstin}/${returnPeriod}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Filing failed');

      // Navigate to success page
      navigate('/gstr3b/success', {
        state: { gstin, returnPeriod, filedAt: new Date() },
      });
    } catch (error) {
      console.error('Error filing GSTR-3B:', error);
      throw error;
    }
  }, [gstin, returnPeriod, navigate]);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back
        </button>

        <GSTR3BAutoPopulationForm
          gstin={gstin}
          returnPeriod={returnPeriod}
          onSave={handleSave}
          onSubmit={handleSubmit}
          varianceThreshold={10}
        />
      </div>
    </div>
  );
};

/**
 * Example 4: With Error Boundary
 * 
 * Best for: Robust error handling
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GSTR3BErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('GSTR-3B Form Error:', error, errorInfo);
    // Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 rounded-lg border border-red-200">
          <h2 className="text-lg font-bold text-red-900 mb-2">Something went wrong</h2>
          <p className="text-red-800 mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const GSTR3BFormPageWithErrorBoundary: React.FC = () => {
  return (
    <GSTR3BErrorBoundary>
      <GSTR3BFormPage />
    </GSTR3BErrorBoundary>
  );
};

/**
 * Example 5: Custom Variance Threshold
 * 
 * Best for: Different warning sensitivity requirements
 */
export const GSTR3BFormPageCustomThreshold: React.FC = () => {
  const gstin = '27AAHFU5055K1Z0';
  const returnPeriod = '202401';

  // More lenient: 20% threshold
  const lenientThreshold = 20;

  // More strict: 5% threshold
  const strictThreshold = 5;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-2">GSTR-3B Form</h2>
          <p className="text-gray-600">
            Variance Threshold: {strictThreshold}%
            (More strict)
          </p>
        </div>

        <GSTR3BAutoPopulationForm
          gstin={gstin}
          returnPeriod={returnPeriod}
          varianceThreshold={strictThreshold}
          onSave={async (data) => console.log('Saving:', data)}
          onSubmit={async (data) => console.log('Filing:', data)}
        />
      </div>
    </div>
  );
};

/**
 * Example 6: Multiple Forms in Tabs
 * 
 * Best for: Handling multiple return periods
 */
interface GSTR3BTabProps {
  returnPeriod: string;
  gstin: string;
}

const GSTR3BFormTab: React.FC<GSTR3BTabProps> = ({ returnPeriod, gstin }) => {
  return (
    <GSTR3BAutoPopulationForm
      gstin={gstin}
      returnPeriod={returnPeriod}
      onSave={async (data) => {
        console.log(`Saving ${returnPeriod}:`, data);
      }}
      onSubmit={async (data) => {
        console.log(`Filing ${returnPeriod}:`, data);
      }}
    />
  );
};

export const GSTR3BFormPageWithTabs: React.FC = () => {
  const gstin = '27AAHFU5055K1Z0';
  const [activeTab, setActiveTab] = useState('202401');

  const returnPeriods = ['202401', '202402', '202403'];

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-300">
          {returnPeriods.map((period) => (
            <button
              key={period}
              onClick={() => setActiveTab(period)}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === period
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {period}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <GSTR3BFormTab returnPeriod={activeTab} gstin={gstin} />
      </div>
    </div>
  );
};

/**
 * Helper function to get authentication token
 * Implement based on your auth system
 */
function getAuthToken(): string {
  // TODO: Implement based on your auth system
  // Examples:
  // - localStorage.getItem('auth_token')
  // - sessionStorage.getItem('jwt_token')
  // - useAuth() from AuthContext
  return 'your-auth-token-here';
}

export default GSTR3BFormPageSimple;
