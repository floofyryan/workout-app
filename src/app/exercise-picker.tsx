import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseList } from '@/components/ExerciseList';
import { Button } from '@/components/ui';
import { resolvePicker } from '@/lib/picker';
import { colors, spacing } from '@/lib/theme';

export default function ExercisePickerScreen() {
  const { single } = useLocalSearchParams<{ single?: string }>();
  const isSingle = single === '1';
  // Keep the order in which exercises were tapped.
  const [selected, setSelected] = useState<number[]>([]);

  const done = (ids: number[]) => {
    router.back();
    resolvePicker(ids);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: isSingle ? 'Replace Exercise' : 'Add Exercises',
          headerRight: () => (
            <Button title="New" small variant="ghost" icon="add" onPress={() => router.push('/exercise-edit')} />
          ),
        }}
      />
      <ExerciseList
        selected={new Set(selected)}
        onPress={(e) => {
          if (isSingle) return done([e.id]);
          setSelected((s) => (s.includes(e.id) ? s.filter((id) => id !== e.id) : [...s, e.id]));
        }}
      />
      {!isSingle && selected.length > 0 && (
        <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button title={`Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}`} onPress={() => done(selected)} />
        </View>
      )}
    </SafeAreaView>
  );
}
