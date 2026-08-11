import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFamilySession } from '@/hooks/use-family-session';
import { supabase } from '@/lib/supabase';

export type DaySteps = {
  dateKey: string;
  steps: number;
};

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Live step updates fire constantly; don't write to the server more often than this.
const LIVE_SYNC_INTERVAL_MS = 30_000;

export function useStepData(enabled: boolean, goal: number) {
  const { familyId, userId } = useFamilySession();
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [todaySteps, setTodaySteps] = useState(0);
  const [weeklyHistory, setWeeklyHistory] = useState<DaySteps[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const lastSyncedAt = useRef(0);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const refresh = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    let isMounted = true;

    async function connectPedometer() {
      if (!enabled) {
        setStatus('Health sync is off');
        return;
      }

      const available = await Pedometer.isAvailableAsync();
      if (!isMounted) return;

      if (!available) {
        setStatus('Steps unavailable on this device');
        return;
      }

      const permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus('Permission denied');
        return;
      }

      const end = new Date();
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const today = await Pedometer.getStepCountAsync(start, end);
      if (!isMounted) return;

      setTodaySteps(today.steps);
      setStatus(process.env.EXPO_OS === 'ios' ? 'Connected via Apple Health' : 'Connected');

      const historyPromises = Array.from({ length: 6 }, (_, i) => {
        const dayEnd = new Date();
        dayEnd.setDate(dayEnd.getDate() - (i + 1));
        dayEnd.setHours(23, 59, 59, 999);
        const dayStart = new Date(dayEnd);
        dayStart.setHours(0, 0, 0, 0);
        return Pedometer.getStepCountAsync(dayStart, dayEnd)
          .then((result) => ({ dateKey: getDateKey(dayStart), steps: result.steps }))
          .catch(() => ({ dateKey: getDateKey(dayStart), steps: 0 }));
      });

      const pastDays = await Promise.all(historyPromises);
      if (!isMounted) return;

      setWeeklyHistory([...pastDays.reverse(), { dateKey: getDateKey(new Date()), steps: today.steps }]);

      subscription = Pedometer.watchStepCount((result) => {
        setTodaySteps(today.steps + result.steps);
      });
    }

    connectPedometer();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [enabled, reloadToken]);

  // Publish this device's steps so the rest of the family can see them. Re-runs
  // when familyId appears, so joining a family backfills the past week.
  useEffect(() => {
    if (!enabled || !familyId || !userId || weeklyHistory.length === 0) return;

    const rows = weeklyHistory.map((day) => ({
      date_key: day.dateKey,
      family_id: familyId,
      steps: day.steps,
      updated_at: new Date().toISOString(),
      user_id: userId,
    }));

    lastSyncedAt.current = Date.now();
    supabase
      .from('step_entries')
      .upsert(rows, { onConflict: 'family_id,user_id,date_key' })
      .then(({ error }) => {
        if (error) console.warn('Failed to sync step history', error.message);
      });
  }, [enabled, familyId, userId, weeklyHistory]);

  // Throttled push of the live-updating today count.
  useEffect(() => {
    if (!enabled || !familyId || !userId || todaySteps <= 0) return;
    if (Date.now() - lastSyncedAt.current < LIVE_SYNC_INTERVAL_MS) return;

    lastSyncedAt.current = Date.now();
    supabase
      .from('step_entries')
      .upsert(
        {
          date_key: getDateKey(new Date()),
          family_id: familyId,
          steps: todaySteps,
          updated_at: new Date().toISOString(),
          user_id: userId,
        },
        { onConflict: 'family_id,user_id,date_key' }
      )
      .then(({ error }) => {
        if (error) console.warn('Failed to sync steps', error.message);
      });
  }, [enabled, familyId, todaySteps, userId]);

  const progress = useMemo(() => Math.min(todaySteps / goal, 1), [goal, todaySteps]);
  const remaining = Math.max(goal - todaySteps, 0);
  const weeklyTotal = useMemo(() => weeklyHistory.reduce((sum, d) => sum + d.steps, 0), [weeklyHistory]);
  const weeklyAverage = useMemo(
    () => (weeklyHistory.length > 0 ? Math.round(weeklyTotal / weeklyHistory.length) : 0),
    [weeklyHistory, weeklyTotal]
  );

  return {
    goal,
    hydrated,
    progress,
    refresh,
    remaining,
    status,
    todaySteps,
    weeklyAverage,
    weeklyHistory,
    weeklyTotal,
  };
}
