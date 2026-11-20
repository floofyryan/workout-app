import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { exportBackup } from '@/db/repo';
import { DATABASE_NAME, migrateDb, SCHEMA_VERSION } from '@/db/schema';
import { saveAutoBackup, weeklyBackupIfDue } from '@/lib/autoBackup';
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

/** Opens the database, backing up the user's data first whenever an app update changes it. */
async function initDb(db: SQLiteDatabase) {
  await migrateDb(db, SCHEMA_VERSION, async () => {
    try {
      saveAutoBackup(await exportBackup(db), 'before-update');
    } catch {
      // Never block the app from opening.
    }
  });
}

/** Keeps a weekly automatic backup. */
function WeeklyBackup() {
  const db = useSQLiteContext();
  useEffect(() => {
    const t = setTimeout(() => weeklyBackupIfDue(() => exportBackup(db)), 5000);
    return () => clearTimeout(t);
  }, [db]);
  return null;
}

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
          <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDb} useSuspense>
            <WeeklyBackup />
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
                  <Stack.Screen name="plan" options={{ title: 'Weekly Plan' }} />
                  <Stack.Screen name="generate" options={{ title: 'Generate Program' }} />
                  <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                  <Stack.Screen name="bestiary" options={{ title: 'Bestiary' }} />
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
