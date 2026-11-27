/**
 * Build-time variables of the main process (electron-vite loads MAIN_VITE_*
 * from .env files). They are compiled into the application and are public:
 * never put a secret here.
 */
interface ImportMetaEnv {
  /** Backend API base URL, without a trailing slash. Required (https) in the production build. */
  readonly MAIN_VITE_API_URL?: string
  /** Web app origin, without a trailing slash. Required (https) in the production build. */
  readonly MAIN_VITE_WEB_APP_URL?: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
