import { ref } from 'vue'
import { loadItemsJson } from '@/api/http'
import type { ItemEntry } from '@/types/admin'

const itemsMap = ref<Record<string, string>>({})
const itemsList = ref<ItemEntry[]>([])
const loaded = ref(false)

export function useItems() {
  async function loadItems() {
    if (loaded.value) return
    try {
      const map = await loadItemsJson()
      itemsMap.value = map
      itemsList.value = Object.entries(map)
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => Number(a.id) - Number(b.id))
      loaded.value = true
    } catch (e) {
      console.warn('load items failed', e)
    }
  }
  return { itemsMap, itemsList, loadItems }
}
