import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_IMPERIAL_PLATES, DEFAULT_SETTINGS, getSettings, saveSettings } from '@/db/repo';
import type { Settings } from '@/lib/types';

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Re-reads settings from the database (e.g. after restoring a backup). */
  reloadSettings: () => Promise<Settings>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    getSettings(db).then(setSettings);
  }, [db]);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        let next = { ...prev, ...patch };
        // Switching units resets the bar and plates to sensible defaults for that unit.
        if (patch.units && patch.units !== prev.units && !patch.plates) {
          next =
            patch.units === 'imperial'
              ? { ...next, barWeight: 45, plates: DEFAULT_IMPERIAL_PLATES }
              : { ...next, barWeight: DEFAULT_SETTINGS.barWeight, plates: DEFAULT_SETTINGS.plates };
        }
        saveSettings(db, next);
        return next;
      });
    },
    [db],
  );

  const reloadSettings = useCallback(async () => {
    const s = await getSettings(db);
    setSettings(s);
    return s;
  }, [db]);

  const value = useMemo(() => ({ settings, updateSettings, reloadSettings }), [settings, updateSettings, reloadSettings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
