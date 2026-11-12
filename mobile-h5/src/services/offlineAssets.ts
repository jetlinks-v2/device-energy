import { preloadOfflineRoutes } from '../routes'

function activated(worker: ServiceWorker): Promise<void> {
  if (worker.state === 'activated') return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(Error('离线资源安装超时，请联网重试')), 60000)
    const finish = (error?: Error) => { clearTimeout(timer); worker.removeEventListener('statechange', update); error ? reject(error) : resolve() }
    const update = () => {
      if (worker.state === 'activated') finish()
      else if (worker.state === 'redundant') finish(Error('离线资源安装失败，请联网重试'))
    }
    worker.addEventListener('statechange', update); update()
  })
}
/** 激活后再次由当前 worker 核对完整缓存，不能把旧 worker ready 当成本次安装完成。 */
export async function ensureOfflineAssets(production = import.meta.env.PROD, workers: ServiceWorkerContainer | undefined = navigator.serviceWorker) {
  if (!production) return
  if (!workers) throw Error('当前浏览器不支持离线页面缓存')
  const registration = await workers.register('./sw.js')
  const worker = registration.installing || registration.waiting || registration.active
  if (!worker) throw Error('离线资源安装尚未开始，请联网重试')
  await activated(worker)
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel()
    const finish = (error?: Error) => { clearTimeout(timer); channel.port1.close(); error ? reject(error) : resolve() }
    const timer = setTimeout(() => finish(Error('离线页面缓存校验超时，请联网重试')), 15000)
    channel.port1.onmessage = event => finish(event.data?.ready === true ? undefined : Error('离线页面缓存不完整，请联网重试'))
    try { worker.postMessage({ type: 'facility:offline-ready' }, [channel.port2]) }
    catch (cause) { finish(cause instanceof Error ? cause : Error('离线页面缓存校验失败')) }
  })
}
/** 先完成路由模块及生产静态缓存，再允许业务快照写入启用标记。 */
export async function prepareOfflineResources() {
  await preloadOfflineRoutes()
  await ensureOfflineAssets()
}
