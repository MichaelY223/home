import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFamilySession } from '@/hooks/use-family-session';
import type { DaySteps } from '@/hooks/use-step-data';
import { supabase } from '@/lib/supabase';

const DAYS_SHOWN = 7;

type StepEntryRow = {
  date_key: string;
  steps: number;
  user_id: string;
};

export type MemberStepSummary = {
  todaySteps: number;
  weeklyAverage: number;
  weeklyHistory: DaySteps[];
  weeklyTotal: number;
};

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** The last 7 date keys, oldest first, ending today. */
function recentDateKeys() {
  return Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS_SHOWN - 1 - i));
    return getDateKey(d);
  });
}

/** Step data for every member of the family, sourced from Supabase. */
export function useFamilySteps() {
  const { familyId, hydrated: sessionHydrated } = useFamilySession();
  const [entries, setEntries] = useState<StepEntryRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const fetchEntries = useCallback(async (fid: string) => {
    const windowStart = recentDateKeys()[0];
    const { data, error } = await supabase
      .from('step_entries')
      .select('user_id, date_key, steps')
      .eq('family_id', fid)
      .gte('date_key', windowStart);

    if (error) {
      console.warn('Failed to load family steps', error.message);
      return;
    }
    setEntries((data ?? []) as StepEntryRow[]);
  }, []);

  const refresh = useCallback(async () => {
    if (familyId) await fetchEntries(familyId);
  }, [familyId, fetchEntries]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!familyId) {
      setEntries([]);
      setHydrated(true);
      return;
    }

    setHydrated(false);
    fetchEntries(familyId).finally(() => setHydrated(true));

    const channel = supabase
      .channel(`step-entries-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'step_entries', filter: `family_id=eq.${familyId}` },
        () => fetchEntries(familyId)
      )
      .subscribe();

    // Steps trickle in continuously on other devices; poll as a safety net for
    // any realtime message that doesn't arrive.
    const interval = setInterval(() => fetchEntries(familyId), 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [sessionHydrated, familyId, fetchEntries]);

  // Rebuilt with the entries so the date window stays current across midnight.
  const { byUser, emptySummary } = useMemo(() => {
    const dateKeys = recentDateKeys();
    const todayKey = dateKeys[dateKeys.length - 1];
    const stepsByUser = new Map<string, Map<string, number>>();

    for (const entry of entries) {
      if (!stepsByUser.has(entry.user_id)) stepsByUser.set(entry.user_id, new Map());
      stepsByUser.get(entry.user_id)!.set(entry.date_key, entry.steps);
    }

    const result: Record<string, MemberStepSummary> = {};
    for (const [userId, days] of stepsByUser) {
      const weeklyHistory = dateKeys.map((dateKey) => ({ dateKey, steps: days.get(dateKey) ?? 0 }));
      const weeklyTotal = weeklyHistory.reduce((sum, d) => sum + d.steps, 0);
      result[userId] = {
        todaySteps: days.get(todayKey) ?? 0,
        weeklyAverage: Math.round(weeklyTotal / DAYS_SHOWN),
        weeklyHistory,
        weeklyTotal,
      };
    }
    return {
      byUser: result,
      emptySummary: {
        todaySteps: 0,
        weeklyAverage: 0,
        weeklyHistory: dateKeys.map((dateKey) => ({ dateKey, steps: 0 })),
        weeklyTotal: 0,
      } satisfies MemberStepSummary,
    };
  }, [entries]);

  const familyTodayTotal = useMemo(
    () => Object.values(byUser).reduce((sum, summary) => sum + summary.todaySteps, 0),
    [byUser]
  );

  const summaryFor = useCallback(
    (userId: string | undefined) => (userId && byUser[userId]) || emptySummary,
    [byUser, emptySummary]
  );

  return { byUser, familyTodayTotal, hydrated, refresh, summaryFor };
}
