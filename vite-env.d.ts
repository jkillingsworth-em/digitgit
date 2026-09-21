interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_EM_DIGIT_SHEET_ID?: string;
  readonly VITE_ALLOWED_EMAIL_DOMAINS?: string;
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
