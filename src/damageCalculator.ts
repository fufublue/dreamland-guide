
import type { TalentMultiplier } from './talentMultiplierData'
import type {
    ParsedCharacter,
    ParsedCalculationEffect,
} from './characterEffectParser'

// ==============================
// 傷害計算資料型別
// ==============================

export interface DamageCalculationInput {
    attack: number

    // 技能倍率，例如 130 代表 130%
    skillCoefficient: number

    // 攻擊提升百分比，例如 20 代表 20%
    attackBonusPercent?: number

    // 爆擊倍率，例如面板 220% 就填 2.2
    criticalMultiplier?: number

    // 防禦倍率：目前尚未建立通用防禦公式，
    // 只有在有可靠倍率資料時才傳入。
    defenseMultiplier?: number

    // 傷害加成目前尚未確認計算位置，
    // 暫時只保留資料，不直接套入公式。
    damageBonusPercent?: number
}

export interface DamageCalculationResult {
    baseDamage: number
    attackMultiplier: number
    defenseMultiplier: number | null
    criticalMultiplier: number
    normalDamage: number | null
    criticalDamage: number | null
    warnings: string[]
    isComplete: boolean
}

// ==============================
// 已確認的倍率計算
// ==============================

/**
 * 攻擊提升倍率
 *
 * 實測支持：
 * 攻擊提升 20% → 傷害約 1.2 倍
 * 攻擊提升 40% → 傷害約 1.4 倍
 * 攻擊提升 60% → 傷害約 1.6 倍
 */
export function getAttackMultiplier(
    attackBonusPercent: number = 0,
): number {
    return 1 + attackBonusPercent / 100
}

/**
 * 爆擊倍率
 *
 * 目前依照面板爆擊傷害 220% 的實測結果，
 * 預設採用 2.2 倍。
 */
export function getCriticalMultiplier(
    criticalMultiplier: number = 2.2,
): number {
    return criticalMultiplier
}

// ==============================
// 基礎傷害計算
// ==============================

/**
 * 計算技能的基礎傷害。
 *
 * 這裡只計算攻擊力 × 技能倍率，
 * 不包含尚未確認的敵人防禦與傷害加成。
 */
export function calculateBaseDamage(
    attack: number,
    skillCoefficient: number,
): number {
    return attack * (skillCoefficient / 100)
}

/**
 * 強度計算器傷害公式
 *
 * 攻擊提升：實測定案
 * 防禦降低：推導定案
 * 傷害加成：推導定案
 *
 * 注意：
 * 這裡計算的是理論傷害，不包含尚未確認的隨機浮動。
 */
export function calculateFinalDamage(
    attack: number,
    skillCoefficient: number,
    attackBonusPercent: number = 0,
    defenseReductionPercent: number = 0,
    damageBonusPercent: number = 0,
    criticalDamagePercent: number = 0,
    isCritical: boolean = false,
): number {

    // 攻擊提升倍率
    const attackMultiplier =
        1 + attackBonusPercent / 100

    // 防禦降低倍率
    // 推導模型：1 / (1 - 防禦降低比例)
    const safeDefenseReduction = Math.min(
        Math.max(defenseReductionPercent, 0),
        99.99
    )

    const defenseMultiplier =
        1 / (1 - safeDefenseReduction / 100)

    // 傷害加成倍率
    const damageMultiplier =
        1 + damageBonusPercent / 100

    // 暴擊倍率
    const criticalMultiplier =
        isCritical
            ? criticalDamagePercent / 100
            : 1

    // 基礎傷害
    const baseDamage =
        attack * (skillCoefficient / 100)

    // 最終理論傷害
    return (
        baseDamage *
        attackMultiplier *
        defenseMultiplier *
        damageMultiplier *
        criticalMultiplier
    )
}


/**
 * 將技能與天賦的結構化效果分類
 *
 * 這一步只整理資料，不擅自決定不同效果的疊加規則。
 */
export function classifyCalculationEffects<
    T extends ParsedCalculationEffect
>(
    calculations: T[],
) {
    return {
        // 攻擊力提升
        attackBuffs: calculations.filter(
            effect => effect.type === 'attack-buff'
        ),

        // 攻擊力降低
        attackDebuffs: calculations.filter(
            effect => effect.type === 'attack-debuff'
        ),

        // 一般傷害加成
        damageBuffs: calculations.filter(
            effect => effect.type === 'damage-buff'
        ),

        // 屬性傷害加成
        elementalDamageBuffs: calculations.filter(
            effect => effect.type === 'elemental-damage-buff'
        ),

        // 防禦降低
        defenseDebuffs: calculations.filter(
            effect => effect.type === 'defense-debuff'
        ),

        // 防禦提升
        defenseBuffs: calculations.filter(
            effect => effect.type === 'defense-buff'
        ),

        // 條件增傷
        conditionalDamages: calculations.filter(
            effect => effect.type === 'conditional-damage'
        ),

        // 治療
        healings: calculations.filter(
            effect => effect.type === 'healing'
        ),

        // 必殺值增加
        ultimateGaugeBuffs: calculations.filter(
            effect => effect.type === 'ultimate-gauge'
        ),

        // 必殺值降低
        ultimateGaugeDebuffs: calculations.filter(
            effect => effect.type === 'ultimate-gauge-debuff'
        ),

        // 速度提升
        speedBuffs: calculations.filter(
            effect => effect.type === 'speed-buff'
        ),

        // 速度降低
        speedDebuffs: calculations.filter(
            effect => effect.type === 'speed-debuff'
        ),

        // 尚未解析或無法分類的效果
        unknownEffects: calculations.filter(
            effect => effect.type === 'unknown'
        ),
    }
}


// ==============================
// 傷害計算入口
// ==============================

export function calculateDamage(
    input: DamageCalculationInput,
): DamageCalculationResult {
    const warnings: string[] = []

    const attackMultiplier = getAttackMultiplier(
        input.attackBonusPercent,
    )

    const criticalMultiplier = getCriticalMultiplier(
        input.criticalMultiplier,
    )

    const baseDamage = calculateBaseDamage(
        input.attack,
        input.skillCoefficient,
    )

    const damageBeforeDefense =
        baseDamage * attackMultiplier

    const hasDefenseMultiplier =
        input.defenseMultiplier !== undefined

    const normalDamage = hasDefenseMultiplier
        ? damageBeforeDefense * input.defenseMultiplier!
        : null

    const criticalDamage = normalDamage !== null
        ? normalDamage * criticalMultiplier
        : null

    if (!hasDefenseMultiplier) {
        warnings.push(
            '尚未提供敵人防禦倍率，因此無法計算最終傷害。',
        )
    }

    if (
        input.damageBonusPercent !== undefined &&
        input.damageBonusPercent !== 0
    ) {
        warnings.push(
            '傷害加成的計算位置尚未確認，目前未套用。',
        )
    }

    return {
        baseDamage,
        attackMultiplier,
        defenseMultiplier: hasDefenseMultiplier
            ? input.defenseMultiplier!
            : null,
        criticalMultiplier,
        normalDamage,
        criticalDamage,
        warnings,
        isComplete:
            hasDefenseMultiplier &&
            (input.damageBonusPercent === undefined ||
                input.damageBonusPercent === 0),
    }
}

// ==============================
// 技能資料輔助
// ==============================

/**
 * 依照技能名稱取得解析後的技能資料。
 */
export function getParsedSkill(
    character: ParsedCharacter,
    skillName: 'ultimate' | 'skill2' | 'skill1',
) {
    return character.skills.find(
        skill => skill.skillName === skillName,
    ) ?? null
}

/**
 * 檢查角色是否存在尚未確認的計算效果。
 */
export function getCalculationWarnings(
    character: ParsedCharacter,
): string[] {
    const warnings = [...character.calculationReviewIssues]

    for (const skill of character.skills) {
        const levels = [
            skill.initial,
            skill.max,
            skill.talentInitial,
            skill.talentMax,
        ]

        for (const level of levels) {
            for (const effect of level.effects) {
                if (effect.calculationReviewRequired) {
                    warnings.push(
                        `${character.characterName}｜${skill.skillName}：${effect.originalText}`,
                    )
                }
            }
        }
    }

    return [...new Set(warnings)]
}

// ==============================
// 天賦倍率資料
// ==============================

/**
 * 取得已確認的天賦倍率。
 *
 * 未確認的資料不會被當成正式倍率使用。
 */
export function getConfirmedTalentMultiplier(
    talent: TalentMultiplier | undefined,
    talentLevel: 9 | 12 | 15,
): number | null {
    if (!talent || !talent.confirmed) {
        return null
    }

    switch (talentLevel) {
        case 9:
            return talent.talent9
        case 12:
            return talent.talent12
        case 15:
            return talent.talent15
        default:
            return null
    }
}
