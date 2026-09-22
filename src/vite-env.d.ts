/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZORIA_API_URL?: string
  readonly VITE_ZORIA_ENV?: 'training' | 'production'
  readonly VITE_ZORIA_PRODUCTION_KEY_FINGERPRINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
