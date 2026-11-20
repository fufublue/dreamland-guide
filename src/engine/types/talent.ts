
// 負責定義天賦規則與天賦解鎖狀態。

// 角色個別的天賦效果規則
export type TalentNode = 9 | 12 | 15

export type TalentSkillSlot =
    | 'skill1'
    | 'skill2'
    | 'ultimate'

export type TalentOperationType =
    | 'replaceMagnitude'
    | 'replaceDuration'
    | 'replaceHealing'
    | 'replaceChance'
    | 'replaceCooldown'
    | 'addEffect'
    | 'unknown'

export interface EngineTalentRule {
    id: string
    node: TalentNode
    targetSkill: TalentSkillSlot
    operation: TalentOperationType

    originalText: string
    replacement: string

    reviewRequired: boolean
    reviewIssues: string[]
}

export interface EngineTalentData {
    originalText: string
    rules: EngineTalentRule[]
    reviewRequired: boolean
    reviewIssues: string[]
}

// GAS 天賦倍率資料狀態
export type TalentMultiplierStatus =
    | 'increase'
    | 'none'
    | 'unknown'

// 單一天賦節點的主技能倍率增加資料
export interface EngineTalentMultiplierValue {
    status: TalentMultiplierStatus
    value: number | null
}

// 角色的天賦 9、12、15 主技能倍率資料
export interface EngineTalentMultiplierData {
    talent9: EngineTalentMultiplierValue
    talent12: EngineTalentMultiplierValue
    talent15: EngineTalentMultiplierValue
}

// 天賦解鎖狀態
export interface TalentUnlockState {
    node6: boolean
    node9: boolean
    node12: boolean
    node15: boolean
}
