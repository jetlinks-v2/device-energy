import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
/** Only build assets are cached. No authenticated API response enters the service-worker cache. */
const offlineAssets = (): Plugin => ({
  name: 'facility-offline-assets',
  generateBundle(_, bundle) {
    const files = ['./', 'index.html', 'config.json', ...Object.keys(bundle)]
    this.emitFile({
      type: 'asset',
      fileName: 'sw.js',
      source: `const CACHE='facility-assets-${Date.now()}';const FILES=${JSON.stringify(files)}.map(p=>new URL(p,self.registration.scope).href);self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('facility-assets-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const url=e.request.url.split('?')[0];if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match(new URL('index.html',self.registration.scope).href)));return}if(FILES.includes(url))e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)))});`
    })
  }
})
export default defineConfig({
  plugins: [vue(), offlineAssets()],
  resolve: { dedupe: ['vue'] },
  server: {
    port: 9502,
    strictPort: true,
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: process.env.FACILITY_API_PROXY || 'http://localhost:8800',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '')
      }
    }
  }
})
