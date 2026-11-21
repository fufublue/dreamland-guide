
import type {
    StrengthCalculatorSettings,
    MaximumModeEnvironment,
    CharacterFilterSettings,
} from './types'


// ======================================================
// 預設角色篩選條件
// ======================================================

export const DEFAULT_CHARACTER_FILTERS: CharacterFilterSettings = {
    // 空陣列代表不限制，全部納入
    rarity: [],
    element: [],
    characterClass: [],
    attackType: [],
}

// ======================================================
// 預設環境效果
// ======================================================

export const DEFAULT_ENVIRONMENT: MaximumModeEnvironment = {
  // 攻擊提升：固定大幅
  attackIncrease: {
    enabled: true,
    magnitude: "large",
    durationSeconds: 10,
    cooldownSeconds: 16,
  },

  // 防禦降低：固定大幅
  defenseReduction: {
    enabled: true,
    magnitude: "large",
    durationSeconds: 15,
    cooldownSeconds: 16,
  },

  // 屬性傷害提升
  attributeDamageIncrease: {
    enabled: false,
    magnitude: "medium",
    durationSeconds: 15,
    cooldownSeconds: 16,
  },

  // 屬性抗性降低
  attributeResistanceReduction: {
    enabled: false,
    magnitude: "medium",
    durationSeconds: 15,
    cooldownSeconds: 16,
  },
};


// ======================================================
// 預設強度計算設定
// ======================================================

export const createDefaultStrengthSettings =
    (): StrengthCalculatorSettings => ({
        // 預設使用最大值模式
        mode: 'maximum',

        // 角色篩選
        filters: {
            ...DEFAULT_CHARACTER_FILTERS,
        },

        // 技能使用初始等級資料
        skillLevel: 'initial',

        // 預設使用彩武
        weaponQuality: 'rainbow',

        // 掛件＆飾品
        hangingTraitType: 'same',

        // 掛件傷害特性預設 15%
        hangingTraitDamageBonus: 15,

        // 預設不自動套用杖角色效果
        autoApplyWandEffects: false,

        accessoryQuality: 'rainbow',

        // 預設天賦進度
        talent: {
            selectedNode: 5,
        },

        // 最大值模式環境效果
        environment: {
            ...DEFAULT_ENVIRONMENT,

            attackIncrease: {
                ...DEFAULT_ENVIRONMENT.attackIncrease,
            },

            defenseReduction: {
                ...DEFAULT_ENVIRONMENT.defenseReduction,
            },

            attributeDamageIncrease: {
                ...DEFAULT_ENVIRONMENT.attributeDamageIncrease,
            },

            attributeResistanceReduction: {
                ...DEFAULT_ENVIRONMENT.attributeResistanceReduction,
            },
        },

        // 敵人由使用者自行新增
        enemies: [],

        // 強度排行設定
        ranking: {
            // 尚未設定必殺技次數
            ultimateUses: null,

            // 第三波剩餘時間預設 50 秒
            remainingSeconds: 50,
        },
    })


// ======================================================
// 預設設定重置工具
// ======================================================

export function resetStrengthSettings(): StrengthCalculatorSettings {
    return createDefaultStrengthSettings()
}
