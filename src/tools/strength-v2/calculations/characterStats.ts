
import type { EngineCharacter } from '../../../engine/types/character'

import type {
    WeaponQuality,
    TalentNodeSelection,
    HangingTraitType,
    HangingTraitRarity,
    HangingTraitDamageBonus,
    AutoApplyWandEffects,
    AccessoryQuality,
} from '../types'

import type { StrengthBaseDataV2 } from '../data/strengthBaseAdapter'

import { calculateBaseStats } from './baseStats'
import { calculateTalentStats } from './talent'

// ======================================================
// 整合單一角色的基礎面板、武器、掛件、飾品及天賦
// ======================================================

export function calculateCharacterStats(
    character: EngineCharacter,
    data: StrengthBaseDataV2,
    weaponQuality: WeaponQuality,
    selectedNode: TalentNodeSelection,
    hangingTraitType: HangingTraitType,
    hangingTraitRarity: HangingTraitRarity,
    accessoryQuality: AccessoryQuality,
    hangingTraitDamageBonus: HangingTraitDamageBonus,
    autoApplyWandEffects: AutoApplyWandEffects,
) {
    // 第一步：計算角色基礎面板、武器、掛件及飾品
    const baseResult = calculateBaseStats(
        character,
        data,
        weaponQuality,
        hangingTraitType,
        hangingTraitRarity,
        accessoryQuality,
        autoApplyWandEffects,
    )

    // 第二步：累積天賦常駐數值
    const talentResult = calculateTalentStats(
        character,
        data,
        baseResult.stats,
        selectedNode,
    )

    // 第三步：合併飾品與天賦提供的額外能力值
    const additionalStats = {
        ...baseResult.additionalStats,
        ...talentResult.additionalStats,
    }

    // 屬性抗性需要累加，不能讓天賦數值覆蓋飾品數值
    if (
        baseResult.additionalStats.attributeResistance !== undefined ||
        talentResult.additionalStats.attributeResistance !== undefined
    ) {
        additionalStats.attributeResistance =
            (baseResult.additionalStats.attributeResistance ?? 0) +
            (talentResult.additionalStats.attributeResistance ?? 0)
    }

    // 判斷是否為開啟自動套用效果的杖角色
    const isAutoAppliedWand =
        autoApplyWandEffects &&
        (character.class === '物杖' || character.class === '魔杖')

    return {
        stats: talentResult.stats,

        weaponDamageBonus: baseResult.weaponDamageBonus,

        // 杖角色開啟自動套用時，掛件傷害特性轉為治癒特性
        hangingTraitDamageBonus: isAutoAppliedWand
            ? 0
            : hangingTraitDamageBonus,

        hangingTraitHealingBonus: isAutoAppliedWand
            ? hangingTraitDamageBonus
            : 0,

        additionalStats,

        effectiveNode: talentResult.effectiveNode,
        appliedNodes: talentResult.appliedNodes,

        warnings: [
            ...baseResult.warnings,
            ...talentResult.warnings,
        ],
    }
}
