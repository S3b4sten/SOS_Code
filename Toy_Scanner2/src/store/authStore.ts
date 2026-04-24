export type AuthRole = 'operator' | 'manager';
export type AuthChangeReason = 'login' | 'logout' | 'timeout';

type PinStorageRecord = {
  algorithm: 'sha256' | 'btoa';
  hash: string;
};

type AuthListener = (role: AuthRole, reason?: AuthChangeReason) => void;

const DEFAULT_PIN = '1234';
const PIN_STORAGE_KEY = 'toy-scanner-manager-pin';
const MANAGER_TIMEOUT_MS = 5 * 60 * 1000;

let currentRole: AuthRole = 'operator';
let logoutTimerId: number | null = null;
const listeners = new Set<AuthListener>();

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canUseSubtleCrypto() {
  return typeof window !== 'undefined' && typeof window.crypto?.subtle !== 'undefined';
}

function notifyListeners(reason?: AuthChangeReason) {
  listeners.forEach((listener) => listener(currentRole, reason));
}

function clearLogoutTimer() {
  if (logoutTimerId !== null) {
    window.clearTimeout(logoutTimerId);
    logoutTimerId = null;
  }
}

async function sha256Hash(pin: string) {
  const encoder = new TextEncoder();
  const digest = await window.crypto.subtle.digest('SHA-256', encoder.encode(pin));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function encodeWithBtoa(pin: string) {
  return window.btoa(pin);
}

async function hashPin(pin: string): Promise<PinStorageRecord> {
  if (canUseSubtleCrypto()) {
    return {
      algorithm: 'sha256',
      hash: await sha256Hash(pin),
    };
  }

  return {
    algorithm: 'btoa',
    hash: encodeWithBtoa(pin),
  };
}

async function readStoredPinRecord(): Promise<PinStorageRecord> {
  if (!canUseLocalStorage()) {
    return hashPin(DEFAULT_PIN);
  }

  const storedValue = window.localStorage.getItem(PIN_STORAGE_KEY);
  if (storedValue) {
    try {
      const parsed = JSON.parse(storedValue) as Partial<PinStorageRecord>;
      if (
        (parsed.algorithm === 'sha256' || parsed.algorithm === 'btoa') &&
        typeof parsed.hash === 'string'
      ) {
        return {
          algorithm: parsed.algorithm,
          hash: parsed.hash,
        };
      }
    } catch {
      // Ignore corrupted localStorage values and recreate from default.
    }
  }

  const defaultRecord = await hashPin(DEFAULT_PIN);
  window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(defaultRecord));
  return defaultRecord;
}

async function verifyPinAgainstRecord(pin: string, record: PinStorageRecord) {
  const candidateRecord =
    record.algorithm === 'sha256' && canUseSubtleCrypto()
      ? { algorithm: 'sha256' as const, hash: await sha256Hash(pin) }
      : { algorithm: 'btoa' as const, hash: encodeWithBtoa(pin) };

  return candidateRecord.hash === record.hash;
}

function startManagerTimeout() {
  clearLogoutTimer();
  logoutTimerId = window.setTimeout(() => {
    currentRole = 'operator';
    logoutTimerId = null;
    notifyListeners('timeout');
  }, MANAGER_TIMEOUT_MS);
}

function isValidPinFormat(pin: string) {
  return /^\d{4}$/.test(pin);
}

export function getCurrentRole(): AuthRole {
  return currentRole;
}

export function subscribe(listener: AuthListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function logout() {
  clearLogoutTimer();
  currentRole = 'operator';
  notifyListeners('logout');
}

export function onActivity() {
  if (currentRole === 'manager') {
    startManagerTimeout();
  }
}

export async function isPinCorrect(pin: string): Promise<boolean> {
  if (!isValidPinFormat(pin)) {
    return false;
  }

  const storedRecord = await readStoredPinRecord();
  return verifyPinAgainstRecord(pin, storedRecord);
}

export async function login(pin: string): Promise<boolean> {
  const isCorrect = await isPinCorrect(pin);
  if (!isCorrect) {
    return false;
  }

  currentRole = 'manager';
  startManagerTimeout();
  notifyListeners('login');
  return true;
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  if (!isValidPinFormat(newPin)) {
    return false;
  }

  const storedRecord = await readStoredPinRecord();
  const isOldPinCorrect = await verifyPinAgainstRecord(oldPin, storedRecord);
  if (!isOldPinCorrect) {
    return false;
  }

  if (!canUseLocalStorage()) {
    return false;
  }

  const newRecord = await hashPin(newPin);
  window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(newRecord));
  return true;
}
