import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { IMSDrawerFlow } from '@/components/ims/IMSDrawerFlow';
import { IMSConsole } from '@/components/ims/IMSConsole';

export function IMSInwardPage() {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [selectedGstin, setSelectedGstin] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGstin) {
      setIsDrawerOpen(true);
    }
  }, [selectedGstin]);

  const handleContinue = (gstin: string) => {
    setSelectedGstin(gstin);
    setIsDrawerOpen(false);
  };

  const handleBackToDrawer = () => {
    setSelectedGstin(null);
    setIsDrawerOpen(true);
  };

  return (
    <DashboardLayout title="IMS Inward Supplies">
      <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden absolute inset-0 bg-slate-50">
        {!selectedGstin ? (
          <div className="flex flex-col items-center justify-center p-12 h-full">
            <h2 className="text-xl font-medium text-slate-500 mb-4">Please select a business from the drawer to continue.</h2>
          </div>
        ) : (
          <IMSConsole gstin={selectedGstin} onBack={handleBackToDrawer} />
        )}
      </div>

      <IMSDrawerFlow 
        open={isDrawerOpen} 
        onOpenChange={(val) => {
           if (!val && !selectedGstin) {
             navigate('/dashboard');
           } else {
             setIsDrawerOpen(val);
           }
        }} 
        onContinue={handleContinue}
        title="IMS Inward Supplies"
      />
    </DashboardLayout>
  );
}
