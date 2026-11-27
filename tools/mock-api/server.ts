import { parseArgs } from 'node:util'
import { MOCK_API_CONFIG } from '../../src/shared/config/app-config.ts'
import { MOCK_PASSWORD, MOCK_USERS } from './fixtures.ts'
import { createMockApi } from './mock-api.ts'

/*
 * `npm run mock-api` starts the local mock of the backend.
 * Options: --port 4010  --host 127.0.0.1  --latency 0 (milliseconds)
 * See tools/mock-api/README.md for the accounts and the control routes.
 */

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: String(MOCK_API_CONFIG.port) },
    host: { type: 'string', default: MOCK_API_CONFIG.host },
    latency: { type: 'string', default: '0' },
  },
})

const port = Number(values.port)
const latencyMs = Number(values.latency)
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  console.error('--port must be a port number.')
  process.exit(1)
}

const api = createMockApi({ host: values.host, port, latencyMs })

try {
  const url = await api.start()
  console.log(`Mock API listening on ${url}`)
  console.log(`Test password of every account: ${MOCK_PASSWORD}`)
  for (const user of MOCK_USERS) console.log(`  ${user.email.padEnd(24)} ${user.behaviour}`)
  console.log('Control routes: GET /__mock/state, POST /__mock/reset (see README). Ctrl+C stops.')
} catch (error) {
  console.error('The mock API could not start.', String(error))
  process.exit(1)
}

const shutdown = (): void => {
  api.stop().then(
    () => process.exit(0),
    () => process.exit(1),
  )
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
