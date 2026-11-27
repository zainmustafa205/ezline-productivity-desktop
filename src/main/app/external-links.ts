import type { Logger } from '../../shared/contracts/logger'

export interface ExternalLinkPolicy {
  /** Origins that may be opened in the default browser (the web app only). */
  allowedOrigins: readonly string[]
  /** The packaged application opens https links only. */
  requireHttps: boolean
}

/** True only for an http(s) URL on an allowed origin, without credentials. */
export function isAllowedExternalUrl(url: string, policy: ExternalLinkPolicy): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && (policy.requireHttps || parsed.protocol !== 'http:')) {
    return false
  }
  if (parsed.username !== '' || parsed.password !== '') return false
  return policy.allowedOrigins.some((origin) => safeOrigin(origin) === parsed.origin)
}

function safeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export interface ExternalLinkOpener {
  /** Opens the URL in the default browser if the policy allows it; returns whether it did. */
  open(url: string): boolean
}

export function createExternalLinkOpener(
  policy: ExternalLinkPolicy,
  openExternal: (url: string) => Promise<void>,
  logger: Logger,
): ExternalLinkOpener {
  return {
    open(url) {
      if (!isAllowedExternalUrl(url, policy)) {
        logger.warn('external_link.blocked')
        return false
      }
      openExternal(url).catch(() => logger.warn('external_link.open_failed'))
      return true
    },
  }
}
