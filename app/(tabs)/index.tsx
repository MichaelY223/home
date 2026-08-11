import * as AppleAuthentication from 'expo-apple-authentication';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BirthdayField } from '@/components/ui/birthday-field';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronRightSmallIcon,
  CloseIcon,
  KeyIcon,
  PersonIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/ui/home-circle-icons';
import { CardInnerStyle, CardStyle, Fonts, HomeCircleTheme as Theme, Shadows } from '@/constants/home-circle-theme';
import { getDateKey, useCalendarEvents, type EventVisibility } from '@/hooks/use-calendar-events';
import { useFamilyMembers } from '@/hooks/use-family-members';
import { useFamilySession } from '@/hooks/use-family-session';
import { useSettings } from '@/hooks/use-settings';

type CalendarMode = 'week' | 'month';

function fmt(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: { date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) {
    days.push({ date: new Date(year, month, -startOffset + i + 1), isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
  }
  return days;
}

const inputStyle = {
  minHeight: 50,
  borderRadius: 14,
  borderCurve: 'continuous' as const,
  borderWidth: 1,
  borderColor: Theme.border,
  backgroundColor: Theme.background,
  paddingHorizontal: 16,
  color: Theme.ink,
  fontSize: 16,
  fontFamily: Fonts.sansSemibold,
};

const primaryButtonStyle = (enabled: boolean) => ({
  minHeight: 52,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  borderRadius: 16,
  borderCurve: 'continuous' as const,
  backgroundColor: enabled ? Theme.ink : Theme.border,
});

export default function CalendarScreen() {
  const {
    completeProfile, createFamily, hydrated, joinFamily,
    refresh: refreshSession, session, signIn, signInWithApple,
    signInWithEmail, signInWithUsername, signUpWithEmail, signUpWithUsername,
  } = useFamilySession();
  const { hydrated: membersHydrated, currentUser, members, refresh: refreshMembers, updateMember } = useFamilyMembers();
  const { hydrated: settingsHydrated, update: updateSettings } = useSettings();
  const {
    addEvent, eventsByDate, hydrated: calendarHydrated,
    refresh: refreshCalendar, removeEvent,
  } = useCalendarEvents(members);

  // Onboarding state
  const [authTab, setAuthTab] = useState<'email' | 'username'>('email');
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileBirthday, setProfileBirthday] = useState<Date | null>(null);
  const [profileGoal, setProfileGoal] = useState('10000');
  const [profileNameError, setProfileNameError] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [onboardMode, setOnboardMode] = useState<'choose' | 'create' | 'join'>('choose');

  // Calendar state
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('week');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventVisibility, setNewEventVisibility] = useState<EventVisibility>('shared');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthDate, setMonthDate] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshSession(), refreshMembers(), refreshCalendar()]);
    setRefreshing(false);
  }, [refreshCalendar, refreshMembers, refreshSession]);

  const selectedDateKey = getDateKey(selectedDate);
  const selectedEvents = eventsByDate[selectedDateKey] ?? [];
  const todayKey = getDateKey(new Date());
  const userColor = currentUser?.avatarColor ?? Theme.primary;

  const weekDays = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    const start = getWeekStart(base);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const monthDays = useMemo(
    () => getMonthDays(monthDate.getFullYear(), monthDate.getMonth()),
    [monthDate]
  );

  function reportError(error: unknown, fallback: string) {
    console.error(error);
    Alert.alert('Something went wrong', error instanceof Error ? error.message : fallback);
  }

  async function handleAppleSignIn() {
    if (process.env.EXPO_OS === 'ios') {
      let credential: AppleAuthentication.AppleAuthenticationCredential;
      try {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
      } catch (error) {
        if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
          reportError(error, 'Could not start Apple Sign-In.');
        }
        return;
      }

      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
      try {
        if (credential.identityToken) {
          await signInWithApple(credential.identityToken, name || undefined);
        } else {
          await signIn(name || undefined);
        }
      } catch (error) {
        reportError(error, 'Could not sign in with Apple.');
      }
      return;
    }
    try {
      await signIn();
    } catch (error) {
      reportError(error, 'Could not sign in.');
    }
  }

  async function handleAuthSubmit() {
    setAuthError('');
    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (authTab === 'email' && !authEmail.trim()) {
      setAuthError('Enter your email.');
      return;
    }
    if (authTab === 'username' && !authUsername.trim()) {
      setAuthError('Enter a username.');
      return;
    }
    setAuthBusy(true);
    try {
      if (authTab === 'email') {
        if (authMode === 'signUp') {
          await signUpWithEmail(authEmail, authPassword, authName);
        } else {
          await signInWithEmail(authEmail, authPassword);
        }
      } else {
        if (authMode === 'signUp') {
          await signUpWithUsername(authUsername, authPassword, authName);
        } else {
          await signInWithUsername(authUsername, authPassword);
        }
      }
    } catch (error) {
      reportError(error, 'Could not sign in.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleCompleteProfile() {
    const first = profileFirstName.trim();
    if (!first) { setProfileNameError('First name is required'); return; }
    if (first.length < 2) { setProfileNameError('First name must be at least 2 characters'); return; }
    const last = profileLastName.trim();
    const name = last ? `${first} ${last}` : first;
    try {
      await completeProfile(name);
      if (profileBirthday && currentUser) {
        await updateMember(currentUser.id, { birthday: profileBirthday.toISOString().slice(0, 10) });
      }
      const goal = Number(profileGoal.replace(/,/g, ''));
      if (Number.isFinite(goal) && goal > 0) {
        await updateSettings({ stepGoal: Math.round(goal) });
      }
    } catch (error) {
      reportError(error, 'Could not save your profile.');
    }
  }

  async function handleCreateFamily() {
    const name = familyName.trim();
    if (!name) return;
    try {
      await createFamily(name);
    } catch (error) {
      reportError(error, 'Could not create your family.');
    }
  }

  async function handleJoinFamily() {
    const code = familyCode.trim();
    if (!code) return;
    try {
      await joinFamily(code);
    } catch (error) {
      reportError(error, 'That invite code doesn\'t look right. Double-check it and try again.');
    }
  }

  async function handleAddEvent() {
    try {
      await addEvent(selectedDateKey, newEventTitle, newEventTime, userColor, newEventVisibility);
    } catch (error) {
      reportError(error, 'Could not add that event.');
      return;
    }
    setNewEventTitle('');
    setNewEventTime('');
    setShowAddForm(false);
  }

  if (!hydrated || !calendarHydrated || !membersHydrated || !settingsHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText lightColor={Theme.muted} darkColor={Theme.muted}>Loading...</ThemedText>
      </View>
    );
  }

  // ── Step 1: Sign in ──
  if (!session.signedIn) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: Theme.background }}
        contentContainerStyle={{ padding: 24, gap: 28, paddingTop: 80 }}>
        <View style={{ gap: 10 }}>
          <ThemedText lightColor={Theme.coral} darkColor={Theme.coral} style={{ fontSize: 13, fontFamily: Fonts.sansBold, letterSpacing: 2, textTransform: 'uppercase' }}>
            Home Circle
          </ThemedText>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifItalicMedium, fontSize: 38, lineHeight: 44 }}>
            Your family,{'\n'}all in one place.
          </ThemedText>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 16, lineHeight: 24, marginTop: 2, fontFamily: Fonts.sans }}>
            A private space for schedules, movement, and shared moments.
          </ThemedText>
        </View>
        <View style={{ ...CardStyle, ...CardInnerStyle }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: Theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <PersonIcon size={22} color={Theme.primary} />
          </View>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifSemibold, fontSize: 19, lineHeight: 24 }}>Get started</ThemedText>

          {process.env.EXPO_OS === 'ios' && (
            <>
              <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontFamily: Fonts.sans, fontSize: 14 }}>
                Sign in with your Apple account to get started.
              </ThemedText>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={14}
                style={{ height: 52 }}
                onPress={handleAppleSignIn}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: Theme.border }} />
                <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 12, fontFamily: Fonts.sansSemibold }}>OR</ThemedText>
                <View style={{ flex: 1, height: 1, backgroundColor: Theme.border }} />
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', gap: 4, backgroundColor: Theme.background, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: Theme.border }}>
            {(['email', 'username'] as const).map((tab) => {
              const active = authTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => { setAuthTab(tab); setAuthError(''); }}
                  style={{
                    flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center',
                    borderRadius: 10, borderCurve: 'continuous',
                    backgroundColor: active ? Theme.primary : 'transparent',
                  }}>
                  <ThemedText
                    lightColor={active ? '#FFFFFF' : Theme.muted}
                    darkColor={active ? '#FFFFFF' : Theme.muted}
                    style={{ fontSize: 13, fontFamily: Fonts.sansBold }}>
                    {tab === 'email' ? 'Email' : 'Username'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {authTab === 'email' ? (
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setAuthEmail}
              placeholder="Email"
              placeholderTextColor={Theme.muted}
              style={inputStyle}
              value={authEmail}
            />
          ) : (
            <TextInput
              autoCapitalize="none"
              onChangeText={setAuthUsername}
              placeholder="Username"
              placeholderTextColor={Theme.muted}
              style={inputStyle}
              value={authUsername}
            />
          )}

          {authMode === 'signUp' && (
            <TextInput
              onChangeText={setAuthName}
              placeholder="Your name (optional)"
              placeholderTextColor={Theme.muted}
              style={inputStyle}
              value={authName}
            />
          )}

          <TextInput
            onChangeText={setAuthPassword}
            placeholder="Password"
            placeholderTextColor={Theme.muted}
            secureTextEntry
            style={inputStyle}
            value={authPassword}
          />

          {authError ? (
            <ThemedText lightColor={Theme.danger} darkColor={Theme.danger} style={{ fontSize: 13, fontFamily: Fonts.sans }}>{authError}</ThemedText>
          ) : null}

          <Pressable onPress={handleAuthSubmit} disabled={authBusy} style={primaryButtonStyle(!authBusy)}>
            <ThemedText style={{ fontFamily: Fonts.sansBold, fontSize: 16 }} lightColor="#FFFFFF" darkColor="#FFFFFF">
              {authBusy ? 'Please wait…' : authMode === 'signUp' ? 'Create account' : 'Sign in'}
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => { setAuthMode((m) => (m === 'signUp' ? 'signIn' : 'signUp')); setAuthError(''); }}>
            <ThemedText lightColor={Theme.primary} darkColor={Theme.primary} style={{ fontSize: 13, fontFamily: Fonts.sansBold, textAlign: 'center' }}>
              {authMode === 'signUp' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ── Step 2: Profile setup (first time) ──
  if (!session.profileComplete) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: Theme.background }}
        contentContainerStyle={{ padding: 24, gap: 24, paddingTop: 80 }}>
        <View style={{ gap: 6 }}>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 15, fontFamily: Fonts.sans }}>
            Almost there
          </ThemedText>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifSemibold, fontSize: 32, lineHeight: 38 }}>
            Set up your profile
          </ThemedText>
        </View>

        <View style={{ ...CardStyle, ...CardInnerStyle }}>
          <View style={{ gap: 6 }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}>
              First name
            </ThemedText>
            <TextInput
              autoFocus
              onChangeText={(t) => { setProfileFirstName(t); setProfileNameError(''); }}
              placeholder="How your family sees you"
              placeholderTextColor={Theme.muted}
              style={[inputStyle, profileNameError ? { borderWidth: 2, borderColor: Theme.danger } : null]}
              value={profileFirstName}
            />
            {profileNameError ? (
              <ThemedText lightColor={Theme.danger} darkColor={Theme.danger} style={{ fontSize: 13, fontFamily: Fonts.sans }}>{profileNameError}</ThemedText>
            ) : null}
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}>
              Last name (optional)
            </ThemedText>
            <TextInput
              onChangeText={setProfileLastName}
              placeholder="Your last name"
              placeholderTextColor={Theme.muted}
              style={inputStyle}
              value={profileLastName}
            />
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}>
              Birthday (optional)
            </ThemedText>
            <BirthdayField value={profileBirthday} onChange={setProfileBirthday} />
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}>
              Daily step goal
            </ThemedText>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setProfileGoal}
              placeholder="10000"
              placeholderTextColor={Theme.muted}
              style={[inputStyle, { fontFamily: Fonts.sans, fontVariant: ['tabular-nums'] }]}
              value={profileGoal}
            />
          </View>

          <Pressable
            onPress={handleCompleteProfile}
            style={[primaryButtonStyle(Boolean(profileFirstName.trim())), { marginTop: 4, backgroundColor: profileFirstName.trim() ? Theme.primary : Theme.border }]}>
            <ThemedText style={{ fontFamily: Fonts.sansBold, fontSize: 16 }} lightColor="#FFFFFF" darkColor="#FFFFFF">Continue</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ── Step 3: Create or join family ──
  if (!session.familyName) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: Theme.background }}
        contentContainerStyle={{ padding: 24, gap: 24, paddingTop: 80 }}>
        <View style={{ gap: 6 }}>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 15, fontFamily: Fonts.sans }}>
            Welcome, {session.displayName}
          </ThemedText>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifSemibold, fontSize: 32, lineHeight: 38 }}>
            Join your family
          </ThemedText>
        </View>

        {onboardMode === 'choose' && (
          <View style={{ gap: 12 }}>
            <Pressable
              onPress={() => setOnboardMode('create')}
              style={{ ...CardStyle, ...CardInnerStyle, flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 22, padding: 18 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: Theme.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <PlusIcon size={20} color={Theme.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 16, fontFamily: Fonts.sansBold }}>
                  Create a family
                </ThemedText>
                <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>
                  Start fresh and invite others
                </ThemedText>
              </View>
              <ChevronRightSmallIcon />
            </Pressable>

            <Pressable
              onPress={() => setOnboardMode('join')}
              style={{ ...CardStyle, ...CardInnerStyle, flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 22, padding: 18 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: Theme.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
                <KeyIcon size={20} color={Theme.gold} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 16, fontFamily: Fonts.sansBold }}>
                  Join a family
                </ThemedText>
                <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>
                  Enter an invite code
                </ThemedText>
              </View>
              <ChevronRightSmallIcon />
            </Pressable>
          </View>
        )}

        {onboardMode === 'create' && (
          <View style={{ ...CardStyle, ...CardInnerStyle }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifSemibold, fontSize: 19, lineHeight: 24 }}>Name your family</ThemedText>
            <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontFamily: Fonts.sans, fontSize: 14 }}>
              An invite code will be generated automatically so others can join.
            </ThemedText>
            <TextInput
              autoFocus
              onChangeText={setFamilyName}
              placeholder="e.g. The Kim Family"
              placeholderTextColor={Theme.muted}
              style={inputStyle}
              value={familyName}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setOnboardMode('choose')}
                style={{ flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderCurve: 'continuous', backgroundColor: Theme.background }}>
                <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor={Theme.muted} darkColor={Theme.muted}>Back</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCreateFamily}
                style={{ flex: 2, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderCurve: 'continuous', backgroundColor: familyName.trim() ? Theme.primary : Theme.border }}>
                <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor="#FFFFFF" darkColor="#FFFFFF">Create family</ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {onboardMode === 'join' && (
          <View style={{ ...CardStyle, ...CardInnerStyle }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifSemibold, fontSize: 19, lineHeight: 24 }}>Enter invite code</ThemedText>
            <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontFamily: Fonts.sans, fontSize: 14 }}>
              Ask a family member for their invite code to join their family.
            </ThemedText>
            <TextInput
              autoCapitalize="characters"
              autoFocus
              onChangeText={setFamilyCode}
              placeholder="e.g. KIM-4821"
              placeholderTextColor={Theme.muted}
              style={[inputStyle, { letterSpacing: 1 }]}
              value={familyCode}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setOnboardMode('choose')}
                style={{ flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderCurve: 'continuous', backgroundColor: Theme.background }}>
                <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor={Theme.muted} darkColor={Theme.muted}>Back</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleJoinFamily}
                style={{ flex: 2, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderCurve: 'continuous', backgroundColor: familyCode.trim() ? Theme.primary : Theme.border }}>
                <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor="#FFFFFF" darkColor="#FFFFFF">Join family</ThemedText>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  // ── Main calendar ──
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: Theme.background }}
      contentContainerStyle={{ padding: 20, gap: 20, paddingTop: 54, paddingBottom: 130 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} colors={[Theme.primary]} />
      }>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sansSemibold }}>
            {fmt(selectedDate, { month: 'long', year: 'numeric' })}
          </ThemedText>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifSemibold, fontSize: 30, lineHeight: 34 }}>
            {selectedDateKey === todayKey ? 'Today' : fmt(selectedDate, { weekday: 'long', day: 'numeric' })}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => setShowAddForm(!showAddForm)}
          style={{
            width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
            backgroundColor: Theme.primary, ...Shadows.md,
          }}>
          <PlusIcon size={18} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 4, backgroundColor: Theme.surface, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: Theme.border }}>
        {(['week', 'month'] as const).map((mode) => {
          const active = calendarMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setCalendarMode(mode)}
              style={{
                flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center',
                borderRadius: 11, borderCurve: 'continuous',
                backgroundColor: active ? Theme.primary : 'transparent',
              }}>
              <ThemedText
                lightColor={active ? '#FFFFFF' : Theme.muted}
                darkColor={active ? '#FFFFFF' : Theme.muted}
                style={{ fontSize: 13, fontFamily: Fonts.sansBold }}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {calendarMode === 'week' && (
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => setWeekOffset((o) => o - 1)} style={{ padding: 6 }}>
              <ChevronLeftIcon />
            </Pressable>
            <Pressable onPress={() => { setWeekOffset(0); setSelectedDate(new Date()); }}>
              <ThemedText lightColor={Theme.primary} darkColor={Theme.primary} style={{ fontSize: 13, fontFamily: Fonts.sansBold }}>This week</ThemedText>
            </Pressable>
            <Pressable onPress={() => setWeekOffset((o) => o + 1)} style={{ padding: 6 }}>
              <ChevronRightIcon />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {weekDays.map((day) => {
              const dayKey = getDateKey(day);
              const dayEvents = eventsByDate[dayKey] ?? [];
              const selected = dayKey === selectedDateKey;
              const isToday = dayKey === todayKey;
              return (
                <Pressable
                  key={dayKey}
                  onPress={() => setSelectedDate(day)}
                  style={{
                    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10,
                    borderRadius: 16, borderCurve: 'continuous',
                    backgroundColor: selected ? Theme.primary : Theme.surface,
                    borderWidth: selected ? 0 : 1, borderColor: Theme.border,
                  }}>
                  <ThemedText
                    lightColor={selected ? 'rgba(255,255,255,0.7)' : Theme.muted}
                    darkColor={selected ? 'rgba(255,255,255,0.7)' : Theme.muted}
                    style={{ fontSize: 10, fontFamily: Fonts.sansSemibold, letterSpacing: 0.5 }}>
                    {fmt(day, { weekday: 'short' }).toUpperCase()}
                  </ThemedText>
                  <View style={{
                    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? 'rgba(255,255,255,0.2)' : isToday ? Theme.coralSoft : 'transparent',
                  }}>
                    <ThemedText
                      lightColor={selected ? '#FFFFFF' : isToday ? Theme.coral : Theme.ink}
                      darkColor={selected ? '#FFFFFF' : isToday ? Theme.coral : Theme.ink}
                      style={{ fontSize: 16, fontFamily: Fonts.sansBold, fontVariant: ['tabular-nums'] }}>
                      {day.getDate()}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3, minHeight: 5 }}>
                    {dayEvents.slice(0, 3).map((ev) => (
                      <View key={ev.id} style={{
                        width: 4, height: 4, borderRadius: 2,
                        backgroundColor: selected ? 'rgba(255,255,255,0.8)' : ev.color,
                      }} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {calendarMode === 'month' && (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} style={{ padding: 6 }}>
              <ChevronLeftIcon />
            </Pressable>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansBold }}>
              {fmt(monthDate, { month: 'long', year: 'numeric' })}
            </ThemedText>
            <Pressable onPress={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} style={{ padding: 6 }}>
              <ChevronRightIcon />
            </Pressable>
          </View>
          {(monthDate.getFullYear() !== new Date().getFullYear() || monthDate.getMonth() !== new Date().getMonth()) && (
            <Pressable
              onPress={() => { const now = new Date(); setMonthDate(now); setSelectedDate(now); }}
              style={{ alignSelf: 'center' }}>
              <ThemedText lightColor={Theme.primary} darkColor={Theme.primary} style={{ fontSize: 13, fontFamily: Fonts.sansBold }}>Jump to today</ThemedText>
            </Pressable>
          )}
          <View style={{ ...CardStyle, padding: 10 }}>
            <View style={{ flexDirection: 'row' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <View key={`${d}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
                  <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 11, fontFamily: Fonts.sansSemibold }}>{d}</ThemedText>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthDays.map(({ date, isCurrentMonth }) => {
                const dayKey = getDateKey(date);
                const dayEvents = eventsByDate[dayKey] ?? [];
                const selected = dayKey === selectedDateKey;
                const isToday = dayKey === todayKey;
                return (
                  <Pressable
                    key={dayKey + (isCurrentMonth ? '' : '-adj')}
                    onPress={() => setSelectedDate(date)}
                    style={{
                      width: '14.28%', minHeight: 40, alignItems: 'center', justifyContent: 'center',
                      borderRadius: 10, gap: 2, backgroundColor: selected ? Theme.primary : 'transparent',
                    }}>
                    <ThemedText
                      lightColor={selected ? '#FFFFFF' : !isCurrentMonth ? Theme.border : isToday ? Theme.coral : Theme.ink}
                      darkColor={selected ? '#FFFFFF' : !isCurrentMonth ? Theme.border : isToday ? Theme.coral : Theme.ink}
                      style={{ fontSize: 13, fontFamily: selected || isToday ? Fonts.sansBold : Fonts.sansMedium, fontVariant: ['tabular-nums'] }}>
                      {date.getDate()}
                    </ThemedText>
                    <View style={{ flexDirection: 'row', gap: 2, minHeight: 4 }}>
                      {dayEvents.slice(0, 2).map((ev) => (
                        <View key={ev.id} style={{
                          width: 3, height: 3, borderRadius: 2,
                          backgroundColor: selected ? 'rgba(255,255,255,0.8)' : ev.color,
                        }} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {showAddForm && (
        <View style={{ ...CardStyle, padding: 20, gap: 12, borderWidth: 2, borderColor: Theme.primarySoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 17, fontFamily: Fonts.sansBold }}>New event</ThemedText>
            <Pressable onPress={() => setShowAddForm(false)} style={{ padding: 4 }}>
              <CloseIcon />
            </Pressable>
          </View>
          <TextInput
            onChangeText={setNewEventTitle}
            placeholder="What's happening?"
            placeholderTextColor={Theme.muted}
            style={[inputStyle, { minHeight: 46, fontFamily: Fonts.sans, fontSize: 15 }]}
            value={newEventTitle}
          />
          <TextInput
            onChangeText={setNewEventTime}
            placeholder="Time — e.g. 4:30 PM"
            placeholderTextColor={Theme.muted}
            style={[inputStyle, { minHeight: 46, fontFamily: Fonts.sans, fontSize: 15 }]}
            value={newEventTime}
          />
          <View style={{ gap: 6 }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 13, fontFamily: Fonts.sansSemibold }}>
              Who can see this?
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 4, backgroundColor: Theme.background, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: Theme.border }}>
              {([
                { key: 'shared' as const, label: 'Shared', hint: 'Whole family' },
                { key: 'private' as const, label: 'Private', hint: 'Only me' },
              ]).map((option) => {
                const active = newEventVisibility === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setNewEventVisibility(option.key)}
                    style={{
                      flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center',
                      borderRadius: 10, borderCurve: 'continuous',
                      backgroundColor: active ? Theme.primary : 'transparent',
                    }}>
                    <ThemedText
                      lightColor={active ? '#FFFFFF' : Theme.ink}
                      darkColor={active ? '#FFFFFF' : Theme.ink}
                      style={{ fontSize: 13, fontFamily: Fonts.sansBold }}>
                      {option.label}
                    </ThemedText>
                    <ThemedText
                      lightColor={active ? 'rgba(255,255,255,0.75)' : Theme.muted}
                      darkColor={active ? 'rgba(255,255,255,0.75)' : Theme.muted}
                      style={{ fontSize: 10, fontFamily: Fonts.sans }}>
                      {option.hint}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {currentUser && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: userColor }} />
              <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 14, fontFamily: Fonts.sans }}>
                {currentUser.displayName}
              </ThemedText>
            </View>
          )}
          <Pressable
            onPress={handleAddEvent}
            style={{
              minHeight: 48, alignItems: 'center', justifyContent: 'center',
              borderRadius: 14, borderCurve: 'continuous',
              backgroundColor: newEventTitle.trim() && newEventTime.trim() ? Theme.primary : Theme.border,
            }}>
            <ThemedText style={{ fontFamily: Fonts.sansBold, fontSize: 15 }} lightColor="#FFFFFF" darkColor="#FFFFFF">Add event</ThemedText>
          </Pressable>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansBold }}>
            {fmt(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })}
          </ThemedText>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>
            {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
          </ThemedText>
        </View>

        {selectedEvents.length === 0 ? (
          <View style={{ ...CardStyle, alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 8 }}>
            <CalendarIcon size={26} color={Theme.muted} />
            <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ textAlign: 'center', fontFamily: Fonts.sans, fontSize: 14 }}>Nothing scheduled</ThemedText>
          </View>
        ) : (
          <View style={{ ...CardStyle, overflow: 'hidden' }}>
            {selectedEvents.map((event, i) => (
              <View
                key={event.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: Theme.background,
                }}>
                <View style={{ width: 4, height: 40, borderRadius: 2, backgroundColor: event.color }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansSemibold }}>
                    {event.title}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>{event.time}</ThemedText>
                    {!event.readOnly && (
                      <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>
                        · {event.isMine ? 'You' : event.createdByName}
                      </ThemedText>
                    )}
                    {event.visibility === 'private' && !event.readOnly && (
                      <View style={{ backgroundColor: Theme.goldSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <ThemedText lightColor={Theme.gold} darkColor={Theme.gold} style={{ fontSize: 11, fontFamily: Fonts.sansSemibold }}>
                          Private
                        </ThemedText>
                      </View>
                    )}
                    {event.readOnly && (
                      <View style={{ backgroundColor: event.type === 'holiday' ? Theme.secondarySoft : Theme.coralSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <ThemedText lightColor={event.type === 'holiday' ? Theme.secondary : Theme.coral} darkColor={event.type === 'holiday' ? Theme.secondary : Theme.coral} style={{ fontSize: 11, fontFamily: Fonts.sansSemibold }}>
                          {event.type === 'holiday' ? 'Holiday' : 'Birthday'}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
                {!event.readOnly && event.isMine && (
                  <Pressable
                    onPress={async () => {
                      try {
                        await removeEvent(event.id);
                      } catch (error) {
                        reportError(error, 'Could not delete that event.');
                      }
                    }}
                    style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: Theme.background }}>
                    <TrashIcon />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
