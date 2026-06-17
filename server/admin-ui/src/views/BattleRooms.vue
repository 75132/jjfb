<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getBattleRooms } from '@/api/http'
import { usePolling } from '@/composables/usePolling'
import type { BattleRoom } from '@/types/admin'
import { formatTime } from '@/utils/format'

const rooms = ref<BattleRoom[]>([])
const loading = ref(false)
const pollOk = ref(true)
const POLL_MS = 2000

async function fetchRooms() {
  loading.value = true
  try {
    const data = await getBattleRooms()
    rooms.value = Array.isArray(data) ? data : []
    pollOk.value = true
  } catch {
    pollOk.value = false
  } finally {
    loading.value = false
  }
}

const polling = usePolling(fetchRooms, POLL_MS, true)

onMounted(() => {
  polling.start()
})
</script>
