
/*
 * 這個檔案負責把已解鎖的天賦效果套用到技能。
 *
 * 目前支援：
 * - 修改技能效果倍率
 * - 修改技能治療倍率
 * - 修改技能持續時間
 * - 修改技能發動機率
 * - 在技能效果後新增效果
 * - 修改技能冷卻時間
 * - 同時修改初始與最大技能等級
 * - 天賦 6 增加普通攻擊倍率
 * - 天賦 9、12、15 增加對應技能主倍率
 *
 * 新增效果：
 * - 原技能效果使用 source: 'skill'
 * - 天賦新增效果使用 source: 'talent'
 * - 兩者合併保存於同一份 effects
 *
 * 天賦累積規則：
 * - 解鎖 9：套用 9
 * - 解鎖 12：套用 9、12
 * - 解鎖 15：套用 9、12、15
 *
 * 重要：
 * applyTalents() 每次都應接收原始角色資料，
 * 不可接收已經套用過天賦的結果。
 */

import type {
    EngineCharacter,
    EngineSkill,
    EngineSkillLevel,
} from '../types/character'

import type {
    EngineTalentRule,
    TalentUnlockState,
} from '../types/talent'

import { parseEffectText } from '../parser/effectParser'
import { parseCalculationData } from '../parser/calculationParser'


// ======================================================
// 建立失敗結果
// ======================================================

function failed(
    text: string,
    issue: string
) {
    return {
        text,
        reviewRequired: true,
        reviewIssues: [issue],
    }
}


// ======================================================
// 套用天賦規則至技能效果文字
// ======================================================

function applyRuleToText(
    text: string,
    rule: EngineTalentRule
) {
    if (rule.reviewRequired) {
        return failed(text, '天賦規則尚未確認')
    }

    const replacement = rule.replacement

    switch (rule.operation) {

        // 修改效果倍率
        case 'replaceMagnitude': {

            const matches = text.match(
                /(?:小幅|中幅|大幅)(?:\s*\d+(?:\.\d+)?%)?/g
            ) ?? []

            if (matches.length !== 1) {
                return failed(
                    text,
                    '效果倍率數量不是唯一，需人工確認'
                )
            }

            return {
                text: text.replace(
                    /(?:小幅|中幅|大幅)(?:\s*\d+(?:\.\d+)?%)?/,
                    replacement
                ),
                reviewRequired: false,
                reviewIssues: [],
            }
        }

        // 修改治療倍率
        case 'replaceHealing': {

            const matches = text.match(
                /(?:回血|治療)\s*\d+(?:\.\d+)?%/g
            ) ?? []

            if (matches.length !== 1) {
                return failed(
                    text,
                    '無法唯一定位治療倍率'
                )
            }

            return {
                text: text.replace(
                    /((?:回血|治療)\s*)\d+(?:\.\d+)?%/,
                    `$1${replacement}`
                ),
                reviewRequired: false,
                reviewIssues: [],
            }
        }

        // 修改發動機率
        case 'replaceChance': {

            const matches = text.match(
                /\d+(?:\.\d+)?%\s*(?=機率|概率)/g
            ) ?? []

            if (matches.length !== 1) {
                return failed(
                    text,
                    '無法唯一定位發動機率'
                )
            }

            return {
                text: text.replace(
                    /\d+(?:\.\d+)?%(\s*(?:機率|概率))/,
                    `${replacement}$1`
                ),
                reviewRequired: false,
                reviewIssues: [],
            }
        }

        // 修改持續時間
        // 修改持續時間
        case 'replaceDuration': {

            if (!/^\d+(?:\.\d+)?秒$/.test(replacement)) {
                return failed(
                    text,
                    '天賦提供的時間格式無法辨識'
                )
            }

            const matches = text.match(
                /\d+(?:\.\d+)?秒/g
            ) ?? []

            if (matches.length !== 1) {
                return failed(
                    text,
                    matches.length === 0
                        ? '找不到可替換的持續時間'
                        : '持續時間不只一處，需人工確認'
                )
            }

            return {
                text: text.replace(
                    /\d+(?:\.\d+)?秒/,
                    replacement
                ),
                reviewRequired: false,
                reviewIssues: [],
            }
        }

        // 冷卻時間由技能等級資料處理
        case 'replaceCooldown': {

            return failed(
                text,
                '冷卻時間應由技能等級資料處理'
            )
        }

        // 新增效果由獨立流程處理
        case 'addEffect': {

            return failed(
                text,
                '新增效果應由獨立解析流程處理'
            )
        }

        default:

            return failed(
                text,
                '尚未支援此天賦修改方式'
            )
    }
}


// ======================================================
// 重新整理技能等級資料
// ======================================================

function refreshSkillLevel(
    level: EngineSkillLevel,
    skillEffectText: string,
    talentEffectTexts: string[],
    skillType: string,
    extraReviewIssues: string[] = []
): EngineSkillLevel {

    // 原技能效果獨立解析
    const skillEffects = parseEffectText(
        skillEffectText,
        'skill'
    )

    // 每組天賦新增效果獨立解析
    // 某一組解析失敗，不會影響其他組
    const talentEffects = talentEffectTexts.flatMap(text =>
        parseEffectText(text, 'talent')
    )

    // 合併效果文字，供原本的計算解析流程使用
    const effectText = [
        skillEffectText,
        ...talentEffectTexts,
    ]
        .filter(text => text.trim().length > 0)
        .join('；')

    // 合併效果資料
    const effects = [
        ...skillEffects,
        ...talentEffects,
    ]

    // 重新解析技能倍率與計算資料
    const calculations = parseCalculationData(
        level.coefficient,
        effectText,
        skillType
    )

    // 重新整理所有待確認項目
    const reviewIssues = [
        ...level.reviewIssues,
        ...extraReviewIssues,
        ...effects.flatMap(effect => effect.reviewIssues),
        ...calculations.flatMap(item => item.reviewIssues),
    ]

    return {
        ...level,

        effectText,

        effects,
        calculations,

        reviewRequired: reviewIssues.length > 0,
        reviewIssues,
    }
}


// ======================================================
// 套用冷卻時間修改
// ======================================================

function applyCooldownRule(
    level: EngineSkillLevel,
    rule: EngineTalentRule
): EngineSkillLevel {

    if (rule.reviewRequired) {
        return {
            ...level,
            reviewRequired: true,
            reviewIssues: [
                ...level.reviewIssues,
                '天賦規則尚未確認',
            ],
        }
    }

    if (!/^\d+(?:\.\d+)?秒?$/.test(rule.replacement)) {
        return {
            ...level,
            reviewRequired: true,
            reviewIssues: [
                ...level.reviewIssues,
                '天賦冷卻時間格式無法辨識',
            ],
        }
    }

    return {
        ...level,
        cooldown: rule.replacement.replace(/秒$/, ''),
    }
}


// ======================================================
// 將天賦規則套用至單一技能等級
// ======================================================


function applyRulesToLevel(
    level: EngineSkillLevel,
    rules: EngineTalentRule[],
    skillType: string
): EngineSkillLevel {

    // 保存天賦修改前的技能效果文字
    // 如果已經有保存過，就沿用原本的資料
    const originalSkillEffectText =
        level.originalEffectText ?? level.effectText

    // 原技能文字與天賦新增效果分開保存
    let skillEffectText = level.effectText

    const talentEffectTexts: string[] = []

    const extraReviewIssues: string[] = []

    for (const rule of rules) {

        // 新增效果獨立保存，不直接混入原技能文字
        if (rule.operation === 'addEffect') {

            if (rule.reviewRequired) {
                extraReviewIssues.push('天賦新增效果規則尚未確認')
                continue
            }

            if (!rule.replacement.trim()) {
                extraReviewIssues.push('天賦新增效果內容為空')
                continue
            }

            talentEffectTexts.push(rule.replacement.trim())

            continue
        }

        // 冷卻時間獨立處理
        if (rule.operation === 'replaceCooldown') {

            const result = applyCooldownRule(
                {
                    ...level,
                    effectText: skillEffectText,
                    reviewIssues: [],
                },
                rule
            )

            if (result.reviewIssues.length > 0) {
                extraReviewIssues.push(
                    ...result.reviewIssues
                )
            }

            // 保留成功修改後的冷卻時間
            level = {
                ...level,
                cooldown: result.cooldown,
            }

            continue
        }

        // 其他效果修改只作用於原技能文字
        const result = applyRuleToText(
            skillEffectText,
            rule
        )

        skillEffectText = result.text

        extraReviewIssues.push(
            ...result.reviewIssues
        )
    }

    // 最後才重新解析全部效果
    return refreshSkillLevel(
        {
            ...level,
            originalEffectText: originalSkillEffectText,
        },
        skillEffectText,
        talentEffectTexts,
        skillType,
        extraReviewIssues
    )
}


// ======================================================
// 將天賦規則套用至技能
// ======================================================

function applyRulesToSkill(
    skill: EngineSkill,
    rules: EngineTalentRule[]
): EngineSkill {

    // 沒有天賦規則時，保留原始技能資料
    if (rules.length === 0) {
        return skill
    }

    return {
        ...skill,

        initial: applyRulesToLevel(
            skill.initial,
            rules,
            skill.type
        ),

        max: applyRulesToLevel(
            skill.max,
            rules,
            skill.type
        ),
    }
}


// ======================================================
// 套用主技能倍率增加
// ======================================================

function applyMultiplierToLevel(
    level: EngineSkillLevel,
    increase: number,
    skillType: string
): EngineSkillLevel {

    const originalCoefficient = level.coefficient.trim()
    const numericCoefficient = Number(originalCoefficient)

    // 無法安全轉換時，保留原始資料並標記待確認
    if (
        originalCoefficient === '' ||
        !Number.isFinite(numericCoefficient)
    ) {
        return {
            ...level,
            reviewRequired: true,
            reviewIssues: [
                ...level.reviewIssues,
                '天賦主倍率無法套用：原始技能倍率不是有效數字',
            ],
        }
    }

    // GAS 數值是倍率增加量
    // 例如 0.11 代表增加 11 個百分點
    const newCoefficient = Number(
        (numericCoefficient + increase).toFixed(10)
    ).toString()

    const updatedLevel = {
        ...level,
        coefficient: newCoefficient,
    }

    // 倍率改變後重新解析計算資料
    return refreshSkillLevel(
        updatedLevel,
        updatedLevel.effectText,
        [],
        skillType
    )
}


// ======================================================
// 套用倍率增加至整個技能
// ======================================================

function applyMultiplierToSkill(
    skill: EngineSkill,
    multiplier: {
        status: string
        value: number | null
    }
): EngineSkill {

    // none 與 unknown 都不增加主倍率
    if (multiplier.status !== 'increase') {
        return skill
    }

    // increase 卻沒有有效數值，標記待確認
    if (
        multiplier.value === null ||
        !Number.isFinite(multiplier.value)
    ) {
        const issue = '天賦主倍率標記為增加，但沒有有效增加數值'

        return {
            ...skill,

            initial: {
                ...skill.initial,
                reviewRequired: true,
                reviewIssues: [
                    ...skill.initial.reviewIssues,
                    issue,
                ],
            },

            max: {
                ...skill.max,
                reviewRequired: true,
                reviewIssues: [
                    ...skill.max.reviewIssues,
                    issue,
                ],
            },
        }
    }

    return {
        ...skill,

        initial: applyMultiplierToLevel(
            skill.initial,
            multiplier.value,
            skill.type
        ),

        max: applyMultiplierToLevel(
            skill.max,
            multiplier.value,
            skill.type
        ),
    }
}


// ======================================================
// 計算實際解鎖的天賦節點
// ======================================================

function getUnlockedNodes(
    unlockState: TalentUnlockState
): {
    node9: boolean
    node12: boolean
    node15: boolean
} {

    // 高階天賦解鎖時，自動包含低階天賦
    const node15 = unlockState.node15

    const node12 = unlockState.node12 || node15

    const node9 = unlockState.node9 || node12

    return {
        node9,
        node12,
        node15,
    }
}


// ======================================================
// 對外入口：套用已解鎖天賦
// ======================================================

export function applyTalents(
    character: EngineCharacter,
    unlockState: TalentUnlockState
): EngineCharacter {

    // 每次都從原始角色資料開始
    let result = { ...character }

    // 統一計算累積解鎖狀態
    const unlocked = getUnlockedNodes(unlockState)

    // --------------------------------------------------
    // 天賦 6：普通攻擊倍率增加
    // --------------------------------------------------

    if (unlockState.node6) {
        result = {
            ...result,

            normalAttack: {
                initial: character.normalAttack.initial + 0.10,
                max: character.normalAttack.max + 0.10,
            },
        }
    }

    // --------------------------------------------------
    // 天賦 9、12、15：角色個別主技能倍率增加
    // --------------------------------------------------

    if (unlocked.node9) {
        result = {
            ...result,
            skill1: applyMultiplierToSkill(
                result.skill1,
                character.talentMultipliers.talent9
            ),
        }
    }

    if (unlocked.node12) {
        result = {
            ...result,
            skill2: applyMultiplierToSkill(
                result.skill2,
                character.talentMultipliers.talent12
            ),
        }
    }

    if (unlocked.node15) {
        result = {
            ...result,
            ultimate: applyMultiplierToSkill(
                result.ultimate,
                character.talentMultipliers.talent15
            ),
        }
    }

    // --------------------------------------------------
    // 篩選已解鎖的天賦效果規則
    // --------------------------------------------------

    const unlockedRules = character.talent.rules.filter(rule => {

        if (rule.node === 9) {
            return unlocked.node9 &&
                rule.targetSkill === 'skill1'
        }

        if (rule.node === 12) {
            return unlocked.node12 &&
                rule.targetSkill === 'skill2'
        }

        if (rule.node === 15) {
            return unlocked.node15 &&
                rule.targetSkill === 'ultimate'
        }

        return false
    })

    // --------------------------------------------------
    // 依照技能分類規則
    // --------------------------------------------------

    const skill1Rules = unlockedRules.filter(
        rule => rule.targetSkill === 'skill1'
    )

    const skill2Rules = unlockedRules.filter(
        rule => rule.targetSkill === 'skill2'
    )

    const ultimateRules = unlockedRules.filter(
        rule => rule.targetSkill === 'ultimate'
    )

    // --------------------------------------------------
    // 套用至各技能
    // --------------------------------------------------

    result = {
        ...result,

        skill1: applyRulesToSkill(
            result.skill1,
            skill1Rules
        ),

        skill2: applyRulesToSkill(
            result.skill2,
            skill2Rules
        ),

        ultimate: applyRulesToSkill(
            result.ultimate,
            ultimateRules
        ),
    }

    // --------------------------------------------------
    // 重新整理角色層級的待確認資訊
    // --------------------------------------------------

    const allLevels = [
        result.ultimate.initial,
        result.ultimate.max,
        result.skill2.initial,
        result.skill2.max,
        result.skill1.initial,
        result.skill1.max,
    ]

    const reviewIssues = [
        ...character.talent.reviewIssues,
        ...allLevels.flatMap(level => level.reviewIssues),
    ]

    return {
        ...result,

        reviewRequired:
            character.talent.reviewRequired ||
            reviewIssues.length > 0,

        reviewIssues,
    }
}
