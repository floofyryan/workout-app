import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import type { Template } from '@/lib/types';
import { useActiveWorkout } from './ActiveWorkoutContext';

/** Starts a workout (from a template, or empty), asking first if one is already in progress. */
export function useBeginWorkout() {
  const { workout, start } = useActiveWorkout();
  return useCallback(
    (template?: Template) => {
      const go = () => {
        start(template);
        router.push('/active-workout');
      };
      if (!workout) return go();
      Alert.alert('Workout in progress', 'You already have a workout in progress.', [
        { text: 'Resume', onPress: () => router.push('/active-workout') },
        { text: 'Discard & start new', style: 'destructive', onPress: go },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [workout, start],
  );
}
