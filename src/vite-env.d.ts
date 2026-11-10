/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_BAG_ID?: string;
  readonly VITE_FIREBASE_DEVICE_ID?: string;
  readonly VITE_FIREBASE_AUTO_CONNECT?: string;
  readonly VITE_FIREBASE_STALE_AFTER_SEC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
