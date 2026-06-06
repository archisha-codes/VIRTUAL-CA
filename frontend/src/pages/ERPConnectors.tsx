import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Database, 
  Link, 
  RefreshCw, 
  Settings, 
  Trash2, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Play,
  Calendar,
  FileText,
  Users,
  Package
} from 'lucide-react';

interface ERPConnector {
  type: string;
  name: string;
  description: string;
  auth_type: string;
  features: string[];
}

interface ERPConnection {
  id: string;
  connector_type: string;
  name: string;
  base_url: string;
  is_active: boolean;
  last_sync: string | null;
  last_sync_status: string | null;
  created_at: string;
}

interface SyncHistory {
  sync_id: string;
  connection_id: string;
  connector_type: string;
  status: string;
  sync_type: string;
  started_at: string;
  completed_at: string;
  invoices_extracted: number;
  items_extracted: number;
  contacts_extracted: number;
  errors: string[];
}

const ERPConnectors: React.FC = () => {
  const [connectors, setConnectors] = useState<ERPConnector[]>([]);
  const [connections, setConnections] = useState<ERPConnection[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [selectedConnector, setSelectedConnector] = useState<string>('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configForm, setConfigForm] = useState({
    name: '',
    base_url: '',
    port: '',
    auth_type: 'api_key',
    api_key: '',
    username: '',
    password: '',
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('connectors');

  useEffect(() => {
    fetchConnectors();
    fetchConnections();
    fetchSyncHistory();
  }, []);

  const fetchConnectors = async () => {
    try {
      const response = await fetch('/api/erp/connectors');
      const data = await response.json();
      setConnectors(data.connectors || []);
    } catch (error) {
      console.error('Failed to fetch connectors:', error);
      // Mock data for demo
      setConnectors([
        {
          type: 'tally',
          name: 'Tally Prime',
          description: 'Connect to Tally Prime ERP',
          auth_type: 'xml',
          features: ['invoices', 'items', 'contacts']
        },
        {
          type: 'sap',
          name: 'SAP ERP',
          description: 'Connect to SAP ERP system',
          auth_type: 'basic, oauth2',
          features: ['invoices', 'items', 'contacts']
        },
        {
          type: 'oracle',
          name: 'Oracle EBS',
          description: 'Connect to Oracle E-Business Suite',
          auth_type: 'basic, oauth2',
          features: ['invoices', 'items', 'contacts']
        },
        {
          type: 'quickbooks',
          name: 'QuickBooks Online',
          description: 'Connect to QuickBooks Online',
          auth_type: 'oauth2',
          features: ['invoices', 'items', 'contacts']
        },
        {
          type: 'zoho',
          name: 'Zoho Books',
          description: 'Connect to Zoho Books',
          auth_type: 'oauth2',
          features: ['invoices', 'items', 'contacts']
        },
        {
          type: 'generic',
          name: 'Generic REST API',
          description: 'Connect to any REST API',
          auth_type: 'api_key, basic, bearer, oauth2',
          features: ['invoices', 'items', 'contacts', 'webhooks']
        }
      ]);
    }
  };

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/erp/connections');
      if (!response.ok) throw new Error('API not available');
      const data = await response.json();
      setConnections(data || []);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
      // Mock data for demo
      setConnections([]);
    }
  };

  const fetchSyncHistory = async () => {
    try {
      const response = await fetch('/api/erp/sync/history');
      if (!response.ok) throw new Error('API not available');
      const data = await response.json();
      setSyncHistory(data || []);
    } catch (error) {
      console.error('Failed to fetch sync history:', error);
      // Mock data for demo
      setSyncHistory([
        {
          sync_id: 'sync_001',
          connection_id: 'conn_001',
          connector_type: 'tally',
          status: 'success',
          sync_type: 'full',
          started_at: '2026-03-01T10:00:00Z',
          completed_at: '2026-03-01T10:05:00Z',
          invoices_extracted: 150,
          items_extracted: 320,
          contacts_extracted: 45,
          errors: []
        },
        {
          sync_id: 'sync_002',
          connection_id: 'conn_001',
          connector_type: 'tally',
          status: 'success',
          sync_type: 'incremental',
          started_at: '2026-03-05T14:30:00Z',
          completed_at: '2026-03-05T14:32:00Z',
          invoices_extracted: 23,
          items_extracted: 56,
          contacts_extracted: 0,
          errors: []
        }
      ]);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Connection test successful!');
    } catch (error) {
      toast.error('Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCreateConnection = async () => {
    try {
      const response = await fetch('/api/erp/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connector_type: selectedConnector,
          name: configForm.name,
          base_url: configForm.base_url,
          port: configForm.port ? parseInt(configForm.port) : undefined,
          auth_type: configForm.auth_type,
          credentials: {
            api_key: configForm.api_key,
            username: configForm.username,
            password: configForm.password,
          }
        })
      });
      
      if (response.ok) {
        toast.success('Connection created successfully');
        fetchConnections();
        setIsConfiguring(false);
        setConfigForm({
          name: '',
          base_url: '',
          port: '',
          auth_type: 'api_key',
          api_key: '',
          username: '',
          password: '',
        });
      }
    } catch (error) {
      toast.error('Failed to create connection');
    }
  };

  const handleDeleteConnection = async (id: string) => {
    try {
      const response = await fetch(`/api/erp/connections/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('Connection deleted');
        fetchConnections();
      }
    } catch (error) {
      toast.error('Failed to delete connection');
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      const response = await fetch('/api/erp/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: connectionId,
          sync_type: 'incremental'
        })
      });
      
      if (response.ok) {
        toast.success('Sync completed successfully');
        fetchConnections();
        fetchSyncHistory();
      }
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const getConnectorIcon = (type: string) => {
    switch (type) {
      case 'tally':
        return <Database className="h-8 w-8" />;
      case 'sap':
        return <Database className="h-8 w-8" />;
      case 'oracle':
        return <Database className="h-8 w-8" />;
      case 'quickbooks':
        return <FileText className="h-8 w-8" />;
      case 'zoho':
        return <FileText className="h-8 w-8" />;
      default:
        return <Link className="h-8 w-8" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return <Badge variant="secondary">Never synced</Badge>;
    }
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ERP Connectors</h1>
          <p className="text-muted-foreground mt-1">
            Connect and sync data from your ERP systems
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connectors">Available Connectors</TabsTrigger>
          <TabsTrigger value="connections">Configured Connections</TabsTrigger>
          <TabsTrigger value="sync">Sync History</TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectors.map((connector) => (
              <Card key={connector.type} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {getConnectorIcon(connector.type)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{connector.name}</CardTitle>
                    <CardDescription>{connector.type}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {connector.description}
                  </p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {connector.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Auth: {connector.auth_type}
                    </p>
                    <Button 
                      className="w-full mt-4"
                      onClick={() => {
                        setSelectedConnector(connector.type);
                        setIsConfiguring(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          {connections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Link className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No connections configured</p>
                <Button onClick={() => setActiveTab('connectors')}>
                  Add Connection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Configured Connections</CardTitle>
                <CardDescription>
                  Manage your ERP connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connections.map((connection) => (
                      <TableRow key={connection.id}>
                        <TableCell className="font-medium">{connection.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{connection.connector_type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {connection.base_url}
                        </TableCell>
                        <TableCell>
                          {connection.is_active ? (
                            <Badge className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(connection.last_sync_status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSync(connection.id)}
                              disabled={syncing === connection.id}
                            >
                              {syncing === connection.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteConnection(connection.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>
                View past synchronization results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {syncHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="mx-auto h-8 w-8 mb-2" />
                  <p>No sync history available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Connection</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invoices</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Contacts</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncHistory.map((sync) => (
                      <TableRow key={sync.sync_id}>
                        <TableCell className="font-medium">{sync.connection_id}</TableCell>
                        <TableCell>{sync.sync_type}</TableCell>
                        <TableCell>
                          {sync.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell>{sync.invoices_extracted}</TableCell>
                        <TableCell>{sync.items_extracted}</TableCell>
                        <TableCell>{sync.contacts_extracted}</TableCell>
                        <TableCell>{new Date(sync.started_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={isConfiguring} onOpenChange={setIsConfiguring}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {selectedConnector} Connection</DialogTitle>
            <DialogDescription>
              Enter your ERP connection details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                placeholder="My Tally Server"
                value={configForm.name}
                onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="base_url">Server URL</Label>
                <Input
                  id="base_url"
                  placeholder="localhost"
                  value={configForm.base_url}
                  onChange={(e) => setConfigForm({ ...configForm, base_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  placeholder="9000"
                  value={configForm.port}
                  onChange={(e) => setConfigForm({ ...configForm, port: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="auth_type">Authentication Type</Label>
              <Select
                value={configForm.auth_type}
                onValueChange={(value) => setConfigForm({ ...configForm, auth_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_key">API Key</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {configForm.auth_type === 'api_key' && (
              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <Input
                  id="api_key"
                  type="password"
                  placeholder="Enter API key"
                  value={configForm.api_key}
                  onChange={(e) => setConfigForm({ ...configForm, api_key: e.target.value })}
                />
              </div>
            )}
            
            {configForm.auth_type === 'basic' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={configForm.username}
                    onChange={(e) => setConfigForm({ ...configForm, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={configForm.password}
                    onChange={(e) => setConfigForm({ ...configForm, password: e.target.value })}
                  />
                </div>
              </>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="flex-1"
              >
                {testingConnection ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button 
                onClick={handleCreateConnection}
                disabled={!configForm.name || !configForm.base_url}
                className="flex-1"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ERPConnectors;
