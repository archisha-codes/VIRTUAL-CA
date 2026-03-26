import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Building2, 
  Phone, 
  Mail, 
  MapPin,
  FileText,
  CreditCard,
  Edit,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getClients, createClient, deleteClient, Client, CreateClientRequest, lookupGSTIN, GSTINDetails } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClient, setNewClient] = useState<CreateClientRequest>({
    business_name: '',
    gstin: '',
    email: '',
    phone: ''
  });
  const [gstinLookup, setGstinLookup] = useState('');
  const [gstinData, setGstinData] = useState<GSTINDetails | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await getClients(searchTerm || undefined);
      setClients(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load clients',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const data = await getClients(searchTerm || undefined);
      setClients(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to search clients',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async () => {
    try {
      if (!newClient.business_name || !newClient.gstin || !newClient.email) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          variant: 'destructive'
        });
        return;
      }

      const created = await createClient(newClient);
      setClients([...clients, created]);
      setShowAddModal(false);
      setNewClient({ business_name: '', gstin: '', email: '', phone: '' });
      toast({
        title: 'Success',
        description: 'Client created successfully'
      });
    } catch (error) {
      const err = error as Error;
      toast({
        title: 'Error',
        description: err.message || 'Failed to create client',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await deleteClient(clientId);
      setClients(clients.filter(c => c.id !== clientId));
      toast({
        title: 'Success',
        description: 'Client deleted successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete client',
        variant: 'destructive'
      });
    }
  };

  const handleGSTINLookup = async () => {
    if (!gstinLookup) return;
    
    try {
      setLookupLoading(true);
      setLookupError('');
      setGstinData(null);
      
      const response = await lookupGSTIN(gstinLookup);
      setGstinData(response.data);
      
      // Auto-fill the form with GSTIN data
      setNewClient({
        ...newClient,
        business_name: response.data.trade_name || response.data.legal_name,
        gstin: response.data.gstin
      });
    } catch (error) {
      const err = error as Error;
      setLookupError(err.message || 'Failed to lookup GSTIN');
    } finally {
      setLookupLoading(false);
    }
  };

  // Filter clients for display (in a real app, filtering would be done server-side)
  const filteredClients = clients; // Already filtered by API when search is used

  return (
    <DashboardLayout title="Clients">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{clients.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-corporate-primary">
                {clients.filter(c => new Date(c.created_at).getMonth() === new Date().getMonth()).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or GSTIN..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <Button 
            className="bg-corporate-primary hover:bg-corporate-primaryHover"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>

        {/* Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Client List</CardTitle>
            <CardDescription>
              Manage your GST clients and their filing details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {client.business_name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{client.gstin}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {client.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {client.phone}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(client.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <FileText className="h-4 w-4 mr-2" />
                              View Invoices
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClient(client.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Client Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Add New Client</CardTitle>
                <CardDescription>Enter client details or search by GSTIN</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* GSTIN Lookup */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">GSTIN Lookup</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter GSTIN (e.g., 27AABCU9603R1ZM)"
                      value={gstinLookup}
                      onChange={(e) => setGstinLookup(e.target.value.toUpperCase())}
                      className="font-mono"
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleGSTINLookup}
                      disabled={lookupLoading || !gstinLookup}
                    >
                      {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                    </Button>
                  </div>
                  
                  {/* GSTIN Lookup Result */}
                  {lookupError && (
                    <div className="flex items-center gap-2 text-red-500 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      {lookupError}
                    </div>
                  )}
                  
                  {gstinData && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">GSTIN Found!</span>
                      </div>
                      <div className="text-sm text-green-600">
                        <p><strong>Legal Name:</strong> {gstinData.legal_name}</p>
                        <p><strong>Trade Name:</strong> {gstinData.trade_name}</p>
                        <p><strong>Status:</strong> {gstinData.status}</p>
                        <p><strong>State:</strong> {gstinData.state}</p>
                        <p><strong>Registration Date:</strong> {gstinData.registration_date}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Business Name *</label>
                    <Input 
                      placeholder="Enter business name"
                      value={newClient.business_name}
                      onChange={(e) => setNewClient({...newClient, business_name: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">GSTIN *</label>
                    <Input 
                      placeholder="Enter GSTIN"
                      value={newClient.gstin}
                      onChange={(e) => setNewClient({...newClient, gstin: e.target.value.toUpperCase()})}
                      className="font-mono"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email *</label>
                    <Input 
                      type="email"
                      placeholder="Enter email"
                      value={newClient.email}
                      onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input 
                      placeholder="Enter phone number"
                      value={newClient.phone}
                      onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setShowAddModal(false);
                    setNewClient({ business_name: '', gstin: '', email: '', phone: '' });
                    setGstinData(null);
                    setGstinLookup('');
                  }}>
                    Cancel
                  </Button>
                  <Button className="bg-corporate-primary hover:bg-corporate-primaryHover" onClick={handleAddClient}>
                    Add Client
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
