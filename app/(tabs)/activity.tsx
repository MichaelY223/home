import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ActivityIcon } from '@/components/ui/home-circle-icons';
import { CardStyle, Fonts, HomeCircleTheme as Theme, Shadows } from '@/constants/home-circle-theme';
import { useFamilyMembers } from '@/hooks/use-family-members';
import { useFamilySession } from '@/hooks/use-family-session';
import { useFamilySteps } from '@/hooks/use-family-steps';
import { useSettings } from '@/hooks/use-settings';
import { useStepData } from '@/hooks/use-step-data';

// Bar column = value label + bar + day label. Keep the tallest bar short enough
// that the label above it stays inside the chart.
const CHART_HEIGHT = 160;
const MAX_BAR_HEIGHT = 110;
const MIN_BAR_HEIGHT = 4;

function fmt(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

function compactSteps(n: number) {
  return n > 999 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function ActivityScreen() {
  const { session, refresh: refreshSession } = useFamilySession();
  const { hydrated: membersHydrated, members, refresh: refreshMembers } = useFamilyMembers();
  const { hydrated: settingsHydrated, settings } = useSettings();
  const hasFamily = Boolean(session.signedIn && session.familyName);

  // Publishes this device's steps; the family-wide numbers come from Supabase.
  const stepData = useStepData(hasFamily && settings.healthSyncEnabled, settings.stepGoal);
  const { familyTodayTotal, hydrated: stepsHydrated, refresh: refreshSteps, summaryFor } = useFamilySteps();

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshOwnSteps = stepData.refresh;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshOwnSteps();
    await Promise.all([refreshSession(), refreshMembers(), refreshSteps()]);
    setRefreshing(false);
  }, [refreshMembers, refreshOwnSteps, refreshSession, refreshSteps]);

  // Highest step count first, so the leaderboard reorders as the day goes on.
  const rankedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const diff = summaryFor(b.id).todaySteps - summaryFor(a.id).todaySteps;
        return diff !== 0 ? diff : a.displayName.localeCompare(b.displayName);
      }),
    [members, summaryFor]
  );

  const currentUser = members.find((m) => m.isCurrentUser);
  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? currentUser;
  const selectedSummary = summaryFor(selectedMember?.id);

  if (!membersHydrated || !stepData.hydrated || !settingsHydrated || !stepsHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText lightColor={Theme.muted} darkColor={Theme.muted}>Loading...</ThemedText>
      </View>
    );
  }

  // Scale bars against the biggest day shown so 10k+ days stay distinguishable.
  const chartMax = Math.max(...selectedSummary.weeklyHistory.map((d) => d.steps), 1);
  const goalRatio = Math.min(settings.stepGoal / chartMax, 1);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: Theme.background }}
      contentContainerStyle={{ padding: 20, gap: 18, paddingTop: 54, paddingBottom: 130 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} colors={[Theme.primary]} />
      }>
      {/* Header */}
      <View style={{ gap: 2 }}>
        <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sansSemibold }}>
          {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
        </ThemedText>
        <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifSemibold, fontSize: 30, lineHeight: 36 }}>
          Activity
        </ThemedText>
      </View>

      {/* Family total hero */}
      <View style={{
        borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden',
        backgroundColor: Theme.primary, ...Shadows.lg,
      }}>
        <View style={{ padding: 24, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 4 }}>
              <ThemedText lightColor="rgba(255,255,255,0.65)" darkColor="rgba(255,255,255,0.65)" style={{ fontSize: 13, fontFamily: Fonts.sansSemibold, letterSpacing: 0.5 }}>
                FAMILY TOTAL
              </ThemedText>
              <ThemedText lightColor="#FFFFFF" darkColor="#FFFFFF" style={{ fontSize: 40, fontFamily: Fonts.sansExtraBold, lineHeight: 46, fontVariant: ['tabular-nums'] }}>
                {fmt(familyTodayTotal)}
              </ThemedText>
              <ThemedText lightColor="rgba(255,255,255,0.6)" darkColor="rgba(255,255,255,0.6)" style={{ fontSize: 13, fontFamily: Fonts.sans }}>
                steps today · {members.length} member{members.length !== 1 ? 's' : ''}
              </ThemedText>
            </View>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIcon size={26} color="#FFFFFF" />
            </View>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <View style={{
              width: `${Math.min(familyTodayTotal / Math.max(settings.stepGoal * Math.max(members.length, 1), 1), 1) * 100}%`,
              height: 6, borderRadius: 3, backgroundColor: '#FFFFFF',
            }} />
          </View>
        </View>
      </View>

      {/* Leaderboard — tap a member to chart their week */}
      <View style={{ gap: 10 }}>
        {rankedMembers.map((member, index) => {
          const summary = summaryFor(member.id);
          const progress = Math.min(summary.todaySteps / settings.stepGoal, 1);
          const isSelected = member.id === selectedMember?.id;

          return (
            <Pressable
              key={member.id}
              onPress={() => setSelectedMemberId(member.id)}
              style={{
                ...CardStyle,
                flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? Theme.primary : Theme.border,
              }}>
              <View style={{ alignItems: 'center', width: 18 }}>
                <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sansBold, fontVariant: ['tabular-nums'] }}>
                  {index + 1}
                </ThemedText>
              </View>
              <View style={{
                width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
                backgroundColor: member.avatarColor,
              }}>
                <ThemedText lightColor="#FFFFFF" darkColor="#FFFFFF" style={{ fontSize: 18, fontFamily: Fonts.sansBold, lineHeight: 24 }}>
                  {member.displayName.charAt(0) || '?'}
                </ThemedText>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansBold }}>
                    {member.displayName}{member.isCurrentUser ? ' (You)' : ''}
                  </ThemedText>
                  <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 18, fontFamily: Fonts.sansExtraBold, fontVariant: ['tabular-nums'] }}>
                    {fmt(summary.todaySteps)}
                  </ThemedText>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: Theme.background }}>
                  <View style={{
                    width: `${progress * 100}%`, height: 6, borderRadius: 3,
                    backgroundColor: member.avatarColor,
                  }} />
                </View>
                <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 12, fontFamily: Fonts.sans }}>
                  Avg {fmt(summary.weeklyAverage)}/day · Goal {fmt(settings.stepGoal)}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* 7-day chart for the selected member */}
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 16, fontFamily: Fonts.sansBold }}>
            7-day trend
          </ThemedText>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sansSemibold }}>
            {selectedMember?.displayName ?? '—'}
          </ThemedText>
        </View>
        <View style={{ ...CardStyle, padding: 20, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: CHART_HEIGHT }}>
            {selectedSummary.weeklyHistory.map((day, i) => {
              const barHeight = Math.max((day.steps / chartMax) * MAX_BAR_HEIGHT, MIN_BAR_HEIGHT);
              const isLast = i === selectedSummary.weeklyHistory.length - 1;
              const dayDate = new Date(day.dateKey + 'T12:00:00');
              const barColor = selectedMember?.avatarColor ?? Theme.primary;

              return (
                <View key={day.dateKey} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 10, lineHeight: 14, fontFamily: Fonts.sans, fontVariant: ['tabular-nums'] }}>
                    {compactSteps(day.steps)}
                  </ThemedText>
                  <View style={{
                    width: '65%', height: barHeight, borderRadius: 6,
                    backgroundColor: barColor, opacity: isLast ? 1 : 0.5,
                  }} />
                  <ThemedText lightColor={isLast ? Theme.ink : Theme.muted} darkColor={isLast ? Theme.ink : Theme.muted} style={{ fontSize: 11, lineHeight: 15, fontFamily: isLast ? Fonts.sansBold : Fonts.sansMedium }}>
                    {new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(dayDate)}
                  </ThemedText>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ height: 2, flex: goalRatio, backgroundColor: Theme.coral, borderRadius: 1, opacity: 0.6 }} />
            <View style={{ height: 2, flex: Math.max(1 - goalRatio, 0.001), backgroundColor: Theme.border, borderRadius: 1 }} />
            <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 11, fontFamily: Fonts.sansSemibold }}>
              Goal: {fmt(settings.stepGoal)}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Weekly summary for the selected member */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ ...CardStyle, flex: 1, padding: 18, gap: 4 }}>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 12, fontFamily: Fonts.sansSemibold, letterSpacing: 0.5 }}>
            THIS WEEK
          </ThemedText>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 22, fontFamily: Fonts.sansExtraBold, fontVariant: ['tabular-nums'] }}>
            {fmt(selectedSummary.weeklyTotal)}
          </ThemedText>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>total steps</ThemedText>
        </View>
        <View style={{ ...CardStyle, flex: 1, padding: 18, gap: 4 }}>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 12, fontFamily: Fonts.sansSemibold, letterSpacing: 0.5 }}>
            DAILY AVG
          </ThemedText>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 22, fontFamily: Fonts.sansExtraBold, fontVariant: ['tabular-nums'] }}>
            {fmt(selectedSummary.weeklyAverage)}
          </ThemedText>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>steps/day</ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}
