/**
 * GSTR-3B Custom Hooks
 * 
 * Hooks for managing auto-population, variance detection, and form state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GSTR3BAutoPopulateResponse,
  LocalGSTR3BState,
  FormState,
  VarianceAlert,
  SupplyTable,
  VarianceCalculationResult,
} from '../types/gstr3b.types';

// ============================================================================
// HOOK: useGSTR3BAutoPopulation
// Fetches and manages auto-population data from backend
// ============================================================================

export function useGSTR3BAutoPopulation(gstin: string, returnPeriod: string) {
  const [data, setData] = useState<GSTR3BAutoPopulateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gstin || !returnPeriod) return;

    const fetchAutoPopulationData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/v1/gstr3b/auto-populate/${gstin}/${returnPeriod}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch GSTR-3B data: ${response.statusText}`);
        }

        const responseData = await response.json();
        setData(responseData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error fetching GSTR-3B auto-population:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAutoPopulationData();
  }, [gstin, returnPeriod]);

  return { data, loading, error };
}

// ============================================================================
// HOOK: useVarianceDetection
// Calculates and tracks variance in edited values
// ============================================================================

export function useVarianceDetection(threshold: number = 10) {
  const [alerts, setAlerts] = useState<VarianceAlert[]>([]);

  const calculateVariance = useCallback(
    (originalValue: number, editedValue: number): VarianceCalculationResult => {
      if (originalValue === 0) {
        // If original is 0, any non-zero value is considered variance
        return {
          isVarianceExceeded: editedValue !== 0,
          variancePercent: editedValue !== 0 ? 100 : 0,
          threshold,
        };
      }

      const variancePercent = Math.abs((editedValue - originalValue) / originalValue) * 100;
      return {
        isVarianceExceeded: variancePercent > threshold,
        variancePercent: Math.round(variancePercent * 100) / 100,
        threshold,
      };
    },
    [threshold]
  );

  const checkVariance = useCallback(
    (
      fieldPath: string,
      fieldLabel: string,
      originalValue: number,
      editedValue: number
    ): VarianceAlert | null => {
      const result = calculateVariance(originalValue, editedValue);
      
      if (result.isVarianceExceeded) {
        return {
          fieldPath,
          fieldLabel,
          originalValue,
          editedValue,
          variancePercent: result.variancePercent,
          threshold: result.threshold,
          isExceeded: true,
        };
      }

      return null;
    },
    [calculateVariance]
  );

  const addAlert = useCallback((alert: VarianceAlert) => {
    setAlerts((prev) => {
      // Remove existing alert for the same field
      const filtered = prev.filter((a) => a.fieldPath !== alert.fieldPath);
      return [...filtered, alert];
    });
  }, []);

  const removeAlert = useCallback((fieldPath: string) => {
    setAlerts((prev) => prev.filter((a) => a.fieldPath !== fieldPath));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    alerts,
    calculateVariance,
    checkVariance,
    addAlert,
    removeAlert,
    clearAlerts,
  };
}

// ============================================================================
// HOOK: useGSTR3BFormState
// Manages form state with saved state protection
// ============================================================================

export function useGSTR3BFormState(
  gstin: string,
  returnPeriod: string,
  backendData: GSTR3BAutoPopulateResponse | null,
  savedStateFromStorage?: LocalGSTR3BState
) {
  const [formState, setFormState] = useState<FormState>({
    saved: savedStateFromStorage || getInitialSavedState(gstin, returnPeriod),
    current: savedStateFromStorage || getInitialSavedState(gstin, returnPeriod),
    isDirty: false,
    varianceAlerts: [],
    showVarianceWarning: false,
  });

  // Hydrate form with backend data if no saved state exists
  useEffect(() => {
    if (!backendData || savedStateFromStorage) return;

    // Only populate if user hasn't entered data before
    const newState = hydrateFormStateFromBackend(backendData, gstin, returnPeriod);
    
    setFormState((prev) => ({
      ...prev,
      saved: newState,
      current: newState,
    }));
  }, [backendData, savedStateFromStorage, gstin, returnPeriod]);

  const updateField = useCallback((path: string, value: number, checkVariance?: (val: number) => VarianceAlert | null) => {
    setFormState((prev) => {
      const updated = { ...prev.current };
      const keys = path.split('.');
      let obj: any = updated;

      // Navigate to the nested field
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) {
          obj[keys[i]] = {};
        }
        obj = obj[keys[i]];
      }

      const lastKey = keys[keys.length - 1];
      const oldValue = obj[lastKey];
      obj[lastKey] = value;

      // Check for variance if function provided
      let newAlerts = prev.varianceAlerts;
      if (checkVariance) {
        const alert = checkVariance(value);
        if (alert) {
          newAlerts = [...prev.varianceAlerts.filter((a) => a.fieldPath !== path), alert];
        } else {
          newAlerts = prev.varianceAlerts.filter((a) => a.fieldPath !== path);
        }
      }

      return {
        ...prev,
        current: updated,
        isDirty: JSON.stringify(updated) !== JSON.stringify(prev.saved),
        varianceAlerts: newAlerts,
      };
    });
  }, []);

  const saveForm = useCallback((state: LocalGSTR3BState) => {
    setFormState((prev) => ({
      ...prev,
      saved: state,
      current: state,
      isDirty: false,
      lastSavedAt: new Date().toISOString(),
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState((prev) => ({
      ...prev,
      current: prev.saved,
      isDirty: false,
      varianceAlerts: [],
      showVarianceWarning: false,
    }));
  }, []);

  const showVarianceWarning = useCallback((show: boolean) => {
    setFormState((prev) => ({
      ...prev,
      showVarianceWarning: show,
    }));
  }, []);

  return {
    formState,
    updateField,
    saveForm,
    resetForm,
    showVarianceWarning,
  };
}

// ============================================================================
// HOOK: useLocalStorage
// Persists form state to local storage
// ============================================================================

export function useLocalStorageState(
  key: string,
  initialValue: LocalGSTR3BState
) {
  const [state, setState] = useState<LocalGSTR3BState>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: LocalGSTR3BState) => {
    try {
      setState(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
  }, [key]);

  const clearValue = useCallback(() => {
    try {
      setState(initialValue);
      window.localStorage.removeItem(key);
    } catch (err) {
      console.error('Error clearing localStorage:', err);
    }
  }, [key, initialValue]);

  return { state, setState: setValue, clearState: clearValue };
}

// ============================================================================
// HOOK: useGSTR3BForm (Composite Hook)
// Combines all functionality for a complete form experience
// ============================================================================

export function useGSTR3BForm(
  gstin: string,
  returnPeriod: string,
  varianceThreshold?: number
) {
  // Fetch auto-population data
  const { data: backendData, loading, error } = useGSTR3BAutoPopulation(
    gstin,
    returnPeriod
  );

  // Manage variance detection
  const variance = useVarianceDetection(varianceThreshold || 10);

  // Manage local storage
  const storageKey = `gstr3b_${gstin}_${returnPeriod}`;
  const { state: savedState, setState: updateSavedState } = useLocalStorageState(
    storageKey,
    getInitialSavedState(gstin, returnPeriod)
  );

  // Manage form state
  const formStateManager = useGSTR3BFormState(
    gstin,
    returnPeriod,
    backendData,
    savedState
  );

  const handleFieldChange = useCallback(
    (path: string, value: number) => {
      // Get original value from backend
      const originalValue = getValueAtPath(backendData, path);
      
      // Check variance
      const alert = variance.checkVariance(
        path,
        getFieldLabel(path),
        originalValue || 0,
        value
      );

      if (alert) {
        variance.addAlert(alert);
      } else {
        variance.removeAlert(path);
      }

      // Update form state
      formStateManager.updateField(path, value);
    },
    [backendData, variance, formStateManager]
  );

  const handleSave = useCallback(async (onSave?: (state: LocalGSTR3BState) => Promise<void>) => {
    formStateManager.saveForm(formStateManager.formState.current);
    updateSavedState(formStateManager.formState.current);
    
    if (onSave) {
      await onSave(formStateManager.formState.current);
    }
  }, [formStateManager, updateSavedState]);

  const handleReset = useCallback(() => {
    formStateManager.resetForm();
    variance.clearAlerts();
  }, [formStateManager, variance]);

  return {
    // Data
    backendData,
    
    // State
    formState: formStateManager.formState,
    savedState,
    
    // Variance
    varianceAlerts: variance.alerts,
    
    // Actions
    handleFieldChange,
    handleSave,
    handleReset,
    
    // Status
    loading,
    error,
    isDirty: formStateManager.formState.isDirty,
    
    // Variance management
    showVarianceWarning: formStateManager.showVarianceWarning,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getInitialSavedState(gstin: string, returnPeriod: string): LocalGSTR3BState {
  return {
    section_3_1_a_edited: {},
    section_3_1_b_edited: {},
    section_3_1_c_edited: {},
    section_3_1_d_edited: {},
    section_3_1_e_edited: {},
    section_3_2_edited: {},
    section_4_edited: {},
    gstr1_filed: false,
    gstr2b_generated: false,
    returnPeriod,
    gstin,
  };
}

function hydrateFormStateFromBackend(
  data: GSTR3BAutoPopulateResponse,
  gstin: string,
  returnPeriod: string
): LocalGSTR3BState {
  return {
    section_3_1_a_edited: { ...data.section_3_1.table_3_1_a },
    section_3_1_b_edited: { ...data.section_3_1.table_3_1_b },
    section_3_1_c_edited: { ...data.section_3_1.table_3_1_c },
    section_3_1_d_edited: { ...data.section_3_1.table_3_1_d },
    section_3_1_e_edited: { ...data.section_3_1.table_3_1_e },
    section_3_2_edited: { ...data.section_3_2 },
    section_4_edited: { ...data.section_4 },
    gstr1_filed: data.filing_status.gstr1_filed,
    gstr2b_generated: data.filing_status.gstr2b_generated,
    returnPeriod,
    gstin,
    lastSavedAt: new Date().toISOString(),
  };
}

function getValueAtPath(obj: any, path: string): number | undefined {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    value = value?.[key];
  }
  
  return typeof value === 'number' ? value : undefined;
}

function getFieldLabel(path: string): string {
  const labels: Record<string, string> = {
    'section_3_1_a_edited.taxable_value': 'Table 3.1(a) - Taxable Value',
    'section_3_1_a_edited.igst': 'Table 3.1(a) - IGST',
    'section_3_1_a_edited.cgst': 'Table 3.1(a) - CGST',
    'section_3_1_a_edited.sgst': 'Table 3.1(a) - SGST',
    'section_3_1_a_edited.cess': 'Table 3.1(a) - CESS',
    // ... add more as needed
  };
  
  return labels[path] || path;
}
