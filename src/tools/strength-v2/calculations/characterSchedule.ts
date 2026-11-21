
import type { EngineCharacter } from '../../../engine/types/character'
import type { EngineEffect } from '../../../engine/types/effect'

import type {
    CharacterCombatStats,
    MaximumModeEnvironment,
    StrengthCalculationMode,
    StrengthEnemySettings,
    SkillLevelType,
    TalentNodeSelection,
    SkillDamageResult,
} from '../types'

import {
    calculateCharacterNormalAttackDamage,
} from './normalAttackDamage'

import {
    calculateCharacterSkillDamage,
} from './skillDamage'

import {
    getSkillEffectsWithTalent,
    type SkillSlot,
} from './effects'

import {
    createSkillSchedule,
    type SkillScheduleResult,
    type ScheduledSkillKey,
} from './skillSchedule'

import { getBreakthroughUltimateGaugeMultiplier } from "./breakthroughTrait";

import type { EffectTimelineState } from './effectTimeline'

type ElementRelation =
    Parameters<typeof calculateCharacterSkillDamage>[0]['elementRelation']

type SkillLevel =
    Parameters<typeof calculateCharacterSkillDamage>[0]['skillLevel']

export interface CharacterSkillScheduleInput {
    character: EngineCharacter

    normalAttackLevel: SkillLevelType
    skillLevel: SkillLevel

    selectedNode: TalentNodeSelection

    stats: CharacterCombatStats

    // 同一場戰鬥中的全部敵人
    enemies: StrengthEnemySettings[]

    elementRelation: ElementRelation

    mode: StrengthCalculationMode
    environment: MaximumModeEnvironment

    speed: number | null
    remainingSeconds: number
    ultimateUses: number | null

    // 武器與掛件傷害加成
    weaponDamageBonus?: number | null
    hangingTraitDamageBonus?: number | null

    // 角色滿突破傷害特性，使用百分點格式（例如 10 代表 10%）
    breakthroughTraitDamageBonus?: number | null

    // 是否將自身生命值條件視為成立
    treatSelfHpConditionAsMet?: boolean

    initialEffectState?: EffectTimelineState[]

    // 角色突破治療特性
    breakthroughTraitHealingBonus?: number | null

    // 掛件治癒特性
    hangingTraitHealingBonus?: number | null
}

/**
* 將技能欄位對應到角色技能資料。
*/
function getSkillSlot(
    skillKey: ScheduledSkillKey,
): SkillSlot | null {
    switch (skillKey) {
        case 'skill1':
            return 'skill1'

        case 'skill2':
            return 'skill2'

        case 'ultimate':
            return 'ultimate'

        default:
            return null
    }
}

/**
 * 取得技能傷害的期望值。
 */
function getExpectedDamage(
    result: SkillDamageResult,
): number | null {
    return result.expectedDamage
}

/**
 * 建立角色技能排程。
 *
 * coefficient：
 * 使用固定傷害，不計入戰鬥中觸發的自身效果。
 *
 * maximum：
 * 使用固定傷害，依最大值模式環境設定計算。
 *
 * selfEffects：
 * 每個行動時間點依照當下有效效果重新計算傷害，
 * 並將技能附帶效果交給效果時間軸處理。
 *
 * 普通攻擊及單體技能只攻擊第一隻敵人。
 * 全體技能則計算全部敵人並加總傷害。
 */
export function createCharacterSkillSchedule(
  input: CharacterSkillScheduleInput,
): SkillScheduleResult {
  const {
    character,
    normalAttackLevel,
    skillLevel,
    selectedNode,
    stats,
    enemies,
    elementRelation,
    mode,
    environment,
    speed,
    remainingSeconds,
    ultimateUses,
    weaponDamageBonus,
    hangingTraitDamageBonus,
    treatSelfHpConditionAsMet = true,
    initialEffectState,
  } = input;

  const warnings: string[] = [];
  // 每次普通攻擊或一般技能增加的基礎必殺值
  const ultimateGaugePerAction = elementRelation === "advantage" ? 1500 : 1000;
  const ultimateGaugeMultiplier = getBreakthroughUltimateGaugeMultiplier(
    character.maxBreakthroughTrait,
  );

  // 普通攻擊固定使用第一隻敵人
  const priorityEnemy = enemies[0] ?? null;

  const skillEffectsCache = new Map<SkillSlot, EngineEffect[]>();

  /**
   * 取得套用天賦後的技能效果。
   *
   * 使用快取，避免重複解析同一技能。
   */
  function getSkillEffects(skillSlot: SkillSlot): EngineEffect[] {
    const cached = skillEffectsCache.get(skillSlot);

    if (cached) {
      return cached;
    }

    const result = getSkillEffectsWithTalent(
      character,
      skillSlot,
      skillLevel,
      selectedNode,
    );

    warnings.push(...result.warnings);

    skillEffectsCache.set(skillSlot, result.effects);

    return result.effects;
  }

  /**
   * 計算普通攻擊傷害。
   */
  function calculateNormalAttack(
    activeEffects: Parameters<
      typeof calculateCharacterNormalAttackDamage
    >[0]["activeEffects"],
    activeEnvironment: MaximumModeEnvironment = environment,
  ): number | null {
    const result = calculateCharacterNormalAttackDamage({
      character,
      normalAttackLevel,
      selectedNode,
      stats,
      enemy: priorityEnemy,
      elementRelation,
      mode,
      environment: activeEnvironment,
      activeEffects,
      weaponDamageBonus,
      hangingTraitDamageBonus,
      breakthroughTraitDamageBonus: input.breakthroughTraitDamageBonus,
    });

    warnings.push(...result.warnings);

    return getExpectedDamage(result.damage);
  }

  /**
   * 計算指定技能的完整傷害及治療結果。
   */
  function calculateSkillResult(
    skillSlot: SkillSlot,
    activeEffects: Parameters<
      typeof calculateCharacterSkillDamage
    >[0]["activeEffects"],
    activeEnvironment: MaximumModeEnvironment = environment,
  ) {
    const result = calculateCharacterSkillDamage({
      character,
      skillSlot,
      skillLevel,
      selectedNode,
      stats,
      enemies,
      elementRelation,
      mode,
      environment: activeEnvironment,
      activeEffects,

      weaponDamageBonus,
      hangingTraitDamageBonus,
      breakthroughTraitDamageBonus: input.breakthroughTraitDamageBonus,

      breakthroughTraitHealingBonus: input.breakthroughTraitHealingBonus,

      hangingTraitHealingBonus: input.hangingTraitHealingBonus,

      treatSelfHpConditionAsMet,
    });

    warnings.push(...result.warnings);

    return result;
  }

  /**
   * 取得技能的期望傷害。
   */
  function calculateSkill(
    skillSlot: SkillSlot,
    activeEffects: Parameters<
      typeof calculateCharacterSkillDamage
    >[0]["activeEffects"],
    activeEnvironment: MaximumModeEnvironment = environment,
  ): number | null {
    const result = calculateSkillResult(
      skillSlot,
      activeEffects,
      activeEnvironment,
    );

    return getExpectedDamage(result.damage);
  }

  // 取得技能冷卻時間。
  const skill1EffectsResult = getSkillEffectsWithTalent(
    character,
    "skill1",
    skillLevel,
    selectedNode,
  );

  const skill2EffectsResult = getSkillEffectsWithTalent(
    character,
    "skill2",
    skillLevel,
    selectedNode,
  );

  warnings.push(
    ...skill1EffectsResult.warnings,
    ...skill2EffectsResult.warnings,
  );

  skillEffectsCache.set("skill1", skill1EffectsResult.effects);

  skillEffectsCache.set("skill2", skill2EffectsResult.effects);

  skillEffectsCache.set("ultimate", getSkillEffects("ultimate"));

  // selfEffects、maximum 模式：動態計算每個行動時間點的傷害與治療。
  if (mode === "selfEffects" || mode === "maximum") {
    const schedule = createSkillSchedule({
      speed,
      remainingSeconds,
      environment,
      environmentEnabled: mode === "maximum",

      normalAttackDamage: null,
      skill1Damage: null,
      skill2Damage: null,
      ultimateDamage: null,

      skill1Cooldown: skill1EffectsResult.cooldown,
      skill2Cooldown: skill2EffectsResult.cooldown,

      ultimateUses,
      ultimateGaugeMultiplier,
      ultimateGaugePerAction,

      initialEffectState,

      calculateDamage: (
        skillKey,
        _actionTime,
        activeEffects,
        activeEnvironment,
      ) => {
        if (skillKey === "normalAttack") {
          return calculateNormalAttack(activeEffects, activeEnvironment);
        }

        const skillSlot = getSkillSlot(skillKey);

        if (!skillSlot) {
          return null;
        }

        return calculateSkill(skillSlot, activeEffects, activeEnvironment);
      },

      calculateHealing: (skillKey, _actionTime, activeEffects) => {
        const skillSlot = getSkillSlot(skillKey);

        if (!skillSlot) {
          return null;
        }

        const result = calculateSkillResult(skillSlot, activeEffects);

        return result.healing?.healing ?? null;
      },

      getEffectsForSkill: (skillKey) => {
        const skillSlot = getSkillSlot(skillKey);

        if (!skillSlot) {
          return [];
        }

        return getSkillEffects(skillSlot);
      },
    });

    return {
      ...schedule,
      warnings: [...new Set([...schedule.warnings, ...warnings])],
    };
  }

  // coefficient 模式：使用固定傷害及治療計算。
  const normalAttackDamage = calculateNormalAttack([]);

  const skill1CalculationResult = calculateSkillResult("skill1", []);

  const skill2CalculationResult = calculateSkillResult("skill2", []);

  const ultimateCalculationResult = calculateSkillResult("ultimate", []);

  const skill1Damage = getExpectedDamage(skill1CalculationResult.damage);

  const skill2Damage = getExpectedDamage(skill2CalculationResult.damage);

  const ultimateDamage = getExpectedDamage(ultimateCalculationResult.damage);

  // 固定模式下，各技能的治療量
  const healingValues: Record<ScheduledSkillKey, number | null> = {
    normalAttack: null,
    skill1: skill1CalculationResult.healing?.healing ?? null,
    skill2: skill2CalculationResult.healing?.healing ?? null,
    ultimate: ultimateCalculationResult.healing?.healing ?? null,
  };

  const schedule = createSkillSchedule({
    speed,
    remainingSeconds,
    environment,
    environmentEnabled: false,

    normalAttackDamage,
    skill1Damage,
    skill2Damage,
    ultimateDamage,

    skill1Cooldown: skill1EffectsResult.cooldown,
    skill2Cooldown: skill2EffectsResult.cooldown,

    ultimateUses,
    ultimateGaugeMultiplier,
    ultimateGaugePerAction,

    calculateHealing: (skillKey) => healingValues[skillKey],

    getEffectsForSkill: (skillKey) => {
      const skillSlot = getSkillSlot(skillKey);

      if (!skillSlot) {
        return [];
      }

      return getSkillEffects(skillSlot);
    },
  });
  return {
    ...schedule,
    warnings: [...new Set([...schedule.warnings, ...warnings])],
  };
}
