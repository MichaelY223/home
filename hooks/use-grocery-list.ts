import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFamilySession } from '@/hooks/use-family-session';
import { supabase } from '@/lib/supabase';

export type GroceryCategory = 'Produce' | 'Meat' | 'Dairy' | 'Frozen' | 'Household' | 'Other';

export const GROCERY_CATEGORIES: GroceryCategory[] = [
  'Produce', 'Meat', 'Dairy', 'Frozen', 'Household', 'Other',
];

export type GroceryItem = {
  addedBy: string;
  category: GroceryCategory;
  completed: boolean;
  createdAt: string;
  id: string;
  name: string;
};

type ItemRow = {
  added_by_name: string;
  category: GroceryCategory;
  completed: boolean;
  created_at: string;
  id: string;
  name: string;
};

function rowToItem(row: ItemRow): GroceryItem {
  return {
    addedBy: row.added_by_name,
    category: row.category,
    completed: row.completed,
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
  };
}

export function useGroceryList() {
  const { familyId, hydrated: sessionHydrated, userId } = useFamilySession();
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<GroceryItem[]>([]);

  const fetchItems = useCallback(async (fid: string) => {
    const { data } = await supabase.from('grocery_items').select('*').eq('family_id', fid).order('created_at');
    setItems(((data ?? []) as ItemRow[]).map(rowToItem));
  }, []);

  const refresh = useCallback(async () => {
    if (familyId) await fetchItems(familyId);
  }, [familyId, fetchItems]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!familyId) {
      setItems([]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    fetchItems(familyId).finally(() => setHydrated(true));

    const channel = supabase
      .channel(`grocery-items-${familyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grocery_items', filter: `family_id=eq.${familyId}` },
        () => fetchItems(familyId)
      )
      // DELETE payloads only carry family_id once the table has REPLICA IDENTITY
      // FULL, so listen unfiltered too and let RLS scope the refetch.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'grocery_items' }, () =>
        fetchItems(familyId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionHydrated, familyId, fetchItems]);

  async function addItem(name: string, category: GroceryCategory, addedBy: string) {
    const trimmed = name.trim();

    if (!trimmed || !familyId) {
      return;
    }

    const { data } = await supabase
      .from('grocery_items')
      .insert({
        added_by: userId,
        added_by_name: addedBy,
        category,
        family_id: familyId,
        name: trimmed,
      })
      .select()
      .single();

    if (data) {
      setItems((prev) => [...prev, rowToItem(data as ItemRow)]);
    }
  }

  async function toggleItem(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const next = !current.completed;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, completed: next } : item)));
    await supabase.from('grocery_items').update({ completed: next }).eq('id', id);
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    await supabase.from('grocery_items').delete().eq('id', id);
  }

  async function clearCompleted() {
    if (!familyId) return;
    setItems((prev) => prev.filter((item) => !item.completed));
    await supabase.from('grocery_items').delete().eq('family_id', familyId).eq('completed', true);
  }

  const itemsByCategory = useMemo(
    () =>
      GROCERY_CATEGORIES.reduce<Record<GroceryCategory, GroceryItem[]>>((groups, category) => {
        groups[category] = items.filter((item) => item.category === category);
        return groups;
      }, {} as Record<GroceryCategory, GroceryItem[]>),
    [items]
  );

  const completedCount = useMemo(() => items.filter((i) => i.completed).length, [items]);

  return {
    addItem,
    clearCompleted,
    completedCount,
    hydrated,
    items,
    itemsByCategory,
    refresh,
    removeItem,
    toggleItem,
  };
}
