import { ACTION_GAUGE_SPEED_CONSTANT, parseCooldownSeconds } from "./ranking";

import type { EngineEffect } from "../../../engine/types/effect";
import type { ConfigurableEnvironmentEffect, MaximumModeEnvironment } from "../types";

import {
  applyEffectsAtCast,
  createInitialEffectTimelineState,
  mergeEffectTimelineStates,
  type EffectTimelineState,
  type TimedEffect,
} from "./effectTimeline";

export type ScheduledSkillKey =
  | "normalAttack"
  | "skill1"
  | "skill2"
  | "ultimate";

export interface SkillScheduleInput {
  speed: number | null;
  remainingSeconds: number;
  environment: MaximumModeEnvironment;
  environmentEnabled?: boolean;

  normalAttackDamage: number | null;
  skill1Damage: number | null;
  skill2Damage: number | null;
  ultimateDamage: number | null;

  skill1Cooldown: string | null;
  skill2Cooldown: string | null;

  ultimateUses: number | null;
  ultimateGaugeMultiplier: number;
  ultimateGaugePerAction: number;

  calculateDamage?: (
    skillKey: ScheduledSkillKey,
    actionTime: number,
    activeEffects: TimedEffect[],
    activeEnvironment: MaximumModeEnvironment,
  ) => number | null;

  calculateHealing?: (
    skillKey: ScheduledSkillKey,
    actionTime: number,
    activeEffects: TimedEffect[],
  ) => number | null;

  getEffectsForSkill?: (skillKey: ScheduledSkillKey) => EngineEffect[];

  // 支援單一狀態或多個初始機率狀態
  initialEffectState?: EffectTimelineState | EffectTimelineState[];
}

export interface ScheduledAction {
  skillKey: ScheduledSkillKey;
  actionTime: number;
  damage: number | null;
  healing: number | null;
}

export interface ScheduledActionProbability {
  skillKey: ScheduledSkillKey;
  actionTime: number;
  probability: number;
  expectedDamage: number;
  expectedHealing: number;
}

export interface SkillScheduleResult {
  actions: ScheduledAction[];
  actionProbabilities: ScheduledActionProbability[];
  totalDamage: number | null;
  totalHealing: number;
  warnings: string[];
}

interface SearchState {
  /** 目前累積的可用行動次數，上限為 2。 */
  actionPoints: 1 | 2;
  /** 下一次行動值累積完成的時間；滿 2 次時暫停累積，因此為 null。 */
  nextActionTime: number | null;
  lastSkill1Cast: number | null;
  lastSkill2Cast: number | null;
  ultimateUses: number;
  ultimateGauge: number;
  hasExited: boolean;
  effectState: EffectTimelineState;
}

interface InternalActionProbability {
  skillKey: ScheduledSkillKey;
  actionTime: number;
  probability: number;
  damageContribution: number;
  healingContribution: number;
}

interface ActionPathNode {
  action: ScheduledAction;
  next: ActionPathNode | null;
}

interface ProbabilityPlanBranch {
  probability: number;
  next: ProbabilityPlanNode | null;
}

/**
 * 以共享節點保存機率分支，避免每個搜尋狀態都複製完整的行動機率陣列。
 */
interface ProbabilityPlanNode {
  action: InternalActionProbability;
  branches: ProbabilityPlanBranch[];
  warnings: string[];
}

interface SearchResult {
  totalDamage: number;
  totalHealing: number;
  actionPath: ActionPathNode | null;
  probabilityPlan: ProbabilityPlanNode | null;
  representativeProbability: number;
}

const EPSILON = 1e-9;

/**
 * 必殺槽環境條件：開場 0 秒立即觸發，之後每經過一個 CD 再觸發。
 * fromTime 不含起點、toTime 包含終點；initial=true 時包含 t=0。
 */
export function applyUltimateGaugeEnvironmentTriggers(
  gauge: number,
  environment: MaximumModeEnvironment,
  fromTime: number,
  toTime: number,
  multiplier: number,
  initial = false,
): number {
  const effect = environment.ultimateGaugeIncrease;
  if (!effect?.enabled || !Number.isFinite(toTime) || toTime < 0) return gauge;

  const cooldown = effect.cooldownSeconds;
  let triggerCount = 0;

  if (!Number.isFinite(cooldown) || cooldown <= 0) {
    triggerCount = initial ? 1 : 0;
  } else {
    const throughTo = Math.floor((toTime + EPSILON) / cooldown) + 1;
    const beforeOrAtFrom = initial
      ? 0
      : Math.floor((Math.max(0, fromTime) + EPSILON) / cooldown) + 1;
    triggerCount = Math.max(0, throughTo - beforeOrAtFrom);
  }

  const points = triggerCount * effect.percentage * 100 * multiplier;
  return Math.min(10000, Math.max(0, gauge + points));
}

function isEnvironmentEffectActive(
  effect: ConfigurableEnvironmentEffect,
  actionTime: number,
): boolean {
  if (!effect.enabled || !Number.isFinite(actionTime) || actionTime < 0) {
    return false;
  }

  const cooldown = effect.cooldownSeconds;
  const duration = effect.durationSeconds;

  // CD 不大於 0 時，只計算戰鬥開始時的第一次觸發。
  if (!Number.isFinite(cooldown) || cooldown <= 0) {
    return actionTime <= duration + EPSILON;
  }

  // 找出 actionTime 之前最近一次觸發的時間。
  const lastTriggerTime =
    Math.floor((actionTime + EPSILON) / cooldown) * cooldown;

  return actionTime <= lastTriggerTime + duration + EPSILON;
}

function getActiveEnvironmentAtTime(
  environment: MaximumModeEnvironment,
  actionTime: number,
): MaximumModeEnvironment {
  return {
    attackIncrease: {
      ...environment.attackIncrease,
      enabled: isEnvironmentEffectActive(
        environment.attackIncrease,
        actionTime,
      ),
    },
    defenseReduction: {
      ...environment.defenseReduction,
      enabled: isEnvironmentEffectActive(
        environment.defenseReduction,
        actionTime,
      ),
    },
    attributeDamageIncrease: {
      ...environment.attributeDamageIncrease,
      enabled: isEnvironmentEffectActive(
        environment.attributeDamageIncrease,
        actionTime,
      ),
    },
    attributeResistanceReduction: {
      ...environment.attributeResistanceReduction,
      enabled: isEnvironmentEffectActive(
        environment.attributeResistanceReduction,
        actionTime,
      ),
    },
    speedIncrease: {
      ...environment.speedIncrease,
      enabled: isEnvironmentEffectActive(
        environment.speedIncrease,
        actionTime,
      ),
    },
    ultimateGaugeIncrease: { ...environment.ultimateGaugeIncrease },
  };
}

type EnvironmentEffectSpec = {
  id: string;
  config: ConfigurableEnvironmentEffect;
  action: EngineEffect["action"];
  category: EngineEffect["category"];
  attribute: string;
  value: number;
};

function getEnvironmentEffectSpecs(
  environment: MaximumModeEnvironment,
): EnvironmentEffectSpec[] {
  const magnitudeValue = (
    magnitude: ConfigurableEnvironmentEffect["magnitude"],
    values: Record<string, number>,
  ) => values[magnitude] ?? 0;

  const specs: EnvironmentEffectSpec[] = [
    {
      id: "environment-attack-increase",
      config: environment.attackIncrease,
      action: "increase",
      category: "attack",
      attribute: "雙攻",
      value: magnitudeValue(environment.attackIncrease.magnitude, {
        small: 20, medium: 40, large: 60,
      }),
    },
    {
      id: "environment-defense-reduction",
      config: environment.defenseReduction,
      action: "decrease",
      category: "defense",
      attribute: "雙防",
      value: magnitudeValue(environment.defenseReduction.magnitude, {
        small: 20, medium: 30, large: 40,
      }),
    },
    {
      id: "environment-attribute-damage-increase",
      config: environment.attributeDamageIncrease,
      action: "increase",
      category: "attack",
      attribute: "屬性傷害",
      value: magnitudeValue(environment.attributeDamageIncrease.magnitude, {
        small: 20, medium: 40, large: 60,
      }),
    },
    {
      id: "environment-speed-increase",
      config: environment.speedIncrease,
      action: "increase",
      category: "speed",
      attribute: "速度",
      value: magnitudeValue(environment.speedIncrease.magnitude, {
        small: 20, medium: 40, large: 60,
      }),
    },
  ];

  for (const element of ["火", "水", "風", "地", "雷", "光", "暗"]) {
    specs.push({
      id: `environment-${element}-resistance-reduction`,
      config: environment.attributeResistanceReduction,
      action: "decrease",
      category: "defense",
      attribute: `${element}屬性抗性`,
      value: magnitudeValue(environment.attributeResistanceReduction.magnitude, {
        small: 20, medium: 30, large: 40,
      }),
    });
  }

  return specs;
}

function createEnvironmentEngineEffect(
  spec: EnvironmentEffectSpec,
): EngineEffect {
  const duration = spec.config.durationSeconds;
  return {
    id: spec.id,
    action: spec.action,
    targetSide: spec.action === "increase" ? "ally" : "enemy",
    range: "all",
    category: spec.category,
    attribute: spec.attribute,
    searchableCategories: [spec.category],
    magnitude: `${spec.value}%`,
    value: `${spec.value}%`,
    duration: `${duration}秒`,
    chance: "",
    originalText: `最大值環境效果：${spec.attribute}${spec.action === "increase" ? "提升" : "降低"}${spec.value}%，持續${duration}秒`,
    source: "skill",
    calculations: [],
    reviewRequired: false,
    reviewIssues: [],
  };
}

/**
 * 將兩個行動時間點之間發生的外部環境效果依時間順序寫入效果時間軸。
 * fromTime 不含起點、toTime 包含終點；初始呼叫會特別納入 t=0。
 */
function applyEnvironmentTriggers(
  state: EffectTimelineState,
  environment: MaximumModeEnvironment,
  fromTime: number,
  toTime: number,
  includeFrom = false,
): EffectTimelineState {
  if (toTime < 0 || toTime + EPSILON < fromTime) return state;

  const events = new Map<number, EngineEffect[]>();

  for (const spec of getEnvironmentEffectSpecs(environment)) {
    if (!spec.config.enabled || spec.value <= 0) continue;

    const cooldown = spec.config.cooldownSeconds;
    let latestTriggerTime: number | null = null;

    if (!Number.isFinite(cooldown) || cooldown <= 0) {
      latestTriggerTime = 0;
    } else {
      const lastIndex = Math.floor((toTime + EPSILON) / cooldown);
      latestTriggerTime = Number((lastIndex * cooldown).toFixed(8));
    }

    if (latestTriggerTime === null) continue;

    const isAfterStart = includeFrom
      ? latestTriggerTime + EPSILON >= fromTime
      : latestTriggerTime > fromTime + EPSILON;

    if (!isAfterStart || latestTriggerTime > toTime + EPSILON) continue;

    // 同一效果在兩次角色行動之間可能觸發多次；中間沒有傷害結算，
    // 依「刷新持續時間、保留較高幅度」規則，只需套用區間內最後一次觸發。
    const effects = events.get(latestTriggerTime) ?? [];
    effects.push(createEnvironmentEngineEffect(spec));
    events.set(latestTriggerTime, effects);
  }

  let currentState = state;
  const sortedEvents = Array.from(events.entries()).sort((a, b) => a[0] - b[0]);

  for (const [triggerTime, effects] of sortedEvents) {
    const applied = applyEffectsAtCast([currentState], effects, triggerTime);
    if (applied.states.length > 0) {
      currentState = mergeEffectTimelineStates(applied.states)[0] ?? currentState;
    }
  }

  return currentState;
}

type UltimateGaugeBranch = {
  gauge: number;
  probability: number;
};

function applyUltimateGaugeEffects(
  initialGauge: number,
  effects: EngineEffect[],
  multiplier: number,
): {
  branches: UltimateGaugeBranch[];
  warnings: string[];
} {
  let branches: UltimateGaugeBranch[] = [
    {
      gauge: initialGauge,
      probability: 1,
    },
  ];

  const warnings: string[] = [];

  const gaugeEffects = effects.filter(
    (effect) =>
      effect.category === "ultimateGauge" &&
      (effect.targetSide === "self" || effect.targetSide === "ally"),
  );

  for (const effect of gaugeEffects) {
    if (effect.action !== "increase" && effect.action !== "decrease") {
      continue;
    }

    const valueMatch = effect.value.match(/-?\d+(?:\.\d+)?/);

    if (!valueMatch) {
      warnings.push(`必殺值效果數值無法辨識：「${effect.originalText}」`);
      continue;
    }

    const percent = Number(valueMatch[0]);

    if (!Number.isFinite(percent)) {
      continue;
    }

    let chance = 1;

    if (effect.chance.trim()) {
      const chanceMatch = effect.chance.match(/\d+(?:\.\d+)?/);

      if (!chanceMatch) {
        warnings.push(`必殺值效果機率無法辨識：「${effect.originalText}」`);
        continue;
      }

      chance = Math.max(0, Math.min(100, Number(chanceMatch[0]))) / 100;
    }

    const points = percent * 100 * multiplier;

    const nextBranches: UltimateGaugeBranch[] = [];

    for (const branch of branches) {
      // 效果未發動
      if (chance < 1) {
        nextBranches.push({
          gauge: branch.gauge,
          probability: branch.probability * (1 - chance),
        });
      }

      // 效果成功發動
      if (chance > 0) {
        const nextGauge =
          effect.action === "increase"
            ? Math.min(10000, branch.gauge + points)
            : Math.max(0, branch.gauge - points);

        nextBranches.push({
          gauge: nextGauge,
          probability: branch.probability * chance,
        });
      }
    }

    // 合併必殺值相同的機率分支
    const merged = new Map<string, UltimateGaugeBranch>();

    for (const branch of nextBranches) {
      const key = branch.gauge.toFixed(8);
      const existing = merged.get(key);

      if (existing) {
        existing.probability += branch.probability;
      } else {
        merged.set(key, { ...branch });
      }
    }

    branches = Array.from(merged.values());
  }

  return {
    branches,
    warnings,
  };
}

/**
 * 取得指定時間點仍有效的效果。
 *
 * 到期時間等於行動時間時，
 * 效果仍參與當次傷害計算。
 */
function getActiveEffects(
  effects: TimedEffect[],
  actionTime: number,
): TimedEffect[] {
  return effects.filter((effect) => {
    if (effect.appliedAt > actionTime) {
      return false;
    }

    return effect.expiresAt === null || effect.expiresAt >= actionTime;
  });
}

/**
 * 計算目前有效的速度倍率。
 * 只套用自身或我方全體的速度增減益，與傷害效果的目標判斷一致。
 */
function getSpeedMultiplier(
  effects: TimedEffect[],
  actionTime: number,
): number {
  let strongestIncrease = 0;
  let strongestDecrease = 0;

  for (const timedEffect of effects) {
    const effect = timedEffect.effect;

    if (
      effect.category !== "speed" ||
      effect.attribute !== "速度" ||
      (effect.action !== "increase" && effect.action !== "decrease")
    ) {
      continue;
    }

    if (
      effect.targetSide !== "self" &&
      !(effect.targetSide === "ally" && effect.range === "all")
    ) {
      continue;
    }

    if (
      timedEffect.appliedAt > actionTime + EPSILON ||
      (timedEffect.expiresAt !== null && timedEffect.expiresAt <= actionTime + EPSILON)
    ) {
      continue;
    }

    const value = timedEffect.magnitudeValue;
    if (value === null || !Number.isFinite(value) || value < 0) {
      continue;
    }

    // 同類速度效果不相乘，依效果時間軸保留最高幅度並刷新持續時間。
    if (effect.action === "increase") {
      strongestIncrease = Math.max(strongestIncrease, value);
    } else {
      strongestDecrease = Math.max(strongestDecrease, value);
    }
  }

  return (1 + strongestIncrease / 100) * Math.max(0, 1 - strongestDecrease / 100);
}

/**
 * 依照速度效果的到期時間分段累積行動值。
 * 速度變化時保留已累積的行動值，只用新速度計算剩餘部分。
 */
function calculateNextActionTime(
  startTime: number,
  effectState: EffectTimelineState,
  baseSpeed: number | null,
  environment: MaximumModeEnvironment,
  environmentEnabled: boolean,
): number | null {
  if (
    baseSpeed === null ||
    !Number.isFinite(baseSpeed) ||
    baseSpeed <= 0 ||
    !Number.isFinite(startTime)
  ) {
    return null;
  }

  let accumulatedGauge = 0;
  let cursor = startTime;
  let currentEffectState = effectState;
  const targetGauge = ACTION_GAUGE_SPEED_CONSTANT;
  const speedEnvironmentSpec = environmentEnabled
    ? getEnvironmentEffectSpecs(environment).find(
        (spec) => spec.id === "environment-speed-increase" && spec.config.enabled,
      ) ?? null
    : null;

  // 每段只跨越角色速度效果到期點或環境速度觸發點。
  // 環境效果在觸發時會套用至暫存時間軸，沿用同類效果取高值、刷新持續時間的規則。
  for (let segment = 0; segment < 10000; segment += 1) {
    const activeSpeedEffects = currentEffectState.activeEffects.filter((item) => {
      const effect = item.effect;
      return (
        effect.category === "speed" &&
        effect.attribute === "速度" &&
        (effect.action === "increase" || effect.action === "decrease") &&
        item.appliedAt <= cursor + EPSILON &&
        (item.expiresAt === null || item.expiresAt > cursor + EPSILON)
      );
    });

    const multiplier = getSpeedMultiplier(activeSpeedEffects, cursor);
    const currentSpeed = baseSpeed * multiplier;

    let nextBoundary = Number.POSITIVE_INFINITY;
    for (const item of activeSpeedEffects) {
      if (item.expiresAt !== null && item.expiresAt > cursor + EPSILON) {
        nextBoundary = Math.min(nextBoundary, item.expiresAt);
      }
    }

    let nextEnvironmentTrigger: number | null = null;
    if (speedEnvironmentSpec) {
      const cooldown = speedEnvironmentSpec.config.cooldownSeconds;
      if (Number.isFinite(cooldown) && cooldown > 0) {
        nextEnvironmentTrigger =
          (Math.floor((cursor + EPSILON) / cooldown) + 1) * cooldown;
        nextBoundary = Math.min(nextBoundary, nextEnvironmentTrigger);
      }
    }

    if (!Number.isFinite(nextBoundary)) {
      if (currentSpeed <= 0) return null;
      return cursor + (targetGauge - accumulatedGauge) / currentSpeed;
    }

    const segmentDuration = nextBoundary - cursor;
    if (segmentDuration <= EPSILON) {
      cursor = nextBoundary + EPSILON * 2;
      continue;
    }

    if (currentSpeed > 0) {
      const gaugeAvailable = currentSpeed * segmentDuration;
      const gaugeNeeded = targetGauge - accumulatedGauge;

      if (gaugeAvailable + EPSILON >= gaugeNeeded) {
        return cursor + gaugeNeeded / currentSpeed;
      }

      accumulatedGauge += gaugeAvailable;
    }

    cursor = nextBoundary;

    // 到達環境速度觸發點時，立即更新暫存時間軸，保留已累積的行動值。
    if (
      speedEnvironmentSpec &&
      nextEnvironmentTrigger !== null &&
      Math.abs(cursor - nextEnvironmentTrigger) <= EPSILON
    ) {
      const applied = applyEffectsAtCast(
        [currentEffectState],
        [createEnvironmentEngineEffect(speedEnvironmentSpec)],
        cursor,
      );
      if (applied.states.length > 0) {
        currentEffectState =
          mergeEffectTimelineStates(applied.states)[0] ?? currentEffectState;
      }
    }
  }

  return null;
}

/**
 * 當次傷害完成後，移除已到期效果。
 */
function expireEffectsAfterDamage(
  state: EffectTimelineState,
  actionTime: number,
): EffectTimelineState {
  return {
    ...state,
    activeEffects: state.activeEffects.filter((effect) => {
      return effect.expiresAt === null || effect.expiresAt > actionTime;
    }),
  };
}

/**
 * 建立效果狀態識別字串。
 *
 * 機率不參與狀態識別。
 */
function createEffectStateKey(state: EffectTimelineState): string {
  return JSON.stringify(
    state.activeEffects
      .map((effect) => ({
        effectKey: effect.effectKey,
        appliedAt: effect.appliedAt,
        expiresAt: effect.expiresAt,
        magnitudeValue: effect.magnitudeValue,
      }))
      .sort((a, b) => a.effectKey.localeCompare(b.effectKey)),
  );
}

/**
 * 只以目前時間點仍有效的效果作為搜尋狀態識別。
 * 已到期效果之後會在 applyEffectsAtCast 中被移除，不影響未來結果；
 * 不把它們放進 memo key，可合併更多等價狀態。
 */
function createEffectStateKeyAtTime(
  state: EffectTimelineState,
  actionTime: number,
): string {
  return createEffectStateKey({
    ...state,
    activeEffects: state.activeEffects.filter(
      (effect) =>
        effect.appliedAt <= actionTime &&
        (effect.expiresAt === null || effect.expiresAt >= actionTime),
    ),
  });
}



/**
 * 建立技能施放排程。
 *
 * 行動最多累積兩次；累積未滿時可選擇等待，累積滿兩次後必須先消耗一次。
 * 同一時間點可連續消耗已累積的行動次數。
 * 技能一、技能二依冷卻時間判定。
 * 必殺技依使用者設定次數施放，不檢查冷卻。
 * 普通攻擊填補其他行動。
 *
 * 支援效果觸發機率分支。
 * 每個效果狀態分支都能獨立最佳化後續技能順序。
 */
export function createSkillSchedule(
  input: SkillScheduleInput,
): SkillScheduleResult {
  if (
    input.speed === null ||
    !Number.isFinite(input.speed) ||
    input.speed <= 0 ||
    !Number.isFinite(input.remainingSeconds) ||
    input.remainingSeconds < 0
  ) {
    return {
      actions: [],
      actionProbabilities: [],
      totalDamage: null,
      totalHealing: 0,
      warnings: ["無法產生行動時間，請檢查角色速度及計算時間。"],
    };
  }

  const skill1Cooldown = parseCooldownSeconds(input.skill1Cooldown);

  const skill2Cooldown = parseCooldownSeconds(input.skill2Cooldown);

  const warnings: string[] = [];

  if (skill1Cooldown === null) {
    warnings.push("技能一冷卻時間無法辨識，暫不安排技能一。");
  }

  if (skill2Cooldown === null) {
    warnings.push("技能二冷卻時間無法辨識，暫不安排技能二。");
  }

  // 技能效果資料在同一次排程中固定，避免搜尋每個節點都重複整理。
  const skillEffectsCache = new Map<ScheduledSkillKey, EngineEffect[]>();
  const getSkillEffects = (skillKey: ScheduledSkillKey): EngineEffect[] => {
    const cached = skillEffectsCache.get(skillKey);
    if (cached) return cached;

    const effects = input.getEffectsForSkill?.(skillKey) ?? [];
    skillEffectsCache.set(skillKey, effects);
    return effects;
  };

  // 取得必殺技效果，判斷是否具有自身立即退場效果。
  const ultimateEffects = getSkillEffects("ultimate");

  const ultimateHasImmediateExit = ultimateEffects.some(
    (effect) =>
      effect.category === "special" &&
      effect.targetSide === "self" &&
      /立即退場/.test(effect.originalText),
  );

  // 留空代表不限制，最多以全部行動時間點作為上限。
  let ultimateUses = input.ultimateUses === null ? Number.MAX_SAFE_INTEGER : 0;

  if (
    input.ultimateUses !== null &&
    (!Number.isFinite(input.ultimateUses) ||
      !Number.isInteger(input.ultimateUses) ||
      input.ultimateUses < 0)
  ) {
    warnings.push("必殺技施放次數必須是大於或等於零的整數。");
  } else if (input.ultimateUses !== null) {
    ultimateUses = input.ultimateUses;
  }

  // 有立即退場效果，而且設定超過一次或不限制時，
  // 自動改成最後一個行動時間點施放一次。
  const delayUltimateUntilEnd =
    ultimateHasImmediateExit &&
    (input.ultimateUses === null || input.ultimateUses > 1);

  if (delayUltimateUntilEnd) {
    ultimateUses = 1;
  }

  const damageValues: Record<ScheduledSkillKey, number | null> = {
    normalAttack: input.normalAttackDamage,
    skill1: input.skill1Damage,
    skill2: input.skill2Damage,
    ultimate: input.ultimateDamage,
  };

  // 取得初始效果狀態。
  // createInitialEffectTimelineState 回傳的是陣列。
  const rawInitialStates = input.initialEffectState
    ? Array.isArray(input.initialEffectState)
      ? input.initialEffectState
      : [input.initialEffectState]
    : createInitialEffectTimelineState();

  // 排除無效的初始效果狀態。
  const validInitialStates = rawInitialStates.filter(
    (state) => Number.isFinite(state.probability) && state.probability > 0,
  );

  if (validInitialStates.length !== rawInitialStates.length) {
    warnings.push("部分初始效果狀態的機率無效，已排除。");
  }

  const initialStates = mergeEffectTimelineStates(validInitialStates);

  const initialProbabilityTotal = initialStates.reduce(
    (sum, state) => sum + state.probability,
    0,
  );

  if (
    !Number.isFinite(initialProbabilityTotal) ||
    initialProbabilityTotal <= 0
  ) {
    return {
      actions: [],
      actionProbabilities: [],
      totalDamage: null,
      totalHealing: 0,
      warnings: [...warnings, "有效初始效果狀態的總機率必須大於零。"],
    };
  }

  // 每個效果狀態分支獨立搜尋。
  const memo = new Map<string, SearchResult>();

  // 相同技能、時間點及有效效果狀態的傷害／治療結果可直接重用。
  const damageCache = new Map<string, number | null>();
  const healingCache = new Map<string, number | null>();
  const effectApplicationCache = new Map<
    string,
    { states: EffectTimelineState[]; warnings: string[] }
  >();
  const ultimateGaugeEffectCache = new Map<
    string,
    ReturnType<typeof applyUltimateGaugeEffects>
  >();

  function search(actionTime: number, state: SearchState): SearchResult {
    if (state.hasExited || actionTime > input.remainingSeconds + EPSILON) {
      return {
        totalDamage: 0,
        totalHealing: 0,
        actionPath: null,
        probabilityPlan: null,
        representativeProbability: 1,
      };
    }

    const memoKey = [
      actionTime.toFixed(6),
      state.actionPoints,
      state.nextActionTime === null ? "paused" : state.nextActionTime.toFixed(6),
      state.lastSkill1Cast === null
        ? "none"
        : Math.max(0, state.lastSkill1Cast + (skill1Cooldown ?? 0) - actionTime).toFixed(6),
      state.lastSkill2Cast === null
        ? "none"
        : Math.max(0, state.lastSkill2Cast + (skill2Cooldown ?? 0) - actionTime).toFixed(6),
      state.ultimateUses,
      state.ultimateGauge,
      state.hasExited,
      createEffectStateKeyAtTime(state.effectState, actionTime),
    ].join("|");

    const cached = memo.get(memoKey);

    if (cached) {
      return cached;
    }

    const nextGaugeTime = calculateNextActionTime(
      actionTime,
      state.effectState,
      input.speed,
      input.environment,
      input.environmentEnabled !== false,
    );
    const isFinalAction =
      nextGaugeTime === null ||
      nextGaugeTime > input.remainingSeconds + EPSILON;

    const candidates: ScheduledSkillKey[] = delayUltimateUntilEnd
      ? isFinalAction
        ? []
        : ["normalAttack"]
      : ["normalAttack"];

    if (
      skill1Cooldown !== null &&
      (state.lastSkill1Cast === null ||
        actionTime + EPSILON >= state.lastSkill1Cast + skill1Cooldown)
    ) {
      candidates.push("skill1");
    }

    if (
      skill2Cooldown !== null &&
      (state.lastSkill2Cast === null ||
        actionTime + EPSILON >= state.lastSkill2Cast + skill2Cooldown)
    ) {
      candidates.push("skill2");
    }

    const canUseUltimate =
      input.ultimateUses === null
        ? state.ultimateGauge >= 10000
        : state.ultimateUses < ultimateUses;

    if (delayUltimateUntilEnd) {
      // 立即退場模式：只能在最後一個行動時間點施放。
      if (isFinalAction && canUseUltimate) {
        candidates.push("ultimate");
      }
    } else if (canUseUltimate) {
      candidates.push("ultimate");
    }

    let bestResult: SearchResult | null = null;

    const activeEffects = getActiveEffects(
      state.effectState.activeEffects,
      actionTime,
    );
    const activeEffectsKey = createEffectStateKey({
      activeEffects,
      probability: 1,
    });
    const activeEnvironment = getActiveEnvironmentAtTime(
      input.environment,
      actionTime,
    );

    for (const skillKey of candidates) {
      const callbackCacheKey = `${skillKey}|${actionTime.toFixed(6)}|${activeEffectsKey}`;

      // 計算當次傷害；相同狀態不重複呼叫完整傷害計算。
      let damageResult = damageValues[skillKey];
      if (input.calculateDamage) {
        if (damageCache.has(callbackCacheKey)) {
          damageResult = damageCache.get(callbackCacheKey) ?? null;
        } else {
          damageResult = input.calculateDamage(
            skillKey,
            actionTime,
            activeEffects,
            activeEnvironment,
          );
          damageCache.set(callbackCacheKey, damageResult);
        }
      }

      // 計算當次治療量；相同狀態直接使用快取。
      let healingResult: number | null = null;
      if (input.calculateHealing) {
        if (healingCache.has(callbackCacheKey)) {
          healingResult = healingCache.get(callbackCacheKey) ?? null;
        } else {
          healingResult = input.calculateHealing(
            skillKey,
            actionTime,
            activeEffects,
          );
          healingCache.set(callbackCacheKey, healingResult);
        }
      }

      const candidateWarnings: string[] = [];

      // 傷害數值有效時才保留
      const damage =
        damageResult !== null &&
        Number.isFinite(damageResult) &&
        damageResult >= 0
          ? damageResult
          : null;

      // 治療數值有效時才保留
      let healing = 0;

      if (healingResult !== null && healingResult !== undefined) {
        if (Number.isFinite(healingResult) && healingResult >= 0) {
          healing = healingResult;
        } else {
          candidateWarnings.push(
            `${skillKey} 在 ${actionTime} 秒的治療量無效，已視為 0。`,
          );
        }
      }

      // 傷害與治療都沒有有效數值，才跳過這次技能
      if (damage === null && healing <= 0) {
        continue;
      }

      // 純治療技能的傷害貢獻視為 0
      const damageValue = damage ?? 0;

      // 先計算當次傷害，再判定技能附帶效果。
      const skillEffects = getSkillEffects(skillKey);

      const tracksUltimateGauge = input.ultimateUses === null;
      const baseUltimateGauge = tracksUltimateGauge
        ? skillKey === "ultimate"
          ? 0
          : Math.min(
              10000,
              state.ultimateGauge +
                input.ultimateGaugePerAction * input.ultimateGaugeMultiplier,
            )
        : 0;

      const ultimateGaugeCacheKey = `${skillKey}|${baseUltimateGauge}`;
      let ultimateGaugeResult = ultimateGaugeEffectCache.get(
        ultimateGaugeCacheKey,
      );
      if (!ultimateGaugeResult) {
        const calculatedGaugeResult = applyUltimateGaugeEffects(
          baseUltimateGauge,
          skillEffects,
          input.ultimateGaugeMultiplier,
        );

        // 已指定必殺技施放次數時，必殺值不再影響可否施放；
        // 保留資料警告，但合併必殺值分支，避免產生無用的搜尋組合。
        ultimateGaugeResult = tracksUltimateGauge
          ? calculatedGaugeResult
          : {
              branches: [
                {
                  gauge: 0,
                  probability: calculatedGaugeResult.branches.reduce(
                    (sum, branch) => sum + branch.probability,
                    0,
                  ),
                },
              ],
              warnings: calculatedGaugeResult.warnings,
            };

        ultimateGaugeEffectCache.set(
          ultimateGaugeCacheKey,
          ultimateGaugeResult,
        );
      }

      candidateWarnings.push(...ultimateGaugeResult.warnings);

      let nextEffectStates: EffectTimelineState[];

      if (skillEffects.length > 0) {
        const effectCacheKey = `${skillKey}|${actionTime.toFixed(6)}|${createEffectStateKeyAtTime(
          state.effectState,
          actionTime,
        )}`;
        let cachedApplication = effectApplicationCache.get(effectCacheKey);

        if (!cachedApplication) {
          // 以機率 1 計算一次，再於取用時乘回目前狀態機率，
          // 讓相同效果狀態不必反覆建立相同的機率分支。
          const normalizedState: EffectTimelineState = {
            ...state.effectState,
            probability: 1,
          };
          const applied = applyEffectsAtCast(
            [normalizedState],
            skillEffects,
            actionTime,
          );

          const normalizedStates = mergeEffectTimelineStates(
            applied.states.map((nextState) =>
              expireEffectsAfterDamage(nextState, actionTime),
            ),
          );

          cachedApplication = {
            states: normalizedStates,
            warnings: applied.warnings,
          };
          effectApplicationCache.set(effectCacheKey, cachedApplication);
        }

        candidateWarnings.push(...cachedApplication.warnings);
        nextEffectStates = cachedApplication.states.map((nextState) => ({
          ...nextState,
          probability:
            nextState.probability * state.effectState.probability,
        }));
      } else {
        // 沒有技能效果時仍需在當次傷害後清除到期效果。
        nextEffectStates = [
          expireEffectsAfterDamage(state.effectState, actionTime),
        ];
      }

      const nextStateBase = {
        lastSkill1Cast:
          skillKey === "skill1" ? actionTime : state.lastSkill1Cast,

        lastSkill2Cast:
          skillKey === "skill2" ? actionTime : state.lastSkill2Cast,

        ultimateUses: state.ultimateUses + (skillKey === "ultimate" ? 1 : 0),
        ultimateGauge: baseUltimateGauge,
        hasExited:
          state.hasExited ||
          (skillKey === "ultimate" && ultimateHasImmediateExit),
      };

      // 計算每個效果分支相對於目前狀態的機率。
      const currentProbability = state.effectState.probability;

      const effectTransitions = nextEffectStates.map((nextState) => ({
        state: nextState,
        probability:
          currentProbability > 0
            ? nextState.probability / currentProbability
            : 0,
      }));

      const transitions = effectTransitions.flatMap((effectTransition) =>
        ultimateGaugeResult.branches.map((gaugeBranch) => ({
          state: effectTransition.state,
          ultimateGauge: gaugeBranch.gauge,
          probability: effectTransition.probability * gaugeBranch.probability,
        })),
      );

      const totalTransitionProbability = transitions.reduce(
        (sum, transition) => sum + transition.probability,
        0,
      );

      if (totalTransitionProbability <= 0) {
        continue;
      }

      let expectedFutureDamage = 0;
      let expectedFutureHealing = 0;

      let representativePath: ActionPathNode | null = null;

      let representativeProbability = 0;

      const probabilityBranches: ProbabilityPlanBranch[] = [];

      for (const transition of transitions) {
        const transitionProbability =
          transition.probability / totalTransitionProbability;

        if (transitionProbability <= 0) {
          continue;
        }

        // 消耗一次行動後：保留已累積次數；若歸零，才等待下一次行動值完成。
        const remainingActionPoints = state.actionPoints - 1;
        const nextGaugeTimeForBranch = calculateNextActionTime(
          actionTime,
          transition.state,
          input.speed,
          input.environment,
          input.environmentEnabled !== false,
        );

        let nextActionTime = actionTime;
        let nextActionPoints: 1 | 2;
        let nextGaugeTime: number | null;
        let nextEffectState = transition.state;

        if (remainingActionPoints > 0) {
          nextActionPoints = remainingActionPoints as 1 | 2;
          nextGaugeTime = nextGaugeTimeForBranch;
        } else if (
          nextGaugeTimeForBranch !== null &&
          nextGaugeTimeForBranch <= input.remainingSeconds + EPSILON
        ) {
          nextActionTime = nextGaugeTimeForBranch;
          nextActionPoints = 1;
          if (input.environmentEnabled !== false) {
            nextEffectState = applyEnvironmentTriggers(
              nextEffectState,
              input.environment,
              actionTime,
              nextActionTime,
            );
          }
          nextGaugeTime = calculateNextActionTime(
            nextActionTime,
            nextEffectState,
            input.speed,
            input.environment,
            input.environmentEnabled !== false,
          );
        } else {
          nextActionPoints = 1;
          nextGaugeTime = null;
        }

        // 每個機率分支各自重新最佳化後續技能順序。
        const gaugeAtNextAction = tracksUltimateGauge && input.environmentEnabled !== false
          ? applyUltimateGaugeEnvironmentTriggers(
              transition.ultimateGauge,
              input.environment,
              actionTime,
              nextActionTime,
              input.ultimateGaugeMultiplier,
            )
          : tracksUltimateGauge ? transition.ultimateGauge : 0;

        const futureResult =
          remainingActionPoints === 0 &&
          (nextGaugeTimeForBranch === null ||
            nextGaugeTimeForBranch > input.remainingSeconds + EPSILON)
            ? {
                totalDamage: 0,
                totalHealing: 0,
                actionPath: null,
                probabilityPlan: null,
                representativeProbability: 1,
              }
            : search(nextActionTime, {
                ...nextStateBase,
                actionPoints: nextActionPoints,
                nextActionTime: nextGaugeTime,
                ultimateGauge: gaugeAtNextAction,
                effectState: nextEffectState,
              });

        expectedFutureDamage +=
          futureResult.totalDamage * transitionProbability;

        expectedFutureHealing +=
          futureResult.totalHealing * transitionProbability;

        probabilityBranches.push({
          probability: transitionProbability,
          next: futureResult.probabilityPlan,
        });

        // 找出機率最高的完整排程分支。
        const branchProbability =
          transitionProbability * futureResult.representativeProbability;

        if (branchProbability > representativeProbability) {
          representativeProbability = branchProbability;

          representativePath = futureResult.actionPath;
        }
      }

      const candidateResult: SearchResult = {
        totalDamage: damageValue + expectedFutureDamage,

        totalHealing: healing + expectedFutureHealing,

        actionPath: {
          action: {
            skillKey,
            actionTime,
            damage,
            healing,
          },
          next: representativePath,
        },

        probabilityPlan: {
          action: {
            skillKey,
            actionTime,
            probability: 1,
            damageContribution: damageValue,
            healingContribution: healing,
          },
          branches: probabilityBranches,
          warnings: [...new Set(candidateWarnings)],
        },

        representativeProbability,
      };

      if (
        bestResult === null ||
        candidateResult.totalDamage > bestResult.totalDamage
      ) {
        bestResult = candidateResult;
      }
    }

    // 累積未滿 2 次時可等待下一次行動值完成；滿 2 次時不再累積。
    if (
      state.actionPoints < 2 &&
      state.nextActionTime !== null &&
      state.nextActionTime <= input.remainingSeconds + EPSILON
    ) {
      const waitedEffectState =
        input.environmentEnabled === false
          ? state.effectState
          : applyEnvironmentTriggers(
              state.effectState,
              input.environment,
              actionTime,
              state.nextActionTime,
            );

      const waitedGauge = input.ultimateUses === null && input.environmentEnabled !== false
        ? applyUltimateGaugeEnvironmentTriggers(
            state.ultimateGauge,
            input.environment,
            actionTime,
            state.nextActionTime,
            input.ultimateGaugeMultiplier,
          )
        : input.ultimateUses === null ? state.ultimateGauge : 0;

      const waitResult = search(state.nextActionTime, {
        ...state,
        actionPoints: 2,
        nextActionTime: null,
        ultimateGauge: waitedGauge,
        effectState: waitedEffectState,
      });

      if (
        bestResult === null ||
        waitResult.totalDamage > bestResult.totalDamage
      ) {
        bestResult = waitResult;
      }
    }

    const result = bestResult ?? {
      totalDamage: 0,
      totalHealing: 0,
      actionPath: null,
      probabilityPlan: null,
      representativeProbability: 1,
    };

    memo.set(memoKey, result);

    return result;
  }

  // 將所有初始狀態的計算結果合併。
  let expectedTotalDamage = 0;
  let expectedTotalHealing = 0;

  let representativePath: ActionPathNode | null = null;

  let representativeProbability = -1;

  const rootProbabilityPlans: Array<{
    plan: ProbabilityPlanNode | null;
    weight: number;
  }> = [];

  for (const initialState of initialStates) {
    const initialWeight = initialState.probability / initialProbabilityTotal;

    if (initialWeight <= 0) {
      continue;
    }

    // 第三波起始必殺值設定
    // 7000 = 原本起始值（進入兩波 + 擊殺三隻小怪 + 一次行動）
    // 500 = 每次受到攻擊增加的必殺值
    // 如果未來要調整預設受到攻擊的次數，只需要修改下面的 2
    const assumedReceivedAttacks = 2;

    const startingEffectState =
      input.environmentEnabled === false
        ? initialState
        : applyEnvironmentTriggers(
            initialState,
            input.environment,
            0,
            0,
            true,
          );

    const result = search(0, {
      // 戰鬥開始時已有一次可用行動。
      actionPoints: 1,
      nextActionTime: calculateNextActionTime(
        0,
        startingEffectState,
        input.speed,
        input.environment,
        input.environmentEnabled !== false,
      ),
      lastSkill1Cast: null,
      lastSkill2Cast: null,
      ultimateUses: 0,
      ultimateGauge: input.environmentEnabled === false
        ? Math.min(
            10000,
            (7000 + assumedReceivedAttacks * 500) * input.ultimateGaugeMultiplier,
          )
        : applyUltimateGaugeEnvironmentTriggers(
            Math.min(
              10000,
              (7000 + assumedReceivedAttacks * 500) * input.ultimateGaugeMultiplier,
            ),
            input.environment,
            0,
            0,
            input.ultimateGaugeMultiplier,
            true,
          ),
      effectState: startingEffectState,
      hasExited: false,
    });

    expectedTotalDamage += result.totalDamage * initialWeight;
    expectedTotalHealing += result.totalHealing * initialWeight;

    rootProbabilityPlans.push({
      plan: result.probabilityPlan,
      weight: initialWeight,
    });

    const branchProbability = initialWeight * result.representativeProbability;

    if (branchProbability > representativeProbability) {
      representativeProbability = branchProbability;

      representativePath = result.actionPath;
    }
  }

  // 從最終選定的搜尋 DAG 一次彙總所有行動機率及提醒，
  // 不在每一個遞迴節點重複複製、合併整份陣列。
  const aggregatedActions = new Map<string, InternalActionProbability>();
  const planWarnings = new Set<string>();
  const pendingWeights = new Map<ProbabilityPlanNode, number>();
  const pendingNodes: ProbabilityPlanNode[] = [];

  const addPendingPlan = (
    node: ProbabilityPlanNode | null,
    weight: number,
  ) => {
    if (!node || weight <= 0) return;

    const existingWeight = pendingWeights.get(node);
    if (existingWeight === undefined) {
      pendingWeights.set(node, weight);
      pendingNodes.push(node);
    } else {
      pendingWeights.set(node, existingWeight + weight);
    }
  };

  for (const root of rootProbabilityPlans) {
    addPendingPlan(root.plan, root.weight);
  }

  let pendingIndex = 0;
  while (pendingIndex < pendingNodes.length) {
    const node = pendingNodes[pendingIndex++];
    const addedWeight = pendingWeights.get(node) ?? 0;
    pendingWeights.delete(node);

    if (addedWeight <= 1e-15) continue;

    const action = node.action;
    const actionKey = `${action.skillKey}|${action.actionTime.toFixed(6)}`;
    const existing = aggregatedActions.get(actionKey);

    if (existing) {
      existing.probability += action.probability * addedWeight;
      existing.damageContribution += action.damageContribution * addedWeight;
      existing.healingContribution += action.healingContribution * addedWeight;
    } else {
      aggregatedActions.set(actionKey, {
        ...action,
        probability: action.probability * addedWeight,
        damageContribution: action.damageContribution * addedWeight,
        healingContribution: action.healingContribution * addedWeight,
      });
    }

    node.warnings.forEach((warning) => planWarnings.add(warning));

    for (const branch of node.branches) {
      addPendingPlan(branch.next, addedWeight * branch.probability);
    }
  }

  const combinedActionProbabilities = Array.from(aggregatedActions.values());
  const actionProbabilities: ScheduledActionProbability[] =
    combinedActionProbabilities.map((item) => ({
      skillKey: item.skillKey,
      actionTime: item.actionTime,
      probability: item.probability,
      expectedDamage:
        item.probability > 0 ? item.damageContribution / item.probability : 0,
      expectedHealing:
        item.probability > 0 ? item.healingContribution / item.probability : 0,
    }));
  const representativeActions: ScheduledAction[] = [];
  let pathNode = representativePath;
  while (pathNode) {
    representativeActions.push(pathNode.action);
    pathNode = pathNode.next;
  }

  return {
    actions: representativeActions,
    actionProbabilities,
    totalDamage:
      combinedActionProbabilities.length > 0 ? expectedTotalDamage : null,
    totalHealing: expectedTotalHealing,
    warnings: [...new Set([...warnings, ...planWarnings])],
  };
}
