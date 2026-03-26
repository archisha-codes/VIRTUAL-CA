/**
 * Business Settings Page
 * Manage businesses and GSTINs
 */

import { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSettingsService, BusinessNode } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';

export default function BusinessSettings() {
  const { getBusinesses, addBusiness } = useSettingsService();
  const { isOrganizationAdmin } = useAuth();
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<BusinessNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBusiness, setNewBusiness] = useState({ name: '', pan: '', gstin: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getBusinesses();
      setBusinesses(data);
    } catch (error) {
      console.error('Failed to load businesses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load businesses',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleAddBusiness = async () => {
    if (!newBusiness.name) return;
    
    setAdding(true);
    try {
      await addBusiness({
        name: newBusiness.name,
        pan: newBusiness.pan || undefined,
        gstin: newBusiness.gstin || undefined,
      });
      toast({ title: 'Business added successfully' });
      setShowAddForm(false);
      setNewBusiness({ name: '', pan: '', gstin: '' });
      loadData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add business', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  // Filter businesses based on search
  const filteredBusinesses = businesses.filter(business => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      business.name.toLowerCase().includes(term) ||
      business.gstin?.toLowerCase().includes(term) ||
      business.pan?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Business Settings</h2>
        <p className="text-sm text-slate-500">View and manage all the businesses in your workspace</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, GSTIN, or PAN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {isOrganizationAdmin() && (
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Business
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="font-medium">Add New Business</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Business Name</label>
                <Input
                  value={newBusiness.name}
                  onChange={(e) => setNewBusiness({ ...newBusiness, name: e.target.value })}
                  placeholder="My Business"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">PAN (Optional)</label>
                <Input
                  value={newBusiness.pan}
                  onChange={(e) => setNewBusiness({ ...newBusiness, pan: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">GSTIN (Optional)</label>
                <Input
                  value={newBusiness.gstin}
                  onChange={(e) => setNewBusiness({ ...newBusiness, gstin: e.target.value.toUpperCase() })}
                  placeholder="29ABCDE1234F1Z5"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button onClick={handleAddBusiness} disabled={adding || !newBusiness.name}>
                {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Business
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-corporate-primary" />
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {searchTerm ? 'No businesses match your search' : 'No businesses found. Add one to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 w-8"></th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">PAN &gt; GSTIN &gt; Branch</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Type</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBusinesses.map((business) => (
                    <BusinessRow
                      key={business.id}
                      business={business}
                      expandedNodes={expandedNodes}
                      onToggleExpand={toggleExpand}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Business Row Component with expand/collapse
interface BusinessRowProps {
  business: BusinessNode;
  expandedNodes: Set<string>;
  onToggleExpand: (id: string) => void;
  depth?: number;
}

function BusinessRow({ business, expandedNodes, onToggleExpand, depth = 0 }: BusinessRowProps) {
  const isExpanded = expandedNodes.has(business.id);
  const hasChildren = business.children && business.children.length > 0;

  return (
    <>
      <tr className="border-b hover:bg-slate-50">
        <td className="py-3 px-4">
          {hasChildren ? (
            <button
              onClick={() => onToggleExpand(business.id)}
              className="p-1 hover:bg-slate-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-6 inline-block" />
          )}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="font-medium">{business.name}</span>
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="space-y-1">
            <div className="font-mono text-sm">{business.pan || '-'}</div>
            <div className="font-mono text-sm text-slate-500">
              {business.gstin || '-'}
              {business.branch_code && <span className="ml-1">&gt; {business.branch_code}</span>}
            </div>
          </div>
        </td>
        <td className="py-3 px-4">
          <Badge variant="outline">{business.type || 'Business'}</Badge>
        </td>
        <td className="py-3 px-4 text-right">
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      {hasChildren && isExpanded && business.children!.map((child) => (
        <BusinessRow
          key={child.id}
          business={child}
          expandedNodes={expandedNodes}
          onToggleExpand={onToggleExpand}
          depth={depth + 1}
        />
      ))}
    </>
  );
}
