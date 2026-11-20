
import type { EngineCharacter } from '../../engine'

// ======================================================
// 基本共用型別
// ======================================================

export type StrengthCharacter = EngineCharacter

export type CharacterRarity = 'UR' | 'SSR' | 'SR' | 'R'

export type CharacterElement =
    | '水'
    | '火'
    | '風'
    | '地'
    | '雷'
    | '光'
    | '暗'

export type CharacterClass =
    | '拳'
    | '鞋'
    | '書'
    | '物杖'
    | '魔杖'
    | '盾'

export type AttackType = 'physical' | 'magic'

export type EnemyDefenseType =
    | '弱物'
    | '弱魔'
    | '物魔雙弱'
    | '物魔雙高'
    | '無弱點'

export type WeaponQuality = 'gold' | 'rainbow'

// 掛件傷害特性加成
export type HangingTraitDamageBonus = 15 | 10 | 8 | 5

// 是否自動將杖角色套用杖的掛件效果
export type AutoApplyWandEffects = boolean
// 掛件稀有度
export type HangingTraitRarity = 'UR' | 'SSR' | 'SR'

// 掛件特性類型
export type HangingTraitType =
    | 'same'          // 相同
    | 'pureUniversal' // 純通用
    | 'semiUniversal' // 半通用
    | 'fullyUniversal'// 完全通用
    | 'different'     // 不同

// 飾品品質
export type AccessoryQuality = 'gold' | 'rainbow'

export type SkillLevelType = 'initial' | 'max'

export type StrengthSkillKey =
    | 'normalAttack'
    | 'skill1'
    | 'skill2'
    | 'ultimate'

export type NullableNumber = number | null


// ======================================================
// 強度計算模式
// ======================================================

export type StrengthCalculationMode =
    | 'coefficient'
    | 'selfEffects'
    | 'maximum'

export const STRENGTH_CALCULATION_MODES = [
    {
        value: 'coefficient',
        label: '只看係數',
    },
    {
        value: 'selfEffects',
        label: '角色自帶增減益效果',
    },
    {
        value: 'maximum',
        label: '最大值',
    },
] as const


// ======================================================
// 角色篩選設定
// ======================================================

export type CharacterFilterSettings = {
    // 稀有度：可複選
    rarity: CharacterRarity[]

    // 屬性：可複選
    element: CharacterElement[]

    // 職業：可複選
    characterClass: CharacterClass[]

    // 攻擊類型：可複選
    attackType: AttackType[]
}

// ======================================================
// 天賦設定
// ======================================================

// 強度計算器可選擇的天賦節點為 4～17。
// 節點 1～3 已包含在基本面板；節點 18 不參與計算。
export type TalentNodeSelection =
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17

export type TalentSettings = {
    selectedNode: TalentNodeSelection
}


// ======================================================
// 最大值模式：環境效果
// ======================================================

export type EffectMagnitude = 'small' | 'medium' | 'large'

export type ConfigurableEnvironmentEffect = {
    enabled: boolean
    magnitude: EffectMagnitude
}

export type MaximumModeEnvironment = {
    // 大幅攻擊提升
    attackIncrease: boolean

    // 大幅防禦降低
    defenseReduction: boolean

    // 屬性傷害提升
    attributeDamageIncrease: ConfigurableEnvironmentEffect

    // 屬性抗性降低
    attributeResistanceReduction: ConfigurableEnvironmentEffect
}


// ======================================================
// 敵人設定
// ======================================================

export type StrengthEnemyKind =
    | 'boss'
    | 'minion'
    | 'bossMinion'

export type StrengthEnemySettings = {
    id: string
    name: string

    // BOSS、小怪或 BOSS小怪
    kind: StrengthEnemyKind

    // 敵人的防禦類型
    defenseType: EnemyDefenseType

    // 小怪生命上限；BOSS 為 null，代表無限生命
    maxHp: NullableNumber
}


// ======================================================
// 強度排行的戰鬥條件
// ======================================================

export type StrengthRankingSettings = {
    // 尚未設定時為 null，不擅自套用舊版預設次數
    ultimateUses: number | null

    // 第三波剩餘時間，單位：秒
    remainingSeconds: number
}


// ======================================================
// 完整計算設定
// ======================================================

export type StrengthCalculatorSettings = {
    mode: StrengthCalculationMode

    filters: CharacterFilterSettings

    // 技能使用初始或最大等級資料
    skillLevel: SkillLevelType

    // 武器品質
    weaponQuality: WeaponQuality

    // 全角色共用的掛件特性
    hangingTraitType: HangingTraitType

    // 全角色共用的掛件傷害特性加成
    hangingTraitDamageBonus: HangingTraitDamageBonus

    // 是否自動將杖角色套用杖的掛件效果
    autoApplyWandEffects: AutoApplyWandEffects

    // 全角色共用的飾品品質
    accessoryQuality: AccessoryQuality

    // 天賦進度，三種模式共用
    talent: TalentSettings

    // 最大值模式環境效果
    environment: MaximumModeEnvironment

    // 敵人資料
    enemies: StrengthEnemySettings[]

    // 強度排行條件
    ranking: StrengthRankingSettings
}

// ======================================================
// 角色基礎能力值
// ======================================================

export type CharacterBaseStats = {
    physicalAttack: NullableNumber
    magicAttack: NullableNumber
    healing: NullableNumber
    speed: NullableNumber

    criticalRate: NullableNumber
    criticalDamage: NullableNumber

    counterElementResistance: NullableNumber

    health: NullableNumber
    physicalDefense: NullableNumber
    magicDefense: NullableNumber
}


// ======================================================
// 計算後能力值
// ======================================================

export type CharacterCombatStats = {
    health: NullableNumber

    physicalAttack: NullableNumber
    magicAttack: NullableNumber
    healing: NullableNumber
    speed: NullableNumber

    criticalRate: NullableNumber
    criticalDamage: NullableNumber

    physicalDefense: NullableNumber
    magicDefense: NullableNumber

    counterElementResistance: NullableNumber

    damageBonus: NullableNumber
    attributeBoost: NullableNumber
    attributeResistance: NullableNumber

    abnormalResistance: NullableNumber
    criticalDamageResistance: NullableNumber
    criticalResistance: NullableNumber
}


// ======================================================
// 傷害及治療計算結果
// ======================================================

export type SkillDamageResult = {
    skillKey: StrengthSkillKey

    coefficient: NullableNumber

    normalDamage: NullableNumber
    criticalDamage: NullableNumber
    expectedDamage: NullableNumber

    criticalRate: NullableNumber

    // 計算過程中尚未支援或需要確認的資訊
    warnings: string[]
}

export type SkillHealingResult = {
    skillKey: StrengthSkillKey

    coefficient: NullableNumber
    healing: NullableNumber

    warnings: string[]
}


// ======================================================
// 角色計算結果
// ======================================================

export type CharacterStrengthResult = {
    characterId: string
    characterName: string

    attackType: AttackType
    element: CharacterElement

    stats: CharacterCombatStats

    damageResults: SkillDamageResult[]
    healingResults: SkillHealingResult[]

    warnings: string[]
}


// ======================================================
// 排名結果
// ======================================================

export type CharacterRankingItem = {
    rank: number
    characterId: string
    characterName: string

    score: number | null

    // 無法完整計算時保留原因，不將未知資料當成 0
    warnings: string[]
}

export type StrengthRankingResult = {
    damageRanking: CharacterRankingItem[]
    healingRanking: CharacterRankingItem[]
}


// ======================================================
// 資料載入與審查狀態
// ======================================================

export type StrengthDataWarning = {
    source: string
    message: string
    characterId?: string
}

export type StrengthDataStatus = {
    loading: boolean
    error: string | null
    warnings: StrengthDataWarning[]
}
