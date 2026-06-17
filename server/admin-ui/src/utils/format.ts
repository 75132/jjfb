export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (days > 0) return `${days}天 ${hours}时 ${mins}分`
  if (hours > 0) return `${hours}时 ${mins}分 ${secs}秒`
  return `${mins}分 ${secs}秒`
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K'
  return String(num)
}

export function todayStr(): string {
  const t = new Date()
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

export function formatTime(ts: number | string | null | undefined): string {
  if (ts == null) return '-'
  const d = new Date(typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : ts)
  return isNaN(d.getTime()) ? '-' : d.toLocaleTimeString('zh-CN', { hour12: false })
}
