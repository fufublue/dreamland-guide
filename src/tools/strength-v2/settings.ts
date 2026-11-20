
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
    attackIncrease: false,

    defenseReduction: false,

    attributeDamageIncrease: {
        enabled: false,
        magnitude: 'medium',
    },

    attributeResistanceReduction: {
        enabled: false,
        magnitude: 'medium',
    },
}


// ======================================================
// 預設強度計算設定
// ======================================================

export const createDefaultStrengthSettings =
    (): StrengthCalculatorSettings => ({
        // 預設使用只看係數模式
        mode: 'coefficient',

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
