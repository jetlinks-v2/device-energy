import { feText } from '../../../shared/i18n'
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { tokenFingerprint, validOfflineSession, type VerifiedSession } from '../services/verification'
import type { Context } from '../../../shared/types'
import JSEncrypt from 'jsencrypt'
import { request, errorText } from '../api/http'
import { loginWithCaptcha } from '../services/captcha'
import { authorize } from '../api/facility'
import { clearSession, setSession, state } from '../services/session'

export async function verifySession() {
  if (!state.session) throw Error(feText('signInFirst'))
  const key = 'facility:verified:' + state.session.tenantDomain + ':' + state.session.applicationId
  const fingerprint = await tokenFingerprint(state.session.token)
  if (!navigator.onLine) {
    let cached: VerifiedSession | null = null
    try {
      cached = JSON.parse(sessionStorage.getItem(key) || 'null')
    } catch {
      /* Invalid local cache requires an online verification. */
    }
    if (!validOfflineSession(cached, fingerprint, Date.now(), state.session.applicationId))
      throw Error(feText('offlineCredentialsExpiredOrTheAccountChangedConnectAndSignIn'))
    state.authorization = cached.authorization
    state.context = cached.context
    return
  }
  const [authorization, context] = await Promise.all([
    authorize(),
    request<Context>('/property/facility-energy/session')
  ])
  if (context.userId !== authorization.user.id || context.applicationId !== state.session.applicationId)
    throw Error(feText('theCurrentAccountDoesNotMatchTheApplicationSession'))
  if (
    !authorization.permissions.some(
      (p) => ['facility-task', 'facility-owner'].includes(p.id) && p.actions.includes('query')
    )
  )
    throw Error(feText('thisAccountCannotAccessFacilityAndEnergyManagement'))
  state.authorization = authorization
  state.context = context
  sessionStorage.setItem(
    key,
    JSON.stringify({ fingerprint, at: Date.now(), authorization, context } satisfies VerifiedSession)
  )
}

export function useSession() {
  const router = useRouter(),
    loading = ref(false),
    error = ref(''),
    captcha = ref('')
  const form = reactive({
    username: '',
    password: '',
    verifyCode: '',
    verifyKey: '',
    tenantDomain: state.config.tenantDomain
  })
  const reloadCaptcha = async () => {
    try {
      const config = await request<{ enabled: boolean; type: string }>(
        '/authorize/captcha/config',
        undefined,
        'GET',
        false
      )
      if (config.enabled) {
        if (config.type === 'altcha') {
          captcha.value = ''
          return
        }
        if (config.type !== 'image') throw Error(feText('useCloudAppForThisSignInVerificationMethod'))
        const image = await request<{ base64: string; key: string }>(
          '/authorize/captcha/image?width=160&height=44',
          undefined,
          'GET',
          false
        )
        captcha.value = image.base64
        form.verifyKey = image.key
        form.verifyCode = ''
      }
    } catch (e) {
      error.value = errorText(e)
    }
  }
  const login = async () => {
    if (loading.value) return
    loading.value = true
    error.value = ''
    try {
      if (!form.username || !form.password || !form.tenantDomain) throw Error(feText('enterTheProjectCodeAccountAndPassword'))
      const config = await request<{ encrypt?: { enabled: boolean; id: string; publicKey: string } }>(
        '/authorize/login/configs',
        undefined,
        'GET',
        false
      )
      let password = form.password
      if (config.encrypt?.enabled) {
        const rsa = new JSEncrypt()
        rsa.setPublicKey(config.encrypt.publicKey)
        const encrypted = rsa.encrypt(password)
        if (!encrypted) throw Error(feText('passwordEncryptionFailedPleaseTryAgain'))
        password = encrypted
      }
      const result = await loginWithCaptcha({
          username: form.username.includes('@') ? form.username : form.username + '@' + form.tenantDomain,
          password,
          verifyKey: form.verifyKey,
          verifyCode: form.verifyCode,
          encryptId: config.encrypt?.enabled ? config.encrypt.id : undefined,
          expires: 3600000
        })
      setSession({ token: result.token, applicationId: state.config.applicationId, tenantDomain: form.tenantDomain })
      await verifySession()
      form.password = ''
      await router.replace('/')
    } catch (e) {
      clearSession()
      error.value = errorText(e)
      await reloadCaptcha()
    } finally {
      loading.value = false
    }
  }
  const logout = async () => {
    loading.value = true
    try {
      await request('/user-token/reset')
    } catch {
      /* 本地会话仍须清理。 */
    } finally {
      clearSession()
      loading.value = false
      await router.replace('/login')
    }
  }
  const expired = () => {
    error.value = feText('yourSessionHasExpiredPleaseSignInAgain')
    void router.replace('/login')
  }
  window.addEventListener('facility:session-expired', expired)
  onBeforeUnmount(() => window.removeEventListener('facility:session-expired', expired))
  return { form, captcha, loading, error, reloadCaptcha, login, logout }
}
