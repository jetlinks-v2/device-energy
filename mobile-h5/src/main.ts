import { feText } from '../../shared/i18n'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import App from './App.vue'
import { initializeConfig, state, clearSession, attachHostBridge } from './services/session'
import { verifySession } from './hooks/useSession'
const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: (_to, _from, saved) => saved || { left: 0, top: 0 },
  routes: [
    { path: '/', component: () => import('./views/HomePage.vue') },
    { path: '/tasks', component: () => import('./views/TaskListPage.vue') },
    { path: '/scan', component: () => import('./views/ScanPage.vue') },
    { path: '/sync', component: () => import('./views/SyncPage.vue') },
    { path: '/profile', component: () => import('./views/ProfilePage.vue') },
    { path: '/messages', component: () => import('./views/MessagesPage.vue') },
    { path: '/owner', redirect: '/messages' },
    { path: '/login', component: () => import('./views/LoginPage.vue') },
    { path: '/tasks/:id', component: () => import('./views/TaskPage.vue') },
    { path: '/groups/:id', component: () => import('./views/GroupPage.vue') },
    { path: '/device/:id', component: () => import('./views/DevicePage.vue') },
    { path: '/meters/:id', component: () => import('./views/OwnerMeterPage.vue') },
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
  createApp(App).use(Antd).use(router).mount('#app')
}
void bootstrap().catch(() => {
  document.getElementById('app')!.textContent = feText('failedToLoadApplicationConfigurationRefreshToRetry')
})

if (import.meta.env.PROD && 'serviceWorker' in navigator)
  void navigator.serviceWorker.register('./sw.js').catch(() => {})
