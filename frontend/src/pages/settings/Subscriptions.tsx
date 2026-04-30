/**
 * Subscriptions Page
 */

import { useState, useEffect } from 'react';
import { 
  Package, 
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSettingsService, SubscriptionPlan } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';

export default function Subscriptions() {
  const { getSubscriptions } = useSettingsService();
  const { currentOrganization } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getSubscriptions();
      setSubscriptions(data);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Active') {
      return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>;
    }
    if (status === 'Expiring Soon') {
      return <Badge className="bg-yellow-100 text-yellow-700"><AlertTriangle className="h-3 w-3 mr-1" /> Expiring Soon</Badge>;
    }
    return <Badge className="bg-red-100 text-red-700">{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Subscriptions</h2>
        <p className="text-sm text-slate-500">View and manage your workspace subscriptions</p>
      </div>

      {/* Workspace Info */}
      {currentOrganization && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Workspace</p>
            <p className="font-medium">{currentOrganization.name}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-corporate-primary" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No subscriptions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Plan</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Validity</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <span className="font-medium">{sub.plan_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {formatDate(sub.validity_start)} - {formatDate(sub.validity_end)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(sub.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {sub.status === 'Expiring Soon' && (
                          <Badge variant="outline" className="text-orange-600">Notify Admin</Badge>
                        )}
                      </td>
                    </tr>
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
