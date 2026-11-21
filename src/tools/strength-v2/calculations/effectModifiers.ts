
import type { EngineEffect } from '../../../engine/types/effect'
import type { TimedEffect } from './effectTimeline'

// 效果數值的分類
export type EffectModifierKind =
    | 'physicalAttack'
    | 'magicAttack'
    | 'bothAttack'
    | 'physicalDefense'
    | 'magicDefense'
    | 'bothDefense'
    | 'elementDamage'
    | 'elementResistance'
    | 'criticalRate'
    | 'criticalDamage'
    | 'speed'
    | 'other'

// 可供後續傷害計算使用的效果資料
export interface EffectModifier {
    effectKey: string
    kind: EffectModifierKind

    action: 'increase' | 'decrease'
    targetSide: EngineEffect['targetSide']
    range: EngineEffect['range']

    attribute: string
    value: number

    appliedAt: number
    expiresAt: number | null
}

// 依照解析器產生的 attribute 判斷效果種類
function getEffectModifierKind(
    attribute: string,
): EffectModifierKind {
    switch (attribute) {
        case '物攻':
            return 'physicalAttack'

        case '魔攻':
            return 'magicAttack'

        case '雙攻':
            return 'bothAttack'

        case '物防':
            return 'physicalDefense'

        case '魔防':
            return 'magicDefense'

        case '雙防':
            return 'bothDefense'

        case '暴擊率':
        case '爆擊率':
            return 'criticalRate'

        case '暴擊傷害':
        case '爆擊傷害':
        case '爆傷':
            return 'criticalDamage'

        case '速度':
            return 'speed'

        default:
            break
    }

    // 屬性傷害
    if (
        /屬性傷害$/.test(attribute) ||
        /^[火水風地雷光暗]傷$/.test(attribute)
    ) {
        return 'elementDamage'
    }

    // 屬性抗性
    if (
        /屬性抗性$/.test(attribute) ||
        /^[火水風地雷光暗]抗$/.test(attribute)
    ) {
        return 'elementResistance'
    }

    return 'other'
}

// 將時間軸效果轉成計算用的結構化資料
export function convertTimedEffectsToModifiers(
    effects: TimedEffect[],
): EffectModifier[] {
    const modifiers: EffectModifier[] = []

    for (const timedEffect of effects) {
        const effect = timedEffect.effect

        // 目前只處理增益及減益
        if (
            effect.action !== 'increase' &&
            effect.action !== 'decrease'
        ) {
            continue
        }

        // 目標不明確時不擅自套用
        if (
            effect.targetSide === 'unknown'
        ) {
            continue
        }

        const value = timedEffect.magnitudeValue

        if (
            value === null ||
            !Number.isFinite(value) ||
            value < 0
        ) {
            continue
        }

        modifiers.push({
            effectKey: timedEffect.effectKey,

            kind: getEffectModifierKind(
                effect.attribute || effect.category,
            ),

            action: effect.action,
            targetSide: effect.targetSide,
            range: effect.range,

            attribute: effect.attribute || effect.category,
            value,

            appliedAt: timedEffect.appliedAt,
            expiresAt: timedEffect.expiresAt,
        })
    }

    return modifiers
}



// 計算角色目前受到的攻擊力增減益
export function calculateAttackBonusPercent(
    modifiers: EffectModifier[],
    attackType: 'physical' | 'magic',
): number {
    let multiplier = 1

    for (const modifier of modifiers) {
        // 只計入作用於自身或我方的效果
        if (
            modifier.targetSide !== 'self' &&
            !(
                modifier.targetSide === 'ally' &&
                modifier.range === 'all'
            )
        ) {
            continue
        }

        // 只處理攻擊力效果
        const isMatchingAttack =
            modifier.kind === 'bothAttack' ||
            (
                attackType === 'physical' &&
                modifier.kind === 'physicalAttack'
            ) ||
            (
                attackType === 'magic' &&
                modifier.kind === 'magicAttack'
            )

        if (!isMatchingAttack) {
            continue
        }

        const effectMultiplier =
            modifier.action === 'increase'
                ? 1 + modifier.value / 100
                : Math.max(0, 1 - modifier.value / 100)

        multiplier *= effectMultiplier
    }

    // 轉換成 damage.ts 使用的百分比格式
    return (multiplier - 1) * 100
}

/**
 * 計算指定種類的效果增減益。
 *
 * 增益與減益分別以乘數計算，
 * 回傳百分比格式，供後續傷害計算使用。
 */
function calculateEffectBonusPercent(
    modifiers: EffectModifier[],
    kind: EffectModifierKind,
): number {
    let multiplier = 1

    for (const modifier of modifiers) {
        // 只計入作用於自身或全體我方的效果
        if (
            modifier.targetSide !== 'self' &&
            !(
                modifier.targetSide === 'ally' &&
                modifier.range === 'all'
            )
        ) {
            continue
        }

        if (modifier.kind !== kind) {
            continue
        }
        //暴擊率與暴擊傷害的減益也會有 0 的下限，和攻擊力計算保持一致。
        const effectMultiplier =
            modifier.action === 'increase'
                ? 1 + modifier.value / 100
                : Math.max(0, 1 - modifier.value / 100)

        multiplier *= effectMultiplier
    }

    return (multiplier - 1) * 100
}

/**
 * 計算角色暴擊率增減益。
 */
export function calculateAttributeDamageBonusPercent(
    modifiers: EffectModifier[],
): number {
    return calculateEffectBonusPercent(
        modifiers,
        'elementDamage',
    )
}

export function calculateCriticalRateBonusPercent(
    modifiers: EffectModifier[],
): number {
    return calculateEffectBonusPercent(
        modifiers,
        'criticalRate',
    )
}

/**
 * 計算角色暴擊傷害增減益。
 */
export function calculateCriticalDamageBonusPercent(
    modifiers: EffectModifier[],
): number {
    return calculateEffectBonusPercent(
        modifiers,
        'criticalDamage',
    )
}

/**
 * 取得指定時間點仍然有效的效果
 *
 * 到期時間與行動時間相同時，仍保留效果，
 * 等該次傷害計算完成後再移除。
 */
export function getActiveTimedEffectsAtTime(
    effects: TimedEffect[],
    actionTime: number,
): TimedEffect[] {
    return effects.filter(effect => {
        // 效果尚未開始
        if (effect.appliedAt > actionTime) {
            return false
        }

        // 沒有到期時間，視為持續有效
        if (effect.expiresAt === null) {
            return true
        }

        // 到期時間等於行動時間時仍有效
        return effect.expiresAt >= actionTime
    })
}

/**
 * 計算指定時間點的角色攻擊力增減益
 */
export function calculateAttackBonusPercentAtTime(
    effects: TimedEffect[],
    actionTime: number,
    attackType: 'physical' | 'magic',
): number {
    const activeEffects = getActiveTimedEffectsAtTime(
        effects,
        actionTime,
    )

    const modifiers =
        convertTimedEffectsToModifiers(activeEffects)

    return calculateAttackBonusPercent(
        modifiers,
        attackType,
    )
}

export function getEnemyDefenseReductionModifiers(
    modifiers: EffectModifier[],
    defenseType: 'physical' | 'magic',
): EffectModifier[] {
    return modifiers.filter((modifier) => {
        if (
            modifier.targetSide !== 'enemy' ||
            modifier.action !== 'decrease'
        ) {
            return false
        }

        if (modifier.kind === 'bothDefense') {
            return true
        }

        if (
            defenseType === 'physical' &&
            modifier.kind === 'physicalDefense'
        ) {
            return true
        }

        if (
            defenseType === 'magic' &&
            modifier.kind === 'magicDefense'
        ) {
            return true
        }

        return false
    })
}


// 依照傷害記錄單的實測資料整理出的敵方降防傷害倍率
const EMPIRICAL_DEFENSE_REDUCTION_MULTIPLIERS: Record<number, number> = {
    20: 1.2491,
    30: 1.4352,
    40: 1.6714,
};

// 計算敵方降防帶來的實測傷害倍率
//最終傷害 = 基礎傷害\times加攻倍率\times降防倍率
export function calculateEnemyDefenseReductionMultiplier(
    modifiers: EffectModifier[],
    defenseType: 'physical' | 'magic',
): number | null {
    const defenseModifiers = getEnemyDefenseReductionModifiers(
        modifiers,
        defenseType,
    );

    let totalMultiplier = 1;

    for (const modifier of defenseModifiers) {
        const measuredMultiplier =
            EMPIRICAL_DEFENSE_REDUCTION_MULTIPLIERS[modifier.value];

        // 尚無實測資料的降防幅度，不擅自套用倍率
        if (measuredMultiplier === undefined) {
            return null;
        }

        totalMultiplier *= measuredMultiplier;
    }

    return totalMultiplier;
}
