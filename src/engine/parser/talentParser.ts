
/*
 * 天賦解析器
 *
 * 負責解析角色天賦9、12、15的效果，
 * 判斷各天賦修改哪個技能，以及修改的內容。
 *
 * 目前支援的天賦操作：
 * - 效果倍率變更
 * - 持續時間變更
 * - 治療倍率變更
 * - 發動機率變更
 * - 冷卻時間變更
 * - 新增效果
 *
 * 新增效果會保留效果原文中的動作文字。
 * 例如：
 * 「天賦12時2技能新增加自身小幅20%物攻15秒」
 *
 * 解析後的新增效果內容必須是：
 * 「加自身小幅20%物攻15秒」
 *
 * 不可將「加」一併當成「新增」的一部分移除，
 * 否則後續效果解析器將無法正確辨識增加動作。
 *
 * 如果天賦文字不符合目前建立的規則，
 * 系統會保留原始文字並標記待確認，不自行推測。
 */

import type {
    EngineTalentData,
    EngineTalentRule,
    TalentNode,
    TalentOperationType,
    TalentSkillSlot,
} from '../types/talent'

import {
    normalizeText,
    splitEffectText,
} from './textNormalizer'


function getTargetSkill(node: TalentNode): TalentSkillSlot {
    if (node === 9) return 'skill1'
    if (node === 12) return 'skill2'
    return 'ultimate'
}


function detectOperation(
    text: string
): {
    operation: TalentOperationType
    replacement: string
} {

    const cooldownMatch = text.match(
        /(?:CD|冷卻時間)\s*改為\s*(.+)/
    )

    if (cooldownMatch) {
        return {
            operation: 'replaceCooldown',
            replacement: cooldownMatch[1].trim(),
        }
    }


    const chanceMatch = text.match(
        /(?:機率|概率)\s*改為\s*(.+)/
    )

    if (chanceMatch) {
        return {
            operation: 'replaceChance',
            replacement: chanceMatch[1].trim(),
        }
    }


    const healingMatch = text.match(
        /(?:回血|治療)(?:效果)?\s*改為\s*(.+)/
    )

    if (healingMatch) {
        return {
            operation: 'replaceHealing',
            replacement: healingMatch[1].trim(),
        }
    }


    // 新增效果
    // 注意：這裡不能使用「新增加」作為完整匹配文字。
    // 因為「新增」後面的「加」屬於效果本身的動作。
    //
    // 例如：
    // 新增加自身小幅20%物攻15秒
    //
    // 必須保留為：
    // 加自身小幅20%物攻15秒

    const addMatch = text.match(
        /(?:新增|追加)\s*(.+)/
    )

    if (addMatch) {
        return {
            operation: 'addEffect',
            replacement: addMatch[1].trim(),
        }
    }


    const effectMatch = text.match(
        /(?:效果)?\s*改為\s*(.+)/
    )

    if (effectMatch) {
        const replacement = effectMatch[1].trim()

        if (/\d+(?:\.\d+)?秒/.test(replacement)) {
            return {
                operation: 'replaceDuration',
                replacement,
            }
        }

        if (/小幅|中幅|大幅|\d+(?:\.\d+)?%/.test(replacement)) {
            return {
                operation: 'replaceMagnitude',
                replacement,
            }
        }
    }


    return {
        operation: 'unknown',
        replacement: '',
    }
}


function createRule(
    text: string,
    node: TalentNode
): EngineTalentRule {

    const result = detectOperation(text)

    const reviewIssues: string[] = []

    if (result.operation === 'unknown') {
        reviewIssues.push('尚未建立此類天賦修改規則')
    }

    if (!result.replacement) {
        reviewIssues.push('無法取得天賦修改內容')
    }

    return {
        id: `talent_${node}_${Math.random().toString(36).slice(2, 8)}`,

        node,
        targetSkill: getTargetSkill(node),
        operation: result.operation,

        originalText: text,
        replacement: result.replacement,

        reviewRequired: reviewIssues.length > 0,
        reviewIssues,
    }
}


export function parseTalentText(
    text: string
): EngineTalentData {

    const normalized = normalizeText(text)
    const fragments = splitEffectText(normalized)

    const rules: EngineTalentRule[] = []
    const reviewIssues: string[] = []

    for (const fragment of fragments) {

        const match = fragment.match(
            /天賦\s*(9|12|15)\s*時\s*(.+)/
        )

        if (!match) {
            reviewIssues.push(`無法辨識天賦節點：${fragment}`)
            continue
        }

        const node = Number(match[1]) as TalentNode
        const description = match[2].trim()

        rules.push(createRule(description, node))
    }

    const ruleIssues = rules.flatMap(rule => rule.reviewIssues)

    return {
        originalText: normalized,
        rules,

        reviewRequired:
            reviewIssues.length > 0 ||
            ruleIssues.length > 0,

        reviewIssues: [
            ...reviewIssues,
            ...ruleIssues,
        ],
    }
}
