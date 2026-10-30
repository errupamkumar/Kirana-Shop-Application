import * as Location from 'expo-location';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { api } from '../lib/api';
import type { LocationCheck } from '../lib/types';

type Status = 'unknown' | 'needsPermission' | 'denied' | 'locating' | 'ready' | 'error';

interface LocationState {
  status: Status;
  check: LocationCheck | null;
  coords: { lat: number; lng: number } | null;
  set: (patch: Partial<Omit<LocationState, 'set'>>) => void;
}

export const useLocationStore = create<LocationState>()((set) => ({
  status: 'unknown',
  check: null,
  coords: null,
  set: (patch) => set(patch),
}));

export async function currentCoords(): Promise<{ lat: number; lng: number }> {
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    lat: Number(position.coords.latitude.toFixed(6)),
    lng: Number(position.coords.longitude.toFixed(6)),
  };
}

export async function checkServiceability(lat: number, lng: number): Promise<LocationCheck> {
  const { data } = await api.post<LocationCheck>('/app/location/check', { lat, lng });
  return data;
}

/** Reads GPS and asks the server whether it is inside the delivery radius. */
async function locate() {
  const { set } = useLocationStore.getState();
  set({ status: 'locating' });
  try {
    const coords = await currentCoords();
    const check = await checkServiceability(coords.lat, coords.lng);
    set({ status: 'ready', coords, check });
  } catch {
    set({ status: 'error' });
  }
}

/**
 * Re-checks the banner (pull to refresh, app back in the foreground) when location is already allowed,
 * so a moved customer or a changed delivery radius shows up without restarting the app.
 */
export async function recheckLocation() {
  const { status } = useLocationStore.getState();
  if (status === 'ready' || status === 'error') {
    await locate();
  }
}

/**
 * Live GPS serviceability for the home banner. Asks for permission only after the user taps the explanation
 * card (request). Order placement uses the saved address coordinates, not this.
 */
export function useServiceability() {
  const state = useLocationStore();

  const request = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      await locate();
    } else {
      useLocationStore.getState().set({ status: 'denied' });
    }
  }, []);

  useEffect(() => {
    if (useLocationStore.getState().status !== 'unknown') return;
    void Location.getForegroundPermissionsAsync().then(({ status, canAskAgain }) => {
      if (status === 'granted') void locate();
      else useLocationStore.getState().set({ status: canAskAgain ? 'needsPermission' : 'denied' });
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void recheckLocation();
    });
    return () => subscription.remove();
  }, []);

  return { ...state, request, refresh: locate };
}
