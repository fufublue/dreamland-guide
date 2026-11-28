import { useEffect, useMemo, useState } from "react";
import type { EngineCharacter } from "../../engine/types/character";
import { loadStrengthData } from "./data/loadStrengthData";
import { DEFAULT_ENVIRONMENT } from "./settings";
import type {
  AccessoryQuality,
  AttackType,
  CharacterClass,
  CharacterElement,
  CharacterRarity,
  ConfigurableEnvironmentEffect,
  CustomEnemyEnvironmentEffect,
  HangingTraitDamageBonus,
  MaximumModeEnvironment,
  SkillLevelType,
  StrengthCalculationMode,
  StrengthEnemySettings,
  TalentNodeSelection,
  WeaponQuality,
} from "./types";
import { calculateCharacterStats } from "./calculations/characterStats";
import { calculateCharacterDamage } from "./calculations/characterDamage";
import {
  calculateBreakthroughTraitDamageBonus,
  calculateBreakthroughTraitHealingBonus,
} from "./calculations/breakthroughTrait";
import "./StrengthCalculatorV2.css";
import "./SpecifiedComparison.css";

type LoadedData = Awaited<ReturnType<typeof loadStrengthData>>;
type SideKey = "left" | "right";
type SideSettings = {
  characterId: string;
  mode: StrengthCalculationMode;
  skillLevel: SkillLevelType;
  talentNode: number;
  weaponQuality: WeaponQuality;
  hangingTraitDamageBonus: HangingTraitDamageBonus;
  autoApplyWandEffects: boolean;
  treatSelfHpConditionAsMet: boolean;
  remainingSeconds: number;
  ultimateUses: number | null;
  skill1PreCastSeconds: number | null;
  skill2PreCastSeconds: number | null;
  environment: MaximumModeEnvironment;
};
type SideResult = {
  character: EngineCharacter;
  skillLevel: SkillLevelType;
  stats: ReturnType<typeof calculateCharacterStats>;
  damage: ReturnType<typeof calculateCharacterDamage>;
  remainingSeconds: number;
};

const cloneEnvironment = (): MaximumModeEnvironment => ({
  ...DEFAULT_ENVIRONMENT,
  ultimateGaugeIncrease: { ...DEFAULT_ENVIRONMENT.ultimateGaugeIncrease },
  attackIncrease: { ...DEFAULT_ENVIRONMENT.attackIncrease },
  defenseReduction: { ...DEFAULT_ENVIRONMENT.defenseReduction },
  attributeDamageIncrease: { ...DEFAULT_ENVIRONMENT.attributeDamageIncrease },
  attributeResistanceReduction: {
    ...DEFAULT_ENVIRONMENT.attributeResistanceReduction,
  },
  speedIncrease: { ...DEFAULT_ENVIRONMENT.speedIncrease },
  criticalRateIncrease: { ...DEFAULT_ENVIRONMENT.criticalRateIncrease! },
  criticalDamageIncrease: { ...DEFAULT_ENVIRONMENT.criticalDamageIncrease! },
  customEnemyEffects: (DEFAULT_ENVIRONMENT.customEnemyEffects ?? []).map((item) => ({ ...item })),
});

function createSideSettings(): SideSettings {
  return {
    characterId: "",
    mode: "maximum",
    skillLevel: "initial",
    talentNode: 5,
    weaponQuality: "rainbow",
    hangingTraitDamageBonus: 15,
    autoApplyWandEffects: false,
    treatSelfHpConditionAsMet: true,
    remainingSeconds: 50,
    ultimateUses: null,
    skill1PreCastSeconds: null,
    skill2PreCastSeconds: null,
    environment: cloneEnvironment(),
  };
}

type FilterOption<T extends string> = {
  value: T;
  label: string;
  className: string;
};

const RARITY_OPTIONS: FilterOption<CharacterRarity>[] = [
  { value: "UR", label: "UR", className: "rarity-ur" },
  { value: "SSR", label: "SSR", className: "rarity-ssr" },
  { value: "SR", label: "SR", className: "rarity-sr" },
  { value: "R", label: "R", className: "rarity-r" },
];
const ELEMENT_OPTIONS: FilterOption<CharacterElement>[] = [
  { value: "水", label: "水", className: "element-water" },
  { value: "火", label: "火", className: "element-fire" },
  { value: "風", label: "風", className: "element-wind" },
  { value: "地", label: "地", className: "element-earth" },
  { value: "雷", label: "雷", className: "element-thunder" },
  { value: "光", label: "光", className: "element-light" },
  { value: "暗", label: "暗", className: "element-dark" },
];
const CLASS_OPTIONS: FilterOption<CharacterClass>[] = [
  { value: "拳", label: "拳", className: "character-class" },
  { value: "鞋", label: "鞋", className: "character-class" },
  { value: "書", label: "書", className: "character-class" },
  { value: "物杖", label: "物杖", className: "character-class" },
  { value: "魔杖", label: "魔杖", className: "character-class" },
  { value: "盾", label: "盾", className: "character-class" },
];
const ATTACK_TYPE_OPTIONS: FilterOption<AttackType>[] = [
  { value: "physical", label: "物理", className: "attack-physical" },
  { value: "magic", label: "魔法", className: "attack-magic" },
];

function toggleFilterValue<T extends string>(selected: T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

function FilterGroup<T extends string>({
  title,
  options,
  selected,
  onChange,
  onClear,
  showClear = true,
}: {
  title: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (value: T) => void;
  onClear: () => void;
  showClear?: boolean;
}) {
  return (
    <div className="strength-v2-filter-group">
      <div className="strength-v2-filter-title">{title}</div>
      <div className="strength-v2-filter-options">
        {showClear && (
          <button
            type="button"
            className={`strength-v2-filter-option ${selected.length === 0 ? "is-active" : ""}`}
            aria-pressed={selected.length === 0}
            onClick={onClear}
          >
            全部
          </button>
        )}
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`strength-v2-filter-option character-tag ${option.className} ${selected.includes(option.value) ? "is-active" : ""}`}
            aria-pressed={selected.includes(option.value)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const ENVIRONMENT_EFFECTS: {
  key:
    | "attackIncrease"
    | "defenseReduction"
    | "attributeDamageIncrease"
    | "attributeResistanceReduction"
    | "speedIncrease";
  title: string;
  durations: number[];
}[] = [
  { key: "attackIncrease", title: "攻擊提升", durations: [10, 15, 20] },
  { key: "defenseReduction", title: "防禦降低", durations: [15, 20] },
  { key: "attributeDamageIncrease", title: "屬性傷害提升", durations: [15, 20] },
  { key: "attributeResistanceReduction", title: "屬性抗性降低", durations: [15, 20] },
  { key: "speedIncrease", title: "速度提升", durations: [10, 15, 20] },
];

function getEnemyKindLabel(kind: StrengthEnemySettings["kind"]): string {
  switch (kind) {
    case "boss":
      return "BOSS";
    case "minion":
      return "小怪";
    case "bossMinion":
      return "BOSS小怪";
  }
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value).toLocaleString("zh-TW")
    : "—";
}

function EnvironmentEditor({
  environment,
  enemies,
  onChange,
}: {
  environment: MaximumModeEnvironment;
  enemies: StrengthEnemySettings[];
  onChange: (next: MaximumModeEnvironment) => void;
}) {
  const updateEffect = (
    key: (typeof ENVIRONMENT_EFFECTS)[number]["key"],
    patch: Partial<ConfigurableEnvironmentEffect>,
  ) => onChange({ ...environment, [key]: { ...environment[key]!, ...patch } });

  const magnitudeOptions = (key: (typeof ENVIRONMENT_EFFECTS)[number]["key"]) => {
    if (key === "defenseReduction" || key === "attributeResistanceReduction") {
      return ["small", "medium", "large"].map((value, index) => ({ value, label: `${[20, 30, 40][index]}%` }));
    }
    return ["small", "medium", "large"].map((value, index) => ({ value, label: `${[20, 40, 60][index]}%` }));
  };

  const renderTargetControls = (
    key: "defenseReduction" | "attributeResistanceReduction",
    effect: ConfigurableEnvironmentEffect,
  ) => (
    <div className="specified-env-target-controls">
      <label>
        目標
        <select
          value={effect.targetScope ?? "all"}
          onChange={(event) => updateEffect(key, {
            targetScope: event.target.value as "all" | "specific",
            targetEnemyId: event.target.value === "all" ? null : effect.targetEnemyId ?? enemies[0]?.id ?? null,
          })}
        >
          <option value="all">全體</option>
          <option value="specific">指定敵人</option>
        </select>
      </label>
      {effect.targetScope === "specific" && enemies.length > 0 && (
        <label>
          敵人
          <select
            value={effect.targetEnemyId ?? ""}
            onChange={(event) => updateEffect(key, { targetEnemyId: event.target.value || null })}
          >
            <option value="">選擇敵人</option>
            {enemies.map((enemy, index) => <option key={enemy.id} value={enemy.id}>{enemy.name}（敵人 {index + 1}）</option>)}
          </select>
        </label>
      )}
    </div>
  );

  const updateCustom = (id: string, patch: Partial<CustomEnemyEnvironmentEffect>) => {
    onChange({
      ...environment,
      customEnemyEffects: (environment.customEnemyEffects ?? []).map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  };

  return (
    <div className="specified-env-editor">
      <h4>環境條件</h4>
      {ENVIRONMENT_EFFECTS.map(({ key, title, durations }) => {
        const effect = environment[key]!;
        const isFixed = key === "attackIncrease" || key === "defenseReduction";
        return (
          <div className="specified-env-row" key={key}>
            <label className="specified-env-toggle">
              <input
                type="checkbox"
                checked={effect.enabled}
                onChange={(event) =>
                  updateEffect(key, { enabled: event.target.checked })
                }
              />
              {title}
            </label>
            {isFixed ? (
              <span className="specified-env-fixed">固定大幅</span>
            ) : (
              <select
                value={effect.magnitude}
                onChange={(event) =>
                  updateEffect(key, {
                    magnitude: event.target
                      .value as ConfigurableEnvironmentEffect["magnitude"],
                  })
                }
              >
                {magnitudeOptions(key).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            <label>
              持續
              <select
                value={effect.durationSeconds}
                onChange={(event) =>
                  updateEffect(key, {
                    durationSeconds: Number(event.target.value) as 10 | 15 | 20,
                  })
                }
              >
                {durations.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} 秒
                  </option>
                ))}
              </select>
            </label>
            <label>
              CD{" "}
              <input
                type="number"
                min="1"
                step="1"
                value={effect.cooldownSeconds}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (event.target.value && Number.isFinite(value) && value > 0)
                    updateEffect(key, {
                      cooldownSeconds: Math.max(1, Math.round(value)),
                    });
                }}
              />{" "}
              秒
            </label>
            {(key === "defenseReduction" ||
              key === "attributeResistanceReduction") &&
              renderTargetControls(key, effect)}
          </div>
        );
      })}

      <div className="specified-env-row">
        <label className="specified-env-toggle">
          <input
            type="checkbox"
            checked={environment.ultimateGaugeIncrease.enabled}
            onChange={(event) =>
              onChange({
                ...environment,
                ultimateGaugeIncrease: {
                  ...environment.ultimateGaugeIncrease,
                  enabled: event.target.checked,
                },
              })
            }
          />
          必殺槽增加
        </label>
        <select
          value={environment.ultimateGaugeIncrease.percentage}
          onChange={(event) =>
            onChange({
              ...environment,
              ultimateGaugeIncrease: {
                ...environment.ultimateGaugeIncrease,
                percentage: Number(event.target.value) as 20 | 40,
              },
            })
          }
        >
          <option value={20}>20%</option>
          <option value={40}>40%</option>
        </select>
        <label>
          CD{" "}
          <input
            type="number"
            min="1"
            step="1"
            value={environment.ultimateGaugeIncrease.cooldownSeconds}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (event.target.value && Number.isFinite(value) && value > 0)
                onChange({
                  ...environment,
                  ultimateGaugeIncrease: {
                    ...environment.ultimateGaugeIncrease,
                    cooldownSeconds: Math.max(1, Math.round(value)),
                  },
                });
            }}
          />{" "}
          秒
        </label>
      </div>

      {(["criticalRateIncrease", "criticalDamageIncrease"] as const).map(
        (key) => {
          const effect = environment[key]!;
          const isCriticalRate = key === "criticalRateIncrease";
          const title = isCriticalRate ? "暴擊率提升" : "暴擊傷害提升";
          const values = isCriticalRate ? [20, 30, 40] : [40, 60, 80];
          return (
            <div className="specified-env-row" key={key}>
              <label className="specified-env-toggle">
                <input
                  type="checkbox"
                  checked={effect.enabled}
                  onChange={(event) =>
                    onChange({
                      ...environment,
                      [key]: { ...effect, enabled: event.target.checked },
                    })
                  }
                />
                {title}
              </label>
              <select
                value={effect.magnitude}
                onChange={(event) =>
                  onChange({
                    ...environment,
                    [key]: {
                      ...effect,
                      magnitude: event.target
                        .value as ConfigurableEnvironmentEffect["magnitude"],
                    },
                  })
                }
              >
                {(["small", "medium", "large"] as const).map((value, index) => (
                  <option key={value} value={value}>
                    {values[index]}%
                  </option>
                ))}
              </select>
              <label>
                持續{" "}
                <select
                  value={effect.durationSeconds}
                  onChange={(event) =>
                    onChange({
                      ...environment,
                      [key]: {
                        ...effect,
                        durationSeconds: Number(event.target.value) as
                          | 10
                          | 15
                          | 20,
                      },
                    })
                  }
                >
                  <option value={10}>10 秒</option>
                  <option value={15}>15 秒</option>
                  <option value={20}>20 秒</option>
                </select>
              </label>
              <label>
                CD{" "}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={effect.cooldownSeconds}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (
                      event.target.value &&
                      Number.isFinite(value) &&
                      value > 0
                    )
                      onChange({
                        ...environment,
                        [key]: {
                          ...effect,
                          cooldownSeconds: Math.max(1, Math.round(value)),
                        },
                      });
                  }}
                />{" "}
                秒
              </label>
            </div>
          );
        },
      )}

      <div className="specified-custom-env-list">
        <button
          type="button"
          className="strength-v2-button"
          onClick={() =>
            onChange({
              ...environment,
              customEnemyEffects: [
                ...(environment.customEnemyEffects ?? []),
                {
                  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  type: "defenseReduction",
                  enabled: true,
                  magnitude: "medium",
                  durationSeconds: 15,
                  cooldownSeconds: 16,
                  targetScope: "all",
                  targetEnemyId: null,
                },
              ],
            })
          }
        >
          ＋ 新增減益效果
        </button>
        {(environment.customEnemyEffects ?? []).map((item) => (
          <div
            className="specified-env-row specified-custom-env-row"
            key={item.id}
          >
            <select
              aria-label="效果類型"
              value={item.type}
              onChange={(event) =>
                updateCustom(item.id, {
                  type: event.target
                    .value as CustomEnemyEnvironmentEffect["type"],
                })
              }
            >
              <option value="defenseReduction">防禦降低</option>
              <option value="attributeResistanceReduction">屬性抗性降低</option>
            </select>
            <label>
              幅度
              <select
                value={item.magnitude}
                onChange={(event) =>
                  updateCustom(item.id, {
                    magnitude: event.target
                      .value as CustomEnemyEnvironmentEffect["magnitude"],
                  })
                }
              >
                <option value="small">20%</option>
                <option value="medium">30%</option>
                <option value="large">40%</option>
              </select>
            </label>
            <label>
              持續{" "}
              <select
                value={item.durationSeconds}
                onChange={(event) =>
                  updateCustom(item.id, {
                    durationSeconds: Number(event.target.value) as 15 | 20,
                  })
                }
              >
                <option value={15}>15 秒</option>
                <option value={20}>20 秒</option>
              </select>
            </label>
            <label>
              CD{" "}
              <input
                type="number"
                min="1"
                step="1"
                value={item.cooldownSeconds}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (event.target.value && Number.isFinite(value) && value > 0)
                    updateCustom(item.id, {
                      cooldownSeconds: Math.max(1, Math.round(value)),
                    });
                }}
              />{" "}
              秒
            </label>
            <div className="specified-env-target-controls">
              <label>
                目標{" "}
                <select
                  value={item.targetScope}
                  onChange={(event) =>
                    updateCustom(item.id, {
                      targetScope: event.target.value as "all" | "specific",
                      targetEnemyId:
                        event.target.value === "all"
                          ? null
                          : (item.targetEnemyId ?? enemies[0]?.id ?? null),
                    })
                  }
                >
                  <option value="all">全體</option>
                  <option value="specific">指定敵人</option>
                </select>
              </label>
              {item.targetScope === "specific" && enemies.length > 0 && (
                <label>
                  敵人{" "}
                  <select
                    value={item.targetEnemyId ?? ""}
                    onChange={(event) =>
                      updateCustom(item.id, {
                        targetEnemyId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">選擇敵人</option>
                    {enemies.map((enemy, index) => (
                      <option key={enemy.id} value={enemy.id}>
                        {enemy.name}（敵人 {index + 1}）
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <button
              className="specified-env-delete-button"
              type="button"
              onClick={() =>
                onChange({
                  ...environment,
                  customEnemyEffects: (
                    environment.customEnemyEffects ?? []
                  ).filter((entry) => entry.id !== item.id),
                })
              }
            >
              刪除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CharacterPicker({
  characters,
  characterId,
  onChange,
  sideLabel,
}: {
  characters: EngineCharacter[];
  characterId: string;
  onChange: (characterId: string) => void;
  sideLabel: string;
}) {
  return (
    <div className="specified-character-picker">
      <label>{sideLabel}角色</label>
      <select
        className="specified-character-select"
        value={characterId}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">選擇角色（{characters.length} 位符合篩選）</option>
        {characters.map((character) => (
          <option key={character.id} value={character.id}>
            {character.name}｜{character.rarity}・{character.element}・
            {character.class}
          </option>
        ))}
      </select>
    </div>
  );
}


function getTalentNodeEffectSuffix(
  node: number,
  talentNodeBonuses: LoadedData["strengthBaseData"]["talentNodeBonuses"],
): string {
  const nodeEffects = talentNodeBonuses.flatMap((row) =>
    row.nodes.filter((effect) => effect.node === node),
  );

  const effectLabels = Array.from(
    new Set(
      nodeEffects
        .map((effect) => {
          const source = `${effect.stat ?? ""} ${effect.effectText ?? ""}`;
          const sign = /降低|減少|下降|decrease/i.test(source) ? "−" : "";

          if (
            /物攻|魔攻|雙攻|物理攻擊|魔法攻擊|攻擊力|攻擊提升|physicalAttack|magicAttack|attack/i.test(
              source,
            )
          )
            return `${sign}攻擊`;

          if (
            /物防|魔防|雙防|物理防禦|魔法防禦|防禦力|防禦提升|physicalDefense|magicDefense|defense/i.test(
              source,
            )
          )
            return `${sign}防禦`;

          if (/速度|speed/i.test(source)) return `${sign}速度`;
          if (/治療|治癒|healing/i.test(source)) return `${sign}治療`;
          if (/暴擊率|爆擊|criticalRate/i.test(source)) return `${sign}爆擊率`;

          if (/暴擊傷害|爆擊傷害|爆傷|criticalDamage/i.test(source))
            return `${sign}暴擊傷害`;

          if (/屬性強化|elementDamage/i.test(source)) return `${sign}屬性傷害`;

          if (/剋屬抵抗|resistance/i.test(source)) return `${sign}剋屬抗性`;

          if (/生命|health|HP/i.test(source)) return `${sign}生命`;
          if (/傷害|damage/i.test(source)) return `${sign}傷害`;
          if (/異常抵抗|damage/i.test(source)) return `${sign}異常抵抗`;
          if (/爆擊抵抗|damage/i.test(source)) return `${sign}爆擊抵抗`;

          return "";
        })
        .filter(Boolean),
    ),
  );

  const manualEffectLabels: Partial<Record<number, string>> = {
    6: " （普攻）",
    9: " （一技能）",
    12: " （二技能）",
    15: " （必殺技）",
  };

  return (
    manualEffectLabels[node] ??
    (effectLabels.length > 0 ? ` （${effectLabels.join("／")}）` : "")
  );
}
function SidePanel({
  talentNodeBonuses,
  side,
  settings,
  characters,
  enemies,
  onChange,
  onCopyFromOther,
}: {
  talentNodeBonuses: LoadedData["strengthBaseData"]["talentNodeBonuses"];
  side: string;
  settings: SideSettings;
  characters: EngineCharacter[];
  enemies: StrengthEnemySettings[];
  onChange: (patch: Partial<SideSettings>) => void;
  onCopyFromOther: () => void;
}) {
  return (
    <section className="strength-v2-section specified-side-panel">
      <div className="specified-side-heading">
        <h3>{side}設定</h3>
        <button
          type="button"
          className="specified-copy-button"
          onClick={onCopyFromOther}
        >
          複製另一側條件
        </button>
      </div>
      <CharacterPicker
        characters={characters}
        characterId={settings.characterId}
        onChange={(characterId) => onChange({ characterId })}
        sideLabel={side}
      />
      <div className="specified-settings-grid">
        <label>
          計算模式
          <select
            value={settings.mode}
            onChange={(event) =>
              onChange({ mode: event.target.value as StrengthCalculationMode })
            }
          >
            <option value="coefficient">只看係數</option>
            <option value="selfEffects">角色自帶增減益效果</option>
            <option value="maximum">自行模擬環境</option>
          </select>
        </label>
        <label>
          UR 技能等級
          <select
            value={settings.skillLevel}
            onChange={(event) =>
              onChange({ skillLevel: event.target.value as SkillLevelType })
            }
          >
            <option value="initial">初始等級</option>
            <option value="max">最大等級</option>
          </select>
        </label>
        <label>
          天賦解鎖節點
          <select
            value={settings.talentNode}
            onChange={(event) =>
              onChange({ talentNode: Number(event.target.value) })
            }
          >
            <option value={3}>不額外解鎖</option>
            {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((node) => (
              <option key={node} value={node}>
                天賦 {node}
                {getTalentNodeEffectSuffix(node, talentNodeBonuses)}
              </option>
            ))}
          </select>
        </label>
        <label>
          武器品質
          <select
            value={settings.weaponQuality}
            onChange={(event) =>
              onChange({ weaponQuality: event.target.value as WeaponQuality })
            }
          >
            <option value="gold">金武</option>
            <option value="rainbow">彩武</option>
          </select>
        </label>
        <label>
          掛件傷害特性
          <select
            value={settings.hangingTraitDamageBonus}
            onChange={(event) =>
              onChange({
                hangingTraitDamageBonus: Number(
                  event.target.value,
                ) as HangingTraitDamageBonus,
              })
            }
          >
            {[15, 10, 8, 5].map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
        </label>
        <div className="specified-checkbox-pair">
          <label className="specified-checkbox">
            <input
              type="checkbox"
              checked={settings.autoApplyWandEffects}
              onChange={(event) =>
                onChange({ autoApplyWandEffects: event.target.checked })
              }
            />
            杖角色自動套用杖掛件效果
          </label>
          <label className="specified-checkbox">
            <input
              type="checkbox"
              checked={settings.treatSelfHpConditionAsMet}
              onChange={(event) =>
                onChange({ treatSelfHpConditionAsMet: event.target.checked })
              }
            />
            視為自身生命值條件成立
          </label>
        </div>
        <label>
          計算時間（秒）
          <input
            type="number"
            min="0"
            value={settings.remainingSeconds}
            onChange={(event) =>
              onChange({
                remainingSeconds: Math.max(0, Number(event.target.value) || 0),
              })
            }
          />
        </label>
        <label>
          必殺技施放次數
          <input
            type="number"
            min="0"
            placeholder="留空：依必殺槽自動判斷"
            value={settings.ultimateUses ?? ""}
            onChange={(event) =>
              onChange({
                ultimateUses:
                  event.target.value === ""
                    ? null
                    : Math.max(0, Math.floor(Number(event.target.value) || 0)),
              })
            }
          />
        </label>
        <label>
          二技能：第三波前施放時間點（秒）
          <input
            type="number"
            min={settings.remainingSeconds}
            step="1"
            placeholder="不預先施放"
            value={settings.skill2PreCastSeconds ?? ""}
            onChange={(event) =>
              onChange({
                skill2PreCastSeconds:
                  event.target.value === ""
                    ? null
                    : Math.max(0, Math.round(Number(event.target.value) || 0)),
              })
            }
          />
          <small>例如計算時間為 50 秒，填入 57 表計算開始前 7 秒施放。</small>
        </label>
        <label>
          一技能：第三波前施放時間點（秒）
          <input
            type="number"
            min={settings.remainingSeconds}
            step="1"
            placeholder="不預先施放"
            value={settings.skill1PreCastSeconds ?? ""}
            onChange={(event) =>
              onChange({
                skill1PreCastSeconds:
                  event.target.value === ""
                    ? null
                    : Math.max(0, Math.round(Number(event.target.value) || 0)),
              })
            }
          />
          <small>例如計算時間為 50 秒，填入 57 表計算開始前 7 秒施放。</small>
        </label>
      </div>
      {settings.mode === "maximum" && (
        <EnvironmentEditor
          environment={settings.environment}
          enemies={enemies}
          onChange={(environment) => onChange({ environment })}
        />
      )}
    </section>
  );
}

function getSkillTypeClass(type: string): string {
  switch (type) {
    case "全體攻擊":
      return "skill-type-all-attack";
    case "單體攻擊":
      return "skill-type-single-attack";
    case "全體回血":
      return "skill-type-all-healing";
    case "單體回血":
      return "skill-type-single-healing";
    default:
      return "";
    case "增益效果":
      return "skill-type-buff";
  }
}

function ResultPanel({
  result,
  side,
}: {
  result: SideResult | null;
  side: string;
}) {
  if (!result)
    return (
      <div className="specified-result-empty">
        {side}尚未計算。設定角色與條件後，按下下方「開始比較」。
      </div>
    );
  const { character, stats, damage } = result;
  const skillLevel = result.skillLevel;
  const skills = [
    {
      label: "必殺技",
      key: "ultimate" as const,
      type: character.ultimate.type,
      info: character.ultimate[skillLevel],
      result: damage.ultimate,
      healing: damage.ultimate.healing,
      showCooldown: false,
    },
    {
      label: "二技能",
      key: "skill2" as const,
      type: character.skill2.type,
      info: character.skill2[skillLevel],
      result: damage.skill2,
      healing: damage.skill2.healing,
      showCooldown: true,
    },
    {
      label: "一技能",
      key: "skill1" as const,
      type: character.skill1.type,
      info: character.skill1[skillLevel],
      result: damage.skill1,
      healing: damage.skill1.healing,
      showCooldown: true,
    },
    {
      label: "普攻",
      key: "normalAttack" as const,
      type: "",
      info: null,
      result: damage.normalAttack,
      healing: null,
      showCooldown: false,
    },
  ];
  const schedule = damage.schedule;
  const warningList = [...new Set([...stats.warnings, ...damage.warnings])];
  const stat = stats.stats;
  const panelStat = (
    label: string,
    value: number | null | undefined,
    suffix = "",
  ) => (
    <div className="strength-v2-result-stat" key={label}>
      <span>{label}</span>
      <strong>
        {formatNumber(value)}
        {suffix}
      </strong>
    </div>
  );
  return (
    <article className="strength-v2-result-character specified-result-panel">
      <div className="strength-v2-result-heading">
        <div>
          <h3>{character.name}</h3>
          <p>
            滿突破特性：{character.maxBreakthroughTrait || "無"}｜天賦計算至第{" "}
            {stats.effectiveNode} 節點
          </p>
        </div>
        <div className="strength-v2-tags">
          <span
            className={`character-tag ${RARITY_OPTIONS.find((item) => item.value === character.rarity)?.className ?? ""}`}
          >
            {character.rarity}
          </span>
          <span
            className={`character-tag ${ELEMENT_OPTIONS.find((item) => item.value === character.element)?.className ?? ""}`}
          >
            {character.element}
          </span>
          <span className="character-tag character-class">
            {character.class}
          </span>
          <span
            className={`character-tag ${character.attackType === "physical" ? "attack-physical" : "attack-magic"}`}
          >
            {character.attackType === "physical" ? "物理" : "魔法"}
          </span>
        </div>
      </div>

      <section className="specified-schedule-overview">
        <h4>戰鬥結果</h4>
        <div className="strength-v2-result-stats">
          {panelStat("排程總傷害", schedule?.totalDamage)}
          {panelStat("排程總治療", schedule?.totalHealing)}
          {panelStat("行動次數", schedule?.actions?.length ?? 0, " 次")}
        </div>
        {schedule?.actions?.length ? (
          <details className="specified-schedule-details">
            <summary>查看完整技能施放排程</summary>
            <div className="specified-schedule-list">
              {schedule.actions.map((action, index) => (
                <div
                  className="specified-schedule-item"
                  key={`${index}-${action.actionTime}-${action.skillKey}`}
                >
                  <span>{formatNumber(Math.max(0, result.remainingSeconds - action.actionTime))} 秒</span>
                  <strong>
                    {
                      {
                        ultimate: "必殺技",
                        skill2: "二技能",
                        skill1: "一技能",
                        normalAttack: "普攻",
                      }[action.skillKey]
                    }
                  </strong>
                  <span>
                    傷害 {formatNumber(action.damage)}／治療{" "}
                    {formatNumber(action.healing)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <details className="strength-v2-panel-details">
        <summary>角色面板</summary>
        <div className="strength-v2-panel-groups">
          <section className="strength-v2-panel-group strength-v2-panel-group-primary">
            <h4>核心能力</h4>
            <div className="strength-v2-panel-group-stats">
              {panelStat(
                character.attackType === "physical" ? "物理攻擊" : "魔法攻擊",
                character.attackType === "physical"
                  ? stat.physicalAttack
                  : stat.magicAttack,
              )}
              {panelStat("治療", stat.healing)}
            </div>
          </section>
          <section className="strength-v2-panel-group">
            <h4>戰鬥屬性</h4>
            <div className="strength-v2-panel-group-stats">
              {panelStat(
                "暴擊率",
                stat.criticalRate === null ? null : stat.criticalRate * 100,
                "%",
              )}
              {panelStat(
                "暴擊傷害",
                stat.criticalDamage === null ? null : stat.criticalDamage * 100,
                "%",
              )}
            </div>
          </section>
          <section className="strength-v2-panel-group">
            <h4>角色特性</h4>
            <div className="strength-v2-panel-group-stats">
              {panelStat(
                "角色傷害特性",
                calculateBreakthroughTraitDamageBonus(
                  character.maxBreakthroughTrait,
                  character.element ?? "",
                  character.attackType ?? "",
                ),
                "%",
              )}
              {panelStat(
                "角色治療特性",
                calculateBreakthroughTraitHealingBonus(
                  character.maxBreakthroughTrait,
                ),
                "%",
              )}
            </div>
          </section>
          <section className="strength-v2-panel-group">
            <h4>其他加成</h4>
            <div className="strength-v2-panel-group-stats">
              {panelStat("掛件傷害特性", stats.hangingTraitDamageBonus, "%")}
              {panelStat("掛件治癒特性", stats.hangingTraitHealingBonus, "%")}
              {panelStat(
                "天賦屬性強化",
                stats.additionalStats.attributeBoost ?? 0,
                "%",
              )}
              {panelStat(
                "武器傷害加成",
                typeof stats.weaponDamageBonus === "number"
                  ? stats.weaponDamageBonus * 100
                  : stats.weaponDamageBonus,
                "%",
              )}
            </div>
          </section>
        </div>
      </details>

      <div className="strength-v2-character-trait">
        <strong>技能資訊</strong>
        {skills.map((skill) => (
          <div className="strength-v2-result-skill" key={skill.label}>
            <div className="strength-v2-skill-heading">
              <strong>{skill.label}</strong>
              {skill.type && (
                <span
                  className={`strength-v2-skill-type-tag ${getSkillTypeClass(skill.type)}`}
                >
                  {skill.type}
                </span>
              )}
            </div>
            <div className="strength-v2-skill-basic">
              <div className="strength-v2-result-stat">
                <span>技能倍率</span>
                <strong>{formatNumber(skill.result.coefficient)}%</strong>
              </div>
              {skill.info && (
                <>
                  {skill.showCooldown && (
                    <div className="strength-v2-result-stat">
                      <span>冷卻時間</span>
                      <strong>
                        {skill.info.cooldown
                          ? `${skill.info.cooldown} 秒`
                          : "尚未確認"}
                      </strong>
                    </div>
                  )}
                  <div className="strength-v2-skill-effect">
                    <span>技能效果</span>
                    <p>
                      {(skill.result as any).skillEffects?.effectLines?.length > 0
                        ? (skill.result as any).skillEffects.effectLines.map(
                            (line: {
                              text: string;
                              source: "skill" | "talent";
                              talentNode?: number;
                            },
                            index: number,
                          ) => (
                            <span
                              className="strength-v2-skill-effect-line"
                              key={`${skill.label}-${index}`}
                            >
                              {line.text}
                              {line.source === "talent" && line.talentNode
                                ? `（天賦${line.talentNode}）`
                                : ""}
                            </span>
                          ),
                        )
                        : (skill.result as any).skillEffects?.effectText ||
                          skill.info.originalEffectText ||
                          skill.info.effectText ||
                          "無"}
                    </p>
                  </div>
                </>
              )}
            </div>
            <details className="strength-v2-skill-calculation">
              <summary>計算明細</summary>
              <div className="strength-v2-result-stats">
                {skill.result.damage && (
                  <>
                    {panelStat("普通傷害", skill.result.damage.normalDamage)}
                    {panelStat("暴擊傷害", skill.result.damage.criticalDamage)}
                    {panelStat("期望傷害", skill.result.damage.expectedDamage)}
                  </>
                )}
                {skill.healing && panelStat("治療量", skill.healing.healing)}
              </div>

              {/* 原本的各敵人傷害：技能使用 */}
              {(skill.result as any).enemyDamages?.length > 0 && (
                <div className="specified-enemy-damage-details">
                  <strong>各敵人傷害</strong>
                  {(skill.result as any).enemyDamages.map(
                    (entry: any, index: number) => (
                      <div
                        className="strength-v2-result-stat"
                        key={`${entry.enemy.id}-${index}`}
                      >
                        <span>{entry.enemy.name}</span>
                        <strong>
                          {formatNumber(entry.damage.expectedDamage)}
                        </strong>
                      </div>
                    ),
                  )}
                </div>
              )}

              {/* 普攻：只顯示第一隻敵人 */}
              {skill.key === "normalAttack" && (skill.result as any).enemy && (
                <div className="specified-enemy-damage-details">
                  <strong>各敵人傷害</strong>
                  <div className="strength-v2-result-stat">
                    <span>{(skill.result as any).enemy.name}</span>
                    <strong>
                      {formatNumber(skill.result.damage.expectedDamage)}
                    </strong>
                  </div>
                </div>
              )}
            </details>
          </div>
        ))}
      </div>
      {warningList.length > 0 && (
        <div className="strength-v2-result-warnings">
          <strong>技能及天賦計算警告</strong>
          <ul>
            {warningList.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function getComparisonSummary(result: SideResult) {
  const schedule = result.damage.schedule;
  const damage = { normalAttack: 0, skill1: 0, skill2: 0, ultimate: 0 };
  const healing = { normalAttack: 0, skill1: 0, skill2: 0, ultimate: 0 };
  const uses = { normalAttack: 0, skill1: 0, skill2: 0, ultimate: 0 };

  for (const action of schedule?.actionProbabilities ?? []) {
    damage[action.skillKey] += action.probability * action.expectedDamage;
    healing[action.skillKey] += action.probability * action.expectedHealing;
    uses[action.skillKey] += action.probability;
  }

  return {
    totalDamage: schedule?.totalDamage ?? null,
    totalHealing: schedule?.totalHealing ?? null,
    damage,
    healing,
    uses,
  };
}

function ComparisonSummary({
  left,
  right,
}: {
  left: SideResult;
  right: SideResult;
}) {
  const leftSummary = getComparisonSummary(left);
  const rightSummary = getComparisonSummary(right);
  const rows = [
    { label: "總傷害", key: "totalDamage" as const },
    {
      label: "必殺技傷害",
      key: "ultimateDamage" as const,
      skill: "ultimate" as const,
    },
    {
      label: "二技能傷害",
      key: "skill2Damage" as const,
      skill: "skill2" as const,
    },
    {
      label: "一技能傷害",
      key: "skill1Damage" as const,
      skill: "skill1" as const,
    },
    {
      label: "普通攻擊傷害",
      key: "normalAttackDamage" as const,
      skill: "normalAttack" as const,
    },
  ];

  const getValue = (
    summary: ReturnType<typeof getComparisonSummary>,
    key: (typeof rows)[number]["key"],
  ): number | null => {
    switch (key) {
      case "totalDamage":
        return summary.totalDamage;
      case "ultimateDamage":
        return summary.damage.ultimate;
      case "skill2Damage":
        return summary.damage.skill2;
      case "skill1Damage":
        return summary.damage.skill1;
      case "normalAttackDamage":
        return summary.damage.normalAttack;
    }
  };

  const formatCompareValue = (value: number | null) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value).toLocaleString("zh-TW")
      : "資料缺漏";
  const formatUses = (value: number) =>
    Number(value.toFixed(2)).toLocaleString("zh-TW");

  return (
    <section className="specified-summary-comparison">
      <div className="strength-v2-character-comparison-names specified-summary-names">
        <strong>{left.character.name}</strong>
        <span>VS</span>
        <strong>{right.character.name}</strong>
      </div>
      <div className="strength-v2-character-comparison-table specified-summary-table">
        {rows.map((row) => {
          const valueA = getValue(leftSummary, row.key);
          const valueB = getValue(rightSummary, row.key);
          const difference =
            valueA !== null && valueB !== null ? valueA - valueB : null;
          const usesA = row.skill ? leftSummary.uses[row.skill] : null;
          const usesB = row.skill ? rightSummary.uses[row.skill] : null;
          const isTotalDamage = row.key === "totalDamage";
          return (
            <div className="strength-v2-character-comparison-row" key={row.key}>
              <span className="strength-v2-character-comparison-label">
                {row.label}
              </span>
              <div className="strength-v2-character-comparison-values">
                <strong
                  className={
                    difference !== null && difference > 0 ? "is-a-winner" : ""
                  }
                >
                  <span className="strength-v2-comparison-damage-number">
                    {formatCompareValue(valueA)}
                  </span>
                  {usesA !== null && (
                    <span className="strength-v2-comparison-uses">
                      （{formatUses(usesA)}次）
                    </span>
                  )}
                </strong>
                {!isTotalDamage && (
                  <span className="strength-v2-character-comparison-difference">
                    {difference === null
                      ? "無法比較"
                      : difference > 0
                        ? `${left.character.name} 高出 ${formatCompareValue(Math.abs(difference))}`
                        : difference < 0
                          ? `${right.character.name} 高出 ${formatCompareValue(Math.abs(difference))}`
                          : "兩名角色數值相同"}
                  </span>
                )}
                <strong
                  className={
                    difference !== null && difference < 0 ? "is-b-winner" : ""
                  }
                >
                  <span className="strength-v2-comparison-damage-number">
                    {formatCompareValue(valueB)}
                  </span>
                  {usesB !== null && (
                    <span className="strength-v2-comparison-uses">
                      （{formatUses(usesB)}次）
                    </span>
                  )}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SpecifiedComparison() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<SideSettings>(createSideSettings);
  const [right, setRight] = useState<SideSettings>(createSideSettings);
  const [enemySelections, setEnemySelections] = useState<
    { key: number; enemyId: string }[]
  >([]);
  const [nextEnemyKey, setNextEnemyKey] = useState(1);
  const [draggedEnemyKey, setDraggedEnemyKey] = useState<number | null>(null);
  const [characterFilters, setCharacterFilters] = useState<{
    rarity: CharacterRarity[];
    element: CharacterElement[];
    characterClass: CharacterClass[];
    attackType: AttackType[];
  }>({ rarity: [], element: [], characterClass: [], attackType: [] });
  const [results, setResults] = useState<{
    left: SideResult | null;
    right: SideResult | null;
  }>({ left: null, right: null });
  const [calculationError, setCalculationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStrengthData()
      .then((loaded) => {
        if (!cancelled) setData(loaded);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "計算資料載入失敗",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const characters = useMemo(
    () => data?.characterData.dataset.getAll() ?? [],
    [data],
  );
  const enemies = useMemo<StrengthEnemySettings[]>(
    () =>
      (data?.monsterData ?? []).map((monster) => ({
        id: monster.id,
        name: monster.name,
        kind: monster.kind,
        defenseType: monster.defenseType,
        maxHp: monster.maxHp,
      })),
    [data],
  );

  const filteredCharacters = useMemo(
    () =>
      characters.filter(
        (character) =>
          (!characterFilters.rarity.length ||
            characterFilters.rarity.includes(
              character.rarity as CharacterRarity,
            )) &&
          (!characterFilters.element.length ||
            characterFilters.element.includes(
              character.element as CharacterElement,
            )) &&
          (!characterFilters.characterClass.length ||
            characterFilters.characterClass.includes(
              character.class as CharacterClass,
            )) &&
          (!characterFilters.attackType.length ||
            (character.attackType !== undefined &&
              characterFilters.attackType.includes(character.attackType))),
      ),
    [characters, characterFilters],
  );

  const selectedEnemies = useMemo(
    () =>
      enemySelections.flatMap((selection) => {
        const enemy = enemies.find((item) => item.id === selection.enemyId);
        return enemy ? [{ ...enemy, id: String(selection.key) }] : [];
      }),
    [enemySelections, enemies],
  );

  const updateSide = (side: SideKey, patch: Partial<SideSettings>) => {
    const setter = side === "left" ? setLeft : setRight;
    setter((previous) => ({ ...previous, ...patch }));
    setResults({ left: null, right: null });
  };

  const reorderEnemy = (fromKey: number, toKey: number) => {
    if (fromKey === toKey) return;
    setEnemySelections((previous) => {
      const fromIndex = previous.findIndex((item) => item.key === fromKey);
      const toIndex = previous.findIndex((item) => item.key === toKey);
      if (fromIndex < 0 || toIndex < 0) return previous;
      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setResults({ left: null, right: null });
  };

  const calculateSide = (
    settings: SideSettings,
    sideEnemies: StrengthEnemySettings[],
  ): SideResult => {
    const character = characters.find(
      (item) => item.id === settings.characterId,
    );
    if (!character || !data) throw new Error("請先為左右兩側選擇角色。");
    const selectedNode: TalentNodeSelection = (
      character.rarity === "UR" ? settings.talentNode : 6
    ) as TalentNodeSelection;
    const statResult = calculateCharacterStats(
      character,
      data.strengthBaseData,
      settings.weaponQuality,
      selectedNode,
      "same",
      "UR",
      "rainbow" as AccessoryQuality,
      settings.hangingTraitDamageBonus,
      settings.autoApplyWandEffects,
    );
    const selectedSkillLevel: SkillLevelType =
      character.rarity === "UR" ? settings.skillLevel : "max";
    const damage = calculateCharacterDamage({
      character,
      normalAttackLevel: selectedSkillLevel,
      skillLevel: selectedSkillLevel,
      selectedNode,
      stats: {
        ...statResult.stats,
        attributeBoost: statResult.additionalStats.attributeBoost ?? null,
        attributeResistance:
          statResult.additionalStats.attributeResistance ?? null,
        abnormalResistance:
          statResult.additionalStats.abnormalResistance ?? null,
        criticalDamageResistance:
          statResult.additionalStats.criticalDamageResistance ?? null,
        criticalResistance:
          statResult.additionalStats.criticalResistance ?? null,
      },
      enemies: sideEnemies,
      elementRelation: "advantage",
      mode: settings.mode,
      environment: settings.environment,
      weaponDamageBonus: statResult.weaponDamageBonus,
      hangingTraitDamageBonus: statResult.hangingTraitDamageBonus,
      hangingTraitHealingBonus: statResult.hangingTraitHealingBonus,
      treatSelfHpConditionAsMet: settings.treatSelfHpConditionAsMet,
      scheduleSettings: {
        remainingSeconds: settings.remainingSeconds,
        ultimateUses: settings.ultimateUses,
        initialSkill1CooldownElapsedSeconds:
          settings.skill1PreCastSeconds === null
            ? null
            : Math.max(0, Math.round(settings.skill1PreCastSeconds - settings.remainingSeconds)),
        initialSkill2CooldownElapsedSeconds:
          settings.skill2PreCastSeconds === null
            ? null
            : Math.max(0, Math.round(settings.skill2PreCastSeconds - settings.remainingSeconds)),
      },
    });
    return {
      character,
      skillLevel: selectedSkillLevel,
      stats: statResult,
      damage,
      remainingSeconds: settings.remainingSeconds,
    };
  };

  const runComparison = () => {
    try {
      setCalculationError(null);
      setResults({
        left: calculateSide(left, selectedEnemies),
        right: calculateSide(right, selectedEnemies),
      });
    } catch (reason) {
      setResults({ left: null, right: null });
      setCalculationError(
        reason instanceof Error ? reason.message : "計算失敗",
      );
    }
  };

  const copySettings = (from: SideSettings, to: SideKey) => {
    const target = to === "left" ? left : right;
    const copy: SideSettings = {
      ...from,
      // 除目標側已選角色外，其餘側邊設定全部複製；環境條件也逐項複製，避免兩側共用物件。
      characterId: target.characterId,
      environment: {
        ...from.environment,
        ultimateGaugeIncrease: { ...from.environment.ultimateGaugeIncrease },
        attackIncrease: { ...from.environment.attackIncrease },
        defenseReduction: { ...from.environment.defenseReduction },
        attributeDamageIncrease: {
          ...from.environment.attributeDamageIncrease,
        },
        attributeResistanceReduction: {
          ...from.environment.attributeResistanceReduction,
        },
        speedIncrease: { ...from.environment.speedIncrease },
        criticalRateIncrease: { ...from.environment.criticalRateIncrease! },
        criticalDamageIncrease: { ...from.environment.criticalDamageIncrease! },
        customEnemyEffects: (from.environment.customEnemyEffects ?? []).map((item) => ({ ...item })),
      },
    };
    if (to === "left") setLeft(copy);
    else setRight(copy);
    setResults({ left: null, right: null });
  };

  if (loading)
    return (
      <div className="specified-comparison-page">
        <p>正在載入角色與計算資料…</p>
      </div>
    );
  if (error || !data)
    return (
      <div className="specified-comparison-page">
        <p className="specified-error">{error ?? "計算資料載入失敗"}</p>
      </div>
    );

  const toggleFilter = <K extends keyof typeof characterFilters>(
    key: K,
    value: (typeof characterFilters)[K][number],
  ) => {
    setCharacterFilters(
      (previous) =>
        ({
          ...previous,
          [key]: toggleFilterValue(previous[key] as string[], value as string),
        }) as typeof previous,
    );
  };

  return (
    <div className="strength-v2-page specified-comparison-page">
      <section className="strength-v2-section strength-v2-character-settings specified-filter-section">
        <h2>角色篩選</h2>
        <p className="strength-v2-muted">
          篩選條件會同時套用於左右兩側的角色名單。
        </p>
        <div className="strength-v2-character-filters">
          <FilterGroup
            title="稀有度"
            options={RARITY_OPTIONS}
            selected={characterFilters.rarity}
            onChange={(value) => toggleFilter("rarity", value)}
            onClear={() =>
              setCharacterFilters((previous) => ({ ...previous, rarity: [] }))
            }
          />
          <FilterGroup
            title="屬性"
            options={ELEMENT_OPTIONS}
            selected={characterFilters.element}
            onChange={(value) =>
              setCharacterFilters((previous) => ({
                ...previous,
                element: [value],
              }))
            }
            onClear={() =>
              setCharacterFilters((previous) => ({ ...previous, element: [] }))
            }
          />
          <FilterGroup
            title="職業"
            showClear={false}
            options={CLASS_OPTIONS}
            selected={characterFilters.characterClass}
            onChange={(value) => toggleFilter("characterClass", value)}
            onClear={() =>
              setCharacterFilters((previous) => ({
                ...previous,
                characterClass: [],
              }))
            }
          />
          <FilterGroup
            title="攻擊類型"
            showClear={false}
            options={ATTACK_TYPE_OPTIONS}
            selected={characterFilters.attackType}
            onChange={(value) =>
              setCharacterFilters((previous) => ({
                ...previous,
                attackType: [value],
              }))
            }
            onClear={() =>
              setCharacterFilters((previous) => ({
                ...previous,
                attackType: [],
              }))
            }
          />
        </div>
        <div className="specified-filter-footer">
          <span>符合條件：{filteredCharacters.length} 位角色</span>
          <button
            type="button"
            onClick={() =>
              setCharacterFilters({
                rarity: [],
                element: [],
                characterClass: [],
                attackType: [],
              })
            }
          >
            清除篩選
          </button>
        </div>
      </section>

      <section className="strength-v2-section strength-v2-enemy-section specified-enemy-section">
        <h2>共用敵人設定</h2>
        <p className="strength-v2-muted">
          新增敵人後，從資料庫選擇敵人。每個資料框代表一隻敵人，可以重複選擇相同敵人；可拖曳調整順序，第一隻敵人是單體攻擊優先目標，全體攻擊仍會命中所有敵人。左右兩側使用相同敵人組合。
        </p>
        {enemySelections.map((item, index) => {
          const enemy = enemies.find((entry) => entry.id === item.enemyId);
          return (
            <div
              className={`strength-v2-setting-group strength-v2-enemy-item ${draggedEnemyKey === item.key ? "is-dragging" : ""}`}
              key={item.key}
              draggable
              onDragStart={(event) => {
                setDraggedEnemyKey(item.key);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(item.key));
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const fromKey = Number(event.dataTransfer.getData("text/plain"));
                if (Number.isFinite(fromKey)) reorderEnemy(fromKey, item.key);
                setDraggedEnemyKey(null);
              }}
              onDragEnd={() => setDraggedEnemyKey(null)}
            >
              <div className="strength-v2-setting-row">
                <h3><span className="specified-enemy-drag-handle" aria-hidden="true">⠿</span> 敵人 {index + 1}</h3>
                <button
                  type="button"
                  onClick={() =>
                    setEnemySelections((previous) =>
                      previous.filter((entry) => entry.key !== item.key),
                    )
                  }
                >
                  刪除
                </button>
              </div>
              <div className="strength-v2-equipment-field">
                <select
                  value={item.enemyId}
                  onChange={(event) =>
                    setEnemySelections((previous) =>
                      previous.map((entry) =>
                        entry.key === item.key
                          ? { ...entry, enemyId: event.target.value }
                          : entry,
                      ),
                    )
                  }
                >
                  <option value="">請選擇敵人</option>
                  {enemies.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </div>
              {enemy && (
                <div className="strength-v2-result-stats">
                  <div className="strength-v2-result-stat">
                    <span>敵人種類</span>
                    <strong>{getEnemyKindLabel(enemy.kind)}</strong>
                  </div>
                  <div className="strength-v2-result-stat">
                    <span>防禦類型</span>
                    <strong>{enemy.defenseType}</strong>
                  </div>
                  <div className="strength-v2-result-stat">
                    <span>HP 上限</span>
                    <strong>
                      {enemy.maxHp === null
                        ? "無限"
                        : formatNumber(enemy.maxHp)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="strength-v2-button"
          onClick={() => {
            setEnemySelections((previous) => [
              ...previous,
              { key: nextEnemyKey, enemyId: "" },
            ]);
            setNextEnemyKey((previous) => previous + 1);
          }}
        >
          ＋ 新增敵人
        </button>
      </section>

      <div className="specified-comparison-columns">
        <SidePanel
          talentNodeBonuses={data.strengthBaseData.talentNodeBonuses}
          side="左側"
          settings={left}
          characters={filteredCharacters}
          enemies={selectedEnemies}
          onChange={(patch) => updateSide("left", patch)}
          onCopyFromOther={() => copySettings(right, "left")}
        />
        <SidePanel
          talentNodeBonuses={data.strengthBaseData.talentNodeBonuses}
          side="右側"
          settings={right}
          characters={filteredCharacters}
          enemies={selectedEnemies}
          onChange={(patch) => updateSide("right", patch)}
          onCopyFromOther={() => copySettings(left, "right")}
        />
      </div>

      <div className="specified-start-area">
        {calculationError && (
          <p className="specified-error">{calculationError}</p>
        )}
        <button
          type="button"
          className="strength-v2-calculate-button specified-start-button"
          onClick={runComparison}
        >
          開始比較
        </button>
      </div>

      <section className="strength-v2-section specified-results-section">
        <h2>比較結果</h2>
        {results.left && results.right ? (
          <>
            <ComparisonSummary left={results.left} right={results.right} />

            <div className="specified-detail-block">
              <h3 className="specified-detail-heading">詳細計算結果</h3>

              <div className="specified-comparison-columns specified-detail-columns">
                <ResultPanel result={results.left} side="左側" />
                <ResultPanel result={results.right} side="右側" />
              </div>
            </div>
          </>
        ) : (
          <div className="specified-result-empty">
            完成左右兩側設定並按下「開始比較」後，這裡會顯示雙方比較表與詳細計算結果。
          </div>
        )}
      </section>
    </div>
  );
}
