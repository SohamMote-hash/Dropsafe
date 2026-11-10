// Public Firebase web configuration. Only the Realtime Database URL is needed for
// unauthenticated, read-only monitoring data. No Admin credentials or device tokens
// are ever placed in frontend code.
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

const readEnv = (value: string | undefined, fallback = '') => (value ?? fallback).trim();
const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(readEnv(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const databaseURL = readEnv(import.meta.env.VITE_FIREBASE_DATABASE_URL);

export const firebaseConfigured = databaseURL.length > 0;
export const FIREBASE_BAG_ID = readEnv(import.meta.env.VITE_FIREBASE_BAG_ID, 'IV-01') || 'IV-01';
export const FIREBASE_DEVICE_ID = readEnv(import.meta.env.VITE_FIREBASE_DEVICE_ID, 'dropsafe-01') || 'dropsafe-01';
export const FIREBASE_AUTO_CONNECT = readEnv(import.meta.env.VITE_FIREBASE_AUTO_CONNECT, 'true').toLowerCase() !== 'false';
export const CLOUD_STALE_AFTER_SEC = positiveInt(import.meta.env.VITE_FIREBASE_STALE_AFTER_SEC, 30);

let database: Database | null = null;
let app: FirebaseApp | null = null;

export function getFirebaseDatabase(): Database {
  if (!firebaseConfigured) {
    throw new Error('Firebase is not configured. Set VITE_FIREBASE_DATABASE_URL.');
  }
  if (!database) {
    app = getApps().find((candidate) => candidate.name === 'dropsafe')
      ?? initializeApp({ databaseURL }, 'dropsafe');
    database = getDatabase(app);
  }
  return database;
}

export function getFirebaseApp(): FirebaseApp | null {
  return app ?? getApps().find((candidate) => candidate.name === 'dropsafe') ?? null;
}
