import { feText } from '../../shared/i18n'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import Vant from 'vant'
import 'vant/lib/index.css'
import MobileNotice from './components/MobileNotice.vue'
import MobileSheet from './components/MobileSheet.vue'
import MobileSelect from './components/MobileSelect.vue'
import './style.css'
import App from './App.vue'
import { initializeConfig, state, clearSession, attachHostBridge } from './services/session'
import { verifySession } from './hooks/useSession'
import { routePages } from './routes'
import { ensureOfflineAssets } from './services/offlineAssets'
const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: (_to, _from, saved) => saved || { left: 0, top: 0 },
  routes: [
    { path: '/', component: routePages.home },
    { path: '/faults', component: routePages.faults },
    { path: '/faults/:id', component: routePages.fault },
    { path: '/faults/:id/repair', component: routePages.faultRepair },
    { path: '/tasks', component: routePages.tasks },
    { path: '/scan', component: routePages.scan },
    { path: '/sync', component: routePages.sync },
    { path: '/profile', component: routePages.profile },
    { path: '/alerts/:id', component: routePages.alert },
    { path: '/messages', component: routePages.messages },
    { path: '/owner', redirect: '/messages' },
    { path: '/login', component: routePages.login },
    { path: '/tasks/:id', component: routePages.task },
    { path: '/groups/:id', component: routePages.group },
    { path: '/device/:id', component: routePages.device },
    { path: '/meters/:id', redirect: '/messages' },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
async function bootstrap() {
  await initializeConfig()
  router.beforeEach(async (to) => {
    if (to.path === '/login') return true
    if (!state.session) return '/login'
    if (!state.authorization)
      try {
        await verifySession()
      } catch {
        clearSession()
        return '/login'
      }
    return true
  })
  attachHostBridge(async () => {
    try {
      await verifySession()
      await router.replace('/')
    } catch {
      clearSession()
      await router.replace('/login')
    }
  })
  window.addEventListener('facility:session-expired', () => void router.replace('/login'))
  createApp(App).use(Vant).component('MobileNotice', MobileNotice).component('MobileSheet', MobileSheet).component('MobileSelect', MobileSelect).use(router).mount('#app')
}
void bootstrap().catch(() => {
  document.getElementById('app')!.textContent = feText('failedToLoadApplicationConfigurationRefreshToRetry')
})

// 提前安装静态资源；失败明确记录，开启离线时会重新核验并显示失败原因。
if (import.meta.env.PROD) void ensureOfflineAssets().catch(error => console.error('离线页面缓存未就绪', error))
