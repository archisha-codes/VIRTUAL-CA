import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRoles?: string[];
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Simplified role guard — always renders children in the new model.
// Role enforcement is handled server-side.
interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  fallback?: React.ReactNode;
}

export function RoleGuard({
  children,
  fallback = null,
}: RoleGuardProps) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}

// Organisation guard — kept for compatibility but simplified.
export function OrganizationGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
