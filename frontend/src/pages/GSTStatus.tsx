/**
 * GST Data Status Page - GST Portal Sync Status with GSP Integration
 * 
 * Display GST portal sync status with:
 * - GSP Connection Status
 * - GSTIN
 * - Return type
 * - Download status
 * - Last sync
 * - Error logs
 * 
 * Actions:
 * - Download GST data via GSP
 * - Authenticate with GSP
 * - Refresh status
 * - Sync GSTN
 */

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  Download, 
  Cloud, 
  CloudOff, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  AlertTriangle,
  Loader2,
  Zap,
  Link,
  Link2Off,
  Key,
  KeyRound,
  Shield,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GSPProvider {
  provider: string;
  name: string;
  description: string;
  is_supported: boolean;
  features: string[];
}

interface GSPHealth {
  overall_status: string;
  providers: Array<{
    provider: string;
    status: string;
    latency_ms: number | null;
  }>;
  default_provider: string | null;
}

interface GSPAuthStatus {
  gstin: string;
  username: string;
  status: string;
  is_authenticated: boolean;
  expires_at: string | null;
}

interface GSTStatus {
  id: string;
  gstin: string;
  returnType: 'GSTR-1' | 'GSTR-3B' | 'GSTR-2B' | 'GSTR-2A';
  status: 'synced' | 'pending' | 'error' | 'not_downloaded';
  lastSync: string;
  errorLogs?: string[];
  documentCount: number;
  taxValue: number;
}

// Mock data for demonstration
const mockGSTStatus: GSTStatus[] = [
  {
    id: '1',
    gstin: '27AABCU9603R1ZM',
    returnType: 'GSTR-1',
    status: 'synced',
    lastSync: '2026-03-07 10:30:00',
    documentCount: 156,
    taxValue: 813540
  },
  {
    id: '2',
    gstin: '27AABCU9603R1ZM',
    returnType: 'GSTR-3B',
    status: 'synced',
    lastSync: '2026-03-07 10:35:00',
    documentCount: 1,
    taxValue: 168310
  },
  {
    id: '3',
    gstin: '27AABCU9603R1ZM',
    returnType: 'GSTR-2B',
    status: 'synced',
    lastSync: '2026-03-07 09:00:00',
    documentCount: 89,
    taxValue: 423560
  },
  {
    id: '4',
    gstin: '29ABPPR3528G1ZT',
    returnType: 'GSTR-2A',
    status: 'pending',
    lastSync: '2026-03-06 18:00:00',
    documentCount: 0,
    taxValue: 0
  },
  {
    id: '5',
    gstin: '07AAACM3715E1ZB',
    returnType: 'GSTR-1',
    status: 'error',
    lastSync: '2026-03-07 08:00:00',
    errorLogs: ['Authentication failed', 'Session expired'],
    documentCount: 0,
    taxValue: 0
  }
];

export default function GSTStatusPage() {
  const { toast } = useToast();
  const [statusList, setStatusList] = useState<GSTStatus[]>(mockGSTStatus);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  
  // GSP Integration State
  const [gspProviders, setGspProviders] = useState<GSPProvider[]>([]);
  const [gspHealth, setGspHealth] = useState<GSPHealth | null>(null);
  const [authStatus, setAuthStatus] = useState<GSPAuthStatus | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('mock');
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isLoadingGSP, setIsLoadingGSP] = useState(false);
  
  // Auth Form State
  const [gstin, setGstin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Load GSP data on mount
  useEffect(() => {
    loadGSPProviders();
    loadGSPHealth();
  }, []);

  const loadGSPProviders = async () => {
    try {
      const response = await fetch('/api/gsp/providers');
      const data = await response.json();
      setGspProviders(data.providers || []);
    } catch (error) {
      console.error('Failed to load GSP providers:', error);
    }
  };

  const loadGSPHealth = async () => {
    try {
      const response = await fetch('/api/gsp/health');
      const data = await response.json();
      setGspHealth(data);
    } catch (error) {
      console.error('Failed to load GSP health:', error);
    }
  };

  const loadAuthStatus = async (gstin: string) => {
    try {
      const response = await fetch(`/api/gsp/auth/status?gstin=${gstin}`);
      const data = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Failed to load auth status:', error);
    }
  };

  const handleRequestOTP = async () => {
    if (!gstin || !username) {
      toast({
        title: 'Missing information',
        description: 'Please enter GSTIN and username',
        variant: 'destructive',
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      const response = await fetch('/api/gsp/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, username, ip_address: '' })
      });
      const data = await response.json();
      
      if (data.success) {
        setOtpRequested(true);
        setRequestId(data.request_id || '');
        toast({
          title: 'OTP Sent',
          description: 'Please enter the OTP sent to your registered mobile',
        });
      } else {
        throw new Error(data.message || 'Failed to request OTP');
      }
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: 'OTP Request Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter a valid 6-digit OTP',
        variant: 'destructive',
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      const response = await fetch('/api/gsp/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, username, otp, request_id: requestId, ip_address: '' })
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Authentication Successful',
          description: 'You are now authenticated with the GSP',
        });
        setIsAuthDialogOpen(false);
        setOtpRequested(false);
        setOtp('');
        loadAuthStatus(gstin);
      } else {
        throw new Error(data.message || 'Failed to verify OTP');
      }
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: 'Verification Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogin = async () => {
    if (!gstin || !username || !password) {
      toast({
        title: 'Missing information',
        description: 'Please enter GSTIN, username and password',
        variant: 'destructive',
      });
      return;
    }

    setIsAuthenticating(true);
    try {
      const response = await fetch('/api/gsp/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, username, password, ip_address: '' })
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Login Successful',
          description: 'You are now authenticated with the GSP',
        });
        setIsAuthDialogOpen(false);
        loadAuthStatus(gstin);
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: 'Login Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`/api/gsp/auth/logout?gstin=${gstin}`, { method: 'POST' });
      setAuthStatus(null);
      toast({
        title: 'Logged Out',
        description: 'You have been logged out from the GSP',
      });
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: 'Logout Failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: GSTStatus['status']) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'not_downloaded':
        return <CloudOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: GSTStatus['status']) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Synced</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pending</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Error</Badge>;
      case 'not_downloaded':
        return <Badge variant="secondary">Not Downloaded</Badge>;
    }
  };

  const getGSPStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'DEGRADED':
        return <Wifi className="h-4 w-4 text-yellow-500" />;
      case 'UNHEALTHY':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStatusList(prev => prev.map(item => 
        item.id === id 
          ? { ...item, status: 'synced' as const, lastSync: new Date().toISOString().replace('T', ' ').split('.')[0] }
          : item
      ));
      
      toast({
        title: 'Sync successful',
        description: 'GST data has been synced from the portal',
      });
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: 'Failed to sync GST data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setStatusList(prev => prev.map(item => ({
        ...item,
        status: 'synced' as const,
        lastSync: new Date().toISOString().replace('T', ' ').split('.')[0]
      })));
      
      toast({
        title: 'Bulk sync completed',
        description: 'All GST data has been synced successfully',
      });
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: 'Some items failed to sync. Please check individual items.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownload = (item: GSTStatus) => {
    toast({
      title: 'Download started',
      description: `Downloading ${item.returnType} data for ${item.gstin}`,
    });
  };

  const handleRefreshStatus = () => {
    loadGSPHealth();
    toast({
      title: 'Refreshing status',
      description: 'Checking latest status from GST portal',
    });
  };

  return (
    <DashboardLayout title="GST Data Status">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GST Data Status</h1>
            <p className="text-gray-500 mt-1">
              Monitor GST portal sync status and download returns via GSP
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleRefreshStatus}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
            <Button 
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="bg-corporate-primary hover:bg-corporate-primaryHover"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Sync All from GSTN
            </Button>
          </div>
        </div>

        {/* GSP Integration Panel */}
        <Card className="shadow-sm border-corporate-primary">
          <CardHeader className="bg-corporate-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  GSP Integration
                </CardTitle>
                <CardDescription>
                  Manage your GSP connection for GSTN portal access
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {/* GSP Health Status */}
                {gspHealth && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border">
                    {getGSPStatusIcon(gspHealth.overall_status)}
                    <span className="text-sm font-medium">
                      {gspHealth.overall_status === 'HEALTHY' ? 'Connected' : gspHealth.overall_status}
                    </span>
                    {gspHealth.providers[0]?.latency_ms && (
                      <span className="text-xs text-gray-500">
                        ({gspHealth.providers[0].latency_ms}ms)
                      </span>
                    )}
                  </div>
                )}
                
                {/* Auth Status */}
                {authStatus?.is_authenticated ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Authenticated
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleLogout}
                    >
                      <Link2Off className="h-4 w-4 mr-1" />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <Button 
                    size="sm" 
                    onClick={() => setIsAuthDialogOpen(true)}
                    className="bg-corporate-primary"
                  >
                    <KeyRound className="h-4 w-4 mr-1" />
                    Authenticate
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue="providers" className="w-full">
              <TabsList>
                <TabsTrigger value="providers">GSP Providers</TabsTrigger>
                <TabsTrigger value="connection">Connection Status</TabsTrigger>
              </TabsList>
              
              <TabsContent value="providers" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {gspProviders.map((provider) => (
                    <div 
                      key={provider.provider}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedProvider === provider.provider 
                          ? 'border-corporate-primary bg-corporate-primary/5' 
                          : 'hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProvider(provider.provider)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{provider.name}</h3>
                        {provider.is_supported && (
                          <Badge variant="secondary">Supported</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{provider.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {provider.features.slice(0, 3).map((feature, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {provider.features.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{provider.features.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Add Provider Placeholder */}
                  <div className="p-4 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-corporate-primary hover:text-corporate-primary cursor-pointer transition-colors">
                    <Link className="h-8 w-8 mb-2" />
                    <span className="text-sm">Add New GSP</span>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="connection">
                <div className="space-y-4">
                  {gspHealth?.providers.map((provider) => (
                    <div key={provider.provider} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getGSPStatusIcon(provider.status)}
                        <div>
                          <h3 className="font-medium">{provider.provider}</h3>
                          <p className="text-sm text-gray-500">
                            Status: {provider.status}
                          </p>
                        </div>
                      </div>
                      {provider.latency_ms && (
                        <div className="text-right">
                          <p className="text-sm font-medium">{provider.latency_ms}ms</p>
                          <p className="text-xs text-gray-500">Latency</p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {!gspHealth?.providers.length && (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No GSP configured. Configure a GSP provider to get started.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total GSTINs</p>
                  <p className="text-2xl font-bold">{statusList.length}</p>
                </div>
                <Cloud className="h-8 w-8 text-corporate-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Synced</p>
                  <p className="text-2xl font-bold text-green-600">
                    {statusList.filter(s => s.status === 'synced').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {statusList.filter(s => s.status === 'pending').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Errors</p>
                  <p className="text-2xl font-bold text-red-600">
                    {statusList.filter(s => s.status === 'error').length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>GST Portal Sync Status</CardTitle>
            <CardDescription>
              Real-time status of data downloaded from GST portal via GSP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Return Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead className="text-right">Tax Value (₹)</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Error Logs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statusList.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.gstin}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.returnType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        {getStatusBadge(item.status)}
                      </div>
                    </TableCell>
                    <TableCell>{item.documentCount}</TableCell>
                    <TableCell className="text-right">
                      {item.taxValue > 0 ? item.taxValue.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {item.lastSync}
                    </TableCell>
                    <TableCell>
                      {item.errorLogs && item.errorLogs.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-600">
                            {item.errorLogs.length} error(s)
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(item)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSync(item.id)}
                          disabled={syncingId === item.id}
                          title="Sync"
                        >
                          {syncingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Error Details */}
        {statusList.some(s => s.errorLogs && s.errorLogs.length > 0) && (
          <Card className="shadow-sm border-red-200">
            <CardHeader className="bg-red-50">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Error Details
              </CardTitle>
              <CardDescription className="text-red-600">
                Details of sync errors that need attention
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {statusList.filter(s => s.errorLogs).map((item) => (
                <div key={item.id} className="mb-4 last:mb-0 p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-medium">{item.gstin}</span>
                    <Badge variant="destructive">{item.returnType}</Badge>
                  </div>
                  <ul className="space-y-1">
                    {item.errorLogs?.map((log, idx) => (
                      <li key={idx} className="text-sm text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" />
                        {log}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => handleSync(item.id)}
                  >
                    Retry Sync
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Authentication Dialog */}
        <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                GSP Authentication
              </DialogTitle>
              <DialogDescription>
                Authenticate with your GSP provider to access GSTN portal
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="gstin">GSTIN</Label>
                <Input
                  id="gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="27AAAAA1234A1Z1"
                  className="font-mono"
                />
              </div>
              
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your GSP username"
                />
              </div>
              
              {!otpRequested ? (
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your GSP password"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="otp">OTP</Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className="font-mono text-center tracking-widest"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    OTP sent to your registered mobile number
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter className="sm:justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAuthDialogOpen(false);
                  setOtpRequested(false);
                  setOtp('');
                }}
              >
                Cancel
              </Button>
              
              {!otpRequested ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRequestOTP}
                    disabled={isAuthenticating || !gstin || !username}
                  >
                    {isAuthenticating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Key className="h-4 w-4 mr-1" />
                    )}
                    Request OTP
                  </Button>
                  <Button
                    onClick={handleLogin}
                    disabled={isAuthenticating || !gstin || !username || !password}
                    className="bg-corporate-primary"
                  >
                    {isAuthenticating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    Login
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleVerifyOTP}
                  disabled={isAuthenticating || !otp}
                  className="bg-corporate-primary"
                >
                  {isAuthenticating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  )}
                  Verify OTP
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
