import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useState } from 'react';

import { confirmAsync } from './dialog';

/**
 * Asks before leaving a screen with unsaved changes (back button, gesture or header back).
 * Returns `leave()`, to call after saving: it goes back without asking.
 */
export function useUnsavedChangesGuard(dirty: boolean): () => void {
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);

  usePreventRemove(dirty && !leaving, ({ data }) => {
    confirmAsync('Discard changes?', 'You have unsaved changes that will be lost.', 'Discard', true).then((ok) => {
      if (ok) navigation.dispatch(data.action);
    });
  });

  // Navigate once the guard has been switched off for this render.
  useEffect(() => {
    if (leaving && router.canGoBack()) router.back();
  }, [leaving]);

  return useCallback(() => setLeaving(true), []);
}
