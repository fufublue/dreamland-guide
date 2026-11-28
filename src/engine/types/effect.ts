
// 負責定義技能效果的資料格式。

export type EffectAction =
    | 'increase'
    | 'decrease'
    | 'heal'
    | 'clear'
    | 'other'

export type EffectTargetSide =
    | 'ally'
    | 'enemy'
    | 'self'
    | 'unknown'

export type EffectRange =
    | 'all'
    | 'single'
    | 'unknown'

export type EffectCategory =
    | 'attack'
    | 'defense'
    | 'speed'
    | 'ultimateGauge'
    | 'elementDamage'
    | 'criticalRate'
    | 'criticalDamage'
    | 'control'
    | 'damageOverTime'
    | 'healing'
    | 'special'
    | 'unknown'

// 條件式傷害加成
export interface EngineConditionalBonus {
    condition: 'selfHpAtLeast'

    // 生命值門檻，例如 90%
    threshold: string

    // 額外傷害，例如 80%
    bonusCoefficient: string

    // 原文括號內的倍率，例如 386%
    displayedCoefficient: string

    originalText: string
}

export interface EngineCalculationEffect {
    kind:
    | 'damage'
    | 'healing'
    | 'buff'
    | 'debuff'
    | 'ultimateGauge'
    | 'unknown'

    coefficient: string
    sourceText: string
    reviewRequired: boolean
}

export interface EngineEffect {
    id: string

    action: EffectAction
    targetSide: EffectTargetSide
    range: EffectRange

    /** 最大值模式環境減益可指定單一敵人實例。 */
    targetEnemyId?: string | null

    category: EffectCategory

    // 例如：物攻、魔攻、速度、火抗、風傷
    attribute: string

    // 供搜尋使用的分類
    searchableCategories: EffectCategory[]

    // 例如：小幅20%、中幅40%
    magnitude: string

    // 數值，例如：20%
    value: string

    // 持續時間，例如：15秒
    duration: string

    // 發動機率
    chance: string

    originalText: string

    source: 'skill' | 'talent'

    calculations: EngineCalculationEffect[]

    reviewRequired: boolean
    reviewIssues: string[]
}
