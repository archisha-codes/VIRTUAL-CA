import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { MembershipRole } from '@/integrations/supabase/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRoles?: MembershipRole[];
}

export function ProtectedRoute({ children, requireRoles }: ProtectedRouteProps) {
  const { user, loading, isDemoMode, isOnboarding, hasRole, currentOrganization } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Allow access if user is logged in OR in demo mode
  if (!user && !isDemoMode) {
    return <Navigate to="/auth" replace />;
  }

  // Check role requirements if specified
  if (requireRoles && requireRoles.length > 0) {
    // If no organization is selected, redirect to onboarding
    if (!currentOrganization) {
      return <Navigate to="/onboarding" replace />;
    }
    
    // Check if user has required role
    if (!hasRole(requireRoles)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

// =====================================================
// ROLE-BASED ACCESS COMPONENT
// =====================================================

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: Array<'owner' | 'admin' | 'member'>;
  fallback?: React.ReactNode;
}

export function RoleGuard({ 
  children, 
  allowedRoles = ['owner', 'admin', 'member'],
  fallback = null 
}: RoleGuardProps) {
  const { hasRole, currentOrganization, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // If no organization is selected, show fallback
  if (!currentOrganization) {
    return <>{fallback}</>;
  }

  // Check if user has required role
  if (hasRole(allowedRoles)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

// =====================================================
// ORGANIZATION REQUIREMENT GUARD
// =====================================================

interface OrganizationGuardProps {
  children: React.ReactNode;
}

export function OrganizationGuard({ children }: OrganizationGuardProps) {
  const { currentOrganization, loading, isDemoMode } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Demo mode always has an organization
  if (isDemoMode) {
    return <>{children}</>;
  }

  // If no organization, show message
  if (!currentOrganization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="bg-olive-50 p-6 rounded-lg max-w-md">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No Organization Found
          </h3>
          <p className="text-slate-600 mb-4">
            You need to create or join an organization to access this feature.
          </p>
          <Navigate to="/onboarding" replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
