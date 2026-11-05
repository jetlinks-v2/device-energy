import type { Authorization, Context } from '../../../shared/types'
export interface VerifiedSession {
  fingerprint: string
  at: number
  authorization: Authorization
  context: Context
}
/** A cached authorization belongs to the exact verified token, not merely the same project and application. */
export async function tokenFingerprint(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}
export function validOfflineSession(
  cached: VerifiedSession | null,
  fingerprint: string,
  now: number,
  applicationId: string
): cached is VerifiedSession {
  return (
    !!cached &&
    cached.fingerprint === fingerprint &&
    now >= cached.at &&
    now - cached.at <= 86400000 &&
    cached.context?.applicationId === applicationId &&
    cached.authorization?.user.id === cached.context.userId
  )
}
