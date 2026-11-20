
/*
這個檔案負責解析技能倍率與可供計算使用的數值。

目前不會擅自認定遊戲的傷害公式，也不會把所有百分比都當成傷害倍率。

numericValue 只代表解析出的百分比數字，
還不是最後計算時使用的倍率。

目前支援：
- 一般技能倍率
- 治療倍率
- 攻擊與防禦增減
- 條件式傷害加成
- 攻擊技能附帶的治療倍率
*/

import type {
    EngineCalculation,
    CalculationKind,
} from '../types/calculation'

import type {
    EngineConditionalBonus,
} from '../types/effect'

import { normalizeText } from './textNormalizer'


function detectCalculationKind(
    text: string
): CalculationKind {

    if (/治療|回血/.test(text)) {
        return 'healing'
    }

    if (/必殺值/.test(text)) {
        return 'ultimateGauge'
    }

    if (/降低|減少|下降|削弱|降/.test(text)) {
        return 'debuff'
    }

    if (/增加|提升|提高|上升|加/.test(text)) {
        return 'buff'
    }

    if (/傷害|攻擊/.test(text)) {
        return 'damage'
    }

    return 'unknown'
}


// ======================================================
// 解析數值
// ======================================================

function parseNumericValue(text: string): number | null {

    const normalized = normalizeText(text)

    const match = normalized.match(
        /^(\d+(?:\.\d+)?)%?$/
    )

    if (!match) {
        return null
    }

    const value = Number(match[1])

    return Number.isFinite(value) ? value : null
}


// ======================================================
// 解析條件式傷害
// ======================================================

function parseConditionalBonuses(
    text: string
): EngineConditionalBonus[] {

    const normalized = normalizeText(text)

    const pattern =
        /自身生命\s*(\d+(?:\.\d+)?)%\s*以上\s*\+\s*(\d+(?:\.\d+)?)%(?:傷害)?\s*[（(]\s*(\d+(?:\.\d+)?)%\s*[）)]/g

    const bonuses: EngineConditionalBonus[] = []

    let match: RegExpExecArray | null

    while ((match = pattern.exec(normalized)) !== null) {

        bonuses.push({
            condition: 'selfHpAtLeast',

            threshold: `${match[1]}%`,

            bonusCoefficient: `${match[2]}%`,

            displayedCoefficient: `${match[3]}%`,

            originalText: match[0],
        })
    }

    return bonuses
}


// ======================================================
// 建立計算資料
// ======================================================

function createCalculation(
    kind: CalculationKind,
    coefficient: string,
    originalText: string,
    conditionalBonuses: EngineConditionalBonus[] = []
): EngineCalculation {

    const numericValue = parseNumericValue(coefficient)

    const reviewIssues: string[] = []

    if (kind === 'unknown') {
        reviewIssues.push('無法確認數值用途')
    }

    if (coefficient && numericValue === null) {
        reviewIssues.push('無法解析技能倍率')
    }

    return {
        kind,
        coefficient,
        numericValue,
        originalText,
        conditionalBonuses,
        reviewRequired: reviewIssues.length > 0,
        reviewIssues,
    }
}


// ======================================================
// 解析附帶治療倍率
// ======================================================

function parseAdditionalHealing(
    effectText: string
): EngineCalculation[] {

    const normalized = normalizeText(effectText)

    // 支援：
    // 全體回血360%
    // 單體回血180%
    // 自身回血100%

    const pattern =
        /(?:全體|單體|自身)?回血\s*(\d+(?:\.\d+)?)%/g

    const calculations: EngineCalculation[] = []

    let match: RegExpExecArray | null

    while ((match = pattern.exec(normalized)) !== null) {

        calculations.push(
            createCalculation(
                'healing',
                `${match[1]}%`,
                match[0]
            )
        )
    }

    return calculations
}


// ======================================================
// 對外解析入口
// ======================================================

export function parseCalculationData(
    coefficient: string,
    effectText: string,
    skillType = ''
): EngineCalculation[] {

    const normalizedCoefficient = normalizeText(coefficient)
    const normalizedEffect = normalizeText(effectText)
    const normalizedSkillType = normalizeText(skillType)

    if (!normalizedCoefficient && !normalizedEffect) {
        return []
    }

    // 優先依照資料庫的技能類型判斷主倍率用途。
    // 避免攻擊技能因為附帶回血而被誤判成純治療技能。
    const kind = normalizedSkillType
        ? detectCalculationKind(normalizedSkillType)
        : detectCalculationKind(normalizedEffect)

    const calculations: EngineCalculation[] = []

    // 解析技能主倍率
    if (normalizedCoefficient) {

        calculations.push(
            createCalculation(
                kind,
                normalizedCoefficient,
                normalizedEffect,
                kind === 'damage'
                    ? parseConditionalBonuses(normalizedEffect)
                    : []
            )
        )
    }

    // 攻擊技能額外解析附帶的治療倍率。
    // 純回血技能的主倍率已經是治療倍率，不重複解析。
    if (kind !== 'healing' && normalizedEffect) {

        calculations.push(
            ...parseAdditionalHealing(normalizedEffect)
        )
    }

    return calculations
}
