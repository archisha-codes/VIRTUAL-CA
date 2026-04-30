/**
 * GSTR-1 Drawer Flow Component
 * 
 * ClearTax-style drawer flow for GSTR-3B:
 * 1. Business Selector - Tree picker with PAN, GSTIN, state, status
 * 2. Return Period Selector - Month/Quarter logic
 * 3. OTP Connect Drawer - Connect GSTINs via OTP
 * 4. Prepare Page - Main GSTR-1 prepare interface
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCircle,
  Circle,
  ArrowRight,
  Loader2,
  KeyRound,
  Building2,
  MapPin,
  Shield,
  X,
  ArrowRightLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  getBusinessesWithGstins,
  generateGSTINOTP,
  verifyGSTINOTP,
  BusinessWithGstins
} from '@/lib/api';

// Types for business hierarchy - using API types
interface BusinessEntity extends BusinessWithGstins {
  isExpanded?: boolean;
}

// Return period type
interface ReturnPeriod {
  value: string;
  label: string;
  type: 'monthly' | 'quarterly';
}

// Props for the drawer flow
interface GSTR3BDrawerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (selectedGstins: string[], returnPeriod: string) => void;
}

// Error fallback data for when API fails
const fallbackBusinesses: BusinessEntity[] = [];

// Generate return periods
const generateReturnPeriods = (): ReturnPeriod[] => {
  const periods: ReturnPeriod[] = [];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const currentYear = new Date().getFullYear();

  // Add monthly periods for last 12 months
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentYear, i, 1);
    const month = date.getMonth();
    const year = date.getFullYear();
    const monthStr = String(month + 1).padStart(2, '0');
    periods.push({
      value: `${monthStr}${year}`,
      label: `${months[month]} ${year}`,
      type: 'monthly'
    });
  }

  // Add quarterly periods
  for (let q = 0; q < 4; q++) {
    periods.push({
      value: `Q${q + 1}${currentYear}`,
      label: `${quarters[q]} ${currentYear}`,
      type: 'quarterly'
    });
  }

  return periods;
};

export default function GSTR3BDrawerFlow({ open, onOpenChange, onContinue }: GSTR3BDrawerFlowProps) {
  const { toast } = useToast();
  const { currentOrganization, isDemoMode } = useAuth();

  // State for business selector
  const [businesses, setBusinesses] = useState<BusinessEntity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGstins, setSelectedGstins] = useState<Set<string>>(new Set());
  const [returnPeriod, setReturnPeriod] = useState<string>('');
  const [returnPeriods, setReturnPeriods] = useState<ReturnPeriod[]>([]);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(false);

  // OTP flow state
  const [otpStep, setOtpStep] = useState<'select' | 'credentials' | 'verify' | 'success'>('select');
  const [selectedGstinForOtp, setSelectedGstinForOtp] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpRequestId, setOtpRequestId] = useState<string>('');

  // Current drawer step
  const [currentDrawer, setCurrentDrawer] = useState<'business' | 'otp'>('business');

  // Fetch businesses from API on mount
  useEffect(() => {
    const fetchBusinesses = async () => {
      // Demo mode: use workspaces from localStorage
      if (isDemoMode) {
        try {
          const demoWorkspacesStr = localStorage.getItem('demo_workspaces');
          if (demoWorkspacesStr) {
            const demoWorkspaces = JSON.parse(demoWorkspacesStr);
            // Convert workspaces to businesses format
            const businessesFromWorkspaces: BusinessEntity[] = demoWorkspaces.map((ws: any) => ({
              id: ws.id,
              name: ws.name,
              pan: ws.pan || 'DEMOPAN1234A',
              gstins: (ws.gstins || []).map((g: any, index: number) => ({
                id: g.id,
                gstin: g.gstin,
                legal_name: g.legal_name,
                trade_name: g.trade_name,
                state: g.state,
                status: g.status || 'Regular',
                registration_type: g.registration_type || 'regular',
                isConnected: index % 2 === 0, // 50% connected in demo mode
                is_default: g.is_default || false,
              }))
            }));
            setBusinesses(businessesFromWorkspaces);
          } else {
            setBusinesses(fallbackBusinesses);
          }
        } catch (error) {
          console.error('Error loading demo workspaces:', error);
          setBusinesses(fallbackBusinesses);
        }
        setIsLoadingBusinesses(false);
        return;
      }

      if (!currentOrganization?.id) return;

      setIsLoadingBusinesses(true);
      try {
        const response = await getBusinessesWithGstins(currentOrganization.id);
        if (response.success && response.data) {
          setBusinesses(response.data);
        } else {
          console.warn('Failed to fetch businesses:', response);
          setBusinesses(fallbackBusinesses);
        }
      } catch (error) {
        console.error('Error fetching businesses:', error);
        toast({
          title: 'Error',
          description: 'Failed to load businesses. Using offline mode.',
          variant: 'destructive',
        });
        setBusinesses(fallbackBusinesses);
      } finally {
        setIsLoadingBusinesses(false);
      }
    };

    fetchBusinesses();
  }, [currentOrganization?.id, isDemoMode]);

  // Generate return periods on mount
  useEffect(() => {
    setReturnPeriods(generateReturnPeriods());
    // Set default to current month
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const currentYear = new Date().getFullYear();
    setReturnPeriod(`${currentMonth}${currentYear}`);
  }, []);

  // Filter businesses by search term
  const filteredBusinesses = businesses.filter(business => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      business.name.toLowerCase().includes(term) ||
      business.pan.toLowerCase().includes(term) ||
      business.gstins.some(g =>
        g.gstin.toLowerCase().includes(term) ||
        g.state.toLowerCase().includes(term)
      )
    );
  });

  // Toggle business expansion
  const toggleBusinessExpansion = (businessId: string) => {
    setBusinesses(prev => prev.map(b =>
      b.id === businessId ? { ...b, isExpanded: !b.isExpanded } : b
    ));
  };

  // Toggle GSTIN selection
  const toggleGstinSelection = (gstin: string) => {
    setSelectedGstins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gstin)) {
        newSet.delete(gstin);
      } else {
        newSet.add(gstin);
      }
      return newSet;
    });
  };

  // Handle OTP initiate - calls real backend API
  const handleInitiateOtp = async (gstin: string) => {
    if (!currentOrganization?.id) {
      toast({
        title: 'Error',
        description: 'Organization not found',
        variant: 'destructive',
      });
      return;
    }

    setSelectedGstinForOtp(gstin);
    setIsLoading(true);

    try {
      const response = await generateGSTINOTP(currentOrganization.id, gstin);
      if (response.success && response.otp_request_id) {
        setOtpRequestId(response.otp_request_id);
        setOtpStep('verify');
        toast({
          title: 'OTP Sent',
          description: response.message || `OTP has been sent to registered mobile/email for ${gstin}`,
        });
      } else {
        toast({
          title: 'OTP Failed',
          description: response.message || 'Failed to generate OTP',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error generating OTP:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle credentials submit (legacy - now just triggers OTP)
  const handleCredentialsSubmit = () => {
    // Now handled directly in handleInitiateOtp
    handleInitiateOtp(selectedGstinForOtp);
  };

  // Handle OTP verify - calls real backend API
  const handleOtpVerify = async () => {
    if (otp.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter a valid 6-digit OTP',
        variant: 'destructive',
      });
      return;
    }

    if (!currentOrganization?.id) {
      toast({
        title: 'Error',
        description: 'Organization not found',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await verifyGSTINOTP(
        currentOrganization.id,
        selectedGstinForOtp,
        otp,
        otpRequestId
      );

      if (response.success && response.is_verified) {
        setOtpStep('success');

        // Update the GSTIN as connected
        setBusinesses(prev => prev.map(b => ({
          ...b,
          gstins: b.gstins.map(g =>
            g.gstin === selectedGstinForOtp ? { ...g, isConnected: true } : g
          )
        })));

        toast({
          title: 'GSTIN Connected',
          description: response.message || `${selectedGstinForOtp} has been successfully verified`,
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: response.message || 'Invalid OTP. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle continue from business selector
  const handleBusinessSelectorContinue = () => {
    if (selectedGstins.size === 0) {
      toast({
        title: 'No GSTIN Selected',
        description: 'Please select at least one GSTIN to continue',
        variant: 'destructive',
      });
      return;
    }
    if (!returnPeriod) {
      toast({
        title: 'No Return Period',
        description: 'Please select a return period to continue',
        variant: 'destructive',
      });
      return;
    }

    // Check if any selected GSTINs need connection
    const unconnectedGstins = Array.from(selectedGstins).filter(gstin => {
      for (const business of businesses) {
        const found = business.gstins.find(g => g.gstin === gstin);
        if (found && !found.isConnected) return true;
      }
      return false;
    });

    if (unconnectedGstins.length > 0) {
      setCurrentDrawer('otp');
    } else {
      onContinue(Array.from(selectedGstins), returnPeriod);
    }
  };

  // Handle skip OTP
  const handleSkipOtp = () => {
    onContinue(Array.from(selectedGstins), returnPeriod);
  };

  // Reset OTP flow
  const resetOtpFlow = () => {
    setOtpStep('select');
    setSelectedGstinForOtp('');
    setOtp('');
  };

  // Get connected and unconnected GSTINs
  const connectedGstins = Array.from(selectedGstins).filter(gstin => {
    for (const business of businesses) {
      const found = business.gstins.find(g => g.gstin === gstin);
      if (found && found.isConnected) return true;
    }
    return false;
  });

  const unconnectedGstins = Array.from(selectedGstins).filter(gstin => {
    for (const business of businesses) {
      const found = business.gstins.find(g => g.gstin === gstin);
      if (found && !found.isConnected) return true;
    }
    return false;
  });

  // Render business selector drawer
  const renderBusinessSelector = () => (
    <Drawer open={open && currentDrawer === 'business'} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>GSTR-3B Form</DrawerTitle>
          <DrawerDescription>
            Select businesses and GSTINs for filing
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by business name, PAN, or GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Business Tree */}
          <div className="space-y-2">
            {isLoadingBusinesses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-corporate-primary" />
                <span className="ml-2 text-slate-500">Loading businesses...</span>
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No businesses found</p>
                <p className="text-sm">Add GSTINs to your workspace to get started</p>
              </div>
            ) : (
              filteredBusinesses.map(business => (
                <div key={business.id} className="border rounded-lg overflow-hidden">
                  {/* Business Header */}
                  <div
                    className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => toggleBusinessExpansion(business.id)}
                  >
                    {business.isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                    <Building2 className="h-4 w-4 text-corporate-primary" />
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {business.name}
                    </span>
                    <span className="text-sm text-slate-500">
                      (PAN: {business.pan})
                    </span>
                  </div>

                  {/* GSTIN List */}
                  {business.isExpanded && (
                    <div className="bg-white dark:bg-slate-900">
                      {business.gstins.map(gstin => (
                        <div
                          key={gstin.id}
                          className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-t"
                        >
                          <Checkbox
                            checked={selectedGstins.has(gstin.gstin)}
                            onCheckedChange={() => toggleGstinSelection(gstin.gstin)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{gstin.gstin}</span>
                              <Badge variant="outline" className="text-xs">
                                {gstin.state}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                className={`text-xs ${gstin.status === 'Regular'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                  }`}
                              >
                                {gstin.status}
                              </Badge>
                              {gstin.isConnected && (
                                <Badge className="bg-blue-100 text-blue-700 text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Connected
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )))}
          </div>

          {/* Return Period Selector */}
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Return Period
            </label>
            <Select value={returnPeriod} onValueChange={setReturnPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select return period" />
              </SelectTrigger>
              <SelectContent>
                {returnPeriods.map(period => (
                  <SelectItem key={period.value} value={period.value}>
                    {period.label} ({period.type === 'monthly' ? 'Monthly' : 'Quarterly'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selection Summary */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {selectedGstins.size} GSTIN(s) selected
            </p>
          </div>
        </div>

        <DrawerFooter>
          <Button
            onClick={handleBusinessSelectorContinue}
            className="w-full bg-corporate-primary hover:bg-corporate-primaryHover"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );

  const renderOtpConnectDrawer = () => {
    const totalGstins = selectedGstins.size;
    const unconnectedCount = unconnectedGstins.length;
    const connectedCount = connectedGstins.length;

    return (
      <Drawer open={currentDrawer === 'otp'} onOpenChange={() => { }}>
        <DrawerContent className="w-full sm:w-[400px] mx-auto sm:ml-auto sm:mr-0 h-full right-0 left-auto mt-0 rounded-none border-l">
          <DrawerHeader className="border-b pb-4">
            <div className="flex justify-between items-center">
              <DrawerTitle className="text-lg">Generate OTP to connect GSTINs</DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full"><X className="h-4 w-4" /></Button>
              </DrawerClose>
            </div>
            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center gap-1 text-sm"><Building2 className="h-4 w-4" /> Multi GSTIN({totalGstins})</div>
              <div className="text-sm text-slate-500">Feb 26</div>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
            {otpStep === 'select' && (
              <div className="space-y-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="State name or GSTIN number"
                    className="pl-9 bg-white"
                  />
                </div>

                {/* Unconnected GSTINs Accordion */}
                <div className="border bg-red-50/30 border-red-100 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 cursor-pointer">
                        <ChevronDown className="h-4 w-4 text-red-500" />
                        <span className="font-semibold text-red-600 text-sm">{unconnectedCount}/{totalGstins} GSTINs NOT CONNECTED</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                        You'll need the GSTN username & password to activate and its registered email/phone to verify the OTP
                      </p>
                    </div>
                    {unconnectedCount > 0 && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 h-8 font-medium shadow-none whitespace-nowrap"
                        onClick={() => {
                          setSelectedGstinForOtp(unconnectedGstins[0]);
                          setOtpStep('credentials');
                        }}
                      >
                        <ArrowRightLeft className="mr-2 h-3 w-3" />
                        Connect
                      </Button>
                    )}
                  </div>
                  {unconnectedCount > 0 && (
                    <div className="mt-4 pl-6 space-y-3">
                      {unconnectedGstins.map(gstin => (
                        <div key={gstin} className="flex justify-between items-center text-sm border-t pt-2">
                          <span className="font-mono">{gstin}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Connected GSTINs Accordion */}
                <div className="border bg-slate-50 border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 cursor-pointer pb-2">
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-600 text-sm">{connectedCount}/{totalGstins} GSTINs ARE CONNECTED</span>
                  </div>
                  <p className="text-xs text-slate-500 pl-6">
                    Connected GSTINs appears here
                  </p>
                  {connectedCount > 0 && (
                    <div className="mt-3 pl-6 space-y-2">
                      {connectedGstins.map(gstin => (
                        <div key={gstin} className="flex justify-between items-center text-sm">
                          <span className="font-mono">{gstin}</span>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {otpStep === 'credentials' && (
              <div className="space-y-4">
                <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-lg">
                  <p className="text-sm text-slate-600 mb-4">
                    Enter your GSTN credentials for <span className="font-mono font-medium">{selectedGstinForOtp}</span>
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Username / GSTIN</label>
                      <Input placeholder="Enter username or GSTIN" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Password</label>
                      <Input type="password" placeholder="Enter password" />
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleCredentialsSubmit}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                  ) : (
                    <><KeyRound className="mr-2 h-4 w-4" />Generate OTP</>
                  )}
                </Button>
              </div>
            )}

            {otpStep === 'verify' && (
              <div className="space-y-4">
                <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-lg text-center">
                  <Shield className="h-10 w-10 text-blue-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 mb-4">
                    Enter the 6-digit OTP sent to your registered mobile number/email for
                    <span className="font-mono font-medium block mt-1">{selectedGstinForOtp}</span>
                  </p>
                  <Input
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="text-center text-2xl tracking-widest bg-slate-50"
                    maxLength={6}
                  />
                </div>
                <Button
                  onClick={handleOtpVerify}
                  disabled={isLoading || otp.length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'Verify OTP'}
                </Button>
                <Button variant="outline" onClick={() => setOtpStep('credentials')} className="w-full">
                  Resend OTP
                </Button>
              </div>
            )}

            {otpStep === 'success' && (
              <div className="space-y-4">
                <div className="p-8 bg-green-50 border border-green-100 rounded-lg text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-green-700 mb-1">GSTIN Connected!</h3>
                  <p className="text-sm text-green-600/80">{selectedGstinForOtp} verified</p>
                </div>
                <Button
                  onClick={() => {
                    const remainingUnconnected = unconnectedGstins.filter(g => g !== selectedGstinForOtp);
                    if (remainingUnconnected.length > 0) resetOtpFlow();
                    else onContinue(Array.from(selectedGstins), returnPeriod);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t mt-auto">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 h-10 shadow-none font-medium gap-2"
              onClick={handleSkipOtp}
            >
              Skip
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  };

  return (
    <>
      {renderBusinessSelector()}
      {renderOtpConnectDrawer()}
    </>
  );
}
