import { ref } from 'vue'

export type LogType = 'info' | 'success' | 'warning' | 'error'

export interface LogEntry {
  time: string
  message: string
  type: LogType
}

export function useOperationLog() {
  const logs = ref<LogEntry[]>([])
  const filter = ref<'all' | LogType>('all')

  function addLog(message: string, type: LogType = 'info') {
    logs.value.unshift({
      time: new Date().toLocaleTimeString('zh-CN'),
      message,
      type,
    })
    if (logs.value.length > 200) logs.value.pop()
  }

  function clearLogs() {
    logs.value = []
  }

  function exportLogs() {
    const content = logs.value
      .map((e) => `[${e.time}] [${e.type.toUpperCase()}] ${e.message}`)
      .join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredLogs = () =>
    filter.value === 'all' ? logs.value : logs.value.filter((l) => l.type === filter.value)

  return { logs, filter, addLog, clearLogs, exportLogs, filteredLogs }
}
