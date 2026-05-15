/**
 * AuthContext — Backend-first authentication
 *
 * Uses the Virtual CA FastAPI backend for login/signup.
 * Falls back to a "no auth" mode if the backend is unavailable.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

export interface AuthResult {
  error: Error | null;
}

export interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  token: string | null;
  isOnboarding: boolean;

  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInDev: () => Promise<AuthResult>;
  signOut: () => void;
  updateProfile: (data: { full_name?: string }) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'gst_access_token';

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function fetchMe(token: string): Promise<AppUser | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: try to restore session from localStorage
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    fetchMe(stored).then((me) => {
      if (me) {
        setUser(me);
        setToken(stored);
      } else {
        clearToken();
      }
      setLoading(false);
    });
  }, []);

  const applyToken = useCallback(async (tok: string): Promise<AppUser | null> => {
    const me = await fetchMe(tok);
    if (me) {
      storeToken(tok);
      setToken(tok);
      setUser(me);
      return me;
    }
    return null;
  }, []);

  // ─── Sign Up ───────────────────────────────────────────────────────────────

  const signUp = useCallback(
    async (email: string, password: string, fullName?: string): Promise<AuthResult> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: new Error(data.detail || 'Signup failed') };
        }
        await applyToken(data.access_token);
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [applyToken]
  );

  // ─── Sign In ───────────────────────────────────────────────────────────────

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: new Error(data.detail || 'Login failed') };
        }
        await applyToken(data.access_token);
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [applyToken]
  );

  // ─── Dev Login ─────────────────────────────────────────────────────────────

  const signInDev = useCallback(async (): Promise<AuthResult> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/dev-login`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        return { error: new Error(data.detail || 'Dev login failed') };
      }
      await applyToken(data.access_token);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }, [applyToken]);

  // ─── Sign Out ──────────────────────────────────────────────────────────────

  const signOut = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (updateData: { full_name?: string }): Promise<AuthResult> => {
      if (!token) return { error: new Error('Not authenticated') };
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updateData),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: new Error(data.detail || 'Update failed') };
        }
        setUser(data);
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [token]
  );
  
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      if (!token) return { error: new Error('Not authenticated') };
      try {
        const res = await fetch(`${API_BASE}/api/auth/me/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { error: new Error(data.detail || 'Password update failed') };
        }
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [token]
  );

  const value: AuthContextType = {
    user,
    loading,
    token,
    isOnboarding: false,
    signUp,
    signIn,
    signInDev,
    signOut,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
