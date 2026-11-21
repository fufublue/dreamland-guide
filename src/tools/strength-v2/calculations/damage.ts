
import type {
    CharacterCombatStats,
    StrengthCalculationMode,
    MaximumModeEnvironment,
    StrengthEnemySettings,
    SkillDamageResult,
    StrengthSkillKey,
} from '../types'

import type { EngineConditionalBonus } from '../../../engine/types/effect'

// ======================================================
// 計算常數
// ======================================================

// 暫定值，尚未經遊戲實測確認
const DEFENSE_CONSTANT = 1000

const ELEMENT_MULTIPLIERS = {
    advantage: 1.5,
    disadvantage: 0.7,
    neutral: 1.0,
} as const

// 敵人防禦類型倍率（暫定）
// 之後有實測資料時，只需要修改這裡
const ENEMY_DEFENSE_TYPE_MULTIPLIERS = {
    弱物: {
        physical: 1.5,
        magic: 0.7,
    },
    弱魔: {
        physical: 0.7,
        magic: 1.5,
    },
    物魔雙弱: {
        physical: 1.5,
        magic: 1.5,
    },
    物魔雙高: {
        physical: 0.7,
        magic: 0.7,
    },
    無弱點: {
        physical: 1.0,
        magic: 1.0,
    },
} as const satisfies Record<
    StrengthEnemySettings['defenseType'],
    {
        physical: number
        magic: number
    }
>

export type ElementRelation =
    | 'advantage'
    | 'disadvantage'
    | 'neutral'

export type CharacterAttackType =
    | 'physical'
    | 'magic'

// ======================================================
// 輸入資料
// ======================================================

export type DamageCalculationInput = {
    skillKey: StrengthSkillKey
    stats: CharacterCombatStats

    // 角色實際使用的攻擊力
    attack: number | null

    // 角色攻擊類型
    attackType: CharacterAttackType | null

    // 原始技能倍率，例如 180 代表 180%
    coefficient: number | null

    // 條件式傷害倍率
    conditionalBonuses?: EngineConditionalBonus[]

    // 是否將自身生命值條件視為成立
    treatSelfHpConditionAsMet?: boolean

    enemy: StrengthEnemySettings
    elementRelation: ElementRelation
    mode: StrengthCalculationMode
    environment: MaximumModeEnvironment

    // 攻擊力提升，獨立計算
    // 其他傷害加成，會與角色面板傷害加成相加
    // 例如武器、掛件及戰鬥中觸發的傷害加成
    attackBonusPercent?: number
    attributeDamageBonusPercent?: number
    damageBonusPercent?: number
    criticalRateBonusPercent?: number
    criticalDamageBonusPercent?: number

    enemyDefenseReductionMultiplier?: number
}

// ======================================================
// 安全數值處理
// ======================================================

function isValidNumber(
    value: unknown,
): value is number {
    return (
        typeof value === 'number' &&
        Number.isFinite(value)
    )
}

function getCriticalRate(
    value: number | null,
): number | null {
    if (!isValidNumber(value)) return null

    // 支援 0～1 或 0～100 的百分比格式
    const rate = value > 1 ? value / 100 : value

    return Math.min(1, Math.max(0, rate))
}

function getCriticalMultiplier(
    value: number | null,
): number | null {
    if (!isValidNumber(value)) return null

    // 支援 0～10 的倍率格式，以及 100 以上的百分比格式
    const multiplier = value > 10 ? value / 100 : value

    return Math.max(0, multiplier)
}

// ======================================================
// 條件式技能倍率
// ======================================================

/**
 * 自身生命值條件式傷害：
 *
 * 開啟時：視為符合條件，使用括號內的最終倍率。
 * 關閉時：不套用條件式倍率，使用原技能倍率。
 *
 * 不另外加上 bonusCoefficient。
 */
function getEffectiveCoefficient(
    originalCoefficient: number | null,
    conditionalBonuses: EngineConditionalBonus[] = [],
    warnings: string[],
    treatSelfHpConditionAsMet = true,
): number | null {
    const conditionalBonus = conditionalBonuses.find(
        bonus => bonus.condition === 'selfHpAtLeast',
    )

    if (!conditionalBonus) {
        return originalCoefficient
    }

    if (!treatSelfHpConditionAsMet) {
        return originalCoefficient
    }

    const displayedCoefficient =
        Number(
            conditionalBonus.displayedCoefficient
                .replace('%', '')
                .trim(),
        )

    if (
        !isValidNumber(displayedCoefficient) ||
        displayedCoefficient < 0
    ) {
        warnings.push(
            '條件式傷害的最終技能倍率無效，暫時使用原技能倍率。',
        )

        return originalCoefficient
    }

    return displayedCoefficient
}

// ======================================================
// 防禦倍率
// ======================================================

/**
 * 暫定防禦公式。
 *
 * K = 1000 尚未經遊戲實測確認。
 * 目前敵人設定尚無防禦數值，因此此函式
 * 暫時不會直接參與傷害計算。
 */
export function calculateDefenseMultiplier(
    enemyDefense: number,
    defenseReductionPercent = 0,
): number | null {
    if (!isValidNumber(enemyDefense) || enemyDefense < 0) {
        return null
    }

    const reduction = Math.min(
        100,
        Math.max(0, defenseReductionPercent),
    )

    const effectiveDefense =
        enemyDefense * (1 - reduction / 100)

    return (
        DEFENSE_CONSTANT /
        (DEFENSE_CONSTANT + effectiveDefense)
    )
}

// ======================================================
// 敵人防禦類型倍率
// ======================================================

/**
 * 根據角色攻擊類型及敵人防禦類型取得傷害倍率。
 *
 * 弱物：
 * 物理 1.5 倍、魔法 0.7 倍
 *
 * 弱魔：
 * 物理 0.7 倍、魔法 1.5 倍
 *
 * 物魔雙弱：
 * 物理及魔法皆為 1.5 倍
 *
 * 物魔雙高：
 * 物理及魔法皆為 0.7 倍
 *
 * 無弱點：
 * 物理及魔法皆為 1.0 倍
 */
export function getEnemyDefenseTypeMultiplier(
    enemy: StrengthEnemySettings,
    attackType: CharacterAttackType | null,
): number | null {
    if (attackType === null) {
        return null
    }

    const multipliers =
        ENEMY_DEFENSE_TYPE_MULTIPLIERS[enemy.defenseType]

    if (!multipliers) {
        return null
    }

    return multipliers[attackType]
}

// ======================================================
// 屬性克制倍率
// ======================================================

export function getElementMultiplier(
    relation: ElementRelation,
): number {
    return ELEMENT_MULTIPLIERS[relation]
}

// 屬性傷害提升已統一由效果時間軸提供，避免外部條件與角色技能重複計算。

// ======================================================
// 傷害加成
// ======================================================

/**
 * 傷害加成統一採加算：
 *
 * 角色面板傷害加成
 * + 武器傷害加成
 * + 掛件傷害特性
 * + 其他適用的傷害加成
 *
 * 最後只轉換成一個乘數，避免重複乘算。
 */
function getDamageBonusMultiplier(
    stats: CharacterCombatStats,
    additionalDamageBonus: number | undefined,
    warnings: string[],
): number {
    let totalDamageBonus = 0

    if (isValidNumber(stats.damageBonus)) {
        totalDamageBonus += stats.damageBonus
    } else {
        warnings.push(
            '角色面板傷害加成缺少有效數值，暫未納入。',
        )
    }

    if (isValidNumber(additionalDamageBonus)) {
        totalDamageBonus += additionalDamageBonus
    }

    return 1 + totalDamageBonus / 100
}

// ======================================================
// 技能傷害計算
// ======================================================

export function calculateSkillDamage(
  input: DamageCalculationInput,
): SkillDamageResult {
  const warnings: string[] = [];

  const {
    skillKey,
    stats,
    attack,
    attackType,
    enemy,
    elementRelation,
    mode,
    environment,
    enemyDefenseReductionMultiplier = 1,
    treatSelfHpConditionAsMet = true,
  } = input;

  // --------------------------------------------------
  // 條件式技能倍率
  // --------------------------------------------------

  const coefficient = getEffectiveCoefficient(
    input.coefficient,
    input.conditionalBonuses,
    warnings,
    treatSelfHpConditionAsMet,
  );

  // --------------------------------------------------
  // 基本資料檢查
  // --------------------------------------------------

  if (!isValidNumber(attack) || attack < 0) {
    warnings.push("角色攻擊力缺少有效數值。");
  }

  if (!isValidNumber(coefficient) || coefficient < 0) {
    warnings.push("技能倍率缺少有效數值。");
  }

  if (criticalRateMissing(stats)) {
    warnings.push("暴擊率缺少有效數值。");
  }

  if (criticalDamageMissing(stats)) {
    warnings.push("暴擊傷害缺少有效數值。");
  }

  const criticalRate = getCriticalRate(stats.criticalRate);

  const criticalMultiplier = getCriticalMultiplier(stats.criticalDamage);

  // 缺少核心資料時不產生傷害數字
  if (
    !isValidNumber(attack) ||
    !isValidNumber(coefficient) ||
    attack < 0 ||
    coefficient < 0
  ) {
    return {
      skillKey,
      coefficient,
      normalDamage: null,
      criticalDamage: null,
      expectedDamage: null,
      criticalRate,
      warnings,
    };
  }

  // --------------------------------------------------
  // 基礎傷害
  // --------------------------------------------------

  const baseDamage = attack * (coefficient / 100);

  // --------------------------------------------------
  // 攻擊提升
  // --------------------------------------------------

  const attackBonus = isValidNumber(input.attackBonusPercent)
    ? input.attackBonusPercent
    : 0;

  const attackMultiplier = 1 + attackBonus / 100;

  // --------------------------------------------------
  // 傷害加成
  // --------------------------------------------------

  const damageBonusMultiplier = getDamageBonusMultiplier(
    stats,
    input.damageBonusPercent,
    warnings,
  );

  // --------------------------------------------------
  // 最大值模式環境效果
  // --------------------------------------------------

  // 環境及角色技能提供的屬性傷害加成
  const environmentAttributeDamageBonus = isValidNumber(
    input.attributeDamageBonusPercent,
  )
    ? input.attributeDamageBonusPercent
    : 0;

  // 天賦提供的屬性傷害加成（例如屬性強化 +5%）
  const talentAttributeDamageBonus = isValidNumber(stats.attributeBoost)
    ? stats.attributeBoost
    : 0;

  // 合併屬性傷害加成
  const attributeDamageBonus =
    environmentAttributeDamageBonus + talentAttributeDamageBonus;

  const attributeDamageMultiplier = 1 + attributeDamageBonus / 100;

  // --------------------------------------------------
  // 屬性克制
  // --------------------------------------------------

  const elementMultiplier = getElementMultiplier(elementRelation);

  // --------------------------------------------------
  // 敵人防禦類型
  // --------------------------------------------------

  const enemyDefenseTypeMultiplier = getEnemyDefenseTypeMultiplier(
    enemy,
    attackType,
  );

  if (enemyDefenseTypeMultiplier === null) {
    warnings.push("無法判斷角色攻擊類型或敵人防禦類型，防禦類型倍率暫未套用。");
  }

  // --------------------------------------------------
  // 尚未確認的計算項目
  // --------------------------------------------------

  if (mode === "maximum" && environment.attributeResistanceReduction.enabled) {
    warnings.push("敵方屬性抗性資料尚未建立，暫未套用抗性降低。");
  }

  if (enemy.maxHp === null && enemy.kind === "minion") {
    warnings.push("小怪缺少生命上限資料。");
  }

  // --------------------------------------------------
  // 普通傷害
  // --------------------------------------------------

  const normalDamage =
    baseDamage *
    attackMultiplier *
    damageBonusMultiplier *
    attributeDamageMultiplier *
    elementMultiplier *
    (enemyDefenseTypeMultiplier ?? 1) *
    enemyDefenseReductionMultiplier;

  // --------------------------------------------------
  // 暴擊率與暴擊傷害技能效果
  // --------------------------------------------------

  const criticalRateBonus = isValidNumber(input.criticalRateBonusPercent)
    ? input.criticalRateBonusPercent
    : 0;

  const criticalDamageBonus = isValidNumber(input.criticalDamageBonusPercent)
    ? input.criticalDamageBonusPercent
    : 0;

  const effectiveCriticalRate =
    criticalRate === null
      ? null
      : Math.min(1, Math.max(0, criticalRate * (1 + criticalRateBonus / 100)));

  const effectiveCriticalMultiplier =
    criticalMultiplier === null
      ? null
      : criticalMultiplier * (1 + criticalDamageBonus / 100);

  // --------------------------------------------------
  // 暴擊傷害
  // --------------------------------------------------

  const criticalDamage =
    effectiveCriticalMultiplier === null
      ? null
      : normalDamage * effectiveCriticalMultiplier;

  // --------------------------------------------------
  // 期望傷害
  // --------------------------------------------------

  const expectedDamage =
    effectiveCriticalRate === null || criticalDamage === null
      ? null
      : normalDamage * (1 - effectiveCriticalRate) +
        criticalDamage * effectiveCriticalRate;

  // --------------------------------------------------
  // 回傳結果
  // --------------------------------------------------

  return {
    skillKey,
    coefficient,
    normalDamage,
    criticalDamage,
    expectedDamage,
    criticalRate: effectiveCriticalRate,
    warnings,
  };
}

// ======================================================
// 資料檢查
// ======================================================

function criticalRateMissing(
    stats: CharacterCombatStats,
): boolean {
    return !isValidNumber(stats.criticalRate)
}

function criticalDamageMissing(
    stats: CharacterCombatStats,
): boolean {
    return !isValidNumber(stats.criticalDamage)
}
