export interface WsMessage {
  type: string
  success?: boolean
  message?: string
  [key: string]: unknown
}

export interface ServerStats {
  total_requests?: number
  online_players?: number
  total_users?: number
  total_characters?: number
  uptime?: number
  qps?: number
  current_connections?: number
  route_stats?: {
    total_error_rate?: number
    avg_time_per_call_ms?: number
    [key: string]: unknown
  }
}

export interface OnlinePlayer {
  role_name?: string
  account?: string
  character_id?: string
  level?: number
}

export interface RouteStat {
  total_calls?: number
  call_count?: number
  avg_time?: number
  max_time?: number
  error_count?: number
  error_rate?: number
}

export interface CharacterInfo {
  user_id?: string
  account?: string
  character_id?: string
  role_name?: string
  slot_index?: number
  level?: number
  exp?: number
  gold?: number
  Sprite?: number
  class?: number
}

export interface PlayerInfo extends CharacterInfo {
  items?: Record<string, number>
  robotcount?: number
  energy_blocks?: number
}

export interface RobotPet {
  pet_id?: string
  name?: string
  level?: number
  exp?: number
  growth?: number
  comprehension?: number
  star_level?: number
  [key: string]: unknown
}

export interface AdminAccount {
  account: string
  password?: string
  token?: string
  characters?: CharacterInfo[]
}

export interface BattleRoom {
  room_id?: string
  status?: string
  character_id?: string
  round?: number
  created_at?: number | string
  remaining_command_seconds?: number
  player?: { name?: string; hp?: number; max_hp?: number }
  enemy?: { name?: string; hp?: number; max_hp?: number }
  result?: { winner?: string; reason?: string }
}

export interface ItemEntry {
  id: number | string
  name: string
}
