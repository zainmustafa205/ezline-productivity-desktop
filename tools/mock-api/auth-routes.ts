import { MOCK_API_CONFIG } from '../../src/shared/config/app-config.ts'
import { BACKEND_ERROR_CODES, BACKEND_MESSAGES } from '../../src/shared/contracts/api-types.ts'
import type { RouteHandler } from './context.ts'
import { MOCK_PASSWORD } from './fixtures.ts'
import { isRecord, readJsonBody, sendError, sendSuccess, unknownFields } from './http.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** POST /auth/login */
export const login: RouteHandler = async ({ request, response, state }) => {
  const body = await readJsonBody(request, MOCK_API_CONFIG.bodyLimitBytes)
  if (!isRecord(body)) {
    sendError(response, 400, ['email must be an email', 'password should not be empty'])
    return
  }
  const errors = unknownFields(body, ['email', 'password', 'rememberMe'])
  const { email, password, rememberMe } = body
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email) || email.length > 320) {
    errors.push('email must be an email')
  }
  if (typeof password !== 'string' || password === '' || password.length > 128) {
    errors.push('password must be a string of at most 128 characters')
  }
  if (rememberMe !== undefined && typeof rememberMe !== 'boolean') {
    errors.push('rememberMe must be a boolean value')
  }
  if (errors.length > 0 || typeof email !== 'string') {
    sendError(response, 400, errors)
    return
  }

  const user = state.findUserByEmail(email)
  if (!user || password !== MOCK_PASSWORD) {
    sendError(response, 401, BACKEND_MESSAGES.INVALID_CREDENTIALS)
    return
  }

  switch (user.behaviour) {
    case 'UNVERIFIED':
      sendError(response, 401, BACKEND_MESSAGES.EMAIL_NOT_VERIFIED)
      return
    case 'LOCKED':
      sendError(response, 403, BACKEND_MESSAGES.TOO_MANY_FAILED_ATTEMPTS)
      return
    case 'SUSPENDED':
      sendError(response, 403, 'Your account is suspended.', {
        code: BACKEND_ERROR_CODES.ACCOUNT_SUSPENDED,
      })
      return
    case 'PASSWORD_RESET_REQUIRED':
      sendError(response, 403, 'You must reset your password before logging in.', {
        code: BACKEND_ERROR_CODES.PASSWORD_RESET_REQUIRED,
      })
      return
    case 'MFA':
      sendSuccess(response, 200, 'Login successful.', {
        mfaRequired: true,
        mfaToken: `mock-mfa-${user.id}`,
        expiresInSeconds: 300,
      })
      return
    case 'OK': {
      const tokens = state.issueTokens(user.id)
      sendSuccess(response, 200, 'Login successful.', {
        user: { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole },
        ...tokens,
      })
    }
  }
}

function readRefreshToken(body: unknown): string | string[] {
  if (!isRecord(body)) return ['refreshToken should not be empty']
  const errors = unknownFields(body, ['refreshToken'])
  const token = body['refreshToken']
  if (typeof token !== 'string' || token === '' || token.length > 2048) {
    errors.push('refreshToken should not be empty')
  }
  return errors.length > 0 || typeof token !== 'string' ? errors : token
}

/** POST /auth/refresh. Refresh tokens are single use; reusing one ends every session. */
export const refresh: RouteHandler = async ({ request, response, state }) => {
  const token = readRefreshToken(await readJsonBody(request, MOCK_API_CONFIG.bodyLimitBytes))
  if (Array.isArray(token)) {
    sendError(response, 400, token)
    return
  }
  const stored = state.refreshTokens.get(token)
  if (!stored) {
    sendError(response, 401, BACKEND_MESSAGES.INVALID_REFRESH_TOKEN)
    return
  }
  if (stored.used) {
    state.revokeUserSessions(stored.userId)
    sendError(response, 401, BACKEND_MESSAGES.INVALID_REFRESH_TOKEN)
    return
  }
  const user = state.findUser(stored.userId)
  if (user?.behaviour === 'SUSPENDED') {
    sendError(response, 401, 'Your account is suspended.', {
      code: BACKEND_ERROR_CODES.ACCOUNT_SUSPENDED,
    })
    return
  }
  if (user?.behaviour === 'PASSWORD_RESET_REQUIRED') {
    sendError(response, 401, 'You must reset your password.', {
      code: BACKEND_ERROR_CODES.PASSWORD_RESET_REQUIRED,
    })
    return
  }
  stored.used = true
  sendSuccess(response, 200, 'Token refreshed successfully.', state.issueTokens(stored.userId))
}

/** POST /auth/logout (201, no data). */
export const logout: RouteHandler = async ({ request, response, state }) => {
  const token = readRefreshToken(await readJsonBody(request, MOCK_API_CONFIG.bodyLimitBytes))
  if (Array.isArray(token)) {
    sendError(response, 400, token)
    return
  }
  const stored = state.refreshTokens.get(token)
  if (!stored || stored.used) {
    sendError(response, 401, BACKEND_MESSAGES.INVALID_REFRESH_TOKEN)
    return
  }
  state.refreshTokens.delete(token)
  sendSuccess(response, 201, 'Logged out successfully.')
}
