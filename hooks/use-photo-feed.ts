import { useCallback, useEffect, useState } from 'react';

import { useFamilySession } from '@/hooks/use-family-session';
import { supabase } from '@/lib/supabase';

const PHOTOS_BUCKET = 'photos';

export type Photo = {
  authorId: string;
  authorName: string;
  caption: string;
  createdAt: string;
  id: string;
  likes: string[];
  storagePath: string;
  uri: string;
};

type PhotoRow = {
  author_id: string;
  author_name: string;
  caption: string;
  created_at: string;
  id: string;
  photo_likes: { user_id: string }[] | null;
  storage_path: string;
};

function rowToPhoto(row: PhotoRow): Photo {
  return {
    authorId: row.author_id,
    authorName: row.author_name,
    caption: row.caption,
    createdAt: row.created_at,
    id: row.id,
    likes: (row.photo_likes ?? []).map((l) => l.user_id),
    storagePath: row.storage_path,
    uri: supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(row.storage_path).data.publicUrl,
  };
}

export function usePhotoFeed() {
  const { familyId, hydrated: sessionHydrated } = useFamilySession();
  const [hydrated, setHydrated] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const fetchPhotos = useCallback(async (fid: string) => {
    const { data } = await supabase
      .from('photos')
      .select('*, photo_likes(user_id)')
      .eq('family_id', fid)
      .order('created_at', { ascending: false });
    setPhotos(((data ?? []) as unknown as PhotoRow[]).map(rowToPhoto));
  }, []);

  const refresh = useCallback(async () => {
    if (familyId) await fetchPhotos(familyId);
  }, [familyId, fetchPhotos]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!familyId) {
      setPhotos([]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    fetchPhotos(familyId).finally(() => setHydrated(true));

    const channel = supabase
      .channel(`photos-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `family_id=eq.${familyId}` },
        () => fetchPhotos(familyId)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_likes' }, () => fetchPhotos(familyId))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'photos' }, () => fetchPhotos(familyId))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionHydrated, familyId, fetchPhotos]);

  async function addPhoto(uri: string, caption: string, authorId: string, authorName: string) {
    if (!familyId) return;

    const arrayBuffer = await fetch(uri).then((res) => res.arrayBuffer());
    const path = `${authorId}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;

    const { data } = await supabase
      .from('photos')
      .insert({
        author_id: authorId,
        author_name: authorName,
        caption: caption.trim(),
        family_id: familyId,
        storage_path: path,
      })
      .select('*, photo_likes(user_id)')
      .single();

    if (data) {
      setPhotos((prev) => [rowToPhoto(data as unknown as PhotoRow), ...prev]);
    }
  }

  async function removePhoto(id: string) {
    const target = photos.find((p) => p.id === id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    await supabase.from('photos').delete().eq('id', id);
    if (target) {
      await supabase.storage.from(PHOTOS_BUCKET).remove([target.storagePath]);
    }
  }

  async function toggleLike(photoId: string, memberId: string) {
    const current = photos.find((p) => p.id === photoId);
    const liked = current?.likes.includes(memberId) ?? false;

    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId
          ? { ...p, likes: liked ? p.likes.filter((l) => l !== memberId) : [...p.likes, memberId] }
          : p
      )
    );

    if (liked) {
      await supabase.from('photo_likes').delete().eq('photo_id', photoId).eq('user_id', memberId);
    } else {
      await supabase.from('photo_likes').insert({ photo_id: photoId, user_id: memberId });
    }
  }

  return {
    addPhoto,
    hydrated,
    photos,
    refresh,
    removePhoto,
    toggleLike,
  };
}
