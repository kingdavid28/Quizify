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

// Local storage fallback for when Supabase is not configured
const localStorageAuth = {
  async signup(email: string, password: string, name: string) {
    // Check if user already exists
    const users = JSON.parse(localStorage.getItem('quizify_users') || '[]');
    
    if (users.find((u: any) => u.email === email)) {
      throw new Error('User already exists');
    }

    // Create new user
    const user = {
      id: `user_${Date.now()}`,
      email,
      password, // In production, never store plain passwords!
      user_metadata: { name },
    };

    users.push(user);
    localStorage.setItem('quizify_users', JSON.stringify(users));

    return this.login(email, password);
  },

  async login(email: string, password: string) {
    const users = JSON.parse(localStorage.getItem('quizify_users') || '[]');
    const user = users.find((u: any) => u.email === email && u.password === password);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Generate mock access token
    const accessToken = `mock_token_${Date.now()}`;
    
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

    return session;
  },

  async logout() {
    localStorage.removeItem('quizify_session');
  },

  async getSession() {
    const session = localStorage.getItem('quizify_session');
    
    if (!session) {
      return { user: null, accessToken: null };
    }

    return JSON.parse(session);
  },
};

export const authService = {
  async signup(email: string, password: string, name: string) {
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
        user: data.user,
        accessToken: data.session.access_token,
      };
    }

    throw new Error('Signup completed but no session created');
  },

  async login(email: string, password: string) {
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
      user: data.user,
      accessToken: data.session.access_token,
    };
  },

  async logout() {
    if (!hasSupabaseCredentials) {
      return localStorageAuth.logout();
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    if (!hasSupabaseCredentials) {
      return localStorageAuth.getSession();
    }

    const { data, error } = await supabase.auth.getSession();
    
    if (error) throw error;

    return {
      user: data.session?.user || null,
      accessToken: data.session?.access_token || null,
    };
  },

  async getCurrentUser(accessToken: string) {
    if (!hasSupabaseCredentials) {
      const session = localStorageAuth.getSession();
      return (await session).user;
    }

    const { data, error } = await supabase.auth.getUser(accessToken);
    
    if (error) throw error;
    return data.user;
  },
};
