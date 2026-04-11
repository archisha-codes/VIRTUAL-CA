import { useState } from 'react';
import { Upload, FileText, BarChart3, FileDown, Settings, LogOut, ShoppingCart, Calculator, FolderOpen, ArrowRightLeft, FileCheck, Files, FileBarChart, Receipt, BookOpen, Users, Bell, CheckCircle, AlertCircle, Cloud, FileStack, Building2, Plug, GitCompare } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Main navigation items - reorganized for GST SaaS structure
const mainNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: FolderOpen },
  { title: 'Clients', url: '/clients', icon: Users },
  { title: 'Workspaces', url: '/workspaces', icon: Building2 },
  { title: 'ERP Connectors', url: '/erp-connectors', icon: Plug },
];

// Filing section
const filingNavItems = [
  { title: 'Filing Status', url: '/filing', icon: CheckCircle },
  { title: 'GSTR-1', url: '/gstr1', icon: FileText },
  { title: 'GSTR-1 Recon', url: '/gstr1/reconciliation', icon: GitCompare },
  { title: 'GSTR-3B', url: '/gstr3b', icon: Calculator },
  { title: 'GSTR-2B', url: '/gstr2b', icon: FileCheck },
  { title: 'GSTR-4', url: '/gstr4', icon: FileText },
  { title: 'GSTR-6', url: '/gstr6', icon: FileText },
  { title: 'GSTR-7', url: '/gstr7', icon: FileText },
  { title: 'GSTR-8', url: '/gstr8', icon: FileText },
  { title: 'GSTR-9', url: '/gstr9', icon: FileStack },
];

// GST Data Status section
const gstStatusNavItems = [
  { title: 'GST Data Status', url: '/gst-status', icon: Cloud },
];

// Notifications section
const notificationsNavItems = [
  { title: 'Notifications', url: '/notifications', icon: Bell },
];

// IMS section
const imsNavItems = [
  { title: 'Inward Supplies', url: '/ims/inward', icon: ArrowRightLeft },
  { title: 'Outward Supplies', url: '/ims/outward', icon: ArrowRightLeft },
];

// ITC section
const itcNavItems = [
  { title: 'Credit Ledger', url: '/itc/ledger', icon: Files },
  { title: 'GSTR-2B', url: '/gstr2b', icon: FileCheck },
];

// Upload section
const uploadNavItems = [
  { title: 'Sales Invoices', url: '/invoices', icon: Receipt },
  { title: 'Purchase Invoices', url: '/purchase-invoices', icon: ShoppingCart },
];

// Reports section
const reportsNavItems = [
  { title: 'Filing Tracker', url: '/reports/filing', icon: BarChart3 },
  { title: 'GST Reports', url: '/reports/gst', icon: FileBarChart },
];

// GST Announcements section
const announcementsNavItems = [
  { title: 'GST Announcements', url: '/announcements', icon: Bell },
];

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const [filingOpen, setFilingOpen] = useState(true);
  const [imsOpen, setImsOpen] = useState(true);
  const [itcOpen, setItcOpen] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-corporate-primary to-corporate-dark flex items-center justify-center">
            <span className="text-lg font-bold text-white">V</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">Virtual CA</span>
            <span className="text-xs text-sidebar-foreground/60">GST Compliance</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Dashboard and Main Items */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/dashboard" 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <FolderOpen className="h-5 w-5" />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/workspaces" 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Building2 className="h-5 w-5" />
                    <span>Workspaces</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/erp-connectors" 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Plug className="h-5 w-5" />
                    <span>ERP Connectors</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Filing Section */}
        <Collapsible open={filingOpen} onOpenChange={setFilingOpen} className="mt-2">
          <SidebarGroup>
            <CollapsibleTrigger className="flex items-center w-full px-3 py-2 text-sidebar-foreground/50 text-xs uppercase tracking-wider hover:text-sidebar-foreground/70">
              {filingOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
              Filing
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filingNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* GST Data Status Section */}
        <SidebarGroup className="mt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {gstStatusNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Reconciliations Section */}
        <Collapsible open={imsOpen} onOpenChange={setImsOpen} className="mt-2">
          <SidebarGroup>
            <CollapsibleTrigger className="flex items-center w-full px-3 py-2 text-sidebar-foreground/50 text-xs uppercase tracking-wider hover:text-sidebar-foreground/70">
              {imsOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
              Reconciliations
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {imsNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* ITC Section */}
        <Collapsible open={itcOpen} onOpenChange={setItcOpen} className="mt-2">
          <SidebarGroup>
            <CollapsibleTrigger className="flex items-center w-full px-3 py-2 text-sidebar-foreground/50 text-xs uppercase tracking-wider hover:text-sidebar-foreground/70">
              {itcOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
              ITC
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {itcNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Upload Section */}
        <Collapsible open={uploadOpen} onOpenChange={setUploadOpen} className="mt-2">
          <SidebarGroup>
            <CollapsibleTrigger className="flex items-center w-full px-3 py-2 text-sidebar-foreground/50 text-xs uppercase tracking-wider hover:text-sidebar-foreground/70">
              {uploadOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
              Upload
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {uploadNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/upload" 
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <Upload className="h-5 w-5" />
                        <span>Upload Data</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Reports Section */}
        <Collapsible open={reportsOpen} onOpenChange={setReportsOpen} className="mt-2">
          <SidebarGroup>
            <CollapsibleTrigger className="flex items-center w-full px-3 py-2 text-sidebar-foreground/50 text-xs uppercase tracking-wider hover:text-sidebar-foreground/70">
              {reportsOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
              Reports
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {reportsNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.url} 
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to="/downloads" 
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <FileDown className="h-5 w-5" />
                        <span>Downloads</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* GST Announcements Section */}
        <SidebarGroup className="mt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/announcements" 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Bell className="h-5 w-5" />
                    <span>GST Announcements</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/notifications" 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <AlertCircle className="h-5 w-5" />
                    <span>Notifications</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider px-3 py-2">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/docs" 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <BookOpen className="h-5 w-5" />
                    <span>Docs & Guide</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/settings" 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Settings className="h-5 w-5" />
                    <span>Profile Settings</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/members" 
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <Users className="h-5 w-5" />
                    <span>Team Members</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-medium text-sidebar-foreground">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {profile?.company_name || 'No company'}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
