import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useFamilySession } from '@/hooks/use-family-session';
import { supabase } from '@/lib/supabase';

const AVATAR_COLORS = ['#1E5C4B', '#35597C', '#DD7856', '#C79A44', '#9B51E0', '#D64550'];

// Realtime membership events can be missed (dropped socket, backgrounded app),
// which used to leave the roster stale until a full restart.
const POLL_INTERVAL_MS = 15_000;

export type FamilyMember = {
  avatarColor: string;
  birthday: string | null;
  displayName: string;
  id: string;
  isCurrentUser: boolean;
  joinedAt: string;
};

function avatarColorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

type MembershipRow = {
  joined_at: string;
  user_id: string;
};

type ProfileRow = {
  birthday: string | null;
  display_name: string;
  id: string;
};

type MembersContextValue = {
  currentUser: FamilyMember | undefined;
  hydrated: boolean;
  members: FamilyMember[];
  refresh: () => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  updateMember: (id: string, updates: Partial<Pick<FamilyMember, 'displayName' | 'birthday'>>) => Promise<void>;
};

const MembersContext = createContext<MembersContextValue | null>(null);

export function FamilyMembersProvider({ children }: { children: ReactNode }) {
  const { familyId, hydrated: sessionHydrated, userId } = useFamilySession();
  const [hydrated, setHydrated] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);

  const fetchMembers = useCallback(
    async (fid: string) => {
      const { data: memberships } = await supabase
        .from('family_members')
        .select('user_id, joined_at')
        .eq('family_id', fid);

      const membershipRows = (memberships ?? []) as MembershipRow[];
      if (membershipRows.length === 0) {
        setMembers([]);
        return;
      }

      const userIds = membershipRows.map((row) => row.user_id);
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, display_name, birthday')
        .in('id', userIds);

      const profilesById = new Map(((profileRows ?? []) as ProfileRow[]).map((p) => [p.id, p]));

      setMembers(
        membershipRows.map((row) => {
          const profile = profilesById.get(row.user_id);
          return {
            avatarColor: avatarColorForId(row.user_id),
            birthday: profile?.birthday ?? null,
            displayName: profile?.display_name ?? '',
            id: row.user_id,
            isCurrentUser: row.user_id === userId,
            joinedAt: row.joined_at,
          };
        })
      );
    },
    [userId]
  );

  const refresh = useCallback(async () => {
    if (familyId) await fetchMembers(familyId);
  }, [familyId, fetchMembers]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!familyId) {
      setMembers([]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    fetchMembers(familyId).finally(() => setHydrated(true));

    const channel = supabase
      .channel(`family-members-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_members', filter: `family_id=eq.${familyId}` },
        () => fetchMembers(familyId)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchMembers(familyId))
      .subscribe();

    const interval = setInterval(() => fetchMembers(familyId), POLL_INTERVAL_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchMembers(familyId);
    });

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [sessionHydrated, familyId, fetchMembers]);

  async function updateMember(id: string, updates: Partial<Pick<FamilyMember, 'displayName' | 'birthday'>>) {
    const patch: Record<string, string | null> = {};
    if (updates.displayName !== undefined) patch.display_name = updates.displayName;
    if (updates.birthday !== undefined) patch.birthday = updates.birthday;
    if (Object.keys(patch).length === 0) return;
    await supabase.from('profiles').update(patch).eq('id', id);
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }

  async function removeMember(id: string) {
    if (!familyId || id === userId) return;
    await supabase.from('family_members').delete().eq('family_id', familyId).eq('user_id', id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  const currentUser = members.find((m) => m.isCurrentUser);

  return (
    <MembersContext.Provider value={{ currentUser, hydrated, members, refresh, removeMember, updateMember }}>
      {children}
    </MembersContext.Provider>
  );
}

export function useFamilyMembers() {
  const ctx = useContext(MembersContext);
  if (!ctx) throw new Error('useFamilyMembers must be used within FamilyMembersProvider');
  return ctx;
}
