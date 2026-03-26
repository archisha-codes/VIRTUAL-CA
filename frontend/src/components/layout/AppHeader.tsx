import { useState, useEffect } from 'react';
import { Bell, Search, User, Settings, HelpCircle, LogOut, Sparkles, Sun, Moon, Monitor, Building2, ChevronDown, ArrowRight, Store } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

interface AppHeaderProps {
  title?: string;
}

interface Workspace {
  id: string;
  pan: string;
  name: string;
  gstin_count: number;
  active_gstin_count: number;
}

interface ActiveGSTIN {
  gstin_id: string;
  gstin: string;
  legal_name: string;
  workspace_id: string;
  workspace_name: string;
  state: string;
  status: string;
}

interface Client {
  id: string;
  business_name: string;
  gstin: string;
  state: string;
  email?: string;
  phone?: string;
}

const API_BASE = '/api';

export function AppHeader({ title = 'Dashboard' }: AppHeaderProps) {
  const { profile, signOut, isDemoMode, user } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [activeGSTIN, setActiveGSTIN] = useState<ActiveGSTIN | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientOpen, setClientOpen] = useState(false);

  // Get user ID for API calls - use actual user context only
  const userId = user?.id || '';

  useEffect(() => {
    if (userId) {
      fetchWorkspaces();
      fetchClients();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedWorkspace) {
      fetchActiveGSTIN(selectedWorkspace.id);
    }
  }, [selectedWorkspace]);

  const fetchWorkspaces = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_BASE}/workspaces?user_id=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data);
        if (data.length > 0) {
          setSelectedWorkspace(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    }
  };

  const fetchActiveGSTIN = async (workspaceId: string) => {
    if (!userId) return;  // Require user to be logged in
    try {
      const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/active-gstin?user_id=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const data = await response.json();
        setActiveGSTIN(data);
      } else {
        setActiveGSTIN(null);
      }
    } catch (error) {
      console.error('Failed to fetch active GSTIN:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await fetch(`${API_BASE}/clients`);
      if (response.ok) {
        const data = await response.json();
        setClients(data);
        if (data.length > 0) {
          setSelectedClient(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const switchGSTIN = async (gstinId: string) => {
    if (!selectedWorkspace || !userId) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/workspaces/${selectedWorkspace.id}/switch-gstin?user_id=${encodeURIComponent(userId)}&gstin_id=${gstinId}`,
        { method: 'POST' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setActiveGSTIN(data);
      }
    } catch (error) {
      console.error('Failed to switch GSTIN:', error);
    }
  };

  const handleClientChange = (client: Client) => {
    setSelectedClient(client);
    setClientOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 flex items-center justify-between shadow-sm transition-colors duration-200">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100" />
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          {isDemoMode && (
            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700 gap-1">
              <Sparkles className="h-3 w-3" />
              Demo
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Workspace & GSTIN Selector */}
        <Popover open={workspaceOpen} onOpenChange={setWorkspaceOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="hidden md:flex gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-medium">
                {selectedWorkspace?.name || 'Select Workspace'}
              </span>
              {activeGSTIN && (
                <>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <Badge variant="secondary" className="font-mono text-xs">
                    {activeGSTIN.gstin}
                  </Badge>
                </>
              )}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm text-slate-500 dark:text-slate-400 mb-2">
                  Select Workspace
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {workspaces.map((ws) => (
                    <Button
                      key={ws.id}
                      variant={selectedWorkspace?.id === ws.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-left"
                      onClick={() => {
                        setSelectedWorkspace(ws);
                        setWorkspaceOpen(false);
                      }}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{ws.name}</div>
                        <div className="text-xs text-slate-500">
                          {ws.active_gstin_count}/{ws.gstin_count} GSTINs • {ws.pan}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
              
              {selectedWorkspace && (
                <div className="border-t pt-3">
                  <h4 className="font-medium text-sm text-slate-500 dark:text-slate-400 mb-2">
                    Quick Switch GSTIN
                  </h4>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left"
                    onClick={() => navigate('/workspaces')}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    View All GSTINs
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Client/GSTIN Selector */}
        <Popover open={clientOpen} onOpenChange={setClientOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Store className="h-4 w-4" />
              <span className="text-sm font-medium">
                {selectedClient?.business_name || 'Select Client'}
              </span>
              {selectedClient && (
                <>
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selectedClient.gstin}
                  </Badge>
                </>
              )}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm text-slate-500 dark:text-slate-400 mb-2">
                  Select Client (GSTIN)
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {clients.map((client) => (
                    <Button
                      key={client.id}
                      variant={selectedClient?.id === client.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start text-left"
                      onClick={() => handleClientChange(client)}
                    >
                      <Store className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{client.business_name}</div>
                        <div className="text-xs text-slate-500">
                          {client.gstin} • {client.state}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Mobile GSTIN Display */}
        <div className="md:hidden">
          {activeGSTIN ? (
            <Badge variant="secondary" className="font-mono text-xs">
              {activeGSTIN.gstin}
            </Badge>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => navigate('/workspaces')}>
              <Building2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input 
            placeholder="Search invoices..." 
            className="pl-10 w-64 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-purple-500 focus:ring-purple-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {resolvedTheme === 'dark' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setTheme('light')}
              className={theme === 'light' ? 'bg-slate-100 dark:bg-slate-800' : ''}
            >
              <Sun className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setTheme('dark')}
              className={theme === 'dark' ? 'bg-slate-100 dark:bg-slate-800' : ''}
            >
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setTheme('system')}
              className={theme === 'system' ? 'bg-slate-100 dark:bg-slate-800' : ''}
            >
              <Monitor className="mr-2 h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="relative text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-purple-600 rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="hidden md:inline text-sm font-medium text-slate-700 dark:text-slate-200">
                {profile?.full_name || 'User'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{profile?.full_name || 'User'}</span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  {profile?.company_name || 'No company'}
                </span>
                {isDemoMode && (
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400 mt-1">
                    Demo Mode
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <User className="mr-2 h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/workspaces')}>
              <Building2 className="mr-2 h-4 w-4" />
              Workspaces
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
