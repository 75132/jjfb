const SECRET = 'iloveu'

async function get(path) {
  const res = await fetch(`${path}?secret=${encodeURIComponent(SECRET)}`, {
    headers: { 'X-Admin-Secret': SECRET },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function post(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Admin-Secret': SECRET,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function fetchStatus() {
  return get('/admin/status')
}

export function fetchOnline() {
  return get('/admin/online')
}

export function fetchRuntime() {
  return get('/admin/runtime')
}

export function kickPlayer(name) {
  return post('/admin/kick', { name })
}

export function kickAllPlayers() {
  return post('/admin/kickAll', {})
}

export function setAllowed(allowed) {
  return post('/admin/setAllowed', { allowed })
}

export function broadcast(content) {
  return post('/admin/broadcast', { content })
}

export function grantCurrency({ name, type, num }) {
  return post('/admin/grantCurrency', { name, type, num })
}

export function grantGoods({ name, key, num, bind }) {
  return post('/admin/grantGoods', { name, key, num, bind })
}

export function resetPassword({ username, password }) {
  return post('/admin/resetPassword', { username, password })
}

export function grantPet({ name, key, quality }) {
  const body = { name, key }
  if (quality != null && quality !== '') body.quality = Number(quality)
  return post('/admin/grantPet', body)
}

export function setLevel({ name, lever }) {
  return post('/admin/setLevel', { name, lever })
}

export function addExp({ name, exp }) {
  return post('/admin/addExp', { name, exp })
}

export function setExp({ name, exp }) {
  return post('/admin/setExp', { name, exp })
}

export function fetchRoles() {
  return get('/admin/roles')
}
