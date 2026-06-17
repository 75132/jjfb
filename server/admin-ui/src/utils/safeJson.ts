export function safeJsonPreview(value: unknown, maxLen = 200): string {
  try {
    return JSON.stringify(
      value,
      (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
    ).slice(0, maxLen)
  } catch {
    return String(value)
  }
}
