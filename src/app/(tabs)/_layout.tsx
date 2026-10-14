import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomTabBar, Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { ActiveWorkoutBanner } from '@/components/ActiveWorkoutBanner';
import type { IconName } from '@/components/ui';
import { colors } from '@/lib/theme';

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <>
          <ActiveWorkoutBanner />
          <BottomTabBar {...props} />
        </>
      )}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 22 },
      }}
    >
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('time-outline') }} />
      <Tabs.Screen name="index" options={{ title: 'Workout', tabBarIcon: icon('add-circle') }} />
      <Tabs.Screen name="exercises" options={{ title: 'Exercises', tabBarIcon: icon('barbell-outline') }} />
      <Tabs.Screen name="measure" options={{ title: 'Measure', tabBarIcon: icon('body-outline') }} />
    </Tabs>
  );
}
