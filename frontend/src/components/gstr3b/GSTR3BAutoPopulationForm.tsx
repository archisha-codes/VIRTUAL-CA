/**
 * GSTR-3B Auto-Population Form Component
 * 
 * Main React component for GSTR-3B form with auto-population,
 * state management, variance detection, and user interaction rules
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  GSTR3BFormProps,
  LocalGSTR3BState,
  GSTR3BAutoPopulateResponse,
  VarianceAlert,
} from '../types/gstr3b.types';
import { useGSTR3BForm } from '../hooks/useGSTR3B';
import {
  ToastContainer,
  VarianceWarningModal,
  EditField,
  SectionHeader,
  SupplyTableDisplay,
  LoadingSkeleton,
  ErrorDisplay,
  InfoBanner,
  StatusBadge,
} from './GSTR3BUI';
import {
  getTable3_1_d_Tooltip,
  getITCTooltip,
  calculateVariancePercentage,
  isHighRiskVariance,
  formatCurrencyValue,
  getStatusColor,
} from '../utils/gstr3b.utils';

// ============================================================================
// MAIN FORM COMPONENT
// ============================================================================

export const GSTR3BAutoPopulationForm: React.FC<GSTR3BFormProps> = ({
  gstin,
  returnPeriod,
  initialSavedState,
  onSave,
  onSubmit,
  varianceThreshold = 10,
}) => {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  const gstr3bForm = useGSTR3BForm(gstin, returnPeriod, varianceThreshold);

  const [toastMessages, setToastMessages] = useState<any[]>([]);
  const [showVarianceModal, setShowVarianceModal] = useState(false);
  const [currentVarianceAlert, setCurrentVarianceAlert] = useState<VarianceAlert | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const addToast = useCallback((message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info', duration = 5000) => {
    const id = `toast_${Date.now()}`;
    setToastMessages((prev) => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToastMessages((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleFieldChange = useCallback(
    (path: string, value: number) => {
      // Check if variance exceeds threshold
      if (gstr3bForm.backendData) {
        const keys = path.split('.');
        let originalValue = gstr3bForm.backendData;
        for (const key of keys) {
          originalValue = originalValue[key];
        }

        if (typeof originalValue === 'number') {
          const variancePercent = calculateVariancePercentage(originalValue as number, value);
          if (variancePercent > varianceThreshold) {
            // Show variance alert
            const alert: VarianceAlert = {
              fieldPath: path,
              fieldLabel: path.split('.').pop() || path,
              originalValue: originalValue as number,
              editedValue: value,
              variancePercent,
              threshold: varianceThreshold,
              isExceeded: true,
            };

            if (isHighRiskVariance(variancePercent)) {
              // High-risk variance - show modal
              setCurrentVarianceAlert(alert);
              setShowVarianceModal(true);
            } else {
              // Normal variance - show toast warning
              addToast(
                `${path}: Value changed by ${variancePercent.toFixed(2)}%. Please review before saving.`,
                'warning'
              );
            }
          }
        }
      }

      // Update field
      gstr3bForm.handleFieldChange(path, value);
    },
    [gstr3bForm, varianceThreshold, addToast]
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await gstr3bForm.handleSave(onSave);
      addToast('GSTR-3B data saved successfully', 'success');
    } catch (error) {
      addToast(`Error saving data: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [gstr3bForm, onSave, addToast]);

  const handleSubmit = useCallback(async () => {
    // Show confirmation modal
    setShowConfirmModal(true);
  }, []);

  const handleConfirmSubmit = useCallback(async () => {
    setShowConfirmModal(false);
    setIsSaving(true);
    try {
      // First save
      await gstr3bForm.handleSave(onSave);
      
      // Then submit
      if (onSubmit) {
        await onSubmit(gstr3bForm.formState.current);
      }
      
      addToast('GSTR-3B filed successfully', 'success');
    } catch (error) {
      addToast(`Error filing GSTR-3B: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [gstr3bForm, onSave, onSubmit, addToast]);

  const handleVarianceModalContinue = useCallback(() => {
    setShowVarianceModal(false);
    addToast('Proceeding with edits. Remember to review before filing.', 'warning');
  }, [addToast]);

  const handleVarianceModalRevert = useCallback(() => {
    if (currentVarianceAlert) {
      // Revert to original value
      handleFieldChange(currentVarianceAlert.fieldPath, currentVarianceAlert.originalValue);
      addToast('Value reverted to original', 'info');
    }
    setShowVarianceModal(false);
  }, [currentVarianceAlert, handleFieldChange, addToast]);

  const handleReset = useCallback(() => {
    gstr3bForm.handleReset();
    addToast('Form reset to last saved state', 'info');
  }, [gstr3bForm, addToast]);

  // ========================================================================
  // RENDER
  // ========================================================================

  if (gstr3bForm.loading) {
    return <LoadingSkeleton />;
  }

  if (gstr3bForm.error) {
    return (
      <div className="p-6">
        <ErrorDisplay
          error={gstr3bForm.error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const data = gstr3bForm.backendData;
  if (!data) {
    return (
      <div className="p-6">
        <ErrorDisplay error="No GSTR-3B data available" />
      </div>
    );
  }

  // ========================================================================
  // RENDER FORM
  // ========================================================================

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-3B Auto-Population</h1>
        <p className="text-gray-600">
          Period: {returnPeriod} | GSTIN: {gstin}
        </p>
      </div>

      {/* Status Flags */}
      {!data.filing_status.gstr1_filed && (
        <InfoBanner message="⚠️ GSTR-1 not filed. Outward supply fields will show 'Not filed'." />
      )}
      
      {!data.filing_status.gstr2b_generated && (
        <InfoBanner message="⚠️ GSTR-2B not generated. ITC and inward supply fields will show 'Not generated'." />
      )}

      {/* Filing Status Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm text-gray-600 mb-1">GSTR-1 Status</p>
          <StatusBadge status={data.filing_status.gstr1_filed ? 'Filed' : 'Not filed'} />
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">GSTR-2B Status</p>
          <StatusBadge status={data.filing_status.gstr2b_generated ? 'Generated' : 'Not generated'} />
        </div>
      </div>

      {/* Variance Alerts Summary */}
      {gstr3bForm.varianceAlerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-900 mb-2">
            ⚠️ {gstr3bForm.varianceAlerts.length} Field(s) with Significant Changes
          </h3>
          <div className="space-y-1 text-sm text-yellow-800">
            {gstr3bForm.varianceAlerts.map((alert) => (
              <p key={alert.fieldPath}>
                • {alert.fieldLabel}: {alert.variancePercent.toFixed(2)}% change
                ({formatCurrencyValue(alert.originalValue)} → {formatCurrencyValue(alert.editedValue)})
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Section 3.1 - Outward Supplies */}
      <SectionHeader
        title="Section 3.1 - Outward Supplies"
        description="Details of supplies made by you"
        status={data.filing_status.gstr1_filed ? 'Filed' : 'Not filed'}
      />

      <div className="space-y-6 mb-8">
        {/* Table 3.1(a) */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">3.1(a) Outward Taxable Supplies</h4>
          <SupplyTableDisplay
            label="Regular taxable supplies"
            data={data.section_3_1.table_3_1_a}
            status={data.section_3_1.table_3_1_a.status}
            hasVariance={gstr3bForm.varianceAlerts.some((a) => a.fieldPath.includes('3_1_a'))}
          />
        </div>

        {/* Table 3.1(b) */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">3.1(b) Zero Rated Supplies</h4>
          <SupplyTableDisplay
            label="Zero-rated and exports"
            data={data.section_3_1.table_3_1_b}
            status={data.section_3_1.table_3_1_b.status}
            hasVariance={gstr3bForm.varianceAlerts.some((a) => a.fieldPath.includes('3_1_b'))}
          />
        </div>

        {/* Table 3.1(c) */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">3.1(c) Nil-Rated, Exempted & Non-GST</h4>
          <SupplyTableDisplay
            label="Supplies not liable to GST"
            data={data.section_3_1.table_3_1_c}
            status={data.section_3_1.table_3_1_c.status}
            hasVariance={gstr3bForm.varianceAlerts.some((a) => a.fieldPath.includes('3_1_c'))}
          />
        </div>

        {/* Table 3.1(d) - With Tooltip */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            3.1(d) Inward Supplies (RCM)
            <span className="text-gray-400 text-sm">ℹ️</span>
          </h4>
          <InfoBanner
            message="⚠️ Important: This table does NOT include supplies from unregistered persons liable to RCM or import of services. You must manually add these if applicable."
          />
          <SupplyTableDisplay
            label="Inward supplies liable to RCM"
            data={data.section_3_1.table_3_1_d}
            status={data.section_3_1.table_3_1_d.status}
            hasVariance={gstr3bForm.varianceAlerts.some((a) => a.fieldPath.includes('3_1_d'))}
          />
        </div>

        {/* Table 3.1(e) */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">3.1(e) Non-GST Outward Supplies</h4>
          <SupplyTableDisplay
            label="Non-GST outward supplies"
            data={data.section_3_1.table_3_1_e}
            status={data.section_3_1.table_3_1_e.status}
            hasVariance={gstr3bForm.varianceAlerts.some((a) => a.fieldPath.includes('3_1_e'))}
          />
        </div>
      </div>

      {/* Section 3.2 - Inter-State Supplies */}
      <SectionHeader
        title="Section 3.2 - Inter-State B2C Supplies"
        description="Supplies to unregistered persons in other states"
        status={data.section_3_2.status}
      />

      <SupplyTableDisplay
        label={data.section_3_2.description}
        data={{
          taxable_value: data.section_3_2.total_taxable_value,
          igst: data.section_3_2.total_igst,
          cgst: 0,
          sgst: 0,
          cess: 0,
        }}
        status={data.section_3_2.status}
      />

      {/* Section 4 - ITC */}
      <SectionHeader
        title="Section 4 - Input Tax Credit (ITC)"
        description="ITC available, reversed, and net ITC"
        status={data.section_4.status}
        tooltip={getITCTooltip()}
      />

      <div className="space-y-6 mb-8">
        {/* Section 4A */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">4A - ITC Available</h4>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600">IGST</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrencyValue(data.section_4.section_4c.igst || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">CGST</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrencyValue(data.section_4.section_4c.cgst || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">SGST</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrencyValue(data.section_4.section_4c.sgst || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Total ITC</p>
                <p className="text-lg font-semibold text-green-700">
                  {formatCurrencyValue(data.section_4.section_4c.total || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tax Summary */}
      <SectionHeader
        title="Tax Summary"
        description="Complete tax liability and payable calculation"
      />

      <div className="bg-blue-50 p-6 rounded-lg mb-8">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Liability</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrencyValue(data.tax_summary.total_liability.total)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Total ITC</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrencyValue(data.tax_summary.total_itc.total)}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-sm text-gray-600 mb-1">Net Tax Payable</p>
            <p className="text-3xl font-bold text-blue-700">
              {formatCurrencyValue(data.tax_summary.total_payable.total)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-6 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={!gstr3bForm.isDirty || isSaving}
          className={`px-6 py-2 rounded font-medium transition-colors ${
            gstr3bForm.isDirty && !isSaving
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          {isSaving ? 'Saving...' : '💾 Save Draft'}
        </button>

        <button
          onClick={handleReset}
          disabled={!gstr3bForm.isDirty}
          className={`px-6 py-2 rounded font-medium transition-colors ${
            gstr3bForm.isDirty
              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              : 'bg-gray-100 text-gray-600 cursor-not-allowed'
          }`}
        >
          ↺ Reset
        </button>

        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="ml-auto px-6 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ✓ File GSTR-3B
        </button>
      </div>

      {/* Toast Container */}
      <ToastContainer
        messages={toastMessages}
        onDismiss={removeToast}
        position="top-right"
      />

      {/* Variance Warning Modal */}
      {currentVarianceAlert && (
        <VarianceWarningModal
          isOpen={showVarianceModal}
          alert={currentVarianceAlert}
          onContinue={handleVarianceModalContinue}
          onRevert={handleVarianceModalRevert}
        />
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Filing</h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to file this GSTR-3B? 
              {gstr3bForm.varianceAlerts.length > 0 && (
                <span className="block mt-2 text-yellow-700 font-medium">
                  ⚠️ You have {gstr3bForm.varianceAlerts.length} field(s) with significant changes.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Filing...' : 'Confirm & File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GSTR3BAutoPopulationForm;
