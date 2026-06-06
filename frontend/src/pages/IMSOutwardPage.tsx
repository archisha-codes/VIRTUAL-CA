import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { IMSOutwardDrawerFlow } from '@/components/ims-outward/IMSOutwardDrawerFlow';
import { IMSOutwardReport } from '@/components/ims-outward/IMSOutwardReport';

export function IMSOutwardPage() {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isOTPConnected, setIsOTPConnected] = useState(false);
  const [reportState, setReportState] = useState<'initial' | 'loading' | 'ready'>('initial');

  useEffect(() => {
    if (reportState === 'initial' && !isDrawerOpen) {
      setIsDrawerOpen(true);
    }
  }, [reportState, isDrawerOpen]);

  const handleFetchData = () => {
    setIsDrawerOpen(false);
    setReportState('loading');
    
    // Simulate downloading data
    setTimeout(() => {
      setReportState('ready');
    }, 2000);
  };

  return (
    <DashboardLayout title="IMS Supplier Reports" fullHeight>
      <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden absolute inset-0 bg-[#f4f7fa]">
        {reportState === 'initial' && (
          <div className="flex flex-col items-center justify-center p-12 h-full">
            <h2 className="text-xl font-medium text-slate-500 mb-4">Please generate report to view your data...</h2>
          </div>
        )}

        {reportState === 'loading' && (
          <div className="flex flex-col items-center justify-center p-12 h-full gap-4 max-w-md mx-auto">
            <h2 className="text-xl font-medium text-slate-700">Please wait while...</h2>
            <p className="text-blue-600 font-medium">We are downloading your data from GSTN.</p>
            <div className="w-full mt-4">
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Downloading Data...</span>
                <span>50% complete</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-1/2 animate-pulse rounded-full"></div>
              </div>
            </div>
          </div>
        )}

        {reportState === 'ready' && (
          <IMSOutwardReport onBack={() => setReportState('initial')} />
        )}
      </div>

      <IMSOutwardDrawerFlow 
        open={isDrawerOpen} 
        onOpenChange={(val) => {
           if (!val && reportState === 'initial') {
             navigate('/dashboard');
           } else {
             setIsDrawerOpen(val);
           }
        }} 
        onFetchData={handleFetchData}
      />
    </DashboardLayout>
  );
}
