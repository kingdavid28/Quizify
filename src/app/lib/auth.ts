import { supabase, hasSupabaseCredentials } from './supabase';

export interface User {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
  };
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
}

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  user_metadata?: {
    name?: string;
  };
}

// Simple password hashing for local auth fallback (NOT for production - use bcrypt in real app)
// This uses a simple hash function for demo purposes
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

// Local storage fallback for when Supabase is not configured
const localStorageAuth = {
  async signup(email: string, password: string, name: string): Promise<{ user: User; accessToken: string }> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const users: StoredUser[] = JSON.parse(localStorage.getItem('quizify_users') || '[]');
    
    if (users.find(u => u.email === email)) {
      throw new Error('User already exists');
    }

    const passwordHash = await hashPassword(password);
    const newUser: StoredUser = {
      id: `user_${Date.now()}`,
      email,
      passwordHash,
      user_metadata: { name },
    };

    users.push(newUser);
    localStorage.setItem('quizify_users', JSON.stringify(users));

    return this.login(email, password);
  },

  async login(email: string, password: string): Promise<{ user: User; accessToken: string }> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const users: StoredUser[] = JSON.parse(localStorage.getItem('quizify_users') || '[]');
    const user = users.find(u => u.email === email);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate secure access token
    const accessToken = btoa(`${user.id}:${Date.now()}:${Math.random()}`);
    
    // Store session
    const session = {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
      accessToken,
    };
    
    localStorage.setItem('quizify_session', JSON.stringify(session));

    return {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
      accessToken,
    };
  },

  async logout(): Promise<void> {
    localStorage.removeItem('quizify_session');
  },

  async getSession(): Promise<{ user: User | null; accessToken: string | null }> {
    const sessionStr = localStorage.getItem('quizify_session');
    
    if (!sessionStr) {
      return { user: null, accessToken: null };
    }

    try {
      const session = JSON.parse(sessionStr);
      return session;
    } catch {
      localStorage.removeItem('quizify_session');
      return { user: null, accessToken: null };
    }
  },
};

export const authService = {
  async signup(email: string, password: string, name: string): Promise<{ user: User; accessToken: string }> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!hasSupabaseCredentials) {
      return localStorageAuth.signup(email, password, name);
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('Signup failed');

    // Check if email confirmation is required
    if (data.user && !data.session) {
      // Email confirmation is required
      throw new Error('EMAIL_CONFIRMATION_REQUIRED');
    }

    // If we have a session, return it (auto-confirm is enabled)
    if (data.session) {
      return {
        user: data.user as User,
        accessToken: data.session.access_token,
      };
    }

    throw new Error('Signup completed but no session created');
  },

  async login(email: string, password: string): Promise<{ user: User; accessToken: string }> {
    if (!email || !password) {
      throw new Error ('Email and password are required');
    }

    if (!hasSupabaseCredentials) {
      return localStorageAuth.login(email, password);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.session) throw new Error('Login failed');

    return {
      user: data.user as User,
      accessToken: data.session.access_token,
    };
  },

  async logout(): Promise<void> {
    if (!hasSupabaseCredentials) {
      return localStorageAuth.logout();
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession(): Promise<{ user: User | null; accessToken: string | null }> {
    if (!hasSupabaseCredentials) {
      return localStorageAuth.getSession();
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      return {
        user: (data.session?.user as User) || null,
        accessToken: data.session?.access_token || null,
      };
    } catch (error) {
      // Session retrieval failed; return null
      return { user: null, accessToken: null };
    }
  },

  async getCurrentUser(accessToken: string): Promise<User | null> {
    if (!hasSupabaseCredentials) {
      const session = await localStorageAuth.getSession();
      return session.user;
    }

    try {
      const { data, error } = await supabase.auth.getUser(accessToken);
      
      if (error) throw error;
      return data.user as User;
    } catch (error) {
      // User fetch failed; return null
      return null;
    }
  },
};
