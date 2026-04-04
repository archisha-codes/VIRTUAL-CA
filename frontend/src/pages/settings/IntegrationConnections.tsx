/**
 * Integration Connections Page
 */

import { useState, useEffect } from 'react';
import { 
  Plug, 
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSettingsService, Integration } from '@/services/settingsService';
import { useAuth } from '@/contexts/AuthContext';

export default function IntegrationConnections() {
  const { getIntegrations, toggleIntegration } = useSettingsService();
  const { isOrganizationAdmin } = useAuth();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getIntegrations();
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (integrationId: string, currentStatus: boolean) => {
    setConnecting(integrationId);
    try {
      await toggleIntegration(integrationId, !currentStatus);
      toast({
        title: currentStatus ? 'Disconnected' : 'Connected',
        description: `Integration ${currentStatus ? 'disconnected from' : 'connected to'} successfully`,
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update integration',
        variant: 'destructive',
      });
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Connections</h2>
        <p className="text-sm text-slate-500">Connect with third-party applications</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-corporate-primary" />
            </div>
          ) : integrations.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No integrations available
            </div>
          ) : (
            <div className="divide-y">
              {integrations.map((integration) => (
                <div 
                  key={integration.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Plug className="h-6 w-6 text-slate-500" />
                    </div>
                    <div>
                      <h3 className="font-medium">{integration.name}</h3>
                      <p className="text-sm text-slate-500">{integration.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {integration.is_connected ? (
                      <>
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm">Connected</span>
                        </div>
                        {isOrganizationAdmin() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggle(integration.id, true)}
                            disabled={connecting === integration.id}
                          >
                            Disconnect
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-slate-400">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm">Not Connected</span>
                        </div>
                        {isOrganizationAdmin() && (
                          <Button
                            size="sm"
                            onClick={() => handleToggle(integration.id, false)}
                            disabled={connecting === integration.id}
                          >
                            Connect
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
