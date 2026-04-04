import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, Plus, Check, Loader2, Users } from 'lucide-react';

interface Entity {
  id: string;
  entity_name: string;
  gstin: string;
  owner_user_id: string;
}

// =====================================================
// ENTITY SWITCHER COMPONENT
// =====================================================

export function EntitySwitcher() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isDemoMode, profile } = useAuth();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEntity, setActiveEntity] = useState<string | null>(null);

  // Load entities
  useEffect(() => {
    async function loadEntities() {
      if (!user && !isDemoMode) {
        setLoading(false);
        return;
      }

      if (isDemoMode) {
        // Demo mode - show mock entity
        setEntities([{
          id: 'demo-entity',
          entity_name: profile?.company_name || 'Demo Company',
          gstin: '29ABCDE1234F1Z5',
          owner_user_id: 'demo-user',
        }]);
        setActiveEntity('demo-entity');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('entities')
          .select('*')
          .eq('owner_user_id', user!.id);

        if (error) throw error;

        setEntities(data || []);
        
        // Set active entity from profile
        if (profile?.active_entity) {
          setActiveEntity(profile.active_entity);
        } else if (data && data.length > 0) {
          setActiveEntity(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load entities:', error);
      } finally {
        setLoading(false);
      }
    }

    loadEntities();
  }, [user, isDemoMode, profile]);

  // Switch entity
  const handleSwitchEntity = async (entityId: string) => {
    if (!user && !isDemoMode) return;

    setActiveEntity(entityId);
    
    if (isDemoMode) return;

    try {
      await supabase
        .from('profiles')
        .upsert({
          user_id: user!.id,
          active_entity: entityId,
          updated_at: new Date().toISOString(),
        });

      toast({
        title: 'Entity switched',
        description: 'Your active entity has been changed.',
      });
    } catch (error) {
      console.error('Failed to switch entity:', error);
    }
  };

  // Navigate to create entity
  const handleCreateEntity = () => {
    navigate('/settings?tab=entities');
  };

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  const currentEntity = entities.find(e => e.id === activeEntity);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2"
        >
          <Building2 className="h-4 w-4" />
          <span className="max-w-[150px] truncate">
            {currentEntity?.entity_name || 'Select Entity'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {entities.map((entity) => (
          <DropdownMenuItem
            key={entity.id}
            onClick={() => handleSwitchEntity(entity.id)}
            className="flex items-center justify-between"
          >
            <div className="flex flex-col">
              <span>{entity.entity_name}</span>
              <span className="text-xs text-slate-500">{entity.gstin}</span>
            </div>
            {entity.id === activeEntity && (
              <Check className="h-4 w-4 text-olive-600" />
            )}
          </DropdownMenuItem>
        ))}

        {entities.length > 0 && <DropdownMenuSeparator />}

        <DropdownMenuItem onClick={handleCreateEntity}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Entity
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => navigate('/settings?tab=members')}>
          <Users className="mr-2 h-4 w-4" />
          Manage Members
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
