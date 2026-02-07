/**
 * SummaryTable Component
 * Display GSTR summary data with TailwindCSS styling
 */

import React, { useState } from 'react';
import { SummaryTablePropTypes } from './propTypes';

const SummaryTable = ({ gstr1Summary, gstr3bSummary }) => {
  const [activeTab, setActiveTab] = useState('gstr1');

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const renderGSTR1Section = (title, data) => {
    if (!data || data.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 px-2">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  Field
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  Count
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  Taxable Value
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  Tax Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(data).map(([key, value]) => {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">{label}</td>
                    <td className="py-3 px-4 text-sm text-gray-700 text-right">{value.count || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-700 text-right font-mono">
                      {value.taxable_value ? formatCurrency(value.taxable_value) : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 text-right font-mono">
                      {value.tax_amount ? formatCurrency(value.tax_amount) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="py-3 px-4 text-sm text-gray-800">Total</td>
                <td className="py-3 px-4 text-sm text-gray-800 text-right">
                  {Object.values(data).reduce((sum, v) => sum + (v.count || 0), 0)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-800 text-right font-mono">
                  {formatCurrency(Object.values(data).reduce((sum, v) => sum + (v.taxable_value || 0), 0))}
                </td>
                <td className="py-3 px-4 text-sm text-gray-800 text-right font-mono">
                  {formatCurrency(Object.values(data).reduce((sum, v) => sum + (v.tax_amount || 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderGSTR3BSection = (section, data) => {
    if (!data || Object.keys(data).length === 0) return null;

    const rows = [];
    
    Object.entries(data).forEach(([key, value]) => {
      rows.push(
        <tr key={`${section}-${key}`} className="hover:bg-gray-50">
          <td className="py-3 px-4 text-sm text-gray-700 font-medium">{key}</td>
          <td className="py-3 px-4 text-sm text-gray-700 text-right font-mono">
            {value.inter_state ? formatCurrency(value.inter_state) : '-'}
          </td>
          <td className="py-3 px-4 text-sm text-gray-700 text-right font-mono">
            {value.intra_state ? formatCurrency(value.intra_state) : '-'}
          </td>
          <td className="py-3 px-4 text-sm text-gray-700 text-right font-mono font-semibold">
            {formatCurrency((value.inter_state || 0) + (value.intra_state || 0))}
          </td>
        </tr>
      );
    });

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 px-2">{section}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  Category
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  Inter-State (₹)
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  Intra-State (₹)
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  Total (₹)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderGSTR3BTotals = (totals) => {
    if (!totals || Object.keys(totals).length === 0) return null;

    return (
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-3">GSTR-3B Summary Totals</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(totals).map(([key, value]) => {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return (
              <div key={key} className="bg-white rounded p-3 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-lg font-bold text-gray-800 font-mono">{formatCurrency(value)}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto mt-8">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('gstr1')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'gstr1'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              GSTR-1 Summary
            </span>
          </button>
          <button
            onClick={() => setActiveTab('gstr3b')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'gstr3b'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              GSTR-3B Summary
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {activeTab === 'gstr1' && (
          <div className="p-6">
            {gstr1Summary?.b2b && renderGSTR1Section('B2B - Business to Business', gstr1Summary.b2b)}
            {gstr1Summary?.b2cl && renderGSTR1Section('B2CL - Business to Consumer (Large)', gstr1Summary.b2cl)}
            {gstr1Summary?.b2cs && renderGSTR1Section('B2CS - Business to Consumer (Small)', gstr1Summary.b2cs)}
            {gstr1Summary?.exports && renderGSTR1Section('Exports', gstr1Summary.exports)}
            {gstr1Summary?.cdnr && renderGSTR1Section('Credit/Debit Notes (Registered)', gstr1Summary.cdnr)}
            {gstr1Summary?.cdnur && renderGSTR1Section('Credit/Debit Notes (Unregistered)', gstr1Summary.cdnur)}
            
            {(!gstr1Summary || Object.keys(gstr1Summary || {}).length === 0) && (
              <div className="text-center py-12 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-lg">No GSTR-1 data available</p>
                <p className="text-sm mt-2">Upload a file to see the summary</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'gstr3b' && (
          <div className="p-6">
            {gstr3bSummary?.output_liability && renderGSTR3BSection('Output Liability (Section 3.1)', gstr3bSummary.output_liability)}
            {gstr3bSummary?.inter_state_supplies && renderGSTR3BSection('Inter-State Supplies (Section 3.2)', gstr3bSummary.inter_state_supplies)}
            {gstr3bSummary?.totals && renderGSTR3BTotals(gstr3bSummary.totals)}
            
            {(!gstr3bSummary || Object.keys(gstr3bSummary || {}).length === 0) && (
              <div className="text-center py-12 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-lg">No GSTR-3B data available</p>
                <p className="text-sm mt-2">Upload a file to generate GSTR-3B summary</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

SummaryTable.propTypes = SummaryTablePropTypes;

export default SummaryTable;
