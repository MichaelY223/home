import { Tabs } from 'expo-router';

import { HomeCircleTabBar } from '@/components/ui/home-circle-tab-bar';
import { useFamilySession } from '@/hooks/use-family-session';

export default function TabLayout() {
  const { session } = useFamilySession();
  const isFullyOnboarded = session.signedIn && session.profileComplete && Boolean(session.familyName);

  return (
    <Tabs
      tabBar={(props) => <HomeCircleTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen name="index" options={{ title: isFullyOnboarded ? 'Calendar' : 'Home' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', href: isFullyOnboarded ? undefined : null }} />
      <Tabs.Screen name="photos" options={{ title: 'Photos', href: isFullyOnboarded ? undefined : null }} />
      <Tabs.Screen name="grocery" options={{ title: 'Grocery', href: isFullyOnboarded ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: 'Family', href: isFullyOnboarded ? undefined : null }} />
    </Tabs>
  );
}
