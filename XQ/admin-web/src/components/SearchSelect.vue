<template>
  <label class="search-select">
    <span v-if="label" class="lbl">{{ label }}</span>
    <div class="box">
      <input
        v-model="keyword"
        type="search"
        :placeholder="placeholder"
        @focus="open = true"
        @input="open = true"
      />
      <button v-if="modelValue" class="clear" type="button" @click="clear">清除</button>
    </div>
    <div v-if="open" class="dropdown">
      <button
        v-for="opt in filtered"
        :key="opt.value"
        type="button"
        class="opt"
        :class="{ active: opt.value === modelValue }"
        @mousedown.prevent="pick(opt)"
      >
        <strong>{{ opt.label }}</strong>
        <span v-if="opt.sub">{{ opt.sub }}</span>
      </button>
      <p v-if="!filtered.length" class="empty">没有匹配项</p>
    </div>
  </label>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // { value, label, sub? }
  label: { type: String, default: '' },
  placeholder: { type: String, default: '搜索并选择' },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const keyword = ref('')

watch(
  () => props.modelValue,
  (v) => {
    if (!v) {
      keyword.value = ''
      return
    }
    const hit = props.options.find((o) => String(o.value) === String(v))
    keyword.value = hit ? hit.label : String(v)
  },
  { immediate: true },
)

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return props.options.slice(0, 80)
  return props.options
    .filter((o) => {
      const hay = `${o.label} ${o.sub || ''} ${o.value}`.toLowerCase()
      return hay.includes(q)
    })
    .slice(0, 80)
})

function pick(opt) {
  emit('update:modelValue', opt.value)
  keyword.value = opt.label
  open.value = false
}

function clear() {
  emit('update:modelValue', '')
  keyword.value = ''
}

function onDocClick(e) {
  if (!e.target.closest?.('.search-select')) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.search-select {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--ink-soft);
}

.box {
  position: relative;
}

input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.7rem 2.4rem 0.7rem 0.85rem;
  background: rgba(255, 255, 255, 0.65);
  color: var(--ink);
  outline: none;
}

input:focus {
  border-color: rgba(139, 90, 43, 0.45);
  box-shadow: 0 0 0 3px rgba(196, 137, 63, 0.15);
}

.clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
  font-size: 0.75rem;
}

.dropdown {
  position: absolute;
  z-index: 20;
  left: 0;
  right: 0;
  top: calc(100% + 4px);
  max-height: 240px;
  overflow: auto;
  background: #fffaf3;
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(61, 50, 41, 0.12);
}

.opt {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  border: 0;
  background: transparent;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  color: var(--ink);
  border-bottom: 1px solid var(--line);
}

.opt:hover,
.opt.active {
  background: rgba(196, 137, 63, 0.12);
}

.opt strong {
  font-weight: 600;
}

.opt span {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--ink-soft);
}

.empty {
  margin: 0;
  padding: 14px;
  text-align: center;
  color: var(--ink-soft);
}
</style>
