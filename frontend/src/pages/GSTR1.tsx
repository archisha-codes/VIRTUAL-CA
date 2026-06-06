/**
 * GSTR-1 Page
 * 
 * Professional step-by-step workflow for GSTR-1 return filing
 * Uses the new GSTR1Workflow component for enhanced UX
 * 
 * CONSOLIDATED: Single canonical workflow - Backend is source of truth for GSTR1 state
 * 
 * Route Flow:
 * - /gst/forms/gstr1 -> Opens drawer flow (business/period selection + OTP)
 * - /gst/gstr1/prepare -> Main prepare page with workflow (with GSTIN/period from state)
 */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GSTR1Workflow from '@/components/gstr1/GSTR1Workflow';
import GSTR1DrawerFlow from '@/components/gstr1/GSTR1DrawerFlow';
import GSTR1PreparePage from '@/components/gstr1/GSTR1PreparePage';
import GSTR1CheckingErrorsPage from '@/components/gstr1/GSTR1CheckingErrorsPage';
import GSTR1UploadToGSTNPage from '@/components/gstr1/GSTR1UploadToGSTNPage';

// Type for navigation state
interface GSTR1NavigationState {
  gstin?: string;
  returnPeriod?: string;
  fromDrawer?: boolean;
  step?: string;
}

export default function GSTR1Page() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [selectedGstins, setSelectedGstins] = useState<string[]>([]);
  const [returnPeriod, setReturnPeriod] = useState<string>('');
  const [isDrawerComplete, setIsDrawerComplete] = useState(false);
  
  // Check if we have state from previous navigation (e.g., from /gst/forms/gstr1)
  const navigationState = location.state as GSTR1NavigationState;
  const hasExistingState = navigationState?.gstin && navigationState?.returnPeriod;
  
  // If we have existing state from navigation, use it directly
  useEffect(() => {
    if (hasExistingState && navigationState.fromDrawer) {
      setSelectedGstins([navigationState.gstin!]);
      setReturnPeriod(navigationState.returnPeriod!);
      setDrawerOpen(false);
      setIsDrawerComplete(true);
    }
  }, [hasExistingState, navigationState]);
  
  // Handle continue from drawer flow - navigate to prepare page with state
  const handleDrawerContinue = (gstins: string[], period: string) => {
    setSelectedGstins(gstins);
    setReturnPeriod(period);
    setDrawerOpen(false);
    setIsDrawerComplete(true);
    
    // Navigate to prepare page with the selected GSTIN and period
    navigate('/gst/gstr1/prepare', {
      replace: true,
      state: {
        gstin: gstins[0],
        returnPeriod: period,
        fromDrawer: true
      }
    });
  };
  
  // If drawer is still open, show the drawer flow
  if (!isDrawerComplete && drawerOpen) {
    return (
      <GSTR1DrawerFlow 
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onContinue={handleDrawerContinue}
      />
    );
  }
  
  // Once drawer is complete, show the main GSTR-1 workflow
  // Use either the selected GSTIN from state or from navigation
  const gstin = selectedGstins[0] || navigationState?.gstin;
  const period = returnPeriod || navigationState?.returnPeriod;
  
  // If we have no GSTIN and period, show the drawer flow
  if (!gstin || !period) {
    return (
      <GSTR1DrawerFlow 
        open={true}
        onOpenChange={(open) => {
          if (!open && !isDrawerComplete) {
            // Do not navigate automatically on close due to unmount race conditions
            // Let the user use browser navigation or explicitly click a button
          }
        }}
        onContinue={handleDrawerContinue}
      />
    );
  }
  
  // Show the main GSTR-1 workflow with selected GSTIN and period
  const showValidationWorkflow = navigationState?.step === 'validation';
  const showPreparePage = navigationState?.step === 'summary' || navigationState?.fromDrawer || !navigationState?.step;
  const showCheckingErrors = navigationState?.step === 'checking-errors';
  const showUploadToGstn = navigationState?.step === 'upload-to-gstn';

  if (showCheckingErrors) {
    return (
      <GSTR1CheckingErrorsPage 
        gstin={gstin}
        returnPeriod={period}
      />
    );
  }

  if (showUploadToGstn) {
    return (
      <GSTR1UploadToGSTNPage 
        gstin={gstin}
        returnPeriod={period}
      />
    );
  }

  if (showValidationWorkflow) {
    return (
      <GSTR1Workflow
        gstin={gstin}
        returnPeriod={period}
        initialStep="validation"
      />
    );
  }

  if (showPreparePage) {
    // Show the new prepare page with table view
    return (
      <GSTR1PreparePage 
        gstin={gstin}
        returnPeriod={period}
      />
    );
  }
  
  return (
    <GSTR1Workflow 
      gstin={gstin}
      returnPeriod={period}
      initialStep={(navigationState?.step as any) || 'upload'}
    />
  );
}
