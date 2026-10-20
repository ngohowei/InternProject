import { useSyncExternalStore } from 'react';

/*
 * Which layout to show: the phone layout (top bar + bottom tabs + card lists) or the computer layout.
 *
 * It is chosen automatically from the device:
 *   - a narrow screen (a phone held upright), or
 *   - a touch screen that is short (a phone turned sideways, e.g. 926 x 428)
 * and a person can override it ("Use desktop layout" / "Use phone layout"); the choice is remembered
 * on that device. Computers and tablets in landscape get the computer layout.
 */
const DEVICE_QUERY = '(max-width: 720px), (pointer: coarse) and (max-height: 500px)';
const STORAGE_KEY = 'welpack_layout'; // 'desktop' | 'mobile' | (absent = automatic)

const readOverride = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'desktop' || v === 'mobile' ? v : null;
  } catch {
    return null;
  }
};

// --- the person's saved choice (shared by every component that asks) ---
const overrideListeners = new Set();
let overrideSnapshot = readOverride();
const subscribeOverride = (cb) => {
  overrideListeners.add(cb);
  return () => overrideListeners.delete(cb);
};
export const setLayoutOverride = (value) => {
  overrideSnapshot = value === 'desktop' || value === 'mobile' ? value : null;
  try {
    if (overrideSnapshot) localStorage.setItem(STORAGE_KEY, overrideSnapshot);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  overrideListeners.forEach((l) => l());
};

// --- what the device itself looks like ---
const subscribeDevice = (cb) => {
  const mq = window.matchMedia(DEVICE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const getDeviceIsPhone = () => window.matchMedia(DEVICE_QUERY).matches;

export const useLayoutMode = () => {
  const deviceIsPhone = useSyncExternalStore(subscribeDevice, getDeviceIsPhone, () => false);
  const override = useSyncExternalStore(subscribeOverride, () => overrideSnapshot, () => null);

  const isMobile = override === 'mobile' ? true : override === 'desktop' ? false : deviceIsPhone;
  return {
    isMobile, // show the phone layout?
    deviceIsPhone, // is this device a phone?
    override, // 'desktop' | 'mobile' | null (automatic)
    setOverride: setLayoutOverride
  };
};
