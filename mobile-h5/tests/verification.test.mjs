import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tokenFingerprint, validOfflineSession } from '../src/services/verification.ts'
test('offline authorization requires the exact token, app, user and unexpired interval', async () => {
  const at = Date.now(),
    fingerprint = await tokenFingerprint('first-token')
  const cached = {
    at,
    fingerprint,
    authorization: { user: { id: 'alice' }, permissions: [] },
    context: { userId: 'alice', applicationId: 'app' }
  }
  assert.equal(validOfflineSession(cached, fingerprint, at + 1000, 'app'), true)
  assert.equal(validOfflineSession(cached, await tokenFingerprint('second-token'), at + 1000, 'app'), false)
  assert.equal(validOfflineSession(cached, fingerprint, at + 86400001, 'app'), false)
  assert.equal(validOfflineSession(cached, fingerprint, at + 1000, 'other-app'), false)
  assert.equal(
    validOfflineSession({ ...cached, context: { userId: 'bob', applicationId: 'app' } }, fingerprint, at + 1000, 'app'),
    false
  )
})
