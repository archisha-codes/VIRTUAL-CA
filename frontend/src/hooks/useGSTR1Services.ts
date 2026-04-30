/**
 * useGSTR1Services Hook
 * 
 * Custom hook that integrates all GSTR-1 services:
 * - Parser (template detection and parsing)
 * - Classifier (invoice classification)
 * - GSTR1 Engine (table generation)
 * - Export Service (JSON/Excel export)
 */

import { useState, useCallback } from 'react';
import { 
  parseGSTR1ExcelFile, 
  validateInvoices, 
  getParsingStats,
  type RawInvoice,
  type TemplateDetectionResult 
} from '@/services/parser';
import { 
  classifyInvoices, 
  type ClassificationResult, 
  type ClassifiedInvoice 
} from '@/services/classifier';
import { 
  generateGSTR1Tables, 
  type GSTR1Tables 
} from '@/services/gstr1Engine';
import { 
  exportGSTR1ToJson, 
  exportGSTR1ToExcel, 
  downloadJson, 
  downloadExcel 
} from '@/services/exportService';

export interface UseGSTR1ServicesState {
  // Parsing state
  isParsing: boolean;
  parsedInvoices: RawInvoice[];
  templateInfo: TemplateDetectionResult | null;
  parsingStats: ReturnType<typeof getParsingStats> | null;
  
  // Classification state
  isClassifying: boolean;
  classificationResult: ClassificationResult | null;
  
  // Engine state
  isGenerating: boolean;
  gstr1Tables: GSTR1Tables | null;
  
  // Export state
  isExporting: boolean;
  
  // Error state
  error: string | null;
}

export interface UseGSTR1ServicesReturn extends UseGSTR1ServicesState {
  // Actions
  parseFile: (file: File, mapping?: Record<string, string>) => Promise<void>;
  classifyInvoices: (taxpayerGstin?: string) => void;
  generateTables: () => void;
  exportToJson: (gstin: string, period: string) => void;
  exportToExcel: (gstin: string, period: string) => void;
  reset: () => void;
}

const initialState: UseGSTR1ServicesState = {
  isParsing: false,
  parsedInvoices: [],
  templateInfo: null,
  parsingStats: null,
  isClassifying: false,
  classificationResult: null,
  isGenerating: false,
  gstr1Tables: null,
  isExporting: false,
  error: null,
};

export function useGSTR1Services(): UseGSTR1ServicesReturn {
  const [state, setState] = useState<UseGSTR1ServicesState>(initialState);

  // Parse file
  const parseFile = useCallback(async (file: File, mapping?: Record<string, string>) => {
    setState(prev => ({ ...prev, isParsing: true, error: null }));
    
    try {
      const result = await parseGSTR1ExcelFile(file, mapping);
      
      const validation = validateInvoices(result.invoices);
      const stats = getParsingStats(validation.valid);
      
      setState(prev => ({
        ...prev,
        isParsing: false,
        parsedInvoices: validation.valid,
        templateInfo: result.templateInfo,
        parsingStats: stats,
        error: validation.invalid.length > 0 
          ? `${validation.invalid.length} invoices have validation issues`
          : null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isParsing: false,
        error: error instanceof Error ? error.message : 'Failed to parse file',
      }));
    }
  }, []);

  // Classify invoices
  const classifyInvoicesAction = useCallback((taxpayerGstin: string = '') => {
    if (state.parsedInvoices.length === 0) {
      setState(prev => ({ 
        ...prev, 
        error: 'No invoices to classify' 
      }));
      return;
    }

    setState(prev => ({ ...prev, isClassifying: true, error: null }));
    
    try {
      // Use setTimeout to allow UI to update
      setTimeout(() => {
        const result = classifyInvoices(state.parsedInvoices, taxpayerGstin);
        
        setState(prev => ({
          ...prev,
          isClassifying: false,
          classificationResult: result,
        }));
      }, 100);
    } catch (error) {
      setState(prev => ({
        ...prev,
        isClassifying: false,
        error: error instanceof Error ? error.message : 'Failed to classify invoices',
      }));
    }
  }, [state.parsedInvoices]);

  // Generate GSTR1 tables
  const generateTables = useCallback(() => {
    if (!state.classificationResult) {
      setState(prev => ({ 
        ...prev, 
        error: 'No classification result to generate tables from' 
      }));
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    
    try {
      const tables = generateGSTR1Tables(state.classificationResult);
      
      setState(prev => ({
        ...prev,
        isGenerating: false,
        gstr1Tables: tables,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Failed to generate tables',
      }));
    }
  }, [state.classificationResult]);

  // Export to JSON
  const exportToJson = useCallback((gstin: string, period: string) => {
    if (!state.gstr1Tables) {
      setState(prev => ({ 
        ...prev, 
        error: 'No tables to export' 
      }));
      return;
    }

    setState(prev => ({ ...prev, isExporting: true, error: null }));
    
    try {
      const json = exportGSTR1ToJson(state.gstr1Tables, gstin, period);
      downloadJson(json, `GSTR1_${period}_${gstin}.json`);
      
      setState(prev => ({ ...prev, isExporting: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isExporting: false,
        error: error instanceof Error ? error.message : 'Failed to export JSON',
      }));
    }
  }, [state.gstr1Tables]);

  // Export to Excel
  const exportToExcelAction = useCallback((gstin: string, period: string) => {
    if (!state.gstr1Tables) {
      setState(prev => ({ 
        ...prev, 
        error: 'No tables to export' 
      }));
      return;
    }

    setState(prev => ({ ...prev, isExporting: true, error: null }));
    
    try {
      const workbook = exportGSTR1ToExcel(state.gstr1Tables, gstin, period);
      downloadExcel(workbook, `GSTR1_${period}_${gstin}.xlsx`);
      
      setState(prev => ({ ...prev, isExporting: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isExporting: false,
        error: error instanceof Error ? error.message : 'Failed to export Excel',
      }));
    }
  }, [state.gstr1Tables]);

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    parseFile,
    classifyInvoices: classifyInvoicesAction,
    generateTables,
    exportToJson,
    exportToExcel: exportToExcelAction,
    reset,
  };
}
