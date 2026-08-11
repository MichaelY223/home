import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BirthdayField } from '@/components/ui/birthday-field';
import {
  ChevronRightSmallIcon,
  FamilyIcon,
  PencilIcon,
  TrashIcon,
} from '@/components/ui/home-circle-icons';
import { CardStyle, Fonts, HomeCircleTheme as Theme, Shadows } from '@/constants/home-circle-theme';
import { useFamilyMembers } from '@/hooks/use-family-members';
import { useFamilySession } from '@/hooks/use-family-session';
import { useSettings } from '@/hooks/use-settings';
import { useStepData } from '@/hooks/use-step-data';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function splitName(name: string): { first: string; last: string } {
  const trimmed = name.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { first: trimmed, last: '' };
  return { first: trimmed.slice(0, idx), last: trimmed.slice(idx + 1) };
}

export default function FamilyProfileScreen() {
  const router = useRouter();
  const {
    hydrated, leaveFamily, refresh: refreshSession, resetAll, session, signOut, updateDisplayName,
  } = useFamilySession();
  const { currentUser, hydrated: membersHydrated, members, refresh: refreshMembers, removeMember, updateMember } = useFamilyMembers();
  const { hydrated: settingsHydrated, settings, update: updateSettings } = useSettings();
  const hasFamily = Boolean(session.familyName);
  const stepData = useStepData(hasFamily && settings.healthSyncEnabled, settings.stepGoal);

  const [editingFirstName, setEditingFirstName] = useState('');
  const [editingLastName, setEditingLastName] = useState('');
  const [editingBirthday, setEditingBirthday] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nameError, setNameError] = useState('');
  const [editingGoal, setEditingGoal] = useState('');
  const [goalError, setGoalError] = useState('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshOwnSteps = stepData.refresh;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshOwnSteps();
    await Promise.all([refreshSession(), refreshMembers()]);
    setRefreshing(false);
  }, [refreshMembers, refreshOwnSteps, refreshSession]);

  if (!hydrated || !membersHydrated || !stepData.hydrated || !settingsHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText lightColor={Theme.muted} darkColor={Theme.muted}>Loading...</ThemedText>
      </View>
    );
  }

  function startEditing() {
    if (!currentUser) return;
    const { first, last } = splitName(currentUser.displayName);
    setEditingFirstName(first);
    setEditingLastName(last);
    setEditingBirthday(currentUser.birthday ? parseDateKey(currentUser.birthday) : null);
    setNameError('');
    setIsEditing(true);
  }

  async function saveProfile() {
    if (!currentUser) return;
    const first = editingFirstName.trim();
    if (!first) {
      setNameError('First name is required');
      return;
    }
    if (first.length < 2) {
      setNameError('First name must be at least 2 characters');
      return;
    }
    const last = editingLastName.trim();
    const name = last ? `${first} ${last}` : first;
    await updateMember(currentUser.id, {
      displayName: name,
      birthday: editingBirthday ? formatDateKey(editingBirthday) : null,
    });
    await updateDisplayName(name);
    setIsEditing(false);
  }

  async function handleCopyCode() {
    if (!session.inviteCode) return;
    await Clipboard.setStringAsync(session.inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function startEditingGoal() {
    setEditingGoal(String(settings.stepGoal));
    setGoalError('');
    setIsEditingGoal(true);
  }

  async function saveGoal() {
    const parsed = Number(editingGoal.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed < 100) {
      setGoalError('Enter a number of at least 100');
      return;
    }
    await updateSettings({ stepGoal: Math.round(parsed) });
    setIsEditingGoal(false);
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  async function handleLeaveFamily() {
    await leaveFamily();
    router.replace('/');
  }

  function handleRemoveMember(id: string, name: string) {
    Alert.alert('Remove member?', `${name || 'This member'} will lose access to the family.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMember(id) },
    ]);
  }

  const displayName = currentUser?.displayName ?? session.displayName;
  const initial = (displayName || 'Y').charAt(0).toUpperCase();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: Theme.background }}
      contentContainerStyle={{ padding: 20, gap: 18, paddingTop: 54, paddingBottom: 130 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} colors={[Theme.primary]} />
      }>
      {/* Profile header */}
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <View style={{ position: 'relative' }}>
          <View style={{
            width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center',
            backgroundColor: Theme.primarySoft, borderWidth: 3, borderColor: Theme.primary,
          }}>
            <ThemedText lightColor={Theme.primary} darkColor={Theme.primary} style={{ fontFamily: Fonts.serifSemibold, fontSize: 32, lineHeight: 38 }}>
              {initial}
            </ThemedText>
          </View>
          <Pressable
            onPress={startEditing}
            style={{
              position: 'absolute', bottom: 0, right: -4,
              width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
              backgroundColor: Theme.surface, borderWidth: 2, borderColor: Theme.background, ...Shadows.sm,
            }}>
            <PencilIcon size={14} color={Theme.primary} strokeWidth={1.8} />
          </Pressable>
        </View>
        <View style={{ alignItems: 'center', gap: 3 }}>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 22, fontFamily: Fonts.sansExtraBold }}>
            {displayName}
          </ThemedText>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 14, fontFamily: Fonts.sans }}>
            {hasFamily ? session.familyName : 'Not in a family yet'}
          </ThemedText>
          {hasFamily && (
            <ThemedText
              lightColor={Theme.muted} darkColor={Theme.muted}
              style={{ fontSize: 10, fontFamily: Fonts.sansSemibold, letterSpacing: 1, textTransform: 'uppercase' }}>
              Family name
            </ThemedText>
          )}
        </View>
      </View>

      {/* Edit profile form */}
      {isEditing && (
        <View style={{ ...CardStyle, padding: 20, gap: 16, borderWidth: 2, borderColor: Theme.primarySoft }}>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 17, fontFamily: Fonts.sansBold }}>Edit profile</ThemedText>
          <View style={{ gap: 6 }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}>First name</ThemedText>
            <TextInput
              onChangeText={(t) => { setEditingFirstName(t); setNameError(''); }}
              style={{
                minHeight: 48, borderRadius: 14, borderCurve: 'continuous',
                borderWidth: nameError ? 2 : 1, borderColor: nameError ? Theme.danger : Theme.border,
                backgroundColor: Theme.background, paddingHorizontal: 16, color: Theme.ink, fontSize: 16, fontFamily: Fonts.sansSemibold,
              }}
              value={editingFirstName}
            />
            {nameError ? (
              <ThemedText lightColor={Theme.danger} darkColor={Theme.danger} style={{ fontSize: 13, fontFamily: Fonts.sans }}>{nameError}</ThemedText>
            ) : null}
          </View>
          <View style={{ gap: 6 }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}>Last name (optional)</ThemedText>
            <TextInput
              onChangeText={setEditingLastName}
              style={{
                minHeight: 48, borderRadius: 14, borderCurve: 'continuous',
                borderWidth: 1, borderColor: Theme.border,
                backgroundColor: Theme.background, paddingHorizontal: 16, color: Theme.ink, fontSize: 16, fontFamily: Fonts.sansSemibold,
              }}
              value={editingLastName}
            />
          </View>
          <View style={{ gap: 6 }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}>Birthday</ThemedText>
            <BirthdayField value={editingBirthday} onChange={setEditingBirthday} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => setIsEditing(false)}
              style={{ flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderCurve: 'continuous', backgroundColor: Theme.background }}>
              <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor={Theme.muted} darkColor={Theme.muted}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={saveProfile}
              style={{ flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderCurve: 'continuous', backgroundColor: Theme.primary }}>
              <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor="#FFFFFF" darkColor="#FFFFFF">Save</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Quick stats */}
      {!isEditing && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ ...CardStyle, flex: 1, padding: 14, gap: 3, alignItems: 'center' }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 20, fontFamily: Fonts.sansExtraBold, fontVariant: ['tabular-nums'] }}>
              {fmt(stepData.todaySteps)}
            </ThemedText>
            <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 11, fontFamily: Fonts.sansSemibold }}>Steps today</ThemedText>
          </View>
          <View style={{ ...CardStyle, flex: 1, padding: 14, gap: 3, alignItems: 'center' }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 20, fontFamily: Fonts.sansExtraBold, fontVariant: ['tabular-nums'] }}>
              {fmt(stepData.weeklyAverage)}
            </ThemedText>
            <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 11, fontFamily: Fonts.sansSemibold }}>Daily avg</ThemedText>
          </View>
          <View style={{ ...CardStyle, flex: 1, padding: 14, gap: 3, alignItems: 'center' }}>
            <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 20, fontFamily: Fonts.sansExtraBold, fontVariant: ['tabular-nums'] }}>
              {currentUser?.birthday?.slice(5) ?? '—'}
            </ThemedText>
            <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 11, fontFamily: Fonts.sansSemibold }}>Birthday</ThemedText>
          </View>
        </View>
      )}

      {/* Invite code card */}
      {hasFamily && session.inviteCode && (
        <View style={{
          borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden',
          backgroundColor: Theme.secondary, ...Shadows.lg,
        }}>
          <View style={{ padding: 20, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 4, flex: 1 }}>
                <ThemedText lightColor="rgba(255,255,255,0.6)" darkColor="rgba(255,255,255,0.6)" style={{ fontSize: 11, fontFamily: Fonts.sansSemibold, letterSpacing: 0.5 }}>
                  INVITE CODE
                </ThemedText>
                <ThemedText lightColor="#FFFFFF" darkColor="#FFFFFF" style={{ fontSize: 24, fontFamily: Fonts.sansExtraBold, letterSpacing: 1.5 }}>
                  {session.inviteCode}
                </ThemedText>
              </View>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <FamilyIcon size={18} color="#FFFFFF" />
              </View>
            </View>
            <ThemedText lightColor="rgba(255,255,255,0.65)" darkColor="rgba(255,255,255,0.65)" style={{ fontSize: 13, lineHeight: 19, fontFamily: Fonts.sans }}>
              Share this code so family members can join {session.familyName}.
            </ThemedText>
            <Pressable
              onPress={handleCopyCode}
              style={{
                minHeight: 44, alignItems: 'center', justifyContent: 'center',
                borderRadius: 12, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.2)',
              }}>
              <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor="#FFFFFF" darkColor="#FFFFFF">
                {codeCopied ? 'Copied!' : 'Copy invite code'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Family members */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 16, fontFamily: Fonts.sansBold }}>Members</ThemedText>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>{members.length} total</ThemedText>
        </View>

        {members.length === 0 ? (
          <View style={{ ...CardStyle, alignItems: 'center', padding: 24, gap: 8 }}>
            <FamilyIcon size={26} color={Theme.muted} />
            <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontFamily: Fonts.sans }}>No members yet.</ThemedText>
          </View>
        ) : (
          <View style={{ ...CardStyle, overflow: 'hidden' }}>
            {members.map((member, i) => (
              <View
                key={member.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
                  borderTopWidth: i > 0 ? 1 : 0, borderTopColor: Theme.background,
                }}>
                <View style={{
                  width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: member.avatarColor,
                }}>
                  <ThemedText lightColor="#FFFFFF" darkColor="#FFFFFF" style={{ fontSize: 18, fontFamily: Fonts.sansBold }}>
                    {member.displayName.charAt(0)}
                  </ThemedText>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansSemibold }}>
                      {member.displayName}
                    </ThemedText>
                    {member.isCurrentUser && (
                      <View style={{ backgroundColor: Theme.primarySoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <ThemedText lightColor={Theme.primary} darkColor={Theme.primary} style={{ fontSize: 10, fontFamily: Fonts.sansBold }}>YOU</ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>
                    {member.birthday ? `Birthday: ${member.birthday}` : 'No birthday set'}
                  </ThemedText>
                </View>
                {session.isCreator && !member.isCurrentUser && (
                  <Pressable
                    onPress={() => handleRemoveMember(member.id, member.displayName)}
                    style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: Theme.background }}>
                    <TrashIcon />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Settings */}
      <View style={{ gap: 10 }}>
        <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 16, fontFamily: Fonts.sansBold, paddingHorizontal: 2 }}>
          Settings
        </ThemedText>
        <View style={{ ...CardStyle, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansSemibold }}>Apple Health</ThemedText>
              <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>
                {settings.healthSyncEnabled ? stepData.status : 'Disabled'}
              </ThemedText>
            </View>
            <Switch
              value={settings.healthSyncEnabled}
              onValueChange={(val) => updateSettings({ healthSyncEnabled: val })}
              trackColor={{ false: Theme.border, true: Theme.primarySoft }}
              thumbColor={settings.healthSyncEnabled ? Theme.primary : Theme.muted}
            />
          </View>
          <View style={{ height: 1, backgroundColor: Theme.background, marginHorizontal: 16 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansSemibold }}>Share calendar</ThemedText>
              <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>
                {settings.calendarShared ? 'Events visible to family' : 'Calendar is private'}
              </ThemedText>
            </View>
            <Switch
              value={settings.calendarShared}
              onValueChange={(val) => updateSettings({ calendarShared: val })}
              trackColor={{ false: Theme.border, true: Theme.primarySoft }}
              thumbColor={settings.calendarShared ? Theme.primary : Theme.muted}
            />
          </View>
          <View style={{ height: 1, backgroundColor: Theme.background, marginHorizontal: 16 }} />
          <Pressable onPress={startEditingGoal} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansSemibold }}>Step goal</ThemedText>
              <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sans }}>Daily target</ThemedText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansBold, fontVariant: ['tabular-nums'] }}>
                {fmt(settings.stepGoal)}
              </ThemedText>
              <ChevronRightSmallIcon />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Step goal editor */}
      {isEditingGoal && (
        <View style={{ ...CardStyle, padding: 20, gap: 12, borderWidth: 2, borderColor: Theme.primarySoft }}>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 17, fontFamily: Fonts.sansBold }}>Step goal</ThemedText>
          <TextInput
            autoFocus
            keyboardType="number-pad"
            onChangeText={(t) => { setEditingGoal(t); setGoalError(''); }}
            style={{
              minHeight: 48, borderRadius: 14, borderCurve: 'continuous',
              borderWidth: goalError ? 2 : 1, borderColor: goalError ? Theme.danger : Theme.border,
              backgroundColor: Theme.background, paddingHorizontal: 16,
              color: Theme.ink, fontSize: 18, fontFamily: Fonts.sansBold, fontVariant: ['tabular-nums'],
            }}
            value={editingGoal}
          />
          {goalError ? (
            <ThemedText lightColor={Theme.danger} darkColor={Theme.danger} style={{ fontSize: 13, fontFamily: Fonts.sans }}>{goalError}</ThemedText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => setIsEditingGoal(false)}
              style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', backgroundColor: Theme.background }}>
              <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor={Theme.muted} darkColor={Theme.muted}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={saveGoal}
              style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', backgroundColor: Theme.primary }}>
              <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor="#FFFFFF" darkColor="#FFFFFF">Save</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Account actions */}
      <View style={{ gap: 10 }}>
        <Pressable
          onPress={handleSignOut}
          style={{
            minHeight: 46, alignItems: 'center', justifyContent: 'center',
            borderRadius: 14, borderCurve: 'continuous', backgroundColor: Theme.surface, borderWidth: 1, borderColor: Theme.border,
          }}>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, fontFamily: Fonts.sansSemibold }}>
            Sign out
          </ThemedText>
        </Pressable>
        {hasFamily && (
          <Pressable
            onPress={handleLeaveFamily}
            style={{
              minHeight: 46, alignItems: 'center', justifyContent: 'center',
              borderRadius: 14, borderCurve: 'continuous', backgroundColor: Theme.dangerSoft,
            }}>
            <ThemedText lightColor={Theme.danger} darkColor={Theme.danger} style={{ fontSize: 15, fontFamily: Fonts.sansSemibold }}>
              Leave family
            </ThemedText>
          </Pressable>
        )}
        <Pressable
          onPress={async () => { await resetAll(); router.replace('/'); }}
          style={{
            minHeight: 44, alignItems: 'center', justifyContent: 'center',
            borderRadius: 14, borderCurve: 'continuous',
          }}>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sansSemibold }}>
            Reset everything
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}
