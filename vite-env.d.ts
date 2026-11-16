/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_EMULATORS?: string;
  readonly VITE_ALLOWED_EMAIL_DOMAINS?: string;
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
