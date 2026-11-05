import { pbkdf2, solveChallenge, type Challenge } from 'altcha/lib'
import { request, ApiError } from '../api/http'
import { feText } from '../../../shared/i18n'

interface CaptchaConfig { enabled: boolean; type: string; loginWithVerify?: boolean }
export interface LoginRequest {
  username: string
  password: string
  verifyKey?: string
  verifyCode?: string
  encryptId?: string
  expires: number
}

/** Proofs stay bound to the server operation, login name, browser cookie and verification key. */
async function altchaProof(reference: { key: string } | { contextToken: string }) {
  const challenge = await request<Challenge>('/authorize/captcha/altcha/challenge', reference, 'POST', false)
  if (challenge.parameters.algorithm !== 'PBKDF2/SHA-256') throw Error(feText('unsupportedVerificationAlgorithm'))
  const solution = await solveChallenge({ challenge, deriveKey: pbkdf2.deriveKey, timeout: 60000 })
  if (!solution) throw Error(feText('verificationExpiredPleaseTryAgain'))
  const payload = btoa(JSON.stringify({ challenge, solution }))
  return request<{ proof: string }>('/authorize/captcha/altcha/prevalidate', { ...reference, payload }, 'POST', false)
}

/** Supports both direct login captcha and Cloud's challenge/confirm/replay verification contract. */
export async function loginWithCaptcha(body: LoginRequest) {
  const config = await request<CaptchaConfig>('/authorize/captcha/config', undefined, 'GET', false)
  let proof: { proof: string; contextToken: string } | undefined
  if (config.enabled && config.type === 'altcha' && !config.loginWithVerify) {
    const context = await request<{ contextToken: string }>('/authorize/captcha/context',
      { operation: 'login.captcha', target: body.username }, 'POST', false)
    proof = { ...context, ...await altchaProof(context) }
  }
  try {
    return await request<{ token: string }>('/authorize/login', { ...body, ...proof }, 'POST', false)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403 || error.details?.type !== 'captcha' || !error.details.key)
      throw error
    const key = error.details.key
    const params = config.type === 'altcha'
      ? await altchaProof({ key })
      : { verifyKey: body.verifyKey, verifyCode: body.verifyCode }
    const confirmed = await request<{ token: string }>('/verify/captcha/_confirm',
      { key, provider: config.type, params }, 'POST', false)
    return request<{ token: string }>('/authorize/login', body, 'POST', false,
      { 'x-verify-key': key, 'x-verify-token': confirmed.token })
  }
}
