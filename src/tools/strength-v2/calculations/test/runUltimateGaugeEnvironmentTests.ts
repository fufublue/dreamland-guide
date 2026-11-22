import { applyUltimateGaugeEnvironmentTriggers, createSkillSchedule } from "../skillSchedule";
import { DEFAULT_ENVIRONMENT } from "../../settings";

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(`必殺槽排程測試失敗：${label}`);
}

function assertEqual(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 1e-8) {
    throw new Error(`${label}：預期 ${expected}，實際 ${actual}`);
  }
}

const environment = {
  ...DEFAULT_ENVIRONMENT,
  ultimateGaugeIncrease: {
    enabled: true,
    percentage: 40 as const,
    cooldownSeconds: 15,
  },
};

const afterOpening = applyUltimateGaugeEnvironmentTriggers(0, environment, 0, 0, 1, true);
assertEqual(afterOpening, 4000, "0 秒開場立即增加 40% ");

const afterFirstCooldown = applyUltimateGaugeEnvironmentTriggers(afterOpening, environment, 0, 15, 1);
assertEqual(afterFirstCooldown, 8000, "15 秒再次增加 40% ");

const afterSecondCooldown = applyUltimateGaugeEnvironmentTriggers(afterFirstCooldown, environment, 15, 30, 1);
assertEqual(afterSecondCooldown, 10000, "30 秒增加後不得超過必殺槽上限");

const withBreakthrough = applyUltimateGaugeEnvironmentTriggers(0, environment, 0, 0, 1.2, true);
assertEqual(withBreakthrough, 4800, "滿破必殺槽上升倍率套用至環境增加量");

const disabledEnvironment = {
  ...environment,
  ultimateGaugeIncrease: { ...environment.ultimateGaugeIncrease, enabled: false },
};
assertEqual(applyUltimateGaugeEnvironmentTriggers(1234, disabledEnvironment, 0, 0, 1, true), 1234, "關閉條件時不增加必殺槽");

// 整合排程測試：確認 t=0 與後續 CD 觸發會改變實際必殺技施放順序。
const schedule = createSkillSchedule({
  speed: 335 / 15,
  remainingSeconds: 45,
  environment,
  normalAttackDamage: 10,
  skill1Damage: null,
  skill2Damage: null,
  ultimateDamage: 1000,
  skill1Cooldown: null,
  skill2Cooldown: null,
  ultimateUses: null,
  ultimateGaugeMultiplier: 1,
  ultimateGaugePerAction: 1500,
  getEffectsForSkill: () => [],
});
assert(schedule.actions.length >= 4, "排程應涵蓋多個 CD 時間點");
assert(schedule.actions[0].skillKey === "ultimate" && schedule.actions[0].actionTime === 0, "開場必殺槽立即增加後，必殺技應可在 0 秒施放");
assert(schedule.actions.some((action) => action.skillKey === "ultimate" && Math.abs(action.actionTime - 45) < 1e-6), "後續 CD 增加必殺槽也應納入實際排程判斷");

console.log("必殺槽環境條件及技能排程整合測試全部通過。");
