<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { onMessage, send, sendAdmin } from '@/composables/useWebSocket'
import { useItems } from '@/composables/useItems'
import { useOperationLog } from '@/composables/useOperationLog'
import type { AdminAccount, CharacterInfo, PlayerInfo, RobotPet } from '@/types/admin'

const { itemsList, loadItems } = useItems()
const { logs, filter, addLog, clearLogs, exportLogs, filteredLogs } = useOperationLog()

const accounts = ref<string[]>([])
const characters = ref<CharacterInfo[]>([])
const selectedAccount = ref('')
const selectedCharacter = ref('')
const modifyCharacterId = ref('')
const searchQuery = ref('')
const playerInfo = ref<PlayerInfo | null>(null)
const playerList = ref<CharacterInfo[]>([])

const modifyType = ref('exp')
const modifyValue = ref('')
const modifyQuantity = ref(1)
const selectedItemId = ref('')

const robotPets = ref<RobotPet[]>([])
const selectedPetId = ref('')
const robotModifyType = ref('exp')
const robotValue = ref('')
const robotAttrName = ref('HP')
const addRobotCount = ref(1)

const announcementText = ref('')
const announcements = ref<Array<{ text?: string; created_at?: string }>>([])
const adminAccounts = ref<AdminAccount[]>([])
const storyMapCode = ref('test_base')
const storyTaskId = ref('100002')

const selectedPet = computed(() => robotPets.value.find((p) => p.pet_id === selectedPetId.value))

const ATTR_OPTIONS = [
  'HP', 'MaxHP', 'MP', 'MaxMP', 'Melee', 'Shooting', 'Armor', 'Evasion',
  'Accuracy', 'Lethality', 'Corrosion', 'Resistance', 'Initiative',
  'Counterattack', 'Block', 'ArmorPenetration', 'ParticleShield',
]

const unsubs: Array<() => void> = []

function selectCharacter(cid: string) {
  modifyCharacterId.value = cid
  selectedCharacter.value = cid
  sendAdmin('admin_get_robot_pets', { character_id: cid })
  addLog(`已选择角色: ${cid}`, 'info')
}

function refreshPets() {
  if (modifyCharacterId.value) {
    sendAdmin('admin_get_robot_pets', { character_id: modifyCharacterId.value })
  }
}

function resetStoryProgress() {
  const cid = modifyCharacterId.value.trim()
  if (!cid) { addLog('请填写角色ID', 'warning'); return }
  sendAdmin('admin_reset_story', { character_id: cid, map_code: storyMapCode.value })
  addLog(`已请求重置剧情: ${cid}`, 'info')
}

function forceCompleteStoryTask() {
  const cid = modifyCharacterId.value.trim()
  if (!cid) { addLog('请填写角色ID', 'warning'); return }
  sendAdmin('admin_complete_story_task', {
    character_id: cid,
    map_code: storyMapCode.value,
    task_id: Number(storyTaskId.value) || 0,
  })
  addLog(`已请求强制完成任务 ${storyTaskId.value}`, 'info')
}

function sendGmMail() {
  const cid = modifyCharacterId.value.trim()
  if (!cid) { addLog('请填写角色ID', 'warning'); return }
  sendAdmin('admin_send_mail', {
    character_id: cid,
    title: 'GM测试邮件',
    body: '管理台发送的测试邮件',
    attachments: [{ itemId: 1, count: 1 }],
  })
  addLog('已发送测试邮件', 'success')
}

watch(selectedAccount, (acc) => {
  if (!acc) return
  sendAdmin('admin_search_account', { account: acc, search_type: 'account' })
})

watch(selectedCharacter, (cid) => {
  if (!cid) return
  modifyCharacterId.value = cid
  sendAdmin('admin_get_player_by_id', { character_id: cid })
  sendAdmin('admin_get_robot_pets', { character_id: cid })
})

watch(selectedPetId, (id) => {
  if (!id) return
  const pet = robotPets.value.find((p) => p.pet_id === id)
  if (pet) addLog(`选中机甲: ${(pet as Record<string, unknown>).RobotName || id}`, 'info')
})

function handleModifyPlayer() {
  const cid = modifyCharacterId.value.trim()
  if (!cid) { addLog('请填写角色ID', 'warning'); return }
  if (modifyType.value === 'exp') {
    sendAdmin('admin_add_exp', { character_id: cid, exp: parseInt(modifyValue.value) })
  } else if (modifyType.value === 'gold') {
    sendAdmin('admin_modify_gold', { character_id: cid, gold: parseInt(modifyValue.value) })
  } else if (modifyType.value === 'level') {
    sendAdmin('admin_modify_level', { character_id: cid, level: parseInt(modifyValue.value) })
  } else if (modifyType.value === 'item') {
    if (!selectedItemId.value) { addLog('请选择物品', 'warning'); return }
    sendAdmin('admin_add_item', {
      character_id: cid,
      itemId: parseInt(selectedItemId.value),
      quantity: modifyQuantity.value,
    })
  }
}

function handleModifyRobot() {
  const petId = selectedPetId.value
  if (!petId) { addLog('请选择机甲', 'warning'); return }
  const msg: Record<string, unknown> = {
    type: 'admin_modify_robot_pet',
    pet_id: petId,
    modify_type: robotModifyType.value,
  }
  const v = parseInt(robotValue.value)
  if (robotModifyType.value === 'exp') msg.exp = v
  else if (robotModifyType.value === 'level') msg.level = v
  else if (robotModifyType.value === 'growth') msg.growth = v
  else if (robotModifyType.value === 'comprehension') msg.comprehension = v
  else if (robotModifyType.value === 'star_level') msg.star_level = v
  else if (robotModifyType.value === 'direct_attr') {
    msg.attr_name = robotAttrName.value
    msg.attr_value = v
  }
  send(msg)
}

onMounted(() => {
  loadItems()
  sendAdmin('admin_get_all_accounts')
  sendAdmin('admin_get_admin_accounts')

  unsubs.push(
    onMessage('admin_all_accounts_response', (d) => {
      if (d.success && d.accounts) {
        accounts.value = (d.accounts as Array<{ account: string }>).map((a) => a.account)
        addLog(`加载 ${accounts.value.length} 个账号`, 'success')
      }
    }),
    onMessage('admin_search_response', (d) => {
      if (d.success && d.characters) {
        const chars = d.characters as CharacterInfo[]
        if (d.search_type === 'account') characters.value = chars
        playerList.value = chars
        if (chars.length && d.search_type === 'account') {
          selectedCharacter.value = chars[0].character_id || ''
        }
        addLog(`搜索到 ${chars.length} 个角色`, 'success')
      } else {
        playerList.value = []
        addLog('未找到角色', 'warning')
      }
    }),
    onMessage('admin_player_info', (d) => {
      if (d.success) {
        playerInfo.value = d as unknown as PlayerInfo
        playerList.value = []
        addLog('查询玩家信息成功', 'success')
      }
    }),
    onMessage('admin_modify_response', (d) => {
      addLog(d.success ? String(d.message || '操作成功') : String(d.message || '失败'), d.success ? 'success' : 'error')
      if (d.success && d.character_id) {
        setTimeout(() => sendAdmin('admin_get_player_by_id', { character_id: d.character_id as string }), 500)
      }
    }),
    onMessage('admin_robot_pets_response', (d) => {
      if (d.success) {
        robotPets.value = (d.pets as RobotPet[]) || []
        addLog(`加载 ${robotPets.value.length} 个机甲`, 'success')
      }
    }),
    onMessage('admin_modify_robot_pet_response', (d) => {
      addLog(d.success ? String(d.message || '成功') : String(d.message || '失败'), d.success ? 'success' : 'error')
      if (d.success) setTimeout(refreshPets, 500)
    }),
    onMessage('admin_reset_robot_pet_response', (d) => {
      addLog(d.success ? '还原成功' : String(d.message), d.success ? 'success' : 'error')
      if (d.success) setTimeout(refreshPets, 500)
    }),
    onMessage('admin_delete_robot_pet_response', (d) => {
      addLog(d.success ? '删除成功' : String(d.message), d.success ? 'success' : 'error')
      if (d.success) setTimeout(refreshPets, 500)
    }),
    onMessage('admin_clear_all_robots_response', (d) => {
      addLog(d.success ? '清空成功' : String(d.message), d.success ? 'success' : 'error')
      if (d.success) setTimeout(refreshPets, 500)
    }),
    onMessage('admin_add_random_robots_response', (d) => {
      addLog(d.success ? String(d.message) : String(d.message), d.success ? 'success' : 'error')
      if (d.success) setTimeout(refreshPets, 500)
    }),
    onMessage('announcement_list', (d) => {
      announcements.value = (d.list as typeof announcements.value) || []
    }),
    onMessage('post_announcement_response', (d) => {
      if (d.success) {
        addLog('公告发布成功', 'success')
        send({ type: 'get_announcements_history', limit: 10 })
      }
    }),
    onMessage('admin_get_admin_accounts_response', (d) => {
      if (d.success) adminAccounts.value = (d.accounts as AdminAccount[]) || []
    }),
    onMessage('admin_register_admin_account_response', (d) => {
      if (d.success) {
        addLog(`注册成功: ${d.account} / ${d.password}`, 'success')
        sendAdmin('admin_get_admin_accounts')
      }
    }),
    onMessage('admin_delete_admin_account_response', (d) => {
      if (d.success) {
        addLog('删除管理员账号成功', 'success')
        sendAdmin('admin_get_admin_accounts')
      }
    }),
  )
})

onUnmounted(() => unsubs.forEach((u) => u()))
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px">🎮 游戏控制</h2>
    <el-row :gutter="20">
      <el-col :xs="24" :lg="14">
        <el-card class="page-card">
          <template #header>选择账号/角色</template>
          <el-form label-width="80px">
            <el-form-item label="账号">
              <el-select v-model="selectedAccount" filterable placeholder="选择账号" style="width: 100%">
                <el-option v-for="a in accounts" :key="a" :label="a" :value="a" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="characters.length" label="角色">
              <el-select v-model="selectedCharacter" filterable style="width: 100%">
                <el-option
                  v-for="c in characters"
                  :key="c.character_id"
                  :label="`${c.role_name} (${c.character_id})`"
                  :value="c.character_id!"
                />
              </el-select>
            </el-form-item>
            <el-button @click="sendAdmin('admin_get_all_accounts')">刷新账号列表</el-button>
          </el-form>
        </el-card>

        <el-card class="page-card">
          <template #header>搜索玩家</template>
          <el-input v-model="searchQuery" placeholder="账号、角色名或角色ID" style="margin-bottom: 12px" />
          <el-button-group>
            <el-button @click="sendAdmin('admin_search_account', { account: searchQuery })">按账号</el-button>
            <el-button @click="sendAdmin('admin_search_character', { role_name: searchQuery })">按角色名</el-button>
            <el-button @click="sendAdmin('admin_get_player_by_id', { character_id: searchQuery })">按ID</el-button>
          </el-button-group>
        </el-card>

        <el-card class="page-card">
          <template #header>玩家信息</template>
          <el-empty v-if="!playerInfo && !playerList.length" description="请搜索或选择角色" />
          <div v-if="playerList.length">
            <el-card v-for="c in playerList" :key="c.character_id" shadow="hover" style="margin-bottom: 12px">
              <div><strong>{{ c.role_name }}</strong> · {{ c.character_id }}</div>
              <div style="font-size: 12px; color: #666">Lv.{{ c.level }} · 金币 {{ c.gold }}</div>
              <el-button size="small" type="primary" style="margin-top: 8px" @click="selectCharacter(c.character_id!)">选择</el-button>
              <el-button size="small" @click="sendAdmin('admin_get_player_by_id', { character_id: c.character_id })">详情</el-button>
            </el-card>
          </div>
          <div v-if="playerInfo">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="角色名">{{ playerInfo.role_name }}</el-descriptions-item>
              <el-descriptions-item label="ID">{{ playerInfo.character_id }}</el-descriptions-item>
              <el-descriptions-item label="等级">{{ playerInfo.level }}</el-descriptions-item>
              <el-descriptions-item label="金币">{{ playerInfo.gold }}</el-descriptions-item>
              <el-descriptions-item label="经验">{{ playerInfo.exp }}</el-descriptions-item>
              <el-descriptions-item label="机甲数">{{ playerInfo.robotcount }}</el-descriptions-item>
            </el-descriptions>
            <div v-if="playerInfo.items && Object.keys(playerInfo.items).length" style="margin-top: 12px">
              <strong>背包:</strong>
              <el-tag v-for="(cnt, id) in playerInfo.items" :key="id" style="margin: 4px">{{ id }} x{{ cnt }}</el-tag>
            </div>
          </div>
        </el-card>

        <el-card class="page-card">
          <template #header>修改玩家数据</template>
          <el-form label-width="90px">
            <el-form-item label="角色ID">
              <el-input v-model="modifyCharacterId" />
            </el-form-item>
            <el-form-item label="操作">
              <el-select v-model="modifyType">
                <el-option label="添加经验" value="exp" />
                <el-option label="修改金币" value="gold" />
                <el-option label="修改等级" value="level" />
                <el-option label="添加物品" value="item" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="modifyType !== 'item'" label="数值">
              <el-input v-model="modifyValue" />
            </el-form-item>
            <el-form-item v-if="modifyType === 'item'" label="物品">
              <el-select v-model="selectedItemId" filterable style="width: 100%">
                <el-option v-for="it in itemsList" :key="it.id" :label="`${it.name} (${it.id})`" :value="String(it.id)" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="modifyType === 'item'" label="数量">
              <el-input-number v-model="modifyQuantity" :min="1" />
            </el-form-item>
            <el-button type="success" @click="handleModifyPlayer">执行修改</el-button>
          </el-form>
        </el-card>

        <el-card>
          <template #header>宠物机甲管理</template>
          <el-select v-model="selectedPetId" placeholder="选择机甲" style="width: 100%; margin-bottom: 12px">
            <el-option
              v-for="p in robotPets"
              :key="p.pet_id"
              :label="`${(p as Record<string,unknown>).RobotName || p.name || p.pet_id} Lv.${(p as Record<string,unknown>).Level || p.level}`"
              :value="p.pet_id!"
            />
          </el-select>
          <el-descriptions v-if="selectedPet" :column="3" size="small" border style="margin-bottom: 12px">
            <el-descriptions-item label="等级">{{ (selectedPet as Record<string,unknown>).Level || selectedPet.level }}</el-descriptions-item>
            <el-descriptions-item label="经验">{{ (selectedPet as Record<string,unknown>).EXP || selectedPet.exp }}</el-descriptions-item>
            <el-descriptions-item label="星级">{{ (selectedPet as Record<string,unknown>).StarLevel || selectedPet.star_level }}</el-descriptions-item>
          </el-descriptions>
          <el-form v-if="selectedPetId" inline>
            <el-select v-model="robotModifyType" style="width: 140px">
              <el-option label="经验" value="exp" />
              <el-option label="等级" value="level" />
              <el-option label="成长" value="growth" />
              <el-option label="悟性" value="comprehension" />
              <el-option label="星级" value="star_level" />
              <el-option label="直接改属性" value="direct_attr" />
            </el-select>
            <el-select v-if="robotModifyType === 'direct_attr'" v-model="robotAttrName" style="width: 120px">
              <el-option v-for="a in ATTR_OPTIONS" :key="a" :label="a" :value="a" />
            </el-select>
            <el-input v-model="robotValue" placeholder="数值" style="width: 100px" />
            <el-button type="primary" @click="handleModifyRobot">修改</el-button>
            <el-button @click="sendAdmin('admin_reset_robot_pet', { pet_id: selectedPetId })">还原1级</el-button>
            <el-button type="danger" @click="sendAdmin('admin_delete_robot_pet', { pet_id: selectedPetId })">删除</el-button>
          </el-form>
          <div style="margin-top: 16px">
            <el-button type="danger" @click="sendAdmin('admin_clear_all_robots', { character_id: modifyCharacterId })">清空全部机甲</el-button>
            <el-input-number v-model="addRobotCount" :min="1" :max="100" style="margin: 0 8px" />
            <el-button @click="sendAdmin('admin_add_random_robots', { character_id: modifyCharacterId, count: addRobotCount })">添加随机机甲</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card class="page-card">
          <template #header>公告管理</template>
          <el-input v-model="announcementText" type="textarea" :rows="3" placeholder="公告内容" />
          <div style="margin-top: 8px">
            <el-button type="primary" @click="send({ type: 'post_announcement', text: announcementText }); announcementText = ''">发布</el-button>
            <el-button @click="send({ type: 'get_announcements_history', limit: 10 })">历史</el-button>
          </div>
          <div v-for="(a, i) in announcements" :key="i" style="padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px">
            {{ typeof a === 'string' ? a : a.text }}
          </div>
        </el-card>

        <el-card class="page-card">
          <template #header>剧情 / 邮件 GM</template>
          <el-input v-model="storyMapCode" placeholder="map_code" style="margin-bottom: 8px" />
          <el-button type="warning" style="width: 100%; margin-bottom: 8px" @click="resetStoryProgress">重置剧情进度</el-button>
          <el-input v-model="storyTaskId" placeholder="task_id" style="margin-bottom: 8px" />
          <el-button type="primary" style="width: 100%; margin-bottom: 8px" @click="forceCompleteStoryTask">强制完成任务</el-button>
          <el-button style="width: 100%" @click="sendGmMail">发送测试邮件</el-button>
        </el-card>

        <el-card class="page-card">
          <template #header>管理员账号</template>
          <el-button type="success" style="width: 100%; margin-bottom: 8px" @click="sendAdmin('admin_register_admin_account')">一键注册</el-button>
          <el-button style="width: 100%; margin-bottom: 12px" @click="sendAdmin('admin_get_admin_accounts')">刷新列表</el-button>
          <el-card v-for="acc in adminAccounts" :key="acc.account" shadow="hover" style="margin-bottom: 8px">
            <div><strong>{{ acc.account }}</strong></div>
            <div style="font-size: 12px; color: #666">密码: {{ acc.password }}</div>
            <el-button size="small" @click="selectedAccount = acc.account">选择</el-button>
            <el-button size="small" type="danger" @click="ElMessageBox.confirm('确认删除？').then(() => sendAdmin('admin_delete_admin_account', { account: acc.account }))">删除</el-button>
          </el-card>
        </el-card>

        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between">
              <span>操作日志</span>
              <div>
                <el-select v-model="filter" size="small" style="width: 90px">
                  <el-option label="全部" value="all" />
                  <el-option label="信息" value="info" />
                  <el-option label="成功" value="success" />
                  <el-option label="警告" value="warning" />
                  <el-option label="错误" value="error" />
                </el-select>
                <el-button size="small" @click="clearLogs">清空</el-button>
                <el-button size="small" @click="exportLogs">导出</el-button>
              </div>
            </div>
          </template>
          <div class="log-panel">
            <div v-for="(l, i) in filteredLogs()" :key="i" :class="['log-line', l.type]">
              [{{ l.time }}] {{ l.message }}
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.log-panel { max-height: 400px; overflow-y: auto; font-size: 12px; font-family: monospace; }
.log-line { padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
.log-line.success { color: #4caf50; }
.log-line.error { color: #f44336; }
.log-line.warning { color: #ff9800; }
</style>
