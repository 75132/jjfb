<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { onMessage, send, sendAdmin } from '@/composables/useWebSocket'
import { useItems } from '@/composables/useItems'
import { safeJsonPreview } from '@/utils/safeJson'
import type { AdminAccount, CharacterInfo } from '@/types/admin'

const { itemsList, loadItems } = useItems()

const loggedIn = ref(false)
const token = ref('')
const currentAccount = ref('')
const currentCharacterId = ref('')
const charInfo = ref<Record<string, unknown>>({})
const bagItems = ref<Record<string, number>>({})
const robots = ref<Array<Record<string, unknown>>>([])
const friends = ref<Array<Record<string, unknown>>>([])
const friendRequests = ref<Array<Record<string, unknown>>>([])
const friendId = ref('')
const searchFriendId = ref('')
const searchFriendResult = ref<Record<string, unknown> | null>(null)

const adminAccounts = ref<AdminAccount[]>([])
const loginAccount = ref('')
const loginPassword = ref('')
const showPassword = ref(false)

const switchAccount = ref('')
const switchCharacter = ref('')
const switchCharacters = ref<CharacterInfo[]>([])
const allCharsCache = ref<Record<string, CharacterInfo>>({})

const operationType = ref('add_exp')
const operationValue = ref('')
const operationItemId = ref('')
const operationQty = ref(1)

const messageLog = ref<Array<{ dir: string; data: unknown; time: string }>>([])

const currentCharLabel = computed(() => {
  const c = Object.values(allCharsCache.value).find((x) => x.character_id === currentCharacterId.value)
  return c ? `${c.role_name} (Lv.${c.level})` : currentCharacterId.value
})

function logMsg(dir: string, data: unknown) {
  messageLog.value.unshift({ dir, data, time: new Date().toLocaleTimeString() })
  if (messageLog.value.length > 100) messageLog.value.pop()
}

function getSlotIndex(): number {
  for (const [slot, char] of Object.entries(allCharsCache.value)) {
    if (char?.character_id === currentCharacterId.value) return parseInt(slot) || 0
  }
  return 0
}

function refreshCharacterData() {
  if (!token.value || !currentCharacterId.value) return
  send({ type: 'get_character_info', token: token.value, slot_index: getSlotIndex() })
  send({ type: 'bag_get', token: token.value, character_id: currentCharacterId.value })
  send({ type: 'get_robot_pets', token: token.value, character_id: currentCharacterId.value, page: 0, page_size: 50 })
  send({ type: 'get_player', token: token.value, character_id: currentCharacterId.value })
}

function doLogin() {
  if (!loginAccount.value || !loginPassword.value) {
    ElMessage.warning('请选择账号')
    return
  }
  send({ type: 'login', account: loginAccount.value, password: loginPassword.value })
}

function doLogout() {
  if (token.value) send({ type: 'logout', token: token.value })
  loggedIn.value = false
  token.value = ''
  currentCharacterId.value = ''
}

function onAccountSelect(acc: AdminAccount) {
  loginAccount.value = acc.account
  loginPassword.value = acc.password || ''
}

function onLoginAccountChange(v: string) {
  const a = adminAccounts.value.find((x) => x.account === v)
  if (a) onAccountSelect(a)
}

const unsubs: Array<() => void> = []

onMounted(() => {
  loadItems()
  sendAdmin('admin_get_admin_accounts')

  unsubs.push(
    onMessage('admin_get_admin_accounts_response', (d) => {
      if (d.success) adminAccounts.value = (d.accounts as AdminAccount[]) || []
    }),
    onMessage('login_response', (d) => {
      if (d.success) {
        token.value = d.token as string
        currentAccount.value = loginAccount.value
        loggedIn.value = true
        send({ type: 'get_all_characters', token: token.value })
        sendAdmin('admin_search_account', { account: currentAccount.value })
        ElMessage.success('登录成功')
      } else {
        ElMessage.error(String(d.message || '登录失败'))
      }
    }),
    onMessage('get_all_characters_response', (d) => {
      handleAllCharacters(d)
    }),
    onMessage('all_characters_response', (d) => {
      handleAllCharacters(d)
    }),
    onMessage('select_character_response', (d) => {
      if (d.success && d.character_id) {
        currentCharacterId.value = d.character_id as string
        switchCharacter.value = currentCharacterId.value
        refreshCharacterData()
      }
    }),
    onMessage('character_info_response', (d) => {
      if (d.success) charInfo.value = d as Record<string, unknown>
    }),
    onMessage('player_info_response', (d) => {
      const fid = (d.data as Record<string, unknown>)?.friend_id || d.friend_id
      friendId.value = fid ? String(fid) : '-'
    }),
    onMessage('player_info', (d) => {
      const fid = (d.data as Record<string, unknown>)?.friend_id || d.friend_id
      friendId.value = fid ? String(fid) : '-'
    }),
    onMessage('get_player_response', (d) => {
      const fid = (d.data as Record<string, unknown>)?.friend_id || d.friend_id
      friendId.value = fid ? String(fid) : '-'
    }),
    onMessage('bag_items', (d) => {
      if (d.success) bagItems.value = (d.items as Record<string, number>) || {}
    }),
    onMessage('robot_pets_response', (d) => {
      if (d.success) robots.value = (d.pets as Array<Record<string, unknown>>) || []
    }),
    onMessage('admin_search_response', (d) => {
      if (d.success && d.characters) {
        switchCharacters.value = d.characters as CharacterInfo[]
        const acc = (d.query as string) || (d.account as string) || switchAccount.value || currentAccount.value
        if (acc) charactersListUpdate(acc, d.characters as CharacterInfo[])
      }
    }),
    onMessage('get_friend_list_response', (d) => {
      const list = (d.data as Record<string, unknown>)?.list
      friends.value = Array.isArray(list) ? list as Array<Record<string, unknown>> : []
    }),
    onMessage('get_friend_requests_response', (d) => {
      const list = (d.data as Record<string, unknown>)?.list
      friendRequests.value = Array.isArray(list) ? list as Array<Record<string, unknown>> : []
    }),
    onMessage('search_friend_response', (d) => {
      if (d.success && (d.data as Record<string, unknown>)?.friend) {
        searchFriendResult.value = (d.data as Record<string, unknown>).friend as Record<string, unknown>
      } else {
        searchFriendResult.value = null
        ElMessage.warning(String(d.message || '未找到'))
      }
    }),
    onMessage('add_exp_response', (d) => {
      if (d.success) { ElMessage.success('添加经验成功'); refreshCharacterData() }
    }),
    onMessage('add_response', (d) => {
      if (d.success) { ElMessage.success('添加物品成功'); refreshCharacterData() }
    }),
    onMessage('add_item_response', (d) => {
      if (d.success) { ElMessage.success('添加物品成功'); refreshCharacterData() }
    }),
  )
})

function handleAllCharacters(d: Record<string, unknown>) {
  const chars = d.characters as Record<string, CharacterInfo> | undefined
  if (!d.success || !chars) return
  allCharsCache.value = chars
  const first = Object.values(chars).find((c) => c?.character_id)
  if (first?.character_id && !currentCharacterId.value) {
    currentCharacterId.value = first.character_id
    send({ type: 'select_character', token: token.value, character_id: first.character_id })
  }
}

const charactersListMap: Record<string, CharacterInfo[]> = {}
function charactersListUpdate(acc: string, chars: CharacterInfo[]) {
  charactersListMap[acc] = chars
}

function doSwitch() {
  if (switchAccount.value && switchAccount.value !== currentAccount.value) {
    const acc = adminAccounts.value.find((a) => a.account === switchAccount.value)
    if (acc) {
      loginAccount.value = acc.account
      loginPassword.value = acc.password || ''
      send({ type: 'login', account: acc.account, password: acc.password })
      return
    }
  }
  if (switchCharacter.value) {
    send({ type: 'select_character', token: token.value, character_id: switchCharacter.value })
  }
}

function onSwitchAccountChange(acc: string) {
  if (!acc) return
  sendAdmin('admin_search_account', { account: acc })
}

function executeOperation() {
  if (!token.value || !currentCharacterId.value) return
  if (operationType.value === 'add_exp') {
    send({ type: 'add_exp', token: token.value, character_id: currentCharacterId.value, exp: parseInt(operationValue.value) })
  } else {
    send({
      type: 'add',
      token: token.value,
      character_id: currentCharacterId.value,
      itemId: parseInt(operationItemId.value),
      quantity: operationQty.value,
    })
  }
}

onUnmounted(() => unsubs.forEach((u) => u()))
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">💻 客户端模拟器</h2>

    <el-card v-if="!loggedIn" class="page-card">
      <template #header>登录</template>
      <el-form label-width="80px">
        <el-form-item label="测试账号">
          <el-select v-model="loginAccount" filterable placeholder="选择管理员账号" style="width: 100%" @change="onLoginAccountChange">
            <el-option v-for="a in adminAccounts" :key="a.account" :label="a.account" :value="a.account" />
          </el-select>
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginPassword" :type="showPassword ? 'text' : 'password'" readonly />
          <el-button link @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</el-button>
        </el-form-item>
        <el-button type="primary" @click="doLogin">登录</el-button>
        <el-button @click="sendAdmin('admin_get_admin_accounts')">刷新账号</el-button>
      </el-form>
    </el-card>

    <template v-else>
      <el-card class="page-card">
        <template #header>账号/角色切换</template>
        <el-descriptions :column="2" size="small">
          <el-descriptions-item label="账号">{{ currentAccount }}</el-descriptions-item>
          <el-descriptions-item label="角色">{{ currentCharLabel }}</el-descriptions-item>
        </el-descriptions>
        <el-select v-model="switchAccount" placeholder="切换账号" style="width: 100%; margin: 8px 0" @change="onSwitchAccountChange">
          <el-option v-for="a in adminAccounts" :key="a.account" :label="a.account" :value="a.account" />
        </el-select>
        <el-select v-model="switchCharacter" placeholder="切换角色" style="width: 100%; margin-bottom: 8px">
          <el-option v-for="c in switchCharacters" :key="c.character_id" :label="`${c.role_name} (${c.character_id})`" :value="c.character_id || ''" />
        </el-select>
        <el-button type="primary" @click="doSwitch">切换</el-button>
        <el-button @click="refreshCharacterData">刷新数据</el-button>
        <el-button @click="doLogout">退出</el-button>
      </el-card>

      <el-row :gutter="16">
        <el-col :xs="24" :md="12">
          <el-card class="page-card">
            <template #header>角色信息</template>
            <el-descriptions :column="2" size="small" border>
              <el-descriptions-item label="角色名">{{ charInfo.role_name || '-' }}</el-descriptions-item>
              <el-descriptions-item label="等级">{{ charInfo.level || '-' }}</el-descriptions-item>
              <el-descriptions-item label="经验">{{ charInfo.exp || '-' }}</el-descriptions-item>
              <el-descriptions-item label="金币">{{ charInfo.gold || '-' }}</el-descriptions-item>
              <el-descriptions-item label="角色ID">{{ currentCharacterId }}</el-descriptions-item>
              <el-descriptions-item label="机甲数">{{ charInfo.robotcount || robots.length }}</el-descriptions-item>
            </el-descriptions>
          </el-card>

          <el-card class="page-card">
            <template #header>背包</template>
            <el-button size="small" @click="send({ type: 'bag_get', token, character_id: currentCharacterId })">刷新</el-button>
            <el-empty v-if="!Object.keys(bagItems).length" description="暂无物品" />
            <el-tag v-for="(cnt, id) in bagItems" :key="id" style="margin: 4px">{{ id }} x{{ cnt }}</el-tag>
          </el-card>

          <el-card>
            <template #header>机甲列表</template>
            <el-empty v-if="!robots.length" description="暂无机甲" />
            <el-card v-for="r in robots" :key="String(r.pet_id)" shadow="hover" style="margin-bottom: 8px">
              <strong>{{ r.RobotName || r.name }}</strong> Lv.{{ r.Level || r.level }}
            </el-card>
          </el-card>
        </el-col>

        <el-col :xs="24" :md="12">
          <el-card class="page-card">
            <template #header>好友</template>
            <el-form label-width="80px">
              <el-form-item label="好友ID">
                <el-input v-model="friendId" readonly />
              </el-form-item>
            </el-form>
            <el-button @click="send({ type: 'get_friend_list', token, character_id: currentCharacterId })">好友列表</el-button>
            <el-button @click="send({ type: 'get_friend_requests', token, character_id: currentCharacterId })">申请列表</el-button>
            <div style="margin: 12px 0">
              <el-input v-model="searchFriendId" placeholder="6位好友ID" maxlength="6" style="width: 160px; margin-right: 8px" />
              <el-button @click="send({ type: 'search_friend', token, character_id: currentCharacterId, friend_id: searchFriendId })">搜索</el-button>
            </div>
            <div v-if="searchFriendResult" style="padding: 8px; background: #f5f5f5; border-radius: 6px; margin-bottom: 8px">
              {{ searchFriendResult.role_name }} ({{ searchFriendResult.friend_id }})
              <el-button size="small" @click="send({ type: 'add_friend', token, character_id: currentCharacterId, target_friend_id: searchFriendResult.friend_id, target_character_id: searchFriendResult.character_id })">加好友</el-button>
            </div>
            <div v-for="f in friends" :key="String(f.friend_id)" style="padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px">
              {{ f.role_name }} · {{ f.friend_id }}
              <el-button size="small" type="danger" link @click="send({ type: 'delete_friend', token, character_id: currentCharacterId, friend_id: f.friend_id })">删除</el-button>
            </div>
            <div v-for="r in friendRequests" :key="String(r.friend_id)" style="padding: 6px 0; font-size: 13px">
              申请: {{ r.role_name }}
              <el-button size="small" link @click="send({ type: 'approve_friend', token, character_id: currentCharacterId, friend_id: r.friend_id })">同意</el-button>
              <el-button size="small" link type="danger" @click="send({ type: 'reject_friend', token, character_id: currentCharacterId, friend_id: r.friend_id })">拒绝</el-button>
            </div>
          </el-card>

          <el-card class="page-card">
            <template #header>快速操作</template>
            <el-select v-model="operationType" style="width: 100%; margin-bottom: 8px">
              <el-option label="添加经验" value="add_exp" />
              <el-option label="添加物品" value="add_item" />
            </el-select>
            <el-input v-if="operationType === 'add_exp'" v-model="operationValue" placeholder="经验值" style="margin-bottom: 8px" />
            <template v-else>
              <el-select v-model="operationItemId" filterable placeholder="物品" style="width: 100%; margin-bottom: 8px">
                <el-option v-for="it in itemsList" :key="it.id" :label="`${it.name} (${it.id})`" :value="String(it.id)" />
              </el-select>
              <el-input-number v-model="operationQty" :min="1" />
            </template>
            <el-button type="primary" style="margin-top: 8px" @click="executeOperation">执行</el-button>
          </el-card>

          <el-card>
            <template #header>消息日志</template>
            <el-scrollbar max-height="300px">
              <pre v-for="(m, i) in messageLog" :key="i" style="font-size: 11px; margin: 0 0 8px; white-space: pre-wrap">{{ m.time }} {{ safeJsonPreview(m.data) }}</pre>
            </el-scrollbar>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>
</template>
