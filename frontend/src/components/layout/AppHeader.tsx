import { Bell, Search, User, Settings, HelpCircle, LogOut, Sparkles } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title = 'Dashboard' }: AppHeaderProps) {
  const { profile, signOut, isDemoMode } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="text-slate-500 hover:text-slate-900" />
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {isDemoMode && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
              <Sparkles className="h-3 w-3" />
              Demo
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search invoices..." 
            className="pl-10 w-64 bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-900 hover:bg-slate-100">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-blue-600 rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 hover:bg-slate-100">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="hidden md:inline text-sm font-medium text-slate-700">
                {profile?.full_name || 'User'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{profile?.full_name || 'User'}</span>
                <span className="text-xs font-normal text-slate-500">
                  {profile?.company_name || 'No company'}
                </span>
                {isDemoMode && (
                  <span className="text-xs font-normal text-amber-600 mt-1">
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
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Support
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
