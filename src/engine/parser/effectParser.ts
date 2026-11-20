
/*
 * 效果解析器
 *
 * 負責將角色技能與天賦中的效果文字，
 * 轉換成統一的 EngineEffect 資料。
 *
 * 判斷原則：
 * 1. 明確寫出自身時，目標為自身。
 * 2. 明確寫出敵方或我方時，優先採用文字。
 * 3. 有利狀態預設作用於我方。
 * 4. 不利狀態預設作用於敵方。
 * 5. 嘲諷、退場等特殊效果依照個別規則判斷。
 * 6. 全體無敵預設作用於我方全體。
 * 7. 天賦新增效果額外檢查必要資訊。
 */

import type {
    EngineEffect,
    EffectAction,
    EffectCategory,
    EffectRange,
    EffectTargetSide,
} from '../types/effect'

import {
    extractDuration,
    normalizeText,
    splitEffectText,
} from './textNormalizer'


// ======================================================
// 效果分類對照表
// ======================================================

const attributeMap: Record<string, EffectCategory> = {

    // 攻擊
    '物攻': 'attack',
    '魔攻': 'attack',
    '雙攻': 'attack',

    // 防禦
    '物防': 'defense',
    '魔防': 'defense',
    '雙防': 'defense',

    // 七種屬性抗性
    '火屬性抗性': 'defense',
    '水屬性抗性': 'defense',
    '風屬性抗性': 'defense',
    '地屬性抗性': 'defense',
    '雷屬性抗性': 'defense',
    '光屬性抗性': 'defense',
    '暗屬性抗性': 'defense',

    '火抗': 'defense',
    '水抗': 'defense',
    '風抗': 'defense',
    '地抗': 'defense',
    '雷抗': 'defense',
    '光抗': 'defense',
    '暗抗': 'defense',

    // 速度
    '速度': 'speed',

    // 必殺值
    '必殺值': 'ultimateGauge',

    // 暴擊率
    '暴擊率': 'criticalRate',
    '爆擊率': 'criticalRate',

    // 暴擊傷害
    '暴擊傷害': 'criticalDamage',
    '爆擊傷害': 'criticalDamage',
    '爆傷': 'criticalDamage',

    // 七種屬性傷害
    '火屬性傷害': 'attack',
    '水屬性傷害': 'attack',
    '風屬性傷害': 'attack',
    '地屬性傷害': 'attack',
    '雷屬性傷害': 'attack',
    '光屬性傷害': 'attack',
    '暗屬性傷害': 'attack',

    // 七種屬性傷害簡稱
    '火傷': 'attack',
    '水傷': 'attack',
    '風傷': 'attack',
    '地傷': 'attack',
    '雷傷': 'attack',
    '光傷': 'attack',
    '暗傷': 'attack',

    // 控制效果
    '束縛': 'control',
    '封印': 'control',
    '黑暗': 'control',
    '嘲諷': 'control',

    // 持續傷害
    '中毒': 'damageOverTime',
    '灼傷': 'damageOverTime',
    '持續傷害': 'damageOverTime',

    // 治療
    '回血': 'healing',
    '治療': 'healing',

    // 特殊效果
    '無敵': 'special',
    '自爆': 'special',
    '退場': 'special',
    '有害狀態': 'special',
    '屬性下降': 'special',
}


// ======================================================
// 基本工具
// ======================================================

function createId(): string {
    return `effect_${Math.random().toString(36).slice(2, 10)}`
}


// ======================================================
// 判斷效果動作
// ======================================================

function detectAction(text: string): EffectAction {

    if (/回血|治療/.test(text)) {
        return 'heal'
    }

    if (/解除|清除|驅散/.test(text)) {
        return 'clear'
    }

    if (/降低|減少|下降|削弱|扣除|^降/.test(text)) {
        return 'decrease'
    }

    if (/增加|提升|提高|上升|獲得|附加|^加/.test(text)) {
        return 'increase'
    }

    return 'other'
}


// ======================================================
// 判斷效果目標
// ======================================================

function detectTargetSide(
    text: string,
    action: EffectAction,
    category: EffectCategory
): EffectTargetSide {

    // 1. 明確寫出自身
    if (/自身|自己/.test(text)) {
        return 'self'
    }

    // 2. 明確寫出敵方
    if (/敵方|敵人|對方/.test(text)) {
        return 'enemy'
    }

    // 3. 明確寫出我方
    if (/我方|友方|隊友/.test(text)) {
        return 'ally'
    }

    // 4. 嘲諷固定視為自身效果
    if (/嘲諷/.test(text)) {
        return 'self'
    }

    // 5. 立即退場視為自身效果
    if (/退場/.test(text)) {
        return 'self'
    }

    // 6. 無敵預設為我方效果
    if (/無敵/.test(text)) {
        return 'ally'
    }

    // 7. 有利狀態預設作用於我方
    if (
        action === 'increase' ||
        action === 'heal' ||
        action === 'clear'
    ) {
        return 'ally'
    }

    // 8. 不利狀態預設作用於敵方
    if (
        action === 'decrease' ||
        category === 'control' ||
        category === 'damageOverTime'
    ) {
        return 'enemy'
    }

    return 'unknown'
}


// ======================================================
// 判斷效果範圍
// ======================================================

function detectRange(text: string): EffectRange {

    if (/全體|全隊|所有/.test(text)) {
        return 'all'
    }

    if (/單體|單一/.test(text)) {
        return 'single'
    }

    if (/自身|自己|嘲諷|退場/.test(text)) {
        return 'single'
    }

    return 'unknown'
}


// ======================================================
// 判斷效果分類
// ======================================================

function detectAttribute(text: string): {
    attribute: string
    category: EffectCategory
} {

    // 優先比對較長名稱
    const attributes = Object.keys(attributeMap)
        .sort((a, b) => b.length - a.length)

    for (const attribute of attributes) {

        if (text.includes(attribute)) {
            return {
                attribute,
                category: attributeMap[attribute],
            }
        }
    }

    return {
        attribute: '',
        category: 'unknown',
    }
}


// ======================================================
// 判斷發動機率
// ======================================================

function detectChance(text: string): string {

    const match = text.match(
        /(\d+(?:\.\d+)?%)\s*(?:機率|概率)/
    )

    return match?.[1] ?? ''
}


// ======================================================
// 判斷效果倍率
// ======================================================

function detectValue(text: string): string {

    const withoutChance = text.replace(
        /\d+(?:\.\d+)?%\s*(?:機率|概率)/,
        ''
    )

    const match = withoutChance.match(
        /\d+(?:\.\d+)?%/
    )

    return match?.[0] ?? ''
}


// ======================================================
// 判斷已知特殊效果
// ======================================================

function isKnownNonDirectionalEffect(
    category: EffectCategory
): boolean {

    return (
        category === 'control' ||
        category === 'special' ||
        category === 'damageOverTime'
    )
}


// ======================================================
// 判斷特殊新增效果
// ======================================================

function isTauntEffect(text: string): boolean {
    return /嘲諷/.test(text)
}

function isClearEffect(action: EffectAction): boolean {
    return action === 'clear'
}


// ======================================================
// 排除條件式技能傷害
// ======================================================

function isConditionalDamageText(text: string): boolean {

    return /自身生命\s*\d+(?:\.\d+)?%\s*以上\s*\+\s*\d+(?:\.\d+)?%(?:傷害)?/.test(text)
}


// ======================================================
// 檢查天賦新增效果
// ======================================================

function checkTalentEffect(
    text: string,
    action: EffectAction,
    category: EffectCategory,
    range: EffectRange,
    magnitude: string,
    value: string,
    duration: string
): string[] {

    const issues: string[] = []

    const isTaunt = isTauntEffect(text)
    const isClear = isClearEffect(action)

    // 狀態效果不要求額外標示幅度及持續時間
    const isStatusEffect = (
        category === 'control' ||
        category === 'damageOverTime'
    )

    // 一般新增效果需要明確標示作用對象
    // 嘲諷固定作用於自身，不需要另外標示
    if (
        range === 'unknown' &&
        !isTaunt
    ) {
        issues.push('新增效果缺少作用對象')
    }

    // 必殺值、狀態效果、清除效果、嘲諷不需要一般幅度
    const doesNotRequireMagnitude = (
        category === 'ultimateGauge' ||
        isStatusEffect ||
        isClear ||
        isTaunt
    )

    if (
        !doesNotRequireMagnitude &&
        !/(大幅|中幅|小幅)/.test(magnitude)
    ) {
        issues.push('新增效果缺少幅度')
    }

    // 必殺值、狀態效果、清除效果、嘲諷不需要持續時間
    if (
        category !== 'ultimateGauge' &&
        !isStatusEffect &&
        !isClear &&
        !isTaunt &&
        !duration
    ) {
        issues.push('新增效果缺少持續時間')
    }

    // 百分比數值必須是大於 0 的整數
    if (value) {

        const number = Number(
            value.replace('%', '')
        )

        if (
            !Number.isInteger(number) ||
            number <= 0
        ) {
            issues.push('新增效果百分比必須是大於0的整數')
        }
    }

    // 持續時間必須是大於 0 的整數秒
    if (duration) {

        const durationMatch = text.match(
            /(\d+(?:\.\d+)?)\s*秒/
        )

        if (durationMatch) {

            const number = Number(durationMatch[1])

            if (
                !Number.isInteger(number) ||
                number <= 0
            ) {
                issues.push('新增效果持續時間必須是大於0的整數秒')
            }
        }
    }

    return issues
}


// ======================================================
// 解析單一效果
// ======================================================

function parseSingleEffect(
    text: string,
    source: 'skill' | 'talent'
): EngineEffect {

    const normalized = normalizeText(text)

    const attributeInfo = detectAttribute(normalized)

    const action = detectAction(normalized)

    const targetSide = detectTargetSide(
        normalized,
        action,
        attributeInfo.category
    )

    const range = detectRange(normalized)

    // 先排除發動機率，避免把機率誤認成效果幅度
    const textWithoutChance = normalized.replace(
        /\d+(?:\.\d+)?%\s*(?:機率|概率)/,
        ''
    )

    const magnitudeMatch = textWithoutChance.match(
        /(小幅|中幅|大幅)?\s*\d+(?:\.\d+)?%/
    )

    const magnitude =
        magnitudeMatch?.[0]?.replace(/\s/g, '') ?? ''

    const value = detectValue(normalized)

    const duration = extractDuration(normalized)

    const chance = detectChance(normalized)

    const reviewIssues: string[] = []

    // 基本解析檢查
    if (attributeInfo.category === 'unknown') {
        reviewIssues.push('無法辨識效果分類')
    }

    if (targetSide === 'unknown') {
        reviewIssues.push('無法確認效果目標')
    }

    if (range === 'unknown') {
        reviewIssues.push('無法確認效果範圍')
    }

    if (
        action === 'other' &&
        !isKnownNonDirectionalEffect(attributeInfo.category)
    ) {
        reviewIssues.push('無法確認效果動作')
    }

    // 只有天賦新增效果額外檢查規則
    if (source === 'talent') {

        reviewIssues.push(
            ...checkTalentEffect(
                normalized,
                action,
                attributeInfo.category,
                range,
                magnitude,
                value,
                duration
            )
        )
    }

    return {
        id: createId(),

        action,
        targetSide,
        range,

        category: attributeInfo.category,
        attribute: attributeInfo.attribute,

        searchableCategories:
            attributeInfo.category === 'unknown'
                ? ['unknown']
                : [attributeInfo.category],

        magnitude,
        value,
        duration,
        chance,

        originalText: normalized,
        source,

        calculations: [],

        reviewRequired: reviewIssues.length > 0,
        reviewIssues,
    }
}


// ======================================================
// 對外解析入口
// ======================================================

export function parseEffectText(
    text: string,
    source: 'skill' | 'talent' = 'skill'
): EngineEffect[] {

    const fragments = splitEffectText(text)

    return fragments
        .filter(fragment => fragment.trim().length > 0)
        .filter(fragment => !isConditionalDamageText(normalizeText(fragment)))
        .map(fragment => parseSingleEffect(fragment, source))
}
