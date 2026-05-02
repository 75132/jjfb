import { EventTarget } from 'cc';

/** 机甲列表 / 属性面板 / 背包等跨模块联动事件名 */
export const RobotGameEvent = {
    RobotDataUpdated: 'robot_game_robot_data_updated',
    BattleTeamUpdated: 'robot_game_battle_team_updated',
} as const;

export type RobotGameEventDetail = { petId?: string; character_id?: string };

export const robotGameEvents = new EventTarget();

export function emitRobotDataUpdated(detail: RobotGameEventDetail = {}): void {
    robotGameEvents.emit(RobotGameEvent.RobotDataUpdated, detail);
}

export function emitBattleTeamUpdated(detail: RobotGameEventDetail = {}): void {
    robotGameEvents.emit(RobotGameEvent.BattleTeamUpdated, detail);
}
