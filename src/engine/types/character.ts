
// 定義新系統使用的角色與技能資料。
import type { EngineEffect } from './effect'
import type { EngineCalculation } from './calculation'
import type {
    EngineTalentData,
    EngineTalentMultiplierData,
} from './talent'

// 普通技能等級資料
export interface EngineSkillLevel {
    cooldown: string
    coefficient: string
    effectText: string
    originalEffectText?: string

    effects: EngineEffect[]
    calculations: EngineCalculation[]

    reviewRequired: boolean
    reviewIssues: string[]
}

// 普通技能資料
export interface EngineSkill {
    type: string
    initial: EngineSkillLevel
    max: EngineSkillLevel
}

// 普攻資料：只保存初始與滿級主倍率
export interface EngineNormalAttack {
    initial: number
    max: number
}

// 角色完整資料
export interface EngineCharacter {
    id: string
    name: string
    rarity: string
    element: string
    class: string

    attackType?: 'physical' | 'magic'

    normalAttack: EngineNormalAttack

    ultimate: EngineSkill
    skill2: EngineSkill
    skill1: EngineSkill

    talent: EngineTalentData
    talentMultipliers: EngineTalentMultiplierData

    talentPages: string
    notes: string
    maxBreakthroughTrait: string
    sourceRows?: number[]

    reviewRequired: boolean
    reviewIssues: string[]
}
