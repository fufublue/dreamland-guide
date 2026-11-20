
import type {
    CharacterCombatStats,
    SkillHealingResult,
    StrengthSkillKey,
} from '../types'

export type HealingCalculationInput = {
    skillKey: StrengthSkillKey
    stats: Pick<CharacterCombatStats, 'healing'>
    coefficient: number | null

    // 角色突破治療特性，使用百分點格式
    // 例如 10 代表 10%
    breakthroughTraitHealingBonus?: number | null

    // 掛件治癒特性，使用百分點格式
    // 例如 15 代表 15%
    hangingTraitHealingBonus?: number | null
}

/**
 * 計算技能治療量。
 *
 * 治療量 = 治療力 × 技能治療倍率
 *        × (1 + (角色治療特性 + 掛件治癒特性) / 100)
 *
 * coefficient 使用百分比數值：
 * 例如 180 代表 180%。
 */
export function calculateSkillHealing({
    skillKey,
    stats,
    coefficient,
    breakthroughTraitHealingBonus = 0,
    hangingTraitHealingBonus = 0,
}: HealingCalculationInput): SkillHealingResult {
    const warnings: string[] = []

    // 檢查技能治療倍率
    if (
        coefficient === null ||
        !Number.isFinite(coefficient)
    ) {
        warnings.push('缺少有效的技能治療倍率，無法計算治療量。')
    } else if (coefficient < 0) {
        warnings.push('技能治療倍率不可為負數。')
    }

    // 檢查角色治療力
    if (
        stats.healing === null ||
        !Number.isFinite(stats.healing)
    ) {
        warnings.push('缺少有效的角色治療力，無法計算治療量。')
    } else if (stats.healing < 0) {
        warnings.push('角色治療力不可為負數。')
    }

    // 檢查角色突破治療特性
    if (
        breakthroughTraitHealingBonus != null &&
        !Number.isFinite(breakthroughTraitHealingBonus)
    ) {
        warnings.push('角色治療特性缺少有效數值。')
    } else if (
        breakthroughTraitHealingBonus != null &&
        breakthroughTraitHealingBonus < 0
    ) {
        warnings.push('角色治療特性不可為負數。')
    }

    // 檢查掛件治癒特性
    if (
        hangingTraitHealingBonus != null &&
        !Number.isFinite(hangingTraitHealingBonus)
    ) {
        warnings.push('掛件治癒特性缺少有效數值。')
    } else if (
        hangingTraitHealingBonus != null &&
        hangingTraitHealingBonus < 0
    ) {
        warnings.push('掛件治癒特性不可為負數。')
    }

    // 任何必要資料無效時，都不產生治療數字
    if (warnings.length > 0) {
        return {
            skillKey,
            coefficient,
            healing: null,
            warnings,
        }
    }

    // 角色治療特性與掛件治癒特性採加算
    const totalHealingBonus =
        (breakthroughTraitHealingBonus ?? 0) +
        (hangingTraitHealingBonus ?? 0)

    const healing =
        stats.healing! *
        (coefficient! / 100) *
        (1 + totalHealingBonus / 100)

    return {
        skillKey,
        coefficient,
        healing,
        warnings,
    }
}
