import axios from 'axios'

export const http = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

export async function getBattleRooms() {
  const { data } = await http.get('/api/battle-rooms')
  return data
}

export async function postDaletou(body: Record<string, unknown>) {
  const { data } = await http.post('/api/daletou', body)
  return data
}

export async function postMinigame2(body: Record<string, unknown>) {
  const { data } = await http.post('/api/minigame2', body)
  return data
}

export async function loadItemsJson(): Promise<Record<string, string>> {
  const { data } = await http.get('/Items.json')
  const map: Record<string, string> = {}
  if (Array.isArray(data)) {
    for (const item of data) {
      const id = item.id ?? item.itemId ?? item.ID
      const name = item.name ?? item.Name ?? `物品${id}`
      if (id != null) map[String(id)] = String(name)
    }
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'object' && v && 'name' in v) {
        map[k] = String((v as { name: string }).name)
      } else if (typeof v === 'string') {
        map[k] = v
      }
    }
  }
  return map
}
