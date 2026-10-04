/**
 * SkillIconAtlas —— 技能图标图集（`assets/resources/SkillIcon/SkillIcon`）的**统一加载 / 取帧工具**。
 *
 * 为什么单独抽一个模块：
 *   - 机甲面板（`MechSkillPanel`）与战斗技能选择面板（`SkillSelectPanel`）用的是**同一套图标口径**，
 *     两处各写一份「加载图集 + 兼容帧名 + 缺帧回退」很容易走偏；
 *   - 图集是**全局单例资源**，两个面板共用同一份缓存，避免重复 `resources.load`。
 *
 * 图标口径（见 `tools/skill_category_todo.md`）：
 *   - 帧名 = `Skills.json` 里每条技能的 `iconIndex`（如 `skill_1` / `skill_3`），分类 1~5；
 *   - 缺省 / 缺帧一律回退 `skill_1`（`SkillData.DEFAULT_SKILL_ICON`）；
 *   - 资源必须在 `assets/resources/` 下才能被 `resources.load` 读到 → 图集放在
 *     `assets/resources/SkillIcon/`。
 */

import { Sprite, SpriteAtlas, SpriteFrame, resources } from 'cc';
import { Logger } from '../global/Logger';
import * as SkillData from './SkillData';

/** 图集缓存（全局只加载一次） */
let _atlas: SpriteAtlas | null = null;
/** 加载中的等待队列 */
let _waiters: Array<(a: SpriteAtlas | null) => void> = [];

/** 取技能图标图集（异步；已加载则同步回调）。加载失败回调 `null`。 */
export function getSkillIconAtlas(cb: (a: SpriteAtlas | null) => void): void {
    if (_atlas) {
        cb(_atlas);
        return;
    }
    _waiters.push(cb);
    if (_waiters.length > 1) return; // 已有加载在途
    resources.load(SkillData.SKILL_ICON_ATLAS_PATH, SpriteAtlas, (err: Error | null, atlas: SpriteAtlas | null) => {
        const waiters = _waiters;
        _waiters = [];
        if (err || !atlas) {
            Logger.warn(`[SkillIcon] 技能图标图集加载失败 ${SkillData.SKILL_ICON_ATLAS_PATH}:`, err);
            for (const w of waiters) w(null);
            return;
        }
        _atlas = atlas;
        for (const w of waiters) w(atlas);
    });
}

/**
 * 从图集里取一帧（兼容 hyphen / underscore 两种帧名写法；缺帧回退 `skill_1`）。
 */
export function resolveSkillIconFrame(atlas: SpriteAtlas, iconIndex: unknown): SpriteFrame | null {
    const key = iconIndex ? String(iconIndex) : SkillData.DEFAULT_SKILL_ICON;
    const tryNames: string[] = [key];
    if (key.indexOf('-') >= 0) tryNames.push(key.replace(/-/g, '_'));
    if (key.indexOf('_') >= 0) tryNames.push(key.replace(/_/g, '-'));
    for (const n of tryNames) {
        const sf = atlas.getSpriteFrame(n);
        if (sf) return sf;
    }
    Logger.warn(`[SkillIcon] 图集里没有图标帧「${key}」，回退 ${SkillData.DEFAULT_SKILL_ICON}`);
    return atlas.getSpriteFrame(SkillData.DEFAULT_SKILL_ICON);
}

/**
 * 给 Sprite 设置技能图标（异步；节点已销毁则静默放弃）。
 * @param sprite    目标 Sprite
 * @param iconIndex 技能分类帧名（`skill_1`…）；空则用缺省
 */
export function applySkillIcon(sprite: Sprite | null, iconIndex: unknown): void {
    if (!sprite) return;
    getSkillIconAtlas((atlas) => {
        if (!sprite.isValid) return;
        if (!atlas) return;
        const sf = resolveSkillIconFrame(atlas, iconIndex);
        if (sf) sprite.spriteFrame = sf;
    });
}
