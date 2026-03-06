import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Filing from "./pages/Filing";
import Invoices from "./pages/Invoices";
import PurchaseInvoices from "./pages/PurchaseInvoices";
import GSTR1 from "./pages/GSTR1";
import GSTR3B from "./pages/GSTR3B";
import Downloads from "./pages/Downloads";
import Settings from "./pages/Settings";
import GSTR2B from "./pages/GSTR2B";
import IMS from "./pages/IMS";
import ITC from "./pages/ITC";
import Reports from "./pages/Reports";
import Docs from "./pages/Docs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/filing" element={
              <ProtectedRoute>
                <Filing />
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
            <Route path="/downloads" element={
              <ProtectedRoute>
                <Downloads />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/docs" element={
              <ProtectedRoute>
                <Docs />
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
