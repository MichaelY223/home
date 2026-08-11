import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert, Dimensions, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CameraIcon, HeartIcon, PhotosIcon, TrashIcon } from '@/components/ui/home-circle-icons';
import { CardStyle, Fonts, HomeCircleTheme as Theme, Shadows } from '@/constants/home-circle-theme';
import { useFamilyMembers } from '@/hooks/use-family-members';
import { usePhotoFeed } from '@/hooks/use-photo-feed';

const SCREEN_WIDTH = Dimensions.get('window').width;

function relativeTime(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(isoDate));
}

export default function PhotosScreen() {
  const { currentUser, hydrated: membersHydrated, refresh: refreshMembers } = useFamilyMembers();
  const { addPhoto, hydrated, photos, refresh: refreshPhotos, removePhoto, toggleLike } = usePhotoFeed();
  const [captionInput, setCaptionInput] = useState('');
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshPhotos(), refreshMembers()]);
    setRefreshing(false);
  }, [refreshMembers, refreshPhotos]);

  if (!hydrated || !membersHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText lightColor={Theme.muted} darkColor={Theme.muted}>Loading...</ThemedText>
      </View>
    );
  }

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingUri(result.assets[0].uri);
      setCaptionInput('');
    }
  }

  async function handleConfirmPhoto() {
    if (!pendingUri || !currentUser) return;
    await addPhoto(pendingUri, captionInput, currentUser.id, currentUser.displayName);
    setPendingUri(null);
    setCaptionInput('');
  }

  function handleDeletePhoto(id: string) {
    Alert.alert('Delete photo?', 'This will remove it for everyone in your family.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removePhoto(id) },
    ]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: Theme.background }}
      contentContainerStyle={{ padding: 20, gap: 18, paddingTop: 54, paddingBottom: 130 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.primary} colors={[Theme.primary]} />
      }>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 13, fontFamily: Fonts.sansSemibold }}>
            Family moments
          </ThemedText>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifSemibold, fontSize: 30, lineHeight: 34 }}>
            Photos
          </ThemedText>
        </View>
        <Pressable
          onPress={handlePickPhoto}
          style={{
            width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
            backgroundColor: Theme.primary, ...Shadows.md,
          }}>
          <CameraIcon size={18} />
        </Pressable>
      </View>

      {/* Pending upload */}
      {pendingUri && (
        <View style={{ ...CardStyle, overflow: 'hidden' }}>
          <Image source={{ uri: pendingUri }} style={{ width: '100%', height: 220 }} contentFit="cover" />
          <View style={{ padding: 16, gap: 12 }}>
            <TextInput
              onChangeText={setCaptionInput}
              placeholder="Write a caption..."
              placeholderTextColor={Theme.muted}
              style={{
                minHeight: 44, borderRadius: 12, borderCurve: 'continuous',
                borderWidth: 1, borderColor: Theme.border,
                backgroundColor: Theme.background, paddingHorizontal: 14,
                color: Theme.ink, fontSize: 15, fontFamily: Fonts.sans,
              }}
              value={captionInput}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => { setPendingUri(null); setCaptionInput(''); }}
                style={{
                  flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center',
                  borderRadius: 12, borderCurve: 'continuous', backgroundColor: Theme.background,
                }}>
                <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor={Theme.muted} darkColor={Theme.muted}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleConfirmPhoto}
                style={{
                  flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center',
                  borderRadius: 12, borderCurve: 'continuous', backgroundColor: Theme.primary,
                }}>
                <ThemedText style={{ fontFamily: Fonts.sansSemibold }} lightColor="#FFFFFF" darkColor="#FFFFFF">Share</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Empty state */}
      {photos.length === 0 && !pendingUri && (
        <View style={{ ...CardStyle, alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Theme.background, alignItems: 'center', justifyContent: 'center' }}>
            <PhotosIcon size={30} color={Theme.muted} />
          </View>
          <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontFamily: Fonts.serifSemibold, fontSize: 19, lineHeight: 24, textAlign: 'center' }}>
            Share a moment
          </ThemedText>
          <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ textAlign: 'center', lineHeight: 22, fontFamily: Fonts.sans, fontSize: 14 }}>
            Tap the camera button to share a photo with your family.
          </ThemedText>
        </View>
      )}

      {/* Photo feed */}
      {photos.map((photo) => {
        const liked = currentUser ? photo.likes.includes(currentUser.id) : false;

        return (
          <View key={photo.id} style={{ ...CardStyle, overflow: 'hidden' }}>
            <Image
              source={{ uri: photo.uri }}
              style={{ width: '100%', height: SCREEN_WIDTH - 40, backgroundColor: Theme.background }}
              contentFit="cover"
            />
            <View style={{ padding: 16, gap: 12 }}>
              {photo.caption ? (
                <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 15, lineHeight: 22, fontFamily: Fonts.sans }}>
                  {photo.caption}
                </ThemedText>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: Theme.secondary, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ThemedText lightColor="#FFFFFF" darkColor="#FFFFFF" style={{ fontSize: 13, fontFamily: Fonts.sansBold }}>
                      {photo.authorName.charAt(0)}
                    </ThemedText>
                  </View>
                  <View>
                    <ThemedText lightColor={Theme.ink} darkColor={Theme.ink} style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}>
                      {photo.authorName}
                    </ThemedText>
                    <ThemedText lightColor={Theme.muted} darkColor={Theme.muted} style={{ fontSize: 12, fontFamily: Fonts.sans }}>
                      {relativeTime(photo.createdAt)}
                    </ThemedText>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {currentUser?.id === photo.authorId && (
                    <Pressable
                      onPress={() => handleDeletePhoto(photo.id)}
                      style={{ padding: 6 }}>
                      <TrashIcon />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => currentUser && toggleLike(photo.id, currentUser.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, padding: 6 }}>
                    <HeartIcon
                      size={20}
                      filled={liked}
                      color={liked ? Theme.coral : Theme.muted}
                    />
                    {photo.likes.length > 0 && (
                      <ThemedText lightColor={liked ? Theme.coral : Theme.muted} darkColor={liked ? Theme.coral : Theme.muted} style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}>
                        {photo.likes.length}
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
