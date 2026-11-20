
import type {
    EngineCharacter,
    EngineEffect,
} from '../../../engine'

import type { EngineSkillLevel } from '../../../engine/types/character'
import type { EngineCalculation } from '../../../engine/types/calculation'
import type { EngineTalentRule } from '../../../engine/types/talent'

import { parseEffectText } from '../../../engine/parser/effectParser'
import { parseCalculationData } from '../../../engine/parser/calculationParser'

import type { TalentNodeSelection } from '../types'
import { getEffectiveTalentNode } from './talent'

export type SkillSlot = 'skill1' | 'skill2' | 'ultimate'
export type SkillLevel = 'initial' | 'max'

export type SkillEffectsResult = {
    effects: EngineEffect[]
    calculations: EngineCalculation[]
    cooldown: string
    effectText: string
    warnings: string[]
    reviewRequired: boolean
}

const TALENT_NODE_BY_SKILL: Record<SkillSlot, 9 | 12 | 15> = {
    skill1: 9,
    skill2: 12,
    ultimate: 15,
}

type TextRuleResult = {
    text: string
    reviewRequired: boolean
    reviewIssues: string[]
}

/**
 * 套用單一天賦規則至原技能效果文字。
 *
 * 此處沿用既有 talentResolver 的判斷方式，
 * 不自行擴張天賦規則。
 */
function applyRuleToText(
    text: string,
    rule: EngineTalentRule,
): TextRuleResult {
    if (rule.reviewRequired) {
        return {
            text,
            reviewRequired: true,
            reviewIssues: rule.reviewIssues.length > 0
                ? rule.reviewIssues
                : ['天賦規則尚未確認'],
        }
    }

    const replacement = rule.replacement.trim()

    switch (rule.operation) {
        case 'replaceMagnitude': {
            const matches = text.match(
                /(?:小幅|中幅|大幅)(?:\s*\d+(?:\.\d+)?%)?/g,
            ) ?? []

            if (matches.length !== 1) {
                return {
                    text,
                    reviewRequired: true,
                    reviewIssues: ['效果倍率數量不是唯一，需人工確認'],
                }
            }

            return {
                text: text.replace(
                    /(?:小幅|中幅|大幅)(?:\s*\d+(?:\.\d+)?%)?/,
                    replacement,
                ),
                reviewRequired: false,
                reviewIssues: [],
            }
        }

        case 'replaceHealing': {
            const matches = text.match(
                /(?:回血|治療)\s*\d+(?:\.\d+)?%/g,
            ) ?? []

            if (matches.length !== 1) {
                return {
                    text,
                    reviewRequired: true,
                    reviewIssues: ['無法唯一定位治療倍率'],
                }
            }

            return {
                text: text.replace(
                    /((?:回血|治療)\s*)\d+(?:\.\d+)?%/,
                    `$1${replacement}`,
                ),
                reviewRequired: false,
                reviewIssues: [],
            }
        }

        case 'replaceChance': {
            const matches = text.match(
                /\d+(?:\.\d+)?%\s*(?=機率|概率)/g,
            ) ?? []

            if (matches.length !== 1) {
                return {
                    text,
                    reviewRequired: true,
                    reviewIssues: ['無法唯一定位發動機率'],
                }
            }

            return {
                text: text.replace(
                    /\d+(?:\.\d+)?%(\s*(?:機率|概率))/,
                    `${replacement}$1`,
                ),
                reviewRequired: false,
                reviewIssues: [],
            }
        }

        case 'replaceDuration': {
            if (!/^\d+(?:\.\d+)?秒$/.test(replacement)) {
                return {
                    text,
                    reviewRequired: true,
                    reviewIssues: ['天賦提供的時間格式無法辨識'],
                }
            }

            const matches = text.match(
                /\d+(?:\.\d+)?秒/g,
            ) ?? []

            if (matches.length !== 1) {
                return {
                    text,
                    reviewRequired: true,
                    reviewIssues: [
                        matches.length === 0
                            ? '找不到可替換的持續時間'
                            : '持續時間不只一處，需人工確認',
                    ],
                }
            }

            return {
                text: text.replace(
                    /\d+(?:\.\d+)?秒/,
                    replacement,
                ),
                reviewRequired: false,
                reviewIssues: [],
            }
        }

        case 'replaceCooldown':
            return {
                text,
                reviewRequired: true,
                reviewIssues: ['冷卻時間應由技能等級資料處理'],
            }

        case 'addEffect':
            return {
                text,
                reviewRequired: true,
                reviewIssues: ['新增效果應由獨立流程處理'],
            }

        default:
            return {
                text,
                reviewRequired: true,
                reviewIssues: ['尚未支援此天賦修改方式'],
            }
    }
}

/**
 * 套用天賦冷卻時間修改。
 */
function applyCooldownRule(
    cooldown: string,
    rule: EngineTalentRule,
): {
    cooldown: string
    reviewIssues: string[]
} {
    if (rule.reviewRequired) {
        return {
            cooldown,
            reviewIssues: rule.reviewIssues.length > 0
                ? rule.reviewIssues
                : ['天賦冷卻時間規則尚未確認'],
        }
    }

    const replacement = rule.replacement.trim()

    if (!/^\d+(?:\.\d+)?秒?$/.test(replacement)) {
        return {
            cooldown,
            reviewIssues: ['天賦冷卻時間格式無法辨識'],
        }
    }

    return {
        cooldown: replacement.replace(/秒$/, ''),
        reviewIssues: [],
    }
}

/**
 * 重新解析技能效果及計算資料。
 *
 * 原技能效果與天賦新增效果分開解析，
 * 最後再合併成同一份效果清單。
 */
function refreshSkillLevel(
    level: EngineSkillLevel,
    skillEffectText: string,
    talentEffectTexts: string[],
    skillType: string,
    cooldown: string,
    extraReviewIssues: string[],
): SkillEffectsResult {
    const skillEffects = parseEffectText(
        skillEffectText,
        'skill',
    )

    const talentEffects = talentEffectTexts.flatMap(text => {
        let effectText = text.trim()

        // 移除可能存在的「效果」前綴，
        // 保留天賦新增效果的「加」字。
        effectText = effectText.replace(/^效果\s*/, '')

        return effectText
            ? parseEffectText(effectText, 'talent')
            : []
    })

    const effectText = [
        skillEffectText,
        ...talentEffectTexts,
    ]
        .filter(text => text.trim().length > 0)
        .join('；')

    const effects = [
        ...skillEffects,
        ...talentEffects,
    ]

    const calculations = parseCalculationData(
        level.coefficient,
        effectText,
        skillType,
    )

    const reviewIssues = [
        ...extraReviewIssues,
        ...effects.flatMap(effect => effect.reviewIssues),
        ...calculations.flatMap(item => item.reviewIssues),
    ]

    const uniqueReviewIssues = [...new Set(reviewIssues)]

    return {
        effects,
        calculations,
        cooldown,
        effectText,
        warnings: uniqueReviewIssues,
        reviewRequired:
            level.reviewRequired ||
            uniqueReviewIssues.length > 0 ||
            effects.some(effect => effect.reviewRequired) ||
            calculations.some(item => item.reviewRequired),
    }
}

/**
 * 取得指定技能、指定等級的效果，
 * 並套用所有已解鎖的對應天賦規則。
 *
 * 只讀取原始 EngineCharacter，
 * 不修改原始角色資料。
 */
export function getSkillEffectsWithTalent(
    character: EngineCharacter,
    skillSlot: SkillSlot,
    skillLevel: SkillLevel,
    selectedNode: TalentNodeSelection,
): SkillEffectsResult {
    const skill = character[skillSlot]
    const level = skill[skillLevel]

    // 每次都從原始技能效果文字開始，
    // 避免重複套用天賦造成效果累加。
    const originalSkillEffectText =
        level.originalEffectText ?? level.effectText

    let skillEffectText = originalSkillEffectText
    let cooldown = level.cooldown

    const talentEffectTexts: string[] = []
    const extraReviewIssues: string[] = []

    // 依照角色實際天賦頁數，取得可計算的最大節點
    const effectiveNode = getEffectiveTalentNode(
        character,
        selectedNode,
    )

    const targetNode = TALENT_NODE_BY_SKILL[skillSlot]

    // 只處理角色實際可解鎖的天賦節點
    if (effectiveNode >= targetNode) {
        const talentRules = character.talent.rules
            .filter(rule =>
                rule.targetSkill === skillSlot &&
                rule.node <= effectiveNode,
            )
            .sort((a, b) => a.node - b.node)

        for (const rule of talentRules) {
            // 新增效果：保留原效果，額外加入
            if (rule.operation === 'addEffect') {
                if (rule.reviewRequired) {
                    extraReviewIssues.push(
                        ...(rule.reviewIssues.length > 0
                            ? rule.reviewIssues
                            : ['天賦新增效果規則尚未確認']),
                    )
                    continue
                }

                if (!rule.replacement.trim()) {
                    extraReviewIssues.push(
                        `天賦 ${rule.node} 的新增效果內容為空`,
                    )
                    continue
                }

                talentEffectTexts.push(rule.replacement.trim())
                continue
            }

            // 冷卻時間獨立處理
            if (rule.operation === 'replaceCooldown') {
                const result = applyCooldownRule(
                    cooldown,
                    rule,
                )

                cooldown = result.cooldown
                extraReviewIssues.push(...result.reviewIssues)
                continue
            }

            // 其他修改作用於原技能效果文字
            const result = applyRuleToText(
                skillEffectText,
                rule,
            )

            skillEffectText = result.text
            extraReviewIssues.push(...result.reviewIssues)
        }
    }

    // 原技能原本就有的待確認資訊不可遺失
    if (level.reviewIssues.length > 0) {
        extraReviewIssues.push(...level.reviewIssues)
    } else if (level.reviewRequired) {
        extraReviewIssues.push('原始技能等級資料需要人工確認')
    }

    return refreshSkillLevel(
        level,
        skillEffectText,
        talentEffectTexts,
        skill.type,
        cooldown,
        extraReviewIssues,
    )
}
