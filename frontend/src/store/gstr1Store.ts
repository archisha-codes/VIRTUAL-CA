import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getGstr1State } from '@/lib/api';
import { logger } from '@/lib/frontendLogger';

// Custom Map and Set storage serializer to handle complex types in localStorage
const mapSetStorageEngine = {
  getItem: (name: string): any => {
    const value = localStorage.getItem(name);
    if (!value) return null;
    
    try {
      return JSON.parse(value, (key, val) => {
        if (val && typeof val === 'object') {
          if (val.__type === 'Map') {
            return new Map(val.value);
          }
          if (val.__type === 'Set') {
            return new Set(val.value);
          }
        }
        return val;
      });
    } catch (e) {
      console.error('Failed to deserialize persisted state:', e);
      return null;
    }
  },
  setItem: (name: string, value: any): void => {
    try {
      const str = JSON.stringify(value, (key, val) => {
        if (val instanceof Map) {
          return {
            __type: 'Map',
            value: Array.from(val.entries())
          };
        }
        if (val instanceof Set) {
          return {
            __type: 'Set',
            value: Array.from(val.values())
          };
        }
        return val;
      });
      localStorage.setItem(name, str);
    } catch (e) {
      console.error('Failed to serialize persisted state:', e);
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  }
};

export interface GSTR1State {
  // State variables
  gstin: string | null;
  returnPeriod: string | null;
  currentStep: string | null;
  stepData: Record<string, any>;
  validationStatus: Record<string, 'pending' | 'passed' | 'failed' | 'skipped'>;
  gstr1Tables: any | null;
  uploadResult: any | null;
  classificationResult: any | null;
  validationResult: any | null;
  filingResult: any | null;
  validationErrors: any[];
  schemaErrors: any[];
  summaryData: { totalTaxable: number; totalIgst: number; totalCgst: number; totalSgst: number; totalCess: number } | null;
  tableData: { b2b: any[]; b2cl: any[]; b2cs: any[]; cdnr: any[]; cdnur: any[]; exp: any[]; hsn: any[] } | null;
  validationErrorsMap: Map<number, string[]>;
  version: number;
  updatedAt: string | null;

  // Individual Table Data States
  b2bData: any[];
  b2clData: any[];
  b2csData: any[];
  cdnrData: any[];
  hsnData: any[];
  exportsData: any[];

  // Actions
  setGstin: (gstin: string | null) => void;
  setReturnPeriod: (returnPeriod: string | null) => void;
  setCurrentStep: (step: string | null) => void;
  setStepData: (data: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  setValidationStatus: (status: Record<string, 'pending' | 'passed' | 'failed' | 'skipped'> | ((prev: Record<string, any>) => Record<string, any>)) => void;
  setGstr1Tables: (tables: any) => void;
  setUploadResult: (result: any) => void;
  setClassificationResult: (result: any) => void;
  setValidationResult: (result: any) => void;
  setFilingResult: (result: any) => void;
  setValidationErrors: (errors: any[]) => void;
  setSchemaErrors: (errors: any[]) => void;
  clearSchemaErrors: () => void;
  setGstr1Data: (summary: any, tables: any) => void;
  setValidationErrorsMap: (map: Map<number, string[]>) => void;
  setVersionAndTimestamp: (version: number, updatedAt: string | null) => void;
  initStoreFromServer: (workspaceId: string, gstin: string, returnPeriod: string) => Promise<boolean>;
  clearStore: () => void;
  markSaved: () => void;

  // Individual Table Setters
  setB2bData: (data: any[] | ((prev: any[]) => any[])) => void;
  setB2clData: (data: any[] | ((prev: any[]) => any[])) => void;
  setB2csData: (data: any[] | ((prev: any[]) => any[])) => void;
  setCdnrData: (data: any[] | ((prev: any[]) => any[])) => void;
  setHsnData: (data: any[] | ((prev: any[]) => any[])) => void;
  setExportsData: (data: any[] | ((prev: any[]) => any[])) => void;
}

export const useGstr1Store = create<GSTR1State>()(
  persist(
    (set, get) => ({
      // Initial States
      gstin: null,
      returnPeriod: null,
      currentStep: null,
      stepData: {},
      validationStatus: {
        upload: 'pending',
        classification: 'pending',
        validation: 'pending',
        summary: 'pending',
        file: 'pending',
        postfiling: 'pending'
      },
      gstr1Tables: null,
      uploadResult: null,
      classificationResult: null,
      validationResult: null,
      filingResult: null,
      validationErrors: [],
      schemaErrors: [],
      summaryData: null,
      tableData: null,
      validationErrorsMap: new Map(),
      version: 0,
      updatedAt: null,

      // Individual Table Data States
      b2bData: [],
      b2clData: [],
      b2csData: [],
      cdnrData: [],
      hsnData: [],
      exportsData: [],

      // State mutators
      setGstin: (gstin) => set({ gstin }),
      setReturnPeriod: (returnPeriod) => set({ returnPeriod }),
      setCurrentStep: (currentStep) => set({ currentStep }),
      setStepData: (data) => set((state) => ({
        stepData: typeof data === 'function' ? data(state.stepData) : { ...state.stepData, ...data }
      })),
      setValidationStatus: (status) => set((state) => ({
        validationStatus: typeof status === 'function' ? status(state.validationStatus) : { ...state.validationStatus, ...status }
      })),
      setGstr1Tables: (gstr1Tables) => set({ gstr1Tables }),
      setUploadResult: (uploadResult) => set({ uploadResult }),
      setClassificationResult: (classificationResult) => set({ classificationResult }),
      setValidationResult: (validationResult) => set({ validationResult }),
      setFilingResult: (filingResult) => set({ filingResult }),
      setValidationErrors: (validationErrors) => set({ validationErrors }),
      setSchemaErrors: (schemaErrors) => set({ schemaErrors }),
      clearSchemaErrors: () => set({ schemaErrors: [] }),
      setGstr1Data: (summary, tables) => set({
        summaryData: summary ? {
          totalTaxable: Number(summary.total_taxable_value ?? summary.totalTaxable ?? 0),
          totalIgst: Number(summary.total_igst ?? summary.totalIgst ?? 0),
          totalCgst: Number(summary.total_cgst ?? summary.totalCgst ?? 0),
          totalSgst: Number(summary.total_sgst ?? summary.totalSgst ?? 0),
          totalCess: Number(summary.total_cess ?? summary.totalCess ?? 0),
        } : null,
        tableData: tables ? {
          b2b: tables.b2b || [],
          b2cl: tables.b2cl || [],
          b2cs: tables.b2cs || [],
          cdnr: tables.cdnr || [],
          cdnur: tables.cdnur || [],
          exp: tables.exp || [],
          hsn: tables.hsn || [],
        } : null,
        gstr1Tables: tables || null,
      }),
      setValidationErrorsMap: (validationErrorsMap) => set({ validationErrorsMap }),
      setVersionAndTimestamp: (version, updatedAt) => set({ version, updatedAt }),

      // Individual Table Setters
      setB2bData: (data) => set((state) => ({
        b2bData: typeof data === 'function' ? data(state.b2bData) : data
      })),
      setB2clData: (data) => set((state) => ({
        b2clData: typeof data === 'function' ? data(state.b2clData) : data
      })),
      setB2csData: (data) => set((state) => ({
        b2csData: typeof data === 'function' ? data(state.b2csData) : data
      })),
      setCdnrData: (data) => set((state) => ({
        cdnrData: typeof data === 'function' ? data(state.cdnrData) : data
      })),
      setHsnData: (data) => set((state) => ({
        hsnData: typeof data === 'function' ? data(state.hsnData) : data
      })),
      setExportsData: (data) => set((state) => ({
        exportsData: typeof data === 'function' ? data(state.exportsData) : data
      })),

      markSaved: () => {
        set({ updatedAt: new Date().toISOString() });
      },

      initStoreFromServer: async (workspaceId: string, gstin: string, returnPeriod: string) => {
        try {
          logger.log('STORE', `Hydrating store from server for Workspace: ${workspaceId}, GSTIN: ${gstin}, Period: ${returnPeriod}`);
          const response = await getGstr1State(workspaceId, gstin, returnPeriod);
          
          if (response && response.success && response.data) {
            const serverState = response.data;
            const serverTime = new Date(serverState.updated_at || serverState.last_saved || 0).getTime();
            const localTime = new Date(get().updatedAt || 0).getTime();
            const serverVersion = serverState.version || 1;
            const localVersion = get().version || 0;

            logger.log('STORE', 'State synchronization metrics:', {
              serverTime: new Date(serverTime).toISOString(),
              localTime: new Date(localTime).toISOString(),
              serverVersion,
              localVersion
            });

            // Hydrate from server if server is newer or version is higher or local state is not set
            if (serverTime > localTime || serverVersion > localVersion || !get().gstin || get().gstin !== gstin) {
              logger.log('STORE', 'Server-side GSTR-1 state is newer, executing hydration on local store...');
              
              const step_data = serverState.step_data || (serverState as any).stepData || {};
              const validation_status = serverState.validation_status || (serverState as any).validationStatus || {
                upload: 'pending',
                classification: 'pending',
                validation: 'pending',
                summary: 'pending',
                file: 'pending',
                postfiling: 'pending'
              };
              
              // Safely transform server table data if nesting exists
              const rawTables = serverState.gstr1_tables || (serverState as any).gstr1Tables || (serverState as any).payload?.gstr1_tables || null;
              
              // Separate tables
              const b2b = rawTables?.b2b || [];
              const b2cl = rawTables?.b2cl || [];
              const b2cs = rawTables?.b2cs || [];
              const cdnr = rawTables?.cdnr || [];
              const hsn = rawTables?.hsn || [];
              const exp = rawTables?.exp || rawTables?.export || [];

              set({
                gstin,
                returnPeriod,
                currentStep: serverState.current_step || (serverState as any).currentStep || 'upload',
                stepData: step_data,
                validationStatus: validation_status,
                gstr1Tables: rawTables,
                uploadResult: serverState.upload_result || (serverState as any).uploadResult || null,
                classificationResult: serverState.classification_result || (serverState as any).classificationResult || null,
                validationResult: serverState.validation_result || (serverState as any).validationResult || null,
                filingResult: serverState.filing_result || (serverState as any).filingResult || null,
                validationErrors: serverState.validation_errors || (serverState as any).validationErrors || [],
                schemaErrors: serverState.schema_errors || (serverState as any).schemaErrors || [],
                summaryData: serverState.summary_data || (serverState as any).summaryData || null,
                tableData: serverState.table_data || (serverState as any).tableData || null,
                validationErrorsMap: serverState.validation_errors_map || (serverState as any).validationErrorsMap || new Map(),
                version: serverVersion,
                updatedAt: serverState.updated_at || serverState.last_saved || new Date().toISOString(),
                
                // Set tables
                b2bData: b2b,
                b2clData: b2cl,
                b2csData: b2cs,
                cdnrData: cdnr,
                hsnData: hsn,
                exportsData: exp
              });
              return true;
            } else {
              logger.log('STORE', 'Local GSTR-1 state is newer or equal, maintaining offline baseline.');
            }
          }
          return false;
        } catch (error) {
          logger.error('STORE', 'Hydration sync operation failed:', error);
          return false;
        }
      },

      clearStore: () => set({
        gstin: null,
        returnPeriod: null,
        currentStep: null,
        stepData: {},
        validationStatus: {
          upload: 'pending',
          classification: 'pending',
          validation: 'pending',
          summary: 'pending',
          file: 'pending',
          postfiling: 'pending'
        },
        gstr1Tables: null,
        uploadResult: null,
        classificationResult: null,
        validationResult: null,
        filingResult: null,
        validationErrors: [],
        schemaErrors: [],
        summaryData: null,
        tableData: null,
        validationErrorsMap: new Map(),
        version: 0,
        updatedAt: null,
        
        b2bData: [],
        b2clData: [],
        b2csData: [],
        cdnrData: [],
        hsnData: [],
        exportsData: []
      })
    }),
    {
      name: 'gstr1_draft_state',
      storage: mapSetStorageEngine,
      partialize: (state) => ({
        gstin: state.gstin,
        returnPeriod: state.returnPeriod,
        currentStep: state.currentStep,
        stepData: state.stepData,
        validationStatus: state.validationStatus,
        gstr1Tables: state.gstr1Tables,
        uploadResult: state.uploadResult,
        classificationResult: state.classificationResult,
        validationResult: state.validationResult,
        filingResult: state.filingResult,
        validationErrors: state.validationErrors,
        schemaErrors: state.schemaErrors,
        summaryData: state.summaryData,
        tableData: state.tableData,
        validationErrorsMap: state.validationErrorsMap,
        version: state.version,
        updatedAt: state.updatedAt,
        
        b2bData: state.b2bData,
        b2clData: state.b2clData,
        b2csData: state.b2csData,
        cdnrData: state.cdnrData,
        hsnData: state.hsnData,
        exportsData: state.exportsData
      })
    }
  )
);
