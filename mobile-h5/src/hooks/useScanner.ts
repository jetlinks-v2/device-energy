import { feText } from '../../../shared/i18n'
import { ref, onBeforeUnmount } from 'vue'
import jsQR from 'jsqr'
/** 摄像头与二维码图片共用本地解码，不上传影像。退出页面时释放摄像头。 */
export function useScanner(onCode: (code: string) => void) {
  const active = ref(false),
    error = ref('')
  let video: HTMLVideoElement | undefined,
    stream: MediaStream | undefined,
    frame = 0
  const setVideo = (element: unknown) => {
    video = element instanceof HTMLVideoElement ? element : undefined
  }
  const stop = () => {
    active.value = false
    cancelAnimationFrame(frame)
    stream?.getTracks().forEach((t) => t.stop())
    stream = undefined
  }
  const decode = (source: CanvasImageSource, width: number, height: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return false
    context.drawImage(source, 0, 0)
    const pixels = context.getImageData(0, 0, width, height),
      result = jsQR(pixels.data, width, height)
    if (result) {
      stop()
      onCode(result.data)
      return true
    }
    return false
  }
  const loop = () => {
    if (!active.value) return
    if (video?.readyState === 4 && decode(video, video.videoWidth, video.videoHeight)) return
    frame = requestAnimationFrame(loop)
  }
  const start = async () => {
    error.value = ''
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (!video) {
        stop()
        return
      }
      video.srcObject = stream
      await video.play()
      active.value = true
      loop()
    } catch {
      stop()
      error.value = feText('cameraUnavailableChooseAQrCodeImageOrPasteItsContents')
    }
  }
  const scanImage = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const bitmap = await createImageBitmap(file)
      const found = decode(bitmap, bitmap.width, bitmap.height)
      bitmap.close()
      if (!found) error.value = feText('noDeviceQrCodeWasFoundInTheImage')
    } catch {
      error.value = feText('unableToReadTheImagePleaseTryAgain')
    }
  }
  onBeforeUnmount(stop)
  return { active, error, setVideo, start, stop, scanImage }
}
