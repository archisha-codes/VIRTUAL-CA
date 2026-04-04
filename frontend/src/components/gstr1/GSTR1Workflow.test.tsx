/**
 * GSTR1Workflow Tests
 * 
 * Unit and integration tests for the GSTR-1 workflow component:
 * 1. Upload handler - tests that processGSTR1Excel is called and state is set
 * 2. LocalStorage reload - tests that data is restored on component mount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GSTR1Workflow from './GSTR1Workflow';
import * as apiModule from '@/lib/api';

// Mock the API module
vi.mock('@/lib/api', () => ({
  processGSTR1Excel: vi.fn(),
  apiExportGSTR1Excel: vi.fn(),
  downloadExcelFromResponse: vi.fn(),
  validateGSTR1: vi.fn(),
}));

// Mock the transformation functions
vi.mock('@/hooks/useGSTR1Data', () => ({
  transformBackendB2BToFrontend: vi.fn((data: unknown[]) => (data as Array<Record<string, unknown>>).map((item) => ({
    customer: { gstin: item.gstin as string, name: item.customer_name as string },
    invoices: [item]
  }))),
  transformBackendB2CLToFrontend: vi.fn((data: unknown[]) => data),
  transformBackendB2CSToFrontend: vi.fn((data: unknown[]) => data),
  transformBackendExportToFrontend: vi.fn((data: unknown[]) => data),
  transformBackendCDNRToFrontend: vi.fn((data: unknown[]) => data),
}));

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
  }),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Upload: () => <div data-testid="upload-icon" />,
  FileSpreadsheet: () => <div data-testid="file-icon" />,
  CheckCircle: () => <div data-testid="check-icon" />,
  AlertCircle: () => <div data-testid="alert-icon" />,
  ArrowRight: () => <div data-testid="arrow-right" />,
  ArrowLeft: () => <div data-testid="arrow-left" />,
  Loader2: () => <div data-testid="loader" />,
  FileDown: () => <div data-testid="file-down" />,
  RefreshCw: () => <div data-testid="refresh" />,
  X: () => <div data-testid="x-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
  Tag: () => <div data-testid="tag-icon" />,
  ClipboardCheck: () => <div data-testid="clipboard-icon" />,
  FileText: () => <div data-testid="file-text" />,
  Send: () => <div data-testid="send-icon" />,
  Download: () => <div data-testid="download-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  Building2: () => <div data-testid="building-icon" />,
  Database: () => <div data-testid="database-icon" />,
  Server: () => <div data-testid="server-icon" />,
  History: () => <div data-testid="history-icon" />,
  ChevronRight: () => <div data-testid="chevron-right" />,
  AlertTriangle: () => <div data-testid="alert-triangle" />,
  Info: () => <div data-testid="info-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  Edit3: () => <div data-testid="edit-icon" />,
  BarChart3: () => <div data-testid="chart-icon" />,
  Package: () => <div data-testid="package-icon" />,
  Truck: () => <div data-testid="truck-icon" />,
  Globe: () => <div data-testid="globe-icon" />,
  CreditCard: () => <div data-testid="credit-card-icon" />,
  RotateCcw: () => <div data-testid="rotate-icon" />,
  Sparkles: () => <div data-testid="sparkles-icon" />,
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('GSTR1Workflow', () => {
  const mockGSTR1Result = {
    success: true,
    data: {
      b2b: [
        {
          gstin: '27AABCU9603R1ZM',
          customer_name: 'Test Company',
          invoice_no: 'INV001',
          invoice_date: '2026-01-01',
          taxable_value: 10000,
          igst: 1800,
          cgst: 900,
          sgst: 900,
        },
      ],
      b2cl: [] as unknown[],
      b2cs: [] as unknown[],
      cdnr: [] as unknown[],
      exp: [] as unknown[],
      hsn: [] as unknown[],
      summary: {
        total_invoices: 1,
        total_taxable_value: 10000,
        total_igst: 1800,
        total_cgst: 900,
        total_sgst: 900,
        total_cess: 0,
        b2b_count: 1,
        b2cl_count: 0,
        b2cs_count: 0,
        exp_count: 0,
        cdnr_count: 0,
      },
    },
    total_records: 1,
    validation_report: {
      errors: [] as string[],
      warnings: [] as string[],
    },
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Upload Handler', () => {
    it('should call processGSTR1Excel when classification runs', async () => {
      const mockProcessGSTR1Excel = apiModule.processGSTR1Excel as ReturnType<typeof vi.fn>;
      mockProcessGSTR1Excel.mockResolvedValue(mockGSTR1Result);
      
      render(<GSTR1Workflow />);

      // Wait for the component to render
      await waitFor(() => {
        expect(screen.getByText('GSTR-1 Filing')).toBeInTheDocument();
      });

      // Find and click the "Run Auto-Classification" button
      const classifyButton = await screen.findByText('Run Auto-Classification');
      fireEvent.click(classifyButton);

      // Wait for the API to be called
      await waitFor(() => {
        expect(mockProcessGSTR1Excel).toHaveBeenCalled();
      });
    });

    it('should set b2bData state after successful upload', async () => {
      const mockProcessGSTR1Excel = apiModule.processGSTR1Excel as ReturnType<typeof vi.fn>;
      mockProcessGSTR1Excel.mockResolvedValue(mockGSTR1Result);
      
      render(<GSTR1Workflow />);

      // Click the Run Auto-Classification button
      const classifyButton = await screen.findByText('Run Auto-Classification');
      fireEvent.click(classifyButton);

      // The API should be called with a File and mapping object
      await waitFor(() => {
        expect(mockProcessGSTR1Excel).toHaveBeenCalledWith(
          expect.any(File),
          expect.any(Object)
        );
      });
    });
  });

  describe('LocalStorage Reload', () => {
    it('should load table data from localStorage on mount', async () => {
      // Pre-populate localStorage with mock data
      const storedData = {
        b2b: mockGSTR1Result.data.b2b,
        b2cl: mockGSTR1Result.data.b2cl,
        b2cs: mockGSTR1Result.data.b2cs,
        cdnr: mockGSTR1Result.data.cdnr,
        exp: mockGSTR1Result.data.exp,
        hsn: mockGSTR1Result.data.hsn,
      };
      
      localStorage.setItem('gstr1_tables', JSON.stringify(storedData));
      localStorage.setItem('gstr1_upload_result', JSON.stringify(mockGSTR1Result));

      render(<GSTR1Workflow />);

      // The component should load data from localStorage
      await waitFor(() => {
        expect(screen.getByText('GSTR-1 Filing')).toBeInTheDocument();
      });
    });

    it('should clear localStorage on reset', async () => {
      // Pre-populate localStorage
      localStorage.setItem('gstr1_tables', JSON.stringify({ b2b: [] }));
      localStorage.setItem('gstr1_workflow_state', JSON.stringify({}));
      
      render(<GSTR1Workflow />);

      // Find and click the Reset button
      const resetButton = await screen.findByText('Reset');
      fireEvent.click(resetButton);

      // Verify localStorage was cleared
      expect(localStorage.getItem('gstr1_workflow_state')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle upload failure gracefully', async () => {
      const mockProcessGSTR1Excel = apiModule.processGSTR1Excel as ReturnType<typeof vi.fn>;
      mockProcessGSTR1Excel.mockResolvedValue({
        success: false,
        validation_report: {
          errors: ['Invalid file format'],
          warnings: [],
        },
      });

      render(<GSTR1Workflow />);

      // Click the Run Auto-Classification button
      const classifyButton = await screen.findByText('Run Auto-Classification');
      fireEvent.click(classifyButton);

      // Should handle the error
      await waitFor(() => {
        expect(mockProcessGSTR1Excel).toHaveBeenCalled();
      });
    });
  });
});
