<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  addExp,
  broadcast,
  fetchOnline,
  fetchRoles,
  fetchRuntime,
  fetchStatus,
  grantCurrency,
  grantGoods,
  grantPet,
  kickAllPlayers,
  kickPlayer,
  resetPassword,
  setAllowed,
  setExp,
  setLevel,
} from './api'
import SearchSelect from './components/SearchSelect.vue'
import petsCatalog from './catalog/pets.json'
import goodsCatalog from './catalog/goods.json'

const status = ref(null)
const online = ref(null)
const runtime = ref(null)
const roles = ref([])
const error = ref('')
const actionMsg = ref('')
const actionErr = ref('')
const busy = ref(false)
const loading = ref(true)
const lastRefresh = ref(null)
const auto = ref(true)

const noticeText = ref('')
const currencyForm = ref({ name: '', type: 'gold', num: 100 })
const goodsForm = ref({ name: '', key: '', num: 1, bind: 0 })
const pwdForm = ref({ username: '', password: '' })
const petForm = ref({ name: '', key: '', quality: '' })
const levelForm = ref({ name: '', lever: 30 })
const expForm = ref({ name: '', exp: 1000, mode: 'add' })

const petOptions = petsCatalog.map((p) => ({
  value: p.key,
  label: p.name,
  sub: p.key,
}))
const goodsOptions = goodsCatalog.map((g) => ({
  value: g.key,
  label: g.name,
  sub: g.key,
}))
const levelOptions = [1, 10, 20, 30, 40, 49, 50, 60, 70, 80, 90, 99, 100, 110, 120, 150, 180, 200].map(
  (n) => ({ value: n, label: `${n} 级`, sub: String(n) }),
)

const roleOptions = computed(() => {
  const map = new Map()
  for (const r of roles.value || []) {
    map.set(r.name, {
      value: r.name,
      label: r.name,
      sub: `Lv.${r.lever ?? '?'} · ${r.username || ''}`,
    })
  }
  for (const row of online.value?.list || []) {
    const prev = map.get(row.name)
    map.set(row.name, {
      value: row.name,
      label: row.name,
      sub: prev?.sub ? `${prev.sub} · 在线` : `Lv.${row.lever ?? '?'} · 在线`,
    })
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh'))
})

const accountOptions = computed(() => {
  const map = new Map()
  for (const r of roles.value || []) {
    if (!r.username) continue
    map.set(r.username, {
      value: r.username,
      label: r.username,
      sub: r.name ? `角色 ${r.name}` : '',
    })
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh'))
})

let timer = null

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return '--'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = Number(n)
  let i = 0
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}

function formatUptime(ms) {
  if (ms == null) return '--'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}天 ${h}时 ${m}分`
  if (h > 0) return `${h}时 ${m}分 ${sec}秒`
  return `${m}分 ${sec}秒`
}

function pct(used, total) {
  if (!total) return 0
  return Math.min(100, Math.round((used / total) * 100))
}

const jvmPct = computed(() =>
  status.value ? pct(status.value.jvmUsed, status.value.jvmTotal) : 0,
)
const osPct = computed(() =>
  status.value ? pct(status.value.osUsed, status.value.osTotal) : 0,
)

const runtimeCards = computed(() => {
  if (!runtime.value) return []
  const skip = new Set(['ok'])
  return Object.entries(runtime.value)
    .filter(([k]) => !skip.has(k))
    .map(([key, value]) => ({ key, value }))
})

async function refresh() {
  error.value = ''
  try {
    const [s, o, r, roleRes] = await Promise.all([
      fetchStatus(),
      fetchOnline(),
      fetchRuntime(),
      fetchRoles().catch(() => ({ ok: false, list: [] })),
    ])
    if (!s.ok) throw new Error(s.msg || '鉴权失败')
    status.value = s
    online.value = o
    runtime.value = r
    if (roleRes?.ok) roles.value = roleRes.list || []
    lastRefresh.value = new Date()
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

async function runAction(fn, confirmText) {
  if (confirmText && !window.confirm(confirmText)) return
  busy.value = true
  actionMsg.value = ''
  actionErr.value = ''
  try {
    const res = await fn()
    if (!res?.ok) throw new Error(res?.msg || '操作失败')
    actionMsg.value = res.msg || '操作成功'
    await refresh()
  } catch (e) {
    actionErr.value = e.message || String(e)
  } finally {
    busy.value = false
  }
}

function fillPlayer(name) {
  currencyForm.value.name = name
  goodsForm.value.name = name
  petForm.value.name = name
  levelForm.value.name = name
  expForm.value.name = name
}

function onKick(name) {
  return runAction(() => kickPlayer(name), `确认踢下线「${name}」？`)
}

function onKickAll() {
  return runAction(() => kickAllPlayers(), '确认踢下线全部在线玩家？')
}

function onToggleAllowed() {
  const next = !(status.value?.allowed)
  const tip = next ? '确认开放入站（结束维护）？' : '确认开启维护（拒收游戏请求）？'
  return runAction(() => setAllowed(next), tip)
}

function onBroadcast() {
  const content = noticeText.value.trim()
  if (!content) {
    actionErr.value = '请输入公告内容'
    return
  }
  return runAction(async () => {
    const res = await broadcast(content)
    if (res.ok) noticeText.value = ''
    return res
  }, '确认发送世界公告？')
}

function onGrantCurrency() {
  const { name, type, num } = currencyForm.value
  if (!name.trim() || !num || num <= 0) {
    actionErr.value = '请填写角色名和数量'
    return
  }
  return runAction(
    () => grantCurrency({ name: name.trim(), type, num: Number(num) }),
    `确认给「${name}」发放 ${type} x${num}？`,
  )
}

function onGrantGoods() {
  const { name, key, num, bind } = goodsForm.value
  if (!name.trim() || !key.trim() || !num || num <= 0) {
    actionErr.value = '请填写角色名、物品 ID 和数量'
    return
  }
  return runAction(
    () =>
      grantGoods({
        name: name.trim(),
        key: key.trim(),
        num: Number(num),
        bind: Number(bind),
      }),
    `确认给「${name}」发放物品 ${key} x${num}？`,
  )
}

function onResetPassword() {
  const { username, password } = pwdForm.value
  if (!username.trim() || !password.trim()) {
    actionErr.value = '请填写账号和密码'
    return
  }
  return runAction(
    async () => {
      const res = await resetPassword({
        username: username.trim(),
        password: password.trim(),
      })
      if (res.ok) pwdForm.value.password = ''
      return res
    },
    `确认重置账号「${username}」的密码？`,
  )
}

function onGrantPet() {
  const { name, key, quality } = petForm.value
  if (!name.trim() || !key.trim()) {
    actionErr.value = '请填写角色名和宠物 ID'
    return
  }
  return runAction(
    () =>
      grantPet({
        name: name.trim(),
        key: key.trim(),
        quality: quality === '' ? null : Number(quality),
      }),
    `确认给「${name}」发放宠物 ${key}？`,
  )
}

function onSetLevel() {
  const { name, lever } = levelForm.value
  if (!name.trim() || !lever || lever < 1) {
    actionErr.value = '请填写角色名和等级'
    return
  }
  return runAction(
    () => setLevel({ name: name.trim(), lever: Number(lever) }),
    `确认将「${name}」等级设为 ${lever}？`,
  )
}

function onExp() {
  const { name, exp, mode } = expForm.value
  if (!name.trim() || exp === '' || exp == null) {
    actionErr.value = '请填写角色名和经验'
    return
  }
  const n = Number(exp)
  if (mode === 'set') {
    return runAction(
      () => setExp({ name: name.trim(), exp: n }),
      `确认将「${name}」经验设为 ${n}？`,
    )
  }
  return runAction(
    () => addExp({ name: name.trim(), exp: n }),
    `确认给「${name}」增加经验 ${n}？`,
  )
}

function toggleAuto() {
  auto.value = !auto.value
  if (auto.value) startTimer()
  else stopTimer()
}

function startTimer() {
  stopTimer()
  timer = setInterval(refresh, 5000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(async () => {
  await refresh()
  if (auto.value) startTimer()
})

onUnmounted(stopTimer)
</script>

<template>
  <div class="shell">
    <header class="hero">
      <div class="brand-block">
        <p class="eyebrow">XunQin Ops</p>
        <h1>寻秦 · 运维控制台</h1>
        <p class="lede">监控服务状态，并直接控制踢人、维护、公告与发放。</p>
      </div>
      <div class="hero-actions">
        <button class="btn" type="button" :disabled="busy" @click="refresh">立即刷新</button>
        <button class="btn ghost" type="button" @click="toggleAuto">
          {{ auto ? '自动刷新 · 开' : '自动刷新 · 关' }}
        </button>
        <p class="meta" v-if="lastRefresh">
          更新于
          <span>{{ lastRefresh.toLocaleTimeString() }}</span>
        </p>
      </div>
    </header>

    <p v-if="error" class="banner error">无法连接服务端：{{ error }}</p>
    <p v-else-if="loading" class="banner">正在拉取服务数据…</p>
    <p v-if="actionMsg" class="banner ok">{{ actionMsg }}</p>
    <p v-if="actionErr" class="banner error">{{ actionErr }}</p>

    <section v-if="status" class="grid status-grid">
      <article class="panel pulse">
        <p class="label">在线玩家</p>
        <p class="metric">{{ status.online }}</p>
        <p class="hint">端口 {{ status.port }} · {{ status.allowed ? '接收入站' : '维护中' }}</p>
      </article>
      <article class="panel">
        <p class="label">运行时长</p>
        <p class="metric sm">{{ formatUptime(status.upTime) }}</p>
        <p class="hint">{{ status.hostname || '本机' }} · {{ status.osName }}</p>
      </article>
      <article class="panel">
        <p class="label">版本</p>
        <p class="metric sm">APK {{ status.apkVersion || '--' }}</p>
        <p class="hint">资源 {{ status.resVersion || '--' }} · Java {{ status.javaVersion }}</p>
      </article>
      <article class="panel">
        <p class="label">JVM 内存</p>
        <div class="bar"><i :style="{ width: jvmPct + '%' }" /></div>
        <p class="hint">
          {{ formatBytes(status.jvmUsed) }} / {{ formatBytes(status.jvmTotal) }}
          <b>{{ jvmPct }}%</b>
        </p>
      </article>
      <article class="panel">
        <p class="label">系统内存</p>
        <div class="bar jade"><i :style="{ width: osPct + '%' }" /></div>
        <p class="hint">
          {{ formatBytes(status.osUsed) }} / {{ formatBytes(status.osTotal) }}
          <b>{{ osPct }}%</b>
        </p>
      </article>
    </section>

    <section class="ops" v-if="status">
      <article class="panel">
        <div class="panel-head">
          <h2>服务控制</h2>
          <span>{{ status.allowed ? '正常运营' : '维护模式' }}</span>
        </div>
        <div class="ops-row">
          <button
            class="btn"
            type="button"
            :disabled="busy"
            @click="onToggleAllowed"
          >
            {{ status.allowed ? '开启维护' : '结束维护' }}
          </button>
          <button class="btn danger" type="button" :disabled="busy" @click="onKickAll">
            踢全部在线
          </button>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>世界公告</h2>
          <span>聊天频道系统消息</span>
        </div>
        <textarea
          v-model="noticeText"
          rows="3"
          maxlength="500"
          placeholder="输入要推送给全服的公告内容"
        />
        <div class="ops-row">
          <button class="btn" type="button" :disabled="busy" @click="onBroadcast">发送公告</button>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>发放货币</h2>
          <span>选择角色与货币类型</span>
        </div>
        <div class="form-grid">
          <SearchSelect
            v-model="currencyForm.name"
            label="角色"
            placeholder="搜索角色名"
            :options="roleOptions"
          />
          <label>
            类型
            <select v-model="currencyForm.type">
              <option value="gold">金币</option>
              <option value="tale">仙玉</option>
              <option value="yinPiao">银票</option>
            </select>
          </label>
          <label>
            数量
            <select v-model.number="currencyForm.num">
              <option :value="100">100</option>
              <option :value="500">500</option>
              <option :value="1000">1,000</option>
              <option :value="5000">5,000</option>
              <option :value="10000">10,000</option>
              <option :value="50000">50,000</option>
              <option :value="100000">100,000</option>
            </select>
          </label>
        </div>
        <div class="ops-row">
          <button class="btn" type="button" :disabled="busy" @click="onGrantCurrency">发放</button>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>发放物品</h2>
          <span>共 {{ goodsOptions.length }} 种道具</span>
        </div>
        <div class="form-grid">
          <SearchSelect
            v-model="goodsForm.name"
            label="角色"
            placeholder="搜索角色名"
            :options="roleOptions"
          />
          <SearchSelect
            v-model="goodsForm.key"
            label="物品"
            placeholder="搜索物品名称"
            :options="goodsOptions"
          />
          <label>
            数量
            <select v-model.number="goodsForm.num">
              <option :value="1">1</option>
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="50">50</option>
              <option :value="99">99</option>
              <option :value="100">100</option>
              <option :value="999">999</option>
            </select>
          </label>
          <label>
            绑定
            <select v-model.number="goodsForm.bind">
              <option :value="0">不绑定</option>
              <option :value="1">绑定</option>
            </select>
          </label>
        </div>
        <div class="ops-row">
          <button class="btn" type="button" :disabled="busy" @click="onGrantGoods">发放物品</button>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>发放宠物</h2>
          <span>共 {{ petOptions.length }} 种宠物</span>
        </div>
        <div class="form-grid">
          <SearchSelect
            v-model="petForm.name"
            label="角色"
            placeholder="搜索角色名"
            :options="roleOptions"
          />
          <SearchSelect
            v-model="petForm.key"
            label="宠物"
            placeholder="搜索宠物名称"
            :options="petOptions"
          />
          <label>
            品质
            <select v-model="petForm.quality">
              <option value="">随机</option>
              <option value="1">1 品</option>
              <option value="2">2 品</option>
              <option value="3">3 品</option>
              <option value="4">4 品</option>
              <option value="5">5 品</option>
            </select>
          </label>
        </div>
        <div class="ops-row">
          <button class="btn" type="button" :disabled="busy" @click="onGrantPet">发放宠物</button>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>设置等级</h2>
          <span>直接改角色等级</span>
        </div>
        <div class="form-grid">
          <SearchSelect
            v-model="levelForm.name"
            label="角色"
            placeholder="搜索角色名"
            :options="roleOptions"
          />
          <SearchSelect
            v-model="levelForm.lever"
            label="等级"
            placeholder="选择等级"
            :options="levelOptions"
          />
          <div class="ops-row align-end">
            <button class="btn" type="button" :disabled="busy" @click="onSetLevel">设置等级</button>
          </div>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>经验</h2>
          <span>增加会触发升级；设置只改当前经验</span>
        </div>
        <div class="form-grid">
          <SearchSelect
            v-model="expForm.name"
            label="角色"
            placeholder="搜索角色名"
            :options="roleOptions"
          />
          <label>
            模式
            <select v-model="expForm.mode">
              <option value="add">增加经验</option>
              <option value="set">设置经验</option>
            </select>
          </label>
          <label>
            经验值
            <select v-model.number="expForm.exp">
              <option :value="0">0</option>
              <option :value="100">100</option>
              <option :value="1000">1,000</option>
              <option :value="5000">5,000</option>
              <option :value="10000">10,000</option>
              <option :value="50000">50,000</option>
              <option :value="100000">100,000</option>
              <option :value="500000">500,000</option>
              <option :value="1000000">1,000,000</option>
            </select>
          </label>
        </div>
        <div class="ops-row">
          <button class="btn" type="button" :disabled="busy" @click="onExp">确认</button>
        </div>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <h2>重置密码</h2>
          <span>按登录账号用户名</span>
        </div>
        <div class="form-grid three">
          <SearchSelect
            v-model="pwdForm.username"
            label="账号"
            placeholder="搜索账号"
            :options="accountOptions"
          />
          <label>
            新密码
            <input v-model="pwdForm.password" type="password" placeholder="新密码" />
          </label>
          <div class="ops-row align-end">
            <button class="btn" type="button" :disabled="busy" @click="onResetPassword">重置</button>
          </div>
        </div>
      </article>
    </section>

    <section class="split" v-if="online || runtime">
      <article class="panel stretch">
        <div class="panel-head">
          <h2>在线列表</h2>
          <span>{{ online?.count ?? 0 }} 人</span>
        </div>
        <div class="table-wrap" v-if="online?.list?.length">
          <table>
            <thead>
              <tr>
                <th>角色</th>
                <th>等级</th>
                <th>地图</th>
                <th>IP</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in online.list" :key="row.sbh">
                <td class="name">{{ row.name }}</td>
                <td>{{ row.lever ?? '--' }}</td>
                <td>{{ row.map ?? '--' }}</td>
                <td class="mono">{{ row.ip }}</td>
                <td class="actions">
                  <button class="link" type="button" @click="fillPlayer(row.name)">填入</button>
                  <button class="link danger" type="button" :disabled="busy" @click="onKick(row.name)">
                    踢下线
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty">当前没有在线玩家</p>
      </article>

      <article class="panel stretch">
        <div class="panel-head">
          <h2>运行时快照</h2>
          <span>缓存计数</span>
        </div>
        <div class="runtime-grid">
          <div v-for="item in runtimeCards" :key="item.key" class="chip">
            <span>{{ item.key }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </article>
    </section>

    <section v-if="status?.notice?.length" class="panel notice">
      <div class="panel-head">
        <h2>登录公告</h2>
      </div>
      <ul>
        <li v-for="(n, i) in status.notice" :key="i">{{ typeof n === 'string' ? n : JSON.stringify(n) }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 40px 24px 72px;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: end;
  margin-bottom: 28px;
  animation: rise 0.7s ease both;
}

.brand-block h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 5vw, 3.6rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.1;
  color: var(--ink);
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 0.78rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--bronze);
  font-weight: 600;
}

.lede {
  margin: 12px 0 0;
  max-width: 28rem;
  color: var(--ink-soft);
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
}

.btn {
  border: 0;
  border-radius: 999px;
  padding: 0.7rem 1.2rem;
  background: linear-gradient(135deg, var(--bronze), var(--bronze-bright));
  color: #fff8ef;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(139, 90, 43, 0.25);
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(139, 90, 43, 0.32);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn.ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--line);
  box-shadow: none;
}

.btn.danger {
  background: linear-gradient(135deg, #8a2f26, var(--cinnabar));
}

.meta {
  margin: 0;
  width: 100%;
  text-align: right;
  color: var(--ink-soft);
  font-size: 0.85rem;
}

.meta span {
  font-family: var(--font-mono);
}

.banner {
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid var(--line);
  margin-bottom: 18px;
}

.banner.error {
  color: var(--cinnabar);
  background: rgba(166, 61, 47, 0.08);
  border-color: rgba(166, 61, 47, 0.25);
}

.banner.ok {
  color: var(--jade);
  background: rgba(47, 107, 90, 0.08);
  border-color: rgba(47, 107, 90, 0.22);
}

.grid {
  display: grid;
  gap: 14px;
  margin-bottom: 18px;
}

.status-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  animation: rise 0.8s ease 0.08s both;
}

.ops {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
  animation: rise 0.82s ease 0.1s both;
}

.ops .wide {
  grid-column: 1 / -1;
}

.panel {
  background: rgba(255, 251, 245, 0.72);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(61, 50, 41, 0.05);
}

.panel.pulse {
  background:
    linear-gradient(160deg, rgba(196, 137, 63, 0.16), transparent 60%),
    rgba(255, 251, 245, 0.8);
}

.label {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.metric {
  margin: 10px 0 6px;
  font-family: var(--font-display);
  font-size: 2.8rem;
  line-height: 1;
  color: var(--ink);
}

.metric.sm {
  font-size: 1.55rem;
  letter-spacing: 0.02em;
}

.hint {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.88rem;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.hint b {
  font-family: var(--font-mono);
  color: var(--bronze);
}

.bar {
  height: 8px;
  margin: 18px 0 10px;
  border-radius: 999px;
  background: rgba(61, 50, 41, 0.08);
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--bronze), var(--bronze-bright));
  transition: width 0.5s ease;
}

.bar.jade i {
  background: linear-gradient(90deg, var(--jade), var(--jade-bright));
}

.split {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 14px;
  margin-bottom: 18px;
  animation: rise 0.85s ease 0.14s both;
}

.stretch {
  min-height: 360px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 14px;
}

.panel-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
}

.panel-head span {
  color: var(--ink-soft);
  font-size: 0.85rem;
}

.ops-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.ops-row.align-end {
  align-items: end;
  margin-top: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.form-grid.three {
  grid-template-columns: 1.2fr 1.2fr auto;
  align-items: end;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--ink-soft);
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.7rem 0.85rem;
  background: rgba(255, 255, 255, 0.65);
  color: var(--ink);
  outline: none;
}

input:focus,
select:focus,
textarea:focus {
  border-color: rgba(139, 90, 43, 0.45);
  box-shadow: 0 0 0 3px rgba(196, 137, 63, 0.15);
}

textarea {
  resize: vertical;
  min-height: 88px;
  font-family: var(--font-body);
}

.table-wrap {
  overflow: auto;
  max-height: 440px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}

th,
td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid var(--line);
}

th {
  color: var(--ink-soft);
  font-weight: 500;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  background: rgba(255, 251, 245, 0.95);
}

td.name {
  font-weight: 600;
}

.mono {
  font-family: var(--font-mono);
  font-size: 0.84rem;
}

.actions {
  display: flex;
  gap: 10px;
  white-space: nowrap;
}

.link {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--bronze);
  cursor: pointer;
  font-weight: 600;
}

.link.danger {
  color: var(--cinnabar);
}

.link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty {
  margin: 48px 0;
  text-align: center;
  color: var(--ink-soft);
}

.runtime-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.chip {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--line);
}

.chip span {
  color: var(--ink-soft);
  font-size: 0.84rem;
}

.chip strong {
  font-family: var(--font-mono);
  font-size: 1rem;
}

.notice ul {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--ink-soft);
  line-height: 1.7;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1100px) {
  .status-grid,
  .ops,
  .split {
    grid-template-columns: 1fr;
  }
  .form-grid,
  .form-grid.three {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .hero {
    flex-direction: column;
    align-items: start;
  }
  .hero-actions,
  .meta {
    justify-content: flex-start;
    text-align: left;
  }
}
</style>
