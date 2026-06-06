import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import GSTAnnouncements from "./pages/GSTAnnouncements";
import Upload from "./pages/Upload";
import Filing from "./pages/Filing";
import Invoices from "./pages/Invoices";
import PurchaseInvoices from "./pages/PurchaseInvoices";
import GSTR1 from "./pages/GSTR1";
import GSTR1Reconciliation from "./pages/GSTR1Reconciliation";
import GSTForms from "./pages/GSTForms";
import GSTR3B from "./pages/GSTR3B";
import GSTR2B from "./pages/GSTR2B";
import GSTR4 from "./pages/GSTR4";
import GSTR6 from "./pages/GSTR6";
import GSTR7 from "./pages/GSTR7";
import GSTR8 from "./pages/GSTR8";
import GSTR9 from "./pages/GSTR9";
import IMS from "./pages/IMS";
import ITC from "./pages/ITC";
import Reports from "./pages/Reports";
import Docs from "./pages/Docs";
import GSTStatus from "./pages/GSTStatus";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import Workspaces from "./pages/Workspaces";
import ERPConnectors from "./pages/ERPConnectors";
import Downloads from "./pages/Downloads";
import Settings from "./pages/Settings";
import SettingsLayout from "./pages/settings/SettingsLayout";
import BusinessSettings from "./pages/settings/BusinessSettings";
import UserAccess from "./pages/settings/UserAccess";
import WorkspaceDetails from "./pages/settings/WorkspaceDetails";
import WorkspaceSecurity from "./pages/settings/WorkspaceSecurity";
import GstinCredentials from "./pages/settings/GstinCredentials";
import NicCredentials from "./pages/settings/NicCredentials";
import Subscriptions from "./pages/settings/Subscriptions";
import DscConfiguration from "./pages/settings/DscConfiguration";
import EmailConfiguration from "./pages/settings/EmailConfiguration";
import IntegrationConnections from "./pages/settings/IntegrationConnections";
import ApiClients from "./pages/settings/ApiClients";
import Profile from "./pages/Profile";
import Members from "./pages/Members";
import SupportChatDrawer, { SupportChatButton } from "./components/support/SupportChatDrawer";

const queryClient = new QueryClient();

// Onboarding route wrapper
function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <SupportChatDrawer />
          <SupportChatButton />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Onboarding Route */}
            <Route path="/onboarding" element={
              <OnboardingRoute>
                <Onboarding />
              </OnboardingRoute>
            } />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/clients" element={
              <ProtectedRoute>
                <Clients />
              </ProtectedRoute>
            } />
            <Route path="/announcements" element={
              <ProtectedRoute>
                <GSTAnnouncements />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            } />
            <Route path="/filing" element={
              <ProtectedRoute>
                <Filing />
              </ProtectedRoute>
            } />
            {/* GST Forms Routes */}
            <Route path="/gst/forms" element={
              <ProtectedRoute>
                <GSTForms />
              </ProtectedRoute>
            } />
            <Route path="/gst/forms/gstr1" element={
              <ProtectedRoute>
                <GSTR1 />
              </ProtectedRoute>
            } />
            
            {/* GSTR-1 Full Flow Routes */}
            <Route path="/gst/gstr1/prepare" element={
              <ProtectedRoute>
                <GSTR1 />
              </ProtectedRoute>
            } />
            <Route path="/upload" element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            } />
            <Route path="/invoices" element={
              <ProtectedRoute>
                <Invoices />
              </ProtectedRoute>
            } />
            <Route path="/purchase-invoices" element={
              <ProtectedRoute>
                <PurchaseInvoices />
              </ProtectedRoute>
            } />
            <Route path="/gstr1" element={
              <ProtectedRoute>
                <GSTR1 />
              </ProtectedRoute>
            } />
            <Route path="/gstr1/reconciliation" element={
              <ProtectedRoute>
                <GSTR1Reconciliation />
              </ProtectedRoute>
            } />
            <Route path="/gstr3b" element={
              <ProtectedRoute>
                <GSTR3B />
              </ProtectedRoute>
            } />
            <Route path="/gstr2b" element={
              <ProtectedRoute>
                <GSTR2B />
              </ProtectedRoute>
            } />
            <Route path="/gstr4" element={
              <ProtectedRoute>
                <GSTR4 />
              </ProtectedRoute>
            } />
            <Route path="/gstr6" element={
              <ProtectedRoute>
                <GSTR6 />
              </ProtectedRoute>
            } />
            <Route path="/gstr7" element={
              <ProtectedRoute>
                <GSTR7 />
              </ProtectedRoute>
            } />
            <Route path="/gstr8" element={
              <ProtectedRoute>
                <GSTR8 />
              </ProtectedRoute>
            } />
            <Route path="/gstr9" element={
              <ProtectedRoute>
                <GSTR9 />
              </ProtectedRoute>
            } />
            <Route path="/ims" element={
              <ProtectedRoute>
                <IMS />
              </ProtectedRoute>
            } />
            <Route path="/ims/inward" element={
              <ProtectedRoute>
                <IMS />
              </ProtectedRoute>
            } />
            <Route path="/ims/outward" element={
              <ProtectedRoute>
                <IMS />
              </ProtectedRoute>
            } />
            <Route path="/itc" element={
              <ProtectedRoute>
                <ITC />
              </ProtectedRoute>
            } />
            <Route path="/itc/ledger" element={
              <ProtectedRoute>
                <ITC />
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/reports/filing" element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/reports/gst" element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/erp-connectors" element={
              <ProtectedRoute>
                <ERPConnectors />
              </ProtectedRoute>
            } />
            <Route path="/downloads" element={
              <ProtectedRoute>
                <Downloads />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/settings/business" replace />} />
              <Route path="business" element={<BusinessSettings />} />
              <Route path="user-access" element={<UserAccess />} />
              <Route path="workspace/details" element={<WorkspaceDetails />} />
              <Route path="workspace/security" element={<WorkspaceSecurity />} />
              <Route path="gstin-credentials" element={<GstinCredentials />} />
              <Route path="nic-credentials" element={<NicCredentials />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="dsc-configuration" element={<DscConfiguration />} />
              <Route path="email-configuration" element={<EmailConfiguration />} />
              <Route path="integrations/connections" element={<IntegrationConnections />} />
              <Route path="integrations/api-clients" element={<ApiClients />} />
            </Route>
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/members" element={
              <ProtectedRoute requireRoles={['owner', 'admin']}>
                <Members />
              </ProtectedRoute>
            } />
            <Route path="/docs" element={
              <ProtectedRoute>
                <Docs />
              </ProtectedRoute>
            } />
            <Route path="/gst-status" element={
              <ProtectedRoute>
                <GSTStatus />
              </ProtectedRoute>
            } />
            <Route path="/workspaces" element={
              <ProtectedRoute>
                <Workspaces />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
