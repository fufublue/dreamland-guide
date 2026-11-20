
import type { EngineCharacter } from '../../../engine/types/character'

import type {
    CharacterCombatStats,
    MaximumModeEnvironment,
    StrengthCalculationMode,
    StrengthEnemySettings,
    StrengthSkillKey,
    SkillDamageResult,
    SkillLevelType,
} from '../types'

import { calculateSkillDamage } from './damage'
import { getEffectiveTalentNode } from './talent'
import type { TalentNodeSelection } from '../types'
import {
    calculateAttackBonusPercent,
    calculateCriticalRateBonusPercent,
    calculateCriticalDamageBonusPercent,
    calculateEnemyDefenseReductionMultiplier,
    getEnemyDefenseReductionModifiers,
    convertTimedEffectsToModifiers,
} from './effectModifiers'

import type { TimedEffect } from './effectTimeline'

type ElementRelation =
    Parameters<typeof calculateSkillDamage>[0]['elementRelation']

type DamageSkillKey =
    Parameters<typeof calculateSkillDamage>[0]['skillKey']

export interface CharacterNormalAttackDamageInput {
    character: EngineCharacter
    selectedNode: TalentNodeSelection
    normalAttackLevel: SkillLevelType
    stats: CharacterCombatStats

    // 普通攻擊只會攻擊第一隻敵人
    // 沒有敵人時為 null
    enemy: StrengthEnemySettings | null

    elementRelation: ElementRelation
    mode: StrengthCalculationMode
    environment: MaximumModeEnvironment
    activeEffects?: TimedEffect[]

    // 武器與掛件傷害加成，來源資料使用小數格式
    weaponDamageBonus?: number | null
    hangingTraitDamageBonus?: number | null
}

export interface CharacterNormalAttackDamageResult {
    skillKey: StrengthSkillKey
    coefficient: number | null
    damage: SkillDamageResult
    warnings: string[]
}

// 取得角色對應的攻擊力
function getCharacterAttack(
    character: EngineCharacter,
    stats: CharacterCombatStats,
): number | null {
    if (character.attackType === 'physical') {
        return stats.physicalAttack
    }

    if (character.attackType === 'magic') {
        return stats.magicAttack
    }

    return null
}

// 將小數格式的傷害加成轉成百分比
function getAdditionalDamageBonusPercent(
    weaponDamageBonus: number | null | undefined,
    hangingTraitDamageBonus: number | null | undefined,
): number {
    const weaponBonus =
        typeof weaponDamageBonus === 'number' &&
            Number.isFinite(weaponDamageBonus)
            ? weaponDamageBonus
            : 0

    const hangingBonus =
        typeof hangingTraitDamageBonus === 'number' &&
            Number.isFinite(hangingTraitDamageBonus)
            ? hangingTraitDamageBonus
            : 0

    return (weaponBonus + hangingBonus) * 100
}

// 建立沒有傷害數值的結果
function createEmptyDamageResult(
    coefficient: number | null,
    warnings: string[] = [],
): SkillDamageResult {
    return {
        skillKey: 'normalAttack' as DamageSkillKey,
        coefficient,
        normalDamage: null,
        criticalDamage: null,
        expectedDamage: null,
        criticalRate: null,
        warnings,
    }
}

// 計算普通攻擊傷害
export function calculateCharacterNormalAttackDamage(
    input: CharacterNormalAttackDamageInput,
): CharacterNormalAttackDamageResult {
    const {
        character,
        selectedNode,
        normalAttackLevel,
        stats,
        enemy,
        elementRelation,
        mode,
        environment,
        activeEffects = [],
        weaponDamageBonus,
        hangingTraitDamageBonus,
    } = input

    const warnings: string[] = []
   
    // 取得角色實際可計算的天賦節點
    const effectiveNode = getEffectiveTalentNode(
        character,
        selectedNode,
    )

    // 取得普通攻擊倍率
    const rawCoefficient =
        character.normalAttack[normalAttackLevel]

    // 天賦 6：普通攻擊倍率增加 0.10
    const talent6Bonus =
        effectiveNode >= 6 ? 0.10 : 0

    // Engine 的普通攻擊倍率是小數，轉成百分比
    const coefficient =
        Number.isFinite(rawCoefficient) &&
            rawCoefficient >= 0
            ? (rawCoefficient + talent6Bonus) * 100
            : null

    // 沒有敵人時，仍然保留普通攻擊倍率
    if (!enemy) {
        warnings.push(
            `${character.name}目前沒有可攻擊的敵人。`,
        )

        return {
            skillKey: 'normalAttack',
            coefficient,
            damage: createEmptyDamageResult(
                coefficient,
                warnings,
            ),
            warnings,
        }
    }

    if (talent6Bonus > 0) {
        warnings.push(
            '已套用天賦 6：普通攻擊倍率增加 0.10。',
        )
    }

    // 取得角色攻擊力
    const attack = getCharacterAttack(character, stats)

    if (attack === null) {
        warnings.push(
            `${character.name}缺少有效的攻擊類型或對應攻擊力。`,
        )
    }

    // 只在角色自帶增減益模式計算角色自身效果
    const activeModifiers =
        convertTimedEffectsToModifiers(activeEffects)

    // 計算角色自身效果帶來的敵方防禦降低倍率
    const enemyDefenseReductionModifiers =
        mode === 'selfEffects' && character.attackType
            ? getEnemyDefenseReductionModifiers(
                activeModifiers,
                character.attackType,
            )
            : []

    const enemyDefenseReductionMultiplier =
        mode === 'selfEffects' && character.attackType
            ? calculateEnemyDefenseReductionMultiplier(
                activeModifiers,
                character.attackType,
            )
            : 1

    if (
        enemyDefenseReductionModifiers.length > 0 &&
        enemyDefenseReductionMultiplier === null
    ) {
        warnings.push(
            '敵方防禦降低效果的倍率尚未建立，暫未套用。',
        )
    }

    const attackBonusPercent =
        mode === 'selfEffects' && character.attackType
            ? calculateAttackBonusPercent(
                activeModifiers,
                character.attackType,
            )
            : 0

    // 計算角色自身的暴擊率及暴擊傷害增減益
    const criticalRateBonusPercent =
        mode === 'selfEffects'
            ? calculateCriticalRateBonusPercent(activeModifiers)
            : 0

    const criticalDamageBonusPercent =
        mode === 'selfEffects'
            ? calculateCriticalDamageBonusPercent(activeModifiers)
            : 0

    // 武器與掛件傷害加成相加
    const additionalDamageBonusPercent =
        getAdditionalDamageBonusPercent(
            weaponDamageBonus,
            hangingTraitDamageBonus,
        )

    // 普通攻擊固定攻擊第一隻敵人
    const damage = calculateSkillDamage({
        skillKey: 'normalAttack' as DamageSkillKey,
        stats,
        attack,
        attackType: character.attackType ?? null,
        coefficient,
        enemy,
        elementRelation,
        mode,
        environment,
        attackBonusPercent,
        damageBonusPercent: additionalDamageBonusPercent,
        criticalRateBonusPercent,
        criticalDamageBonusPercent,
        enemyDefenseReductionMultiplier:
            enemyDefenseReductionMultiplier ?? 1,
    })

    warnings.push(...damage.warnings)

    return {
        skillKey: 'normalAttack',
        coefficient,
        damage,
        warnings: [...new Set(warnings)],
    }
}
