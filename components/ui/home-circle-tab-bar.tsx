import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeCircleTheme } from '@/constants/home-circle-theme';
import {
  ActivityIcon,
  CalendarIcon,
  FamilyIcon,
  GroceryIcon,
  PhotosIcon,
  type IconProps,
} from './home-circle-icons';

const ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  index: CalendarIcon,
  activity: ActivityIcon,
  photos: PhotosIcon,
  grocery: GroceryIcon,
  profile: FamilyIcon,
};

export function HomeCircleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((route) => {
    const { href } = descriptors[route.key].options as { href?: string | null };
    return href !== null;
  });

  if (visibleRoutes.length <= 1) {
    return null;
  }

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const isFocused = state.index === routeIndex;
          const Icon = ICONS[route.name] ?? CalendarIcon;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              if (Platform.OS !== 'web') {
                Haptics.selectionAsync();
              }
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={[styles.tabButton, isFocused && styles.tabButtonActive]}>
              <Icon
                size={21}
                color={isFocused ? HomeCircleTheme.primary : HomeCircleTheme.muted}
                strokeWidth={1.8}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    gap: 2,
    padding: 8,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    width: '100%',
    maxWidth: 420,
    shadowColor: HomeCircleTheme.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    height: 48,
    borderRadius: 20,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: HomeCircleTheme.primarySoft,
  },
});
