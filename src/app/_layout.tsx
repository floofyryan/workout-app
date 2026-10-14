import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DATABASE_NAME, migrateDb } from '@/db/schema';
import { colors } from '@/lib/theme';
import { ActiveWorkoutProvider } from '@/state/ActiveWorkoutContext';
import { SettingsProvider } from '@/state/SettingsContext';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
  },
};

function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Suspense fallback={<Loading />}>
          <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDb} useSuspense>
            <SettingsProvider>
              <ActiveWorkoutProvider>
                <Stack
                  screenOptions={{
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                    contentStyle: { backgroundColor: colors.background },
                  }}
                >
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="active-workout" options={{ presentation: 'fullScreenModal', headerShown: false }} />
                  <Stack.Screen name="exercise-picker" options={{ presentation: 'modal', title: 'Add Exercises' }} />
                  <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
                  <Stack.Screen name="exercise-edit" options={{ presentation: 'modal', title: 'Exercise' }} />
                  <Stack.Screen name="workout/[id]" options={{ title: 'Workout' }} />
                  <Stack.Screen name="workout-edit/[id]" options={{ title: 'Edit Workout' }} />
                  <Stack.Screen name="template/[id]" options={{ title: 'Template' }} />
                  <Stack.Screen name="measurement/[type]" options={{ title: '' }} />
                  <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                  <Stack.Screen name="tools/plates" options={{ title: 'Plate Calculator' }} />
                  <Stack.Screen name="tools/one-rep-max" options={{ title: '1RM Calculator' }} />
                </Stack>
              </ActiveWorkoutProvider>
            </SettingsProvider>
          </SQLiteProvider>
        </Suspense>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
