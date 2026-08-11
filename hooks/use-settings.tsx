import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const SETTINGS_KEY = 'homecircle-settings';

export type AppSettings = {
  calendarShared: boolean;
  healthSyncEnabled: boolean;
  stepGoal: number;
};

const defaultSettings: AppSettings = {
  calendarShared: true,
  healthSyncEnabled: true,
  stepGoal: 10000,
};

async function getStoredSettings() {
  if (process.env.EXPO_OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(SETTINGS_KEY);
  }
  return SecureStore.getItemAsync(SETTINGS_KEY);
}

async function setStoredSettings(settings: AppSettings) {
  const value = JSON.stringify(settings);
  if (process.env.EXPO_OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(SETTINGS_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(SETTINGS_KEY, value);
}

type SettingsContextValue = {
  hydrated: boolean;
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    let isMounted = true;
    async function hydrate() {
      const stored = await getStoredSettings();
      if (!isMounted) return;
      if (stored) setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      setHydrated(true);
    }
    hydrate();
    return () => { isMounted = false; };
  }, []);

  async function update(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await setStoredSettings(next);
  }

  return (
    <SettingsContext.Provider value={{ hydrated, settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
