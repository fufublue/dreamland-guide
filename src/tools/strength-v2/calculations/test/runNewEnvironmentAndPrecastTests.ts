import assert from "node:assert/strict";
import { DEFAULT_ENVIRONMENT } from "../../settings";
import {
  calculateCriticalDamageBonusPercent,
  calculateCriticalRateBonusPercent,
  calculateEnemyAttributeResistanceReductionMultiplier,
  convertTimedEffectsToModifiers,
  getModifiersForEnemy,
  type EffectModifier,
} from "../effectModifiers";
import { createSkillSchedule } from "../skillSchedule";
import { applyEffectsAtCast, createInitialEffectTimelineState } from "../effectTimeline";
import type { EngineEffect } from "../../../../engine/types/effect";

const modifiers: EffectModifier[] = [
  {
    effectKey: "all-defense-down",
    kind: "bothDefense",
    action: "decrease",
    targetSide: "enemy",
    range: "all",
    targetEnemyId: null,
    attribute: "雙防",
    value: 20,
    appliedAt: 0,
    expiresAt: 15,
  },
  {
    effectKey: "enemy-a-defense-down",
    kind: "bothDefense",
    action: "decrease",
    targetSide: "enemy",
    range: "single",
    targetEnemyId: "enemy-a",
    attribute: "雙防",
    value: 40,
    appliedAt: 0,
    expiresAt: 15,
  },
  {
    effectKey: "enemy-b-defense-down",
    kind: "bothDefense",
    action: "decrease",
    targetSide: "enemy",
    range: "single",
    targetEnemyId: "enemy-b",
    attribute: "雙防",
    value: 30,
    appliedAt: 0,
    expiresAt: 15,
  },
  {
    effectKey: "critical-rate-up",
    kind: "criticalRate",
    action: "increase",
    targetSide: "ally",
    range: "all",
    targetEnemyId: null,
    attribute: "暴擊率",
    value: 20,
    appliedAt: 0,
    expiresAt: 10,
  },
  {
    effectKey: "critical-damage-up",
    kind: "criticalDamage",
    action: "increase",
    targetSide: "ally",
    range: "all",
    targetEnemyId: null,
    attribute: "暴擊傷害",
    value: 40,
    appliedAt: 0,
    expiresAt: 10,
  },
];

const enemyAModifiers = getModifiersForEnemy(modifiers, "enemy-a");
const enemyBModifiers = getModifiersForEnemy(modifiers, "enemy-b");
assert.deepEqual(
  enemyAModifiers.filter((item) => item.kind === "bothDefense").map((item) => item.value),
  [20, 40],
  "指定敵人的效果應包含全體效果及該敵人的專屬效果",
);
assert.deepEqual(
  enemyBModifiers.filter((item) => item.kind === "bothDefense").map((item) => item.value),
  [20, 30],
  "更換敵人順序後，專屬效果仍應依敵人 ID 對應",
);
assert.ok(Math.abs(calculateCriticalRateBonusPercent(modifiers) - 20) < 1e-9);
assert.ok(Math.abs(calculateCriticalDamageBonusPercent(modifiers) - 40) < 1e-9);

const attributeResistanceModifiers: EffectModifier[] = [
  {
    effectKey: "attribute-resistance-down",
    kind: "elementResistance",
    action: "decrease",
    targetSide: "enemy",
    range: "single",
    targetEnemyId: "enemy-a",
    attribute: "屬性抗性",
    value: 30,
    appliedAt: 0,
    expiresAt: 15,
  },
];
assert.ok(
  Math.abs(calculateEnemyAttributeResistanceReductionMultiplier(attributeResistanceModifiers)! - 1.4352) < 1e-9,
  "屬性抗性降低應沿用防禦降低的 30% 實測倍率，且不區分物理／魔法",
);
assert.equal(
  calculateEnemyAttributeResistanceReductionMultiplier(getModifiersForEnemy(attributeResistanceModifiers, "enemy-b")),
  1,
  "指定敵人的屬性抗性降低不應套用到其他敵人",
);

const makeCriticalEffect = (id: string, category: "criticalRate" | "criticalDamage", attribute: string, value: number): EngineEffect => ({
  id,
  action: "increase",
  targetSide: "ally",
  range: "all",
  category,
  attribute,
  searchableCategories: [category],
  magnitude: `${value}%`,
  value: `${value}%`,
  duration: "10秒",
  chance: "",
  originalText: `${attribute}提升${value}%`,
  source: "skill",
  calculations: [],
  reviewRequired: false,
  reviewIssues: [],
});
const criticalTimeline = applyEffectsAtCast(createInitialEffectTimelineState(), [
  makeCriticalEffect("environment-critical-rate", "criticalRate", "暴擊率", 20),
  makeCriticalEffect("character-skill-critical-rate", "criticalRate", "暴擊率", 30),
  makeCriticalEffect("environment-critical-damage", "criticalDamage", "暴擊傷害", 40),
  makeCriticalEffect("character-skill-critical-damage", "criticalDamage", "暴擊傷害", 60),
], 0);
const criticalModifiers = convertTimedEffectsToModifiers(criticalTimeline.states[0].activeEffects);
assert.equal(criticalModifiers.filter((item) => item.kind === "criticalRate").length, 2, "環境暴擊率與技能暴擊率必須分開保留");
assert.equal(criticalModifiers.filter((item) => item.kind === "criticalDamage").length, 2, "環境暴擊傷害與技能暴擊傷害必須分開保留");
assert.ok(Math.abs(calculateCriticalRateBonusPercent(criticalModifiers) - 56) < 1e-9, "20% 與 30% 暴擊率增益應以 1.2 × 1.3 乘算");
assert.ok(Math.abs(calculateCriticalDamageBonusPercent(criticalModifiers) - 124) < 1e-9, "40% 與 60% 暴擊傷害增益應以 1.4 × 1.6 乘算");
const customDefenseTimeline = applyEffectsAtCast(createInitialEffectTimelineState(), [
  {
    ...makeCriticalEffect("custom-row-one", "criticalRate", "暴擊率", 20),
    id: "custom-row-one-defense-reduction",
    action: "decrease",
    targetSide: "enemy",
    category: "defense",
    attribute: "雙防",
    magnitude: "20%",
  },
  {
    ...makeCriticalEffect("custom-row-two", "criticalRate", "暴擊率", 40),
    id: "custom-row-two-defense-reduction",
    action: "decrease",
    targetSide: "enemy",
    category: "defense",
    attribute: "雙防",
    magnitude: "40%",
  },
], 0);
assert.equal(customDefenseTimeline.states[0].activeEffects.length, 4, "兩列自訂防禦降低應各自保留物防與魔防時間軸，不互相覆蓋");

const schedule = createSkillSchedule({
  speed: 335,
  remainingSeconds: 5,
  environment: DEFAULT_ENVIRONMENT,
  environmentEnabled: false,
  normalAttackDamage: 1,
  skill1Damage: 100,
  skill2Damage: null,
  ultimateDamage: null,
  skill1Cooldown: "10秒",
  skill2Cooldown: null,
  initialSkill1CooldownElapsedSeconds: 8,
  ultimateUses: 0,
  ultimateGaugeMultiplier: 1,
  ultimateGaugePerAction: 0,
  getEffectsForSkill: () => [],
});
const firstSkill1 = schedule.actions.find((action) => action.skillKey === "skill1");
assert.ok(firstSkill1, "預先施放的一技能仍應能在冷卻結束後施放");
assert.ok(
  firstSkill1.actionTime >= 2 - 1e-9,
  "第三波開始前 8 秒施放、技能冷卻 10 秒，第三波開始後至少還要等 2 秒",
);

let capturedEnvironmentTargets: Array<{ id: string; targetEnemyId?: string | null }> = [];
const targetedEnvironment = {
  ...DEFAULT_ENVIRONMENT,
  defenseReduction: {
    ...DEFAULT_ENVIRONMENT.defenseReduction,
    enabled: true,
    targetScope: "specific" as const,
    targetEnemyId: "enemy-a",
  },
  attributeResistanceReduction: {
    ...DEFAULT_ENVIRONMENT.attributeResistanceReduction,
    enabled: true,
    targetScope: "specific" as const,
    targetEnemyId: "enemy-b",
  },
  criticalRateIncrease: {
    ...DEFAULT_ENVIRONMENT.criticalRateIncrease!,
    enabled: true,
    magnitude: "small" as const,
  },
  customEnemyEffects: [
    {
      id: "custom-defense-b",
      type: "defenseReduction" as const,
      enabled: true,
      magnitude: "medium" as const,
      durationSeconds: 15 as const,
      cooldownSeconds: 16,
      targetScope: "specific" as const,
      targetEnemyId: "enemy-b",
    },
  ],
};
createSkillSchedule({
  speed: 335,
  remainingSeconds: 0,
  environment: targetedEnvironment,
  environmentEnabled: true,
  normalAttackDamage: null,
  skill1Damage: null,
  skill2Damage: null,
  ultimateDamage: null,
  skill1Cooldown: null,
  skill2Cooldown: null,
  ultimateUses: 0,
  ultimateGaugeMultiplier: 1,
  ultimateGaugePerAction: 0,
  calculateDamage: (_skill, _time, activeEffects) => {
    capturedEnvironmentTargets = activeEffects.map((item) => ({
      id: item.effect.id,
      targetEnemyId: item.effect.targetEnemyId,
    }));
    return 1;
  },
  getEffectsForSkill: () => [],
});
assert.ok(capturedEnvironmentTargets.some((item) => item.id === "environment-defense-reduction_physical" && item.targetEnemyId === "enemy-a"));
assert.ok(capturedEnvironmentTargets.some((item) => item.id === "environment-attribute-resistance-reduction" && item.targetEnemyId === "enemy-b"));
assert.ok(capturedEnvironmentTargets.some((item) => item.id === "custom-custom-defense-b-defense-reduction_physical" && item.targetEnemyId === "enemy-b"));
assert.ok(capturedEnvironmentTargets.some((item) => item.id === "environment-critical-rate-increase"));

console.log("新增環境效果目標、暴擊增益及預先施放冷卻測試通過。");
