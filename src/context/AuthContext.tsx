import React, { createContext, useState, useEffect, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export type UserRole = 'client' | 'driver';

export interface UserProfile {
  id: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
}

interface AuthProps {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  devLogin?: (devSession: any) => void;
  devCompleteProfile?: (firstName: string, lastName: string, role: UserRole) => void;
}

const AuthContext = createContext<AuthProps>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No row yet — new user just verified their phone.
        // Leave profile=null so AppNavigator routes to CompleteProfileScreen,
        // which will write the full row (role + name) to Supabase.
        setProfile(null);
      } else if (!error && data) {
        setProfile(data);
      }
    } catch (err) {
      console.log('Erreur récupération profil:', err);
    } finally {
      setLoading(false);
    }
  };


  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const devLogin = (devSession: any) => {
    setSession(devSession);
    setUser(devSession.user);
    // Profile is missing the "role" so it simulates a new user needing setup
    setProfile({ id: devSession.user.id } as UserProfile);
    setLoading(false);
  };

  const devCompleteProfile = (first_name: string, last_name: string, role: UserRole) => {
    if (profile) {
      setProfile({ ...profile, first_name, last_name, role });
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      profile, 
      loading, 
      signOut, 
      refreshProfile: () => user ? fetchProfile(user.id) : Promise.resolve(),
      devLogin,
      devCompleteProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
