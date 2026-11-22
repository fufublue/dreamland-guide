import { calculateCharacterStats } from "./calculations/characterStats";
import { calculateCharacterDamage } from "./calculations/characterDamage";
import type { EngineCharacter } from "../../engine/types/character";
import type {
  CharacterCombatStats,
  CharacterFilterSettings,
  HangingTraitDamageBonus,
  MaximumModeEnvironment,
  SkillLevelType,
  StrengthEnemySettings,
  TalentNodeSelection,
  WeaponQuality,
  AccessoryQuality,
  AutoApplyWandEffects,
} from "./types";
import type { StrengthBaseDataV2 } from "./data/strengthBaseAdapter";

type EnemySelectionItem = {
  key: number;
  enemy: StrengthEnemySettings | null;
};

type CalculationSnapshot = {
  filters: CharacterFilterSettings;
  calculationMode: "coefficient" | "selfEffects" | "maximum";
  skillLevel: SkillLevelType;
  talentNode: number;
  weaponQuality: WeaponQuality;
  accessoryQuality: AccessoryQuality;
  hangingTraitDamageBonus: HangingTraitDamageBonus;
  autoApplyWandEffects: AutoApplyWandEffects;
  treatSelfHpConditionAsMet: boolean;
  remainingSeconds: number;
  ultimateUses: number | null;
  environmentEffects: MaximumModeEnvironment;
  enemySelections: EnemySelectionItem[];
};

type CalculationRequest = {
  characters: EngineCharacter[];
  strengthBaseData: StrengthBaseDataV2;
  snapshot: CalculationSnapshot;
};

type CalculatedCharacterItem = {
  character: EngineCharacter;
} & ReturnType<typeof calculateCharacterStats> & {
  damage: ReturnType<typeof calculateCharacterDamage>;
};

type WorkerResponse =
  | { type: "results"; results: CalculatedCharacterItem[] }
  | { type: "progress"; completed: number; total: number }
  | { type: "character-error"; characterName: string; message: string }
  | { type: "complete" };

type WorkerScope = {
  onmessage: ((event: MessageEvent<CalculationRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = (event) => {
  const { characters, strengthBaseData, snapshot } = event.data;

  const enemies = snapshot.enemySelections.flatMap((item) =>
    item.enemy ? [item.enemy] : [],
  );

  const batch: CalculatedCharacterItem[] = [];

  characters.forEach((character, index) => {
    try {
      // UR 使用目前選擇的天賦節點，SSR 以下固定使用天賦 6。
      const selectedTalentNode: TalentNodeSelection =
        character.rarity === "UR"
          ? (snapshot.talentNode as TalentNodeSelection)
          : 6;

      const result = calculateCharacterStats(
        character,
        strengthBaseData,
        snapshot.weaponQuality,
        selectedTalentNode,
        "same",
        "UR",
        snapshot.accessoryQuality,
        snapshot.hangingTraitDamageBonus,
        snapshot.autoApplyWandEffects,
      );

      // 只有 UR 使用目前選擇的技能等級。
      const selectedSkillLevel: SkillLevelType =
        character.rarity === "UR" ? snapshot.skillLevel : "max";

      const damage = calculateCharacterDamage({
        character,
        normalAttackLevel: selectedSkillLevel,
        skillLevel: selectedSkillLevel,
        selectedNode: selectedTalentNode,
        stats: {
          ...result.stats,
          attributeBoost: result.additionalStats.attributeBoost ?? null,
          attributeResistance:
            result.additionalStats.attributeResistance ?? null,
          abnormalResistance: result.additionalStats.abnormalResistance ?? null,
          criticalDamageResistance:
            result.additionalStats.criticalDamageResistance ?? null,
          criticalResistance:
            result.additionalStats.criticalResistance ?? null,
        } satisfies CharacterCombatStats,
        enemies,
        elementRelation: "advantage",
        mode: snapshot.calculationMode,
        environment: snapshot.environmentEffects,
        weaponDamageBonus: result.weaponDamageBonus,
        hangingTraitDamageBonus: result.hangingTraitDamageBonus,
        hangingTraitHealingBonus: result.hangingTraitHealingBonus,
        treatSelfHpConditionAsMet: snapshot.treatSelfHpConditionAsMet,
        scheduleSettings: {
          remainingSeconds: snapshot.remainingSeconds,
          ultimateUses: snapshot.ultimateUses,
        },
      });

      batch.push({
        character,
        ...result,
        damage,
      });
    } catch (error) {
      workerScope.postMessage({
        type: "character-error",
        characterName: character.name,
        message: error instanceof Error ? error.message : "未知計算錯誤",
      });
    }

    // 分批回傳結果，讓頁面能逐步顯示排行，不必等全部角色算完。
    if (batch.length >= 2 || index === characters.length - 1) {
      if (batch.length > 0) {
        workerScope.postMessage({
          type: "results",
          results: batch.splice(0, batch.length),
        });
      }
    }

    workerScope.postMessage({
      type: "progress",
      completed: index + 1,
      total: characters.length,
    });
  });

  workerScope.postMessage({ type: "complete" });
};
