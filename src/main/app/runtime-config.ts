import { API_CONFIG } from '../../shared/config/app-config'

export interface RuntimeConfig {
  /** Backend API base URL without a trailing slash. */
  apiBaseUrl: string
  /** Web app origin without a trailing slash (forgot password, dashboard, download page). */
  webAppUrl: string
  /** True for the installed (packaged) application. */
  isPackaged: boolean
  appVersion: string
}

export interface RuntimeConfigInput {
  apiUrl: string | undefined
  webAppUrl: string | undefined
  isPackaged: boolean
  appVersion: string
}

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeConfigError'
  }
}

/**
 * Resolves the URLs the application talks to. In development the mock API is
 * the default. The packaged application requires both URLs and HTTPS.
 */
export function resolveRuntimeConfig(input: RuntimeConfigInput): RuntimeConfig {
  const apiBaseUrl = resolveUrl(
    'MAIN_VITE_API_URL',
    input.apiUrl,
    API_CONFIG.developmentApiUrl,
    input.isPackaged,
  )
  const webAppUrl = resolveUrl(
    'MAIN_VITE_WEB_APP_URL',
    input.webAppUrl,
    API_CONFIG.developmentWebAppUrl,
    input.isPackaged,
  )
  return { apiBaseUrl, webAppUrl, isPackaged: input.isPackaged, appVersion: input.appVersion }
}

function resolveUrl(
  name: string,
  value: string | undefined,
  developmentDefault: string,
  isPackaged: boolean,
): string {
  const raw = value?.trim() ?? ''
  if (raw === '' && isPackaged) throw new RuntimeConfigError(`${name} is not set for this build.`)
  const candidate = raw === '' ? developmentDefault : raw

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new RuntimeConfigError(`${name} is not a valid URL.`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RuntimeConfigError(`${name} must use http or https.`)
  }
  if (isPackaged && url.protocol !== 'https:') {
    throw new RuntimeConfigError(`${name} must use https in the production build.`)
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') {
    throw new RuntimeConfigError(`${name} must not contain credentials, a query or a fragment.`)
  }
  return url.toString().replace(/\/+$/, '')
}
