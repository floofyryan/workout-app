import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { imageUrl } from '@/lib/freeExerciseDb';
import { colors, radius } from '@/lib/theme';
import type { Exercise } from '@/lib/types';

/** Small square thumbnail for lists; falls back to the first letter. */
export function ExerciseThumb({ exercise, size = 40 }: { exercise: Exercise; size?: number }) {
  const [failed, setFailed] = useState(false);
  const first = exercise.images[0];
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: size / 2 }]}>
      {first && !failed ? (
        <Image
          source={imageUrl(first)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={first}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={styles.letter}>{exercise.name[0]}</Text>
      )}
    </View>
  );
}

/** Start/end position photos, alternating like an animation. */
export function ExerciseDemo({ exercise }: { exercise: Exercise }) {
  const [frame, setFrame] = useState(0);
  const count = exercise.images.length;

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % count), 1000);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;
  return (
    <View style={styles.demo}>
      {exercise.images.map((img, i) => (
        // All frames stay mounted (and cached) so switching doesn't flicker.
        <Image
          key={img}
          source={imageUrl(img)}
          style={[StyleSheet.absoluteFill, { opacity: i === frame % count ? 1 : 0 }]}
          contentFit="contain"
          cachePolicy="disk"
          accessibilityLabel={`${exercise.name}, position ${i + 1}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: { color: colors.text, fontWeight: '700', fontSize: 16 },
  demo: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
