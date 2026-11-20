
import type { EngineConditionalBonus } from './effect'

// 負責定義未來強度計算和戰鬥模擬使用的數值格式。

export type CalculationKind =
    | 'damage'
    | 'healing'
    | 'buff'
    | 'debuff'
    | 'ultimateGauge'
    | 'unknown'

export interface EngineCalculation {
    kind: CalculationKind

    // 原始倍率文字
    coefficient: string

    // 解析後的數值
    numericValue: number | null

    // 原始文字
    originalText: string

    // 條件式傷害加成
    conditionalBonuses: EngineConditionalBonus[]

    // 是否需要人工確認
    reviewRequired: boolean

    reviewIssues: string[]
}
