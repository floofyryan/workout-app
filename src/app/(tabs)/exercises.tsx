import { router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';

import { ExerciseList } from '@/components/ExerciseList';
import { Button } from '@/components/ui';

export default function ExercisesScreen() {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button title="New" small variant="ghost" icon="add" onPress={() => router.push('/exercise-edit')} />
      ),
    });
  }, [navigation]);

  return (
    <ExerciseList
      onPress={(e) => router.push({ pathname: '/exercise/[id]', params: { id: String(e.id) } })}
    />
  );
}
