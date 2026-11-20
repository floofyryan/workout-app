import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { imageUrl, videoSearchUrl } from '@/lib/freeExerciseDb';
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

/**
 * Opens video demonstrations of the exercise in a popup over the app (a sheet on iOS, an in-app
 * browser tab on Android) rather than switching to another app.
 */
export async function openExerciseVideo(name: string) {
  try {
    await WebBrowser.openBrowserAsync(videoSearchUrl(name), {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: colors.background,
      controlsColor: colors.primary,
      dismissButtonStyle: 'done',
      showTitle: true,
      enableBarCollapsing: true,
      // Keep it on top of the app, so closing it comes straight back here.
      createTask: false,
    });
  } catch {
    // Already open, or no browser available.
  }
}

export function WatchVideoButton({ exercise }: { exercise: Exercise }) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    if (opening) return;
    setOpening(true);
    await openExerciseVideo(exercise.name);
    setOpening(false);
  };
  return (
    <Pressable onPress={open} style={({ pressed }) => [styles.videoButton, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Ionicons name="logo-youtube" size={20} color="#FF0033" />
      <Text style={styles.videoText}>Watch a video</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  videoText: { color: colors.text, fontWeight: '600', fontSize: 15 },
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
