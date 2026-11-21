
import type { EngineCharacter } from '../../../engine/types/character'
import type { EngineConditionalBonus } from '../../../engine/types/effect'

import type {
    CharacterCombatStats,
    MaximumModeEnvironment,
    StrengthCalculationMode,
    StrengthEnemySettings,
    StrengthSkillKey,
    SkillDamageResult,
    SkillHealingResult,
    TalentNodeSelection,
} from '../types'

import {
    getSkillEffectsWithTalent,
    type SkillSlot,
    type SkillLevel,
} from './effects'

import {
    calculateAttackBonusPercent,
    calculateAttributeDamageBonusPercent,
    calculateCriticalRateBonusPercent,
    calculateCriticalDamageBonusPercent,
    calculateEnemyDefenseReductionMultiplier,
    getEnemyDefenseReductionModifiers,
    convertTimedEffectsToModifiers,
} from './effectModifiers'
import type { TimedEffect } from './effectTimeline'

import { calculateSkillDamage } from './damage'
import { calculateSkillHealing } from './healing'
import { getEffectiveTalentNode } from './talent'

type ElementRelation =
    Parameters<typeof calculateSkillDamage>[0]['elementRelation']

type DamageSkillKey =
    Parameters<typeof calculateSkillDamage>[0]['skillKey']

// 單一敵人的技能傷害結果
export interface CharacterSkillEnemyDamageResult {
    enemy: StrengthEnemySettings
    damage: SkillDamageResult
}

// 單次技能傷害計算的輸入資料
export interface CharacterSkillDamageInput {
    character: EngineCharacter
    skillSlot: SkillSlot
    skillLevel: SkillLevel
    selectedNode: TalentNodeSelection

    stats: CharacterCombatStats
    enemies: StrengthEnemySettings[]
    elementRelation: ElementRelation
    mode: StrengthCalculationMode
    environment: MaximumModeEnvironment
    activeEffects?: TimedEffect[]

    // 武器及掛件傷害加成，來源資料使用小數格式
    // 例如 0.07 代表 7%
    weaponDamageBonus?: number | null
    hangingTraitDamageBonus?: number | null

    // 角色滿突破傷害特性，使用百分點格式（例如 10 代表 10%）
    breakthroughTraitDamageBonus?: number | null

    // 角色突破治療特性，使用百分點格式
    // 例如 10 代表 10%
    breakthroughTraitHealingBonus?: number | null

    // 掛件治癒特性，使用百分點格式
    // 例如 15 代表 15%
    hangingTraitHealingBonus?: number | null

    // 是否將自身生命值條件視為成立
    treatSelfHpConditionAsMet?: boolean
}

// 單次技能傷害計算結果
export interface CharacterSkillDamageResult {
    skillKey: StrengthSkillKey
    coefficient: number | null
    cooldown: string
    skillEffects: ReturnType<typeof getSkillEffectsWithTalent>

    // 所有受到攻擊的敵人，各自的傷害
    enemyDamages: CharacterSkillEnemyDamageResult[]

    // 所有敵人的傷害加總
    damage: SkillDamageResult

    // 技能本身或附帶效果產生的治療結果；沒有治療效果時為 null
    healing: SkillHealingResult | null

    warnings: string[]
    reviewRequired: boolean
}

// 將 Engine 角色技能倍率轉換成 damage.ts 使用的百分比數值
function parseSkillCoefficient(
    coefficient: string,
): number | null {
    const normalized = coefficient.trim()

    if (!normalized) {
        return null
    }

    const hasPercent = normalized.includes('%')
    const numeric = Number(normalized.replace('%', '').trim())

    if (!Number.isFinite(numeric) || numeric < 0) {
        return null
    }

    // Engine Adapter 已將一般倍率轉成小數
    // 例如 1.8 代表 180%
    return hasPercent ? numeric : numeric * 100
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
    breakthroughTraitDamageBonus: number | null | undefined,
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

    const breakthroughBonus =
        typeof breakthroughTraitDamageBonus === 'number' &&
            Number.isFinite(breakthroughTraitDamageBonus)
            ? breakthroughTraitDamageBonus
            : 0

    // 武器與掛件使用小數格式；突破特性使用百分點格式。
    return (weaponBonus + hangingBonus) * 100 + breakthroughBonus
}

// 建立沒有傷害數值的結果
function createEmptyDamageResult(
    skillKey: DamageSkillKey,
    coefficient: number | null,
    warnings: string[] = [],
): SkillDamageResult {
    return {
        skillKey,
        coefficient,
        normalDamage: null,
        criticalDamage: null,
        expectedDamage: null,
        criticalRate: null,
        warnings,
    }
}

// 將多隻敵人的傷害結果加總
function sumDamageValues(
    results: SkillDamageResult[],
    key: 'normalDamage' | 'criticalDamage' | 'expectedDamage',
): number | null {
    if (results.length === 0) {
        return null
    }

    const values = results.map(result => result[key])

    // 只要其中一隻敵人缺少有效傷害，
    // 就不顯示不完整的加總結果
    if (values.some(value => value === null)) {
        return null
    }

    return values.reduce<number>(
        (total, value) => total + (value ?? 0),
        0,
    )
}

// 將多隻敵人的傷害整理成一份加總結果
function combineEnemyDamageResults(
    skillKey: DamageSkillKey,
    results: SkillDamageResult[],
    coefficient: number | null,
): SkillDamageResult {
    if (results.length === 0) {
        return createEmptyDamageResult(
            skillKey,
            coefficient,
        )
    }

    const firstResult = results[0]

    return {
        skillKey,
        coefficient: firstResult.coefficient,
        normalDamage: sumDamageValues(results, 'normalDamage'),
        criticalDamage: sumDamageValues(results, 'criticalDamage'),
        expectedDamage: sumDamageValues(results, 'expectedDamage'),
        criticalRate: firstResult.criticalRate,
        warnings: [
            ...new Set(results.flatMap(result => result.warnings)),
        ],
    }
}

// 計算角色單一技能的傷害或治療
export function calculateCharacterSkillDamage(
    input: CharacterSkillDamageInput,
): CharacterSkillDamageResult {
    const {
        character,
        skillSlot,
        skillLevel,
        selectedNode,
        stats,
        enemies,
        elementRelation,
        mode,
        environment,
        activeEffects = [],
        weaponDamageBonus,
        hangingTraitDamageBonus,
        breakthroughTraitDamageBonus,
        breakthroughTraitHealingBonus,
        hangingTraitHealingBonus,
        treatSelfHpConditionAsMet = true,
    } = input

    const warnings: string[] = []

    // 取得原始技能等級資料
    const originalSkillLevel = character[skillSlot][skillLevel]

    // 取得技能類型
    const skillType = character[skillSlot].type

    // 取得套用天賦後的技能效果及計算資料
    const skillEffects = getSkillEffectsWithTalent(
        character,
        skillSlot,
        skillLevel,
        selectedNode,
    )

    warnings.push(...skillEffects.warnings)
    warnings.push(...originalSkillLevel.reviewIssues)

    // 取得技能主倍率
    const originalCoefficient = parseSkillCoefficient(
        originalSkillLevel.coefficient,
    )

    // 取得目前有效的天賦節點
    const effectiveNode = getEffectiveTalentNode(
        character,
        selectedNode,
    )

    // 取得目前技能對應的天賦節點
    const talentNode =
        skillSlot === 'skill1'
            ? 9
            : skillSlot === 'skill2'
                ? 12
                : 15

    // 取得目前技能對應的天賦倍率資料
    const talentMultiplier =
        skillSlot === 'skill1'
            ? character.talentMultipliers.talent9
            : skillSlot === 'skill2'
                ? character.talentMultipliers.talent12
                : character.talentMultipliers.talent15

    // 預設不增加技能倍率
    let talentCoefficientBonus = 0

    // 只有解鎖對應天賦節點後才處理倍率
    if (effectiveNode >= talentNode) {
        if (
            talentMultiplier.status === 'increase' &&
            typeof talentMultiplier.value === 'number' &&
            Number.isFinite(talentMultiplier.value) &&
            talentMultiplier.value >= 0
        ) {
            // 天賦倍率來源使用小數格式，轉成百分比
            talentCoefficientBonus =
                talentMultiplier.value * 100

            if (talentCoefficientBonus > 0) {
                warnings.push(
                    `已套用天賦 ${talentNode}：技能主倍率增加 ${talentCoefficientBonus}%。`,
                )
            }
        } else if (talentMultiplier.status === 'unknown') {
            warnings.push(
                `${character.name}的天賦 ${talentNode} 技能主倍率資料尚未確認，暫不增加倍率。`,
            )
        }
    }

    // 合併原始技能倍率與天賦增加倍率
    const coefficient =
        originalCoefficient === null
            ? null
            : originalCoefficient + talentCoefficientBonus

    // 取得角色攻擊力
    const attack = getCharacterAttack(character, stats)

    if (attack === null) {
        warnings.push(
            `${character.name}缺少有效的攻擊類型或對應攻擊力。`,
        )
    }

    if (coefficient === null) {
        warnings.push(
            `${character.name}的${skillSlot}缺少有效技能倍率。`,
        )
    }

    // 收集技能計算資料中的條件式倍率
    const conditionalBonuses: EngineConditionalBonus[] =
        skillEffects.calculations
            .flatMap(
                calculation => calculation.conditionalBonuses,
            )
            .map(bonus => {
                if (bonus.condition !== 'selfHpAtLeast') {
                    return bonus
                }

                const displayedCoefficient = Number(
                    bonus.displayedCoefficient
                        .replace('%', '')
                        .trim(),
                )

                if (
                    !Number.isFinite(displayedCoefficient) ||
                    displayedCoefficient < 0 ||
                    talentCoefficientBonus <= 0
                ) {
                    return bonus
                }

                return {
                    ...bonus,
                    displayedCoefficient:
                        `${displayedCoefficient + talentCoefficientBonus}%`,
                }
            })

    // 只在角色自帶增減益模式計算角色自身效果
    const activeModifiers =
        convertTimedEffectsToModifiers(activeEffects)

    // 計算角色自身效果帶來的敵方防禦降低倍率
    const enemyDefenseReductionModifiers =
        (mode === 'selfEffects' || mode === 'maximum') && character.attackType
            ? getEnemyDefenseReductionModifiers(
                activeModifiers,
                character.attackType,
            )
            : []

    const enemyDefenseReductionMultiplier =
        (mode === 'selfEffects' || mode === 'maximum') && character.attackType
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
        (mode === 'selfEffects' || mode === 'maximum') && character.attackType
            ? calculateAttackBonusPercent(
                activeModifiers,
                character.attackType,
            )
            : 0

    const attributeDamageBonusPercent =
        mode === 'selfEffects' || mode === 'maximum'
            ? calculateAttributeDamageBonusPercent(activeModifiers)
            : 0

    // 計算角色自身的暴擊率及暴擊傷害增減益
    const criticalRateBonusPercent =
        (mode === 'selfEffects' || mode === 'maximum')
            ? calculateCriticalRateBonusPercent(activeModifiers)
            : 0

    const criticalDamageBonusPercent =
        (mode === 'selfEffects' || mode === 'maximum')
            ? calculateCriticalDamageBonusPercent(activeModifiers)
            : 0

    // 武器與掛件傷害加成相加
    const additionalDamageBonusPercent =
        getAdditionalDamageBonusPercent(
            weaponDamageBonus,
            hangingTraitDamageBonus,
            breakthroughTraitDamageBonus,
        )

    // 根據技能類型決定攻擊目標
    let targetEnemies: StrengthEnemySettings[] = []

    const isHealingSkill =
        skillType === '單體回血' ||
        skillType === '全體回血'

    if (skillType === '單體攻擊') {
        // 單體攻擊只攻擊第一隻敵人
        targetEnemies = enemies.slice(0, 1)
    } else if (skillType === '全體攻擊') {
        // 全體攻擊會攻擊所有敵人
        targetEnemies = enemies
    } else if (!isHealingSkill) {
        // 其他非攻擊技能暫不計算傷害
        warnings.push(
            `${character.name}的${skillSlot}類型為「${skillType}」，目前不屬於傷害技能，暫不計算傷害。`,
        )
    }

    if (
        (skillType === '單體攻擊' ||
            skillType === '全體攻擊') &&
        targetEnemies.length === 0
    ) {
        warnings.push(
            `${character.name}的${skillSlot}目前沒有可攻擊的敵人。`,
        )
    }

    // ======================================================
    // 解析技能治療倍率
    // ======================================================

    // 從技能計算資料中尋找治療倍率。
    // 攻擊技能附帶回血時，也會在這裡找到 healing 資料。
    const healingCalculations =
        skillEffects.calculations.filter(
            calculation => calculation.kind === 'healing'
        )

    const healingCalculation = healingCalculations[0]

    // 將治療倍率轉換成百分比數值
    const healingCoefficient = healingCalculation
        ? parseSkillCoefficient(healingCalculation.coefficient)
        : isHealingSkill
            ? coefficient
            : null

    // 是否具有治療效果
    const hasHealingEffect =
        isHealingSkill || healingCalculation !== undefined

    // 如果同一技能解析出多筆治療倍率，先標記待確認，
    // 避免目前只取第一筆卻沒有提醒。
    if (healingCalculations.length > 1) {
        warnings.push(
            `${character.name}的${skillSlot}解析出多筆治療倍率，目前只使用第一筆，需人工確認。`
        )
    }

    // ======================================================
    // 計算技能治療量
    // ======================================================

    let healing: SkillHealingResult | null = null

    if (hasHealingEffect) {
        healing = calculateSkillHealing({
            skillKey: skillSlot,
            stats,
            coefficient: healingCoefficient,
            breakthroughTraitHealingBonus,
            hangingTraitHealingBonus,
        })

        warnings.push(...healing.warnings)
    } 
    
    // 將技能資料交給傷害計算模組
    /*
     coefficient：不套用角色自身降防效果。
     selfEffects：依照實際觸發的敵方降防效果，套用實測倍率。
     maximum：暫時不套用角色自身降防效果。
     沒有降防效果時，倍率為 1，不影響原本傷害。
     */

    // 對每一隻目標敵人分別計算傷害
    const enemyDamages: CharacterSkillEnemyDamageResult[] =
        targetEnemies.map(enemy => {
            const damage = calculateSkillDamage({
                skillKey: skillSlot as DamageSkillKey,
                stats,
                attack,
                attackType: character.attackType ?? null,
                coefficient,
                conditionalBonuses,
                treatSelfHpConditionAsMet,
                enemy,
                elementRelation,
                mode,
                environment,
                attackBonusPercent,
                attributeDamageBonusPercent,
                damageBonusPercent: additionalDamageBonusPercent,
                criticalRateBonusPercent,
                criticalDamageBonusPercent,
                enemyDefenseReductionMultiplier:
                    enemyDefenseReductionMultiplier ?? 1,
            })

            return {
                enemy,
                damage,
            }
        })

    // 整理所有敵人的傷害加總
    const damage = combineEnemyDamageResults(
        skillSlot as DamageSkillKey,
        enemyDamages.map(result => result.damage),
        coefficient,
    )

    warnings.push(
        ...enemyDamages.flatMap(result => result.damage.warnings),
    )

    if (
        originalSkillLevel.reviewRequired ||
        skillEffects.reviewRequired
    ) {
        warnings.push(
            `${character.name}的${skillSlot}含有尚待確認的資料。`,
        )
    }

    return {
        skillKey: skillSlot,
        coefficient,
        cooldown: skillEffects.cooldown,
        skillEffects,
        enemyDamages,
        damage,
        healing,
        warnings: [...new Set(warnings)],
        reviewRequired:
            originalSkillLevel.reviewRequired ||
            skillEffects.reviewRequired,
    }
}
