import type { User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

// Supabase Auth identities are keyed by email, so username accounts are
// mapped to a synthetic, undeliverable email — see migration-004.sql for the
// required Supabase Dashboard setting this depends on.
const USERNAME_EMAIL_DOMAIN = 'users.homecircle.internal';
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}

export type FamilySession = {
  displayName: string;
  familyName: string | null;
  inviteCode: string | null;
  isCreator: boolean;
  joinedAt: string | null;
  profileComplete: boolean;
  signedIn: boolean;
};

type FamilyRow = { id: string; name: string; invite_code: string; created_by: string };

type SessionContextValue = {
  completeProfile: (displayName: string) => Promise<void>;
  createFamily: (familyName: string) => Promise<void>;
  familyId: string | null;
  hydrated: boolean;
  joinFamily: (inviteCode: string) => Promise<void>;
  leaveFamily: () => Promise<void>;
  refresh: () => Promise<void>;
  resetAll: () => Promise<void>;
  session: FamilySession;
  signIn: (displayName?: string) => Promise<void>;
  signInWithApple: (identityToken: string, displayName?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signUpWithUsername: (username: string, password: string, displayName?: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  userId: string | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function FamilySessionProvider({ children }: { children: ReactNode }) {
  const [authLoaded, setAuthLoaded] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ display_name: string } | null>(null);
  const [family, setFamily] = useState<{ joinedAt: string; row: FamilyRow } | null>(null);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.session?.user ?? null);
      setAuthLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setUser(newSession?.user ?? null);
      setAuthLoaded(true);
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refetchProfileAndFamily(userId: string) {
    const [{ data: profileRow }, { data: memberRow }] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
      supabase.from('family_members').select('family_id, joined_at').eq('user_id', userId).maybeSingle(),
    ]);
    setProfile({ display_name: profileRow?.display_name ?? '' });

    if (!memberRow) {
      setFamily(null);
      return;
    }

    const { data: familyRow } = await supabase
      .from('families')
      .select('id, name, invite_code, created_by')
      .eq('id', memberRow.family_id)
      .maybeSingle();

    setFamily(familyRow ? { joinedAt: memberRow.joined_at, row: familyRow as FamilyRow } : null);
  }

  useEffect(() => {
    if (!authLoaded) return;
    if (!user) {
      setProfile(null);
      setFamily(null);
      setDataLoaded(true);
      return;
    }
    setDataLoaded(false);
    refetchProfileAndFamily(user.id).finally(() => setDataLoaded(true));
  }, [authLoaded, user]);

  async function maybeSetDisplayName(userId: string, displayName?: string) {
    const trimmed = displayName?.trim();
    if (!trimmed) return;
    const { data: existing } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
    if (existing?.display_name) return;
    await supabase.from('profiles').upsert({ id: userId, display_name: trimmed });
  }

  async function signIn(displayName?: string) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    const uid = data.user?.id;
    if (!uid) return;
    await maybeSetDisplayName(uid, displayName);
    await refetchProfileAndFamily(uid);
  }

  async function signInWithApple(identityToken: string, displayName?: string) {
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken });
    if (error) throw error;
    const uid = data.user?.id;
    if (!uid) return;
    await maybeSetDisplayName(uid, displayName);
    await refetchProfileAndFamily(uid);
  }

  async function signUpWithEmail(email: string, password: string, displayName?: string) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes('@')) throw new Error('Enter a valid email address.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { data: { display_name: displayName?.trim() || '' } },
    });
    if (error) throw error;
    if (data.user && data.user.identities?.length === 0) {
      throw new Error('An account with that email already exists.');
    }
    if (data.user?.id && data.session) await refetchProfileAndFamily(data.user.id);
  }

  async function signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
    const uid = data.user?.id;
    if (!uid) return;
    await refetchProfileAndFamily(uid);
  }

  async function signUpWithUsername(username: string, password: string, displayName?: string) {
    const normalized = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(normalized)) {
      throw new Error('Usernames must be 3-20 characters: letters, numbers, and underscores only.');
    }
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');

    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(normalized),
      password,
      options: { data: { username: normalized, display_name: displayName?.trim() || '' } },
    });
    if (error) throw error;
    if (data.user && data.user.identities?.length === 0) {
      throw new Error('That username is already taken.');
    }
    if (data.user?.id && data.session) await refetchProfileAndFamily(data.user.id);
  }

  async function signInWithUsername(username: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) throw error;
    const uid = data.user?.id;
    if (!uid) return;
    await refetchProfileAndFamily(uid);
  }

  async function completeProfile(displayName: string) {
    if (!user) return;
    const trimmed = displayName.trim();
    await supabase.from('profiles').upsert({ id: user.id, display_name: trimmed });
    setProfile({ display_name: trimmed });
  }

  async function updateDisplayName(displayName: string) {
    await completeProfile(displayName);
  }

  async function createFamily(familyName: string) {
    if (!user) return;
    const { error } = await supabase.rpc('create_family', { p_name: familyName });
    if (error) throw error;
    await refetchProfileAndFamily(user.id);
  }

  async function joinFamily(inviteCode: string) {
    if (!user) return;
    const { error } = await supabase.rpc('join_family', { p_invite_code: inviteCode });
    if (error) throw error;
    await refetchProfileAndFamily(user.id);
  }

  async function leaveFamily() {
    if (!user) return;
    await supabase.from('family_members').delete().eq('user_id', user.id);
    setFamily(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function resetAll() {
    await leaveFamily();
    await signOut();
  }

  async function refresh() {
    if (user) await refetchProfileAndFamily(user.id);
  }

  const session: FamilySession = useMemo(
    () => ({
      displayName: profile?.display_name ?? '',
      familyName: family?.row.name ?? null,
      inviteCode: family?.row.invite_code ?? null,
      isCreator: Boolean(user && family?.row.created_by === user.id),
      joinedAt: family?.joinedAt ?? null,
      profileComplete: Boolean(profile?.display_name),
      signedIn: Boolean(user),
    }),
    [profile, family, user]
  );

  return (
    <SessionContext.Provider
      value={{
        completeProfile,
        createFamily,
        familyId: family?.row.id ?? null,
        hydrated: authLoaded && dataLoaded,
        joinFamily,
        leaveFamily,
        refresh,
        resetAll,
        session,
        signIn,
        signInWithApple,
        signInWithEmail,
        signInWithUsername,
        signOut,
        signUpWithEmail,
        signUpWithUsername,
        updateDisplayName,
        userId: user?.id ?? null,
      }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useFamilySession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useFamilySession must be used within FamilySessionProvider');
  return ctx;
}
