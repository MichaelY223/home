import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import {
  CheckIcon,
  CloseIcon,
  PlusIcon,
} from "@/components/ui/home-circle-icons";
import {
  CardStyle,
  Fonts,
  Shadows,
  HomeCircleTheme as Theme,
} from "@/constants/home-circle-theme";
import { useFamilySession } from "@/hooks/use-family-session";
import {
  GROCERY_CATEGORIES,
  type GroceryCategory,
  useGroceryList,
} from "@/hooks/use-grocery-list";

const CATEGORY_COLORS: Record<GroceryCategory, string> = {
  Produce: Theme.primary,
  Dairy: Theme.gold,
  Meat: Theme.coral,
  Frozen: Theme.secondary,
  Household: "#8A7B63",
  Other: Theme.muted,
};

export default function GroceryScreen() {
  const { session } = useFamilySession();
  const {
    addItem,
    clearCompleted,
    completedCount,
    hydrated,
    itemsByCategory,
    refresh,
    removeItem,
    toggleItem,
  } = useGroceryList();
  const [newItemName, setNewItemName] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<GroceryCategory>("Produce");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Theme.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ThemedText lightColor={Theme.muted} darkColor={Theme.muted}>
          Loading...
        </ThemedText>
      </View>
    );
  }

  async function handleAddItem() {
    await addItem(newItemName, selectedCategory, session.displayName);
    setNewItemName("");
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: Theme.background }}
      contentContainerStyle={{
        padding: 20,
        gap: 18,
        paddingTop: 54,
        paddingBottom: 130,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Theme.primary}
          colors={[Theme.primary]}
        />
      }
    >
      {/* Header */}
      <View style={{ gap: 2 }}>
        <ThemedText
          lightColor={Theme.muted}
          darkColor={Theme.muted}
          style={{ fontSize: 13, fontFamily: Fonts.sansSemibold }}
        >
          Shared list
        </ThemedText>
        <ThemedText
          lightColor={Theme.ink}
          darkColor={Theme.ink}
          style={{
            fontFamily: Fonts.serifSemibold,
            fontSize: 30,
            lineHeight: 34,
          }}
        >
          Grocery
        </ThemedText>
      </View>

      {/* Add item */}
      <View style={{ ...CardStyle, padding: 16, gap: 14, borderRadius: 22 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            onChangeText={setNewItemName}
            placeholder="Add an item..."
            placeholderTextColor={Theme.muted}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
            style={{
              flex: 1,
              minHeight: 46,
              borderRadius: 14,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: Theme.border,
              backgroundColor: Theme.background,
              paddingHorizontal: 16,
              color: Theme.ink,
              fontSize: 15,
              fontFamily: Fonts.sans,
            }}
            value={newItemName}
          />
          <Pressable
            onPress={handleAddItem}
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: newItemName.trim()
                ? Theme.primary
                : Theme.border,
            }}
          >
            <PlusIcon size={18} strokeWidth={2.2} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {GROCERY_CATEGORIES.map((cat) => {
            const active = cat === selectedCategory;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  minHeight: 34,
                  paddingHorizontal: 12,
                  borderRadius: 17,
                  borderCurve: "continuous",
                  backgroundColor: active ? Theme.primary : Theme.background,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: active ? "#FFFFFF" : CATEGORY_COLORS[cat],
                  }}
                />
                <ThemedText
                  lightColor={active ? "#FFFFFF" : Theme.muted}
                  darkColor={active ? "#FFFFFF" : Theme.muted}
                  style={{ fontSize: 13, fontFamily: Fonts.sansSemibold }}
                >
                  {cat}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Items by category */}
      {GROCERY_CATEGORIES.map((cat) => {
        const categoryItems = itemsByCategory[cat];
        if (!categoryItems || categoryItems.length === 0) return null;

        const pending = categoryItems.filter((i) => !i.completed);
        const done = categoryItems.filter((i) => i.completed);

        return (
          <View key={cat} style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: CATEGORY_COLORS[cat],
                }}
              />
              <ThemedText
                lightColor={Theme.ink}
                darkColor={Theme.ink}
                style={{ fontSize: 15, fontFamily: Fonts.sansBold }}
              >
                {cat}
              </ThemedText>
              <ThemedText
                lightColor={Theme.muted}
                darkColor={Theme.muted}
                style={{ fontSize: 13, fontFamily: Fonts.sans }}
              >
                {pending.length} item{pending.length !== 1 ? "s" : ""}
              </ThemedText>
            </View>

            <View style={{ ...CardStyle, overflow: "hidden" }}>
              {[...pending, ...done].map((item, i) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: Theme.background,
                    opacity: item.completed ? 0.5 : 1,
                  }}
                >
                  <Pressable
                    onPress={() => toggleItem(item.id)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: item.completed
                        ? Theme.primary
                        : "transparent",
                      borderWidth: item.completed ? 0 : 2,
                      borderColor: Theme.border,
                    }}
                  >
                    {item.completed && <CheckIcon size={14} />}
                  </Pressable>
                  <View style={{ flex: 1, gap: 1 }}>
                    <ThemedText
                      lightColor={item.completed ? Theme.muted : Theme.ink}
                      darkColor={item.completed ? Theme.muted : Theme.ink}
                      style={{
                        fontSize: 15,
                        fontFamily: Fonts.sansMedium,
                        textDecorationLine: item.completed
                          ? "line-through"
                          : "none",
                      }}
                    >
                      {item.name}
                    </ThemedText>
                    <ThemedText
                      lightColor={Theme.muted}
                      darkColor={Theme.muted}
                      style={{ fontSize: 12, fontFamily: Fonts.sans }}
                    >
                      {item.addedBy}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => removeItem(item.id)}
                    style={{ padding: 6 }}
                  >
                    <CloseIcon size={16} color={Theme.border} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {/* Clear completed */}
      {completedCount > 0 && (
        <Pressable
          onPress={clearCompleted}
          style={{
            minHeight: 46,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            borderCurve: "continuous",
            backgroundColor: Theme.surface,
            borderWidth: 1,
            borderColor: Theme.border,
            ...Shadows.sm,
          }}
        >
          <ThemedText
            lightColor={Theme.coral}
            darkColor={Theme.coral}
            style={{ fontSize: 14, fontFamily: Fonts.sansSemibold }}
          >
            Clear {completedCount} completed item
            {completedCount !== 1 ? "s" : ""}
          </ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}
