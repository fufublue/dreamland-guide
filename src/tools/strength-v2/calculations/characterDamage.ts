
// 負責把效果資料傳給普通攻擊及其他技能。

import type { EngineCharacter } from '../../../engine/types/character'

import type {
    CharacterCombatStats,
    MaximumModeEnvironment,
    StrengthCalculationMode,
    StrengthEnemySettings,
    SkillLevelType,
} from '../types'

import {
    calculateCharacterNormalAttackDamage,
} from './normalAttackDamage'

import {
    calculateCharacterSkillDamage,
} from './skillDamage'

import {
    createCharacterSkillSchedule,
} from './characterSchedule'

import type { TimedEffect } from './effectTimeline'
import {
    calculateBreakthroughTraitDamageBonus,
    calculateBreakthroughTraitHealingBonus,
} from './breakthroughTrait'

type SkillLevel =
    Parameters<typeof calculateCharacterSkillDamage>[0]['skillLevel']

type SkillSlot =
    Parameters<typeof calculateCharacterSkillDamage>[0]['skillSlot']

type ElementRelation =
    Parameters<typeof calculateCharacterSkillDamage>[0]['elementRelation']

export interface CharacterDamageInput {
    character: EngineCharacter

    normalAttackLevel: SkillLevelType
    skillLevel: SkillLevel

    selectedNode: Parameters<
        typeof calculateCharacterSkillDamage
    >[0]['selectedNode']

    stats: CharacterCombatStats

    // 同一場戰鬥中的全部敵人
    enemies: StrengthEnemySettings[]

    elementRelation: ElementRelation
    mode: StrengthCalculationMode
    environment: MaximumModeEnvironment

    // 武器與掛件傷害加成
    weaponDamageBonus?: number | null
    hangingTraitDamageBonus?: number | null

    // 掛件治癒特性
    hangingTraitHealingBonus?: number | null

    // 是否將自身生命值條件視為成立
    treatSelfHpConditionAsMet?: boolean

    activeEffects?: TimedEffect[]

    // 有設定時才建立技能排程
    scheduleSettings?: {
        remainingSeconds: number
        ultimateUses: number | null
        initialSkill1CooldownElapsedSeconds?: number | null
        initialSkill2CooldownElapsedSeconds?: number | null
    }
}

export function calculateCharacterDamage(
    input: CharacterDamageInput,
) {
    const {
        character,
        normalAttackLevel,
        skillLevel,
        selectedNode,
        stats,
        enemies,
        elementRelation,
        mode,
        environment,
        weaponDamageBonus,
        hangingTraitDamageBonus,
        hangingTraitHealingBonus,
        treatSelfHpConditionAsMet = true,
        activeEffects = [],
        scheduleSettings,
    } = input

    // 取得角色滿突破傷害特性，依角色屬性及攻擊類型判斷適用加成
    const breakthroughTraitDamageBonus =
        calculateBreakthroughTraitDamageBonus(
            character.maxBreakthroughTrait,
            character.element,
            character.attackType ?? '',
        )


    // 普通攻擊固定攻擊第一隻敵人
    const priorityEnemy = enemies[0] ?? null

    // 計算普通攻擊傷害
    const normalAttack = calculateCharacterNormalAttackDamage({
        character,
        normalAttackLevel,
        selectedNode,
        stats,
        enemy: priorityEnemy,
        elementRelation,
        mode,
        environment,
        activeEffects,
        weaponDamageBonus,
        hangingTraitDamageBonus,
        breakthroughTraitDamageBonus,
    })

    // 取得角色突破治療特性
    const breakthroughTraitHealingBonus =
        calculateBreakthroughTraitHealingBonus(
            character.maxBreakthroughTrait,
        )

    // 計算技能傷害及治療
    const calculateSkill = (skillSlot: SkillSlot) =>
        calculateCharacterSkillDamage({
            character,
            skillSlot,
            skillLevel,
            selectedNode,
            stats,
            enemies,
            elementRelation,
            mode,
            environment,
            activeEffects,
            weaponDamageBonus,
            hangingTraitDamageBonus,
            breakthroughTraitDamageBonus,
            hangingTraitHealingBonus,
            breakthroughTraitHealingBonus,
            treatSelfHpConditionAsMet,
        })

    const skill1 = calculateSkill('skill1')
    const skill2 = calculateSkill('skill2')
    const ultimate = calculateSkill('ultimate')

    // 整合原本的傷害警告
    const warnings = [
        ...normalAttack.warnings,
        ...skill1.warnings,
        ...skill2.warnings,
        ...ultimate.warnings,
    ]

    // 預設不建立排程
    let schedule = null

    // 有傳入排程設定時才建立排程
    if (scheduleSettings) {
        schedule = createCharacterSkillSchedule({
            character,

            normalAttackLevel,
            skillLevel,
            selectedNode,

            stats,
            enemies,
            elementRelation,

            mode,
            environment,

            speed: stats.speed,

            remainingSeconds:
                scheduleSettings.remainingSeconds,

            ultimateUses:
                scheduleSettings.ultimateUses,

            weaponDamageBonus,
            hangingTraitDamageBonus,
            breakthroughTraitDamageBonus,

            breakthroughTraitHealingBonus,
            hangingTraitHealingBonus,

            treatSelfHpConditionAsMet,

            initialEffectState: [
                {
                    activeEffects,
                    probability: 1,
                },
            ],
        })

        warnings.push(...schedule.warnings)
    }

    return {
        characterId: character.id,
        characterName: character.name,

        normalAttack,
        skill1,
        skill2,
        ultimate,

        // 完整技能排程結果
        schedule,

        warnings: [...new Set(warnings)],

        reviewRequired:
            character.reviewRequired ||
            skill1.reviewRequired ||
            skill2.reviewRequired ||
            ultimate.reviewRequired,
    }
}


