/*
這個檔案負責把 GAS 回傳的 JSON 轉成引擎使用的角色資料。

因為前一步已經在 sheetCharacterAdapter.ts 加入：
- 普攻初始與滿級倍率。
- 天賦倍率預設狀態。
所以這個檔案原則上不需要重新建立這些欄位，只要沿用轉換結果即可。

不過，我們要讓它能接收之後從 GAS 取得的天賦倍率資料。 
*/
import type { EngineCharacter } from '../types/character'
import type { EngineTalentMultiplierData } from '../types/talent'

import { createEngineCharacterFromSheetRows } from './sheetCharacterAdapter'

export interface JsonSkillLevel {
    cooldown: string
    coefficient: string
    effect: string
}

export interface JsonSkill {
    type: string
    initial: JsonSkillLevel
    max: JsonSkillLevel
}

export interface JsonCharacter {
    id: string
    name: string
    rarity: string
    element: string
    class: string
    ultimate: JsonSkill
    skill2: JsonSkill
    skill1: JsonSkill
    talent: string
    talentPages: string
    notes: string
    maxBreakthroughTrait: string
    sourceRows: number[]
    reviewRequired: boolean
    reviewIssues: string[]
}

function createSheetRow(
    character: JsonCharacter,
    level: 'initial' | 'max'
): unknown[] {
    const ultimate = character.ultimate[level]
    const skill2 = character.skill2[level]
    const skill1 = character.skill1[level]

    return [
        character.name, character.rarity, character.element, character.class,
        character.ultimate.type, parseCoefficient(ultimate.coefficient), ultimate.effect,
        character.skill2.type, parseCooldown(skill2.cooldown), parseCoefficient(skill2.coefficient), skill2.effect,
        character.skill1.type, parseCooldown(skill1.cooldown), parseCoefficient(skill1.coefficient), skill1.effect,
        level === 'initial' ? character.talent : '',
        character.talentPages, character.notes, character.maxBreakthroughTrait,
    ]
}

function parseCoefficient(value: string): number | string {
    const text = String(value ?? '').trim()

    if (!text) return ''

    if (text.endsWith('%')) {
        const number = Number(text.slice(0, -1))

        if (!Number.isFinite(number)) return text

        return number / 100
    }

    const number = Number(text)

    return Number.isFinite(number) ? number : text
}

function parseCooldown(value: string): number | string {
    const text = String(value ?? '').trim()

    if (!text) return ''

    const number = Number(text)

    return Number.isFinite(number) ? number : text
}

export function createEngineCharacterFromJson(
    character: JsonCharacter,
    attackType: 'physical' | 'magic',
    talentMultipliers?: EngineTalentMultiplierData
): EngineCharacter {
    const initialRow = createSheetRow(character, 'initial')
    const maxRow = createSheetRow(character, 'max')

    const result = createEngineCharacterFromSheetRows(
        initialRow,
        maxRow,
        {
            id: character.id,
            attackType,
        }
    )

    const reviewIssues = [
        ...new Set([
            ...result.reviewIssues,
            ...(character.reviewIssues ?? []),
        ]),
    ]

    return {
        ...result,

        // 確保普通攻擊倍率存在
        normalAttack: result.normalAttack ?? {
            initial: 1.00,
            max: 1.20,
        },

        id: character.id,
        name: character.name,
        sourceRows: character.sourceRows,

        // 有提供 GAS 倍率資料時使用 GAS 資料
        // 否則保留 sheetCharacterAdapter 的 unknown 預設值
        talentMultipliers:
            talentMultipliers ?? result.talentMultipliers,

        reviewRequired:
            result.reviewRequired ||
            character.reviewRequired ||
            reviewIssues.length > 0,

        reviewIssues,
    }
}
