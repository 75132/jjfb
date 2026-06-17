import { onBeforeUnmount, onDeactivated } from 'vue'

/**
 * 页面轮询：组件卸载/失活时自动清理，避免切页后定时器泄漏。
 */
export function usePolling(fn: () => void, intervalMs: number, runImmediately = false) {
  let timer: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  function start() {
    stop()
    if (runImmediately) {
      try {
        fn()
      } catch (e) {
        console.error('[usePolling] immediate run failed', e)
      }
    }
    timer = setInterval(() => {
      try {
        fn()
      } catch (e) {
        console.error('[usePolling] tick failed', e)
      }
    }, intervalMs)
  }

  onBeforeUnmount(stop)
  onDeactivated(stop)

  return { start, stop }
}
