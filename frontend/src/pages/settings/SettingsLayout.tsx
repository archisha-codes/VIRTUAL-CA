/**
 * Settings Layout
 * ClearTax-like settings with left sidebar navigation
 */

import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Shield, 
  Key, 
  CreditCard, 
  User, 
  Package, 
  Mail, 
  Plug,
  Code,
  Settings as SettingsIcon,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SETTINGS_NAV = [
  {
    title: 'Business',
    items: [
      { name: 'Business Settings', path: '/settings/business', icon: Building2 },
      { name: 'User Access', path: '/settings/user-access', icon: Users },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { name: 'Workspace Details', path: '/settings/workspace/details', icon: SettingsIcon },
      { name: 'Workspace Security', path: '/settings/workspace/security', icon: Shield },
    ],
  },
  {
    title: 'Credentials',
    items: [
      { name: 'GSTIN Credentials', path: '/settings/gstin-credentials', icon: Key },
      { name: 'NIC Credentials', path: '/settings/nic-credentials', icon: CreditCard },
    ],
  },
  {
    title: 'Account',
    items: [
      { name: 'Profile', path: '/settings', icon: User, end: true },
      { name: 'Subscriptions', path: '/settings/subscriptions', icon: Package },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { name: 'DSC Configuration', path: '/settings/dsc-configuration', icon: CreditCard },
      { name: 'Email Configuration', path: '/settings/email-configuration', icon: Mail },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { name: 'Connections', path: '/settings/integrations/connections', icon: Plug },
      { name: 'API Clients', path: '/settings/integrations/api-clients', icon: Code },
    ],
  },
];

export default function SettingsLayout() {
  const location = useLocation();
  
  // Get current page title
  const getPageTitle = () => {
    for (const group of SETTINGS_NAV) {
      for (const item of group.items) {
        if (item.end && location.pathname === '/settings') {
          return item.name;
        }
        if (location.pathname === item.path) {
          return item.name;
        }
      }
    }
    return 'Settings';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-900">{getPageTitle()}</h1>
      </div>
      
      <div className="flex">
        {/* Left Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-73px)] p-4">
          <nav className="space-y-6">
            {SETTINGS_NAV.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = item.end 
                      ? location.pathname === '/settings'
                      : location.pathname === item.path;
                    
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-corporate-primary text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                        {isActive && (
                          <ChevronRight className="h-4 w-4 ml-auto" />
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-4xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
