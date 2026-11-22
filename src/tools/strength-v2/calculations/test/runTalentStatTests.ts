import type { EngineCharacter } from "../../../../engine/types/character";
import type { CharacterBaseStats, TalentNodeSelection } from "../../types";
import type { StrengthBaseDataV2 } from "../../data/strengthBaseAdapter";
import { calculateTalentStats } from "../talent";
import { calculateSkillDamage } from "../damage";
import { DEFAULT_ENVIRONMENT } from "../../settings";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`天賦面板測試失敗：${message}`);
}
function assertClose(actual: number | null | undefined, expected: number, message: string) {
  assert(typeof actual === "number" && Math.abs(actual - expected) < 1e-9, message);
}

const baseStats: CharacterBaseStats = {
  physicalAttack: 100,
  magicAttack: 100,
  healing: 100,
  speed: 100,
  criticalRate: 0.1,
  criticalDamage: 2.2,
  counterElementResistance: 0.2,
  health: 1000,
  physicalDefense: 100,
  magicDefense: 100,
};

const entries = [
  [4, "物攻", 11],
  [5, "魔攻", 12],
  [6, "生命", 13],
  [7, "物防", 14],
  [8, "魔防", 15],
  [9, "速度", 16],
  [10, "爆擊", 0.01],
  [11, "爆傷", 0.2],
  [12, "剋屬抵抗", 0.05],
  [13, "屬性強化", 5],
  [14, "屬性抗性", 0.1],
  [15, "異常抵抗", 0.05],
  [16, "爆傷抵抗", 0.15],
  [17, "爆擊抵抗", 0.01],
] as const;

const data = {
  talentNodeBonuses: [{
    rarity: "UR",
    class: "拳",
    nodes: entries.map(([node, stat, value]) => ({
      node,
      includedInBase: false,
      effectType: "stat",
      stat,
      value,
      unit: stat.includes("抵抗") || stat.includes("爆擊") || stat.includes("爆傷") || stat.includes("屬性") ? "%" : "",
      effectText: `${stat}+${value}`,
    })),
  }],
} as unknown as StrengthBaseDataV2;

const character = {
  id: "talent-stat-test",
  name: "天賦面板測試角色",
  rarity: "UR",
  class: "拳",
  talentPages: "3",
} as EngineCharacter;

const result = calculateTalentStats(character, data, baseStats, 17 as TalentNodeSelection);
assert(result.stats.physicalAttack === 111, "物攻要加進基礎面板");
assert(result.stats.magicAttack === 112, "魔攻要加進基礎面板");
assert(result.stats.health === 1013, "生命要加進基礎面板");
assert(result.stats.physicalDefense === 114, "物防要加進基礎面板");
assert(result.stats.magicDefense === 115, "魔防要加進基礎面板");
assert(result.stats.speed === 116, "速度要加進基礎面板");
assertClose(result.stats.criticalRate, 0.11, "爆擊要加進基礎面板");
assertClose(result.stats.criticalDamage, 2.4, "爆傷要加進基礎面板");
assertClose(result.stats.counterElementResistance, 0.25, "剋屬抵抗要加進基礎面板");
assertClose(result.additionalStats.attributeBoost, 5, "屬性強化要以百分點進入額外戰鬥能力值");
assertClose(result.additionalStats.attributeResistance, 0.1, "屬性抗性要進入額外戰鬥能力值");
assertClose(result.additionalStats.abnormalResistance, 0.05, "異常抵抗要進入額外戰鬥能力值");
assertClose(result.additionalStats.criticalDamageResistance, 0.15, "爆傷抵抗要進入額外戰鬥能力值");
assertClose(result.additionalStats.criticalResistance, 0.01, "爆擊抵抗要進入額外戰鬥能力值");
assert(result.appliedNodes.length === entries.length, "所有選定節點都應套用");
assert(result.warnings.length === 0, "所有測試能力類型都應有對應欄位");

// 確認實際 API 格式：unit="percent" 且 value=0.05 代表屬性強化 +5%。
const apiPercentData = {
  talentNodeBonuses: [{
    rarity: "UR",
    class: "拳",
    nodes: [{
      node: 17,
      includedInBase: false,
      effectType: "stat",
      stat: "屬性強化",
      value: 0.05,
      unit: "percent",
      effectText: "屬性強化+5%",
    }],
  }],
} as unknown as StrengthBaseDataV2;
const apiPercentResult = calculateTalentStats(
  character,
  apiPercentData,
  baseStats,
  17 as TalentNodeSelection,
);
assertClose(
  apiPercentResult.additionalStats.attributeBoost,
  5,
  'API 的 0.05 percent 必須轉成計算用的 5 個百分點',
);

// 額外確認屬性強化不是只寫入面板，而是實際影響傷害公式。
const combatStats = {
  health: 1000,
  physicalAttack: 100,
  magicAttack: 100,
  healing: 100,
  speed: 100,
  criticalRate: 0.1,
  criticalDamage: 2.2,
  physicalDefense: 100,
  magicDefense: 100,
  counterElementResistance: 0.2,
  attributeBoost: 0,
  attributeResistance: null,
  abnormalResistance: null,
  criticalDamageResistance: null,
  criticalResistance: null,
};
const enemy = {
  id: "talent-test-enemy",
  name: "測試敵人",
  kind: "boss" as const,
  defenseType: "無弱點" as const,
  maxHp: null,
};
const baseDamage = calculateSkillDamage({
  skillKey: "skill1",
  stats: combatStats,
  attack: 100,
  attackType: "physical",
  coefficient: 100,
  enemy,
  elementRelation: "neutral",
  mode: "coefficient",
  environment: DEFAULT_ENVIRONMENT,
});
const talentBoostDamage = calculateSkillDamage({
  skillKey: "skill1",
  stats: { ...combatStats, attributeBoost: 5 },
  attack: 100,
  attackType: "physical",
  coefficient: 100,
  enemy,
  elementRelation: "neutral",
  mode: "coefficient",
  environment: DEFAULT_ENVIRONMENT,
});
assert(
  typeof baseDamage.normalDamage === "number" &&
    typeof talentBoostDamage.normalDamage === "number" &&
    Math.abs(talentBoostDamage.normalDamage / baseDamage.normalDamage - 1.05) < 1e-9,
  "屬性強化 +5% 必須實際讓傷害增加 5%",
);

console.log("14 種天賦面板能力值對應與屬性強化傷害公式測試全部通過。");
