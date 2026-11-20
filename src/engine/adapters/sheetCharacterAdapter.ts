
// 這個檔案負責把試算表的一組初始等級與最大等級資料，轉換成我們新系統使用的 EngineCharacter。

import type {
    EngineCharacter,
    EngineSkill,
    EngineSkillLevel,
} from '../types/character'

import type {
    EngineTalentMultiplierData,
} from '../types/talent'

import { parseEffectText } from '../parser/effectParser'
import { parseCalculationData } from '../parser/calculationParser'
import { parseTalentText } from '../parser/talentParser'

export interface SheetCharacterOptions {
    id?: string
    attackType?: 'physical' | 'magic'
}

function cellToText(
    value: unknown,
    zeroAsBlank = false
): string {
    if (value === null || value === undefined) {
        return ''
    }

    if (zeroAsBlank && value === 0) {
        return ''
    }

    return String(value).trim()
}

// 尚未取得 GAS 倍率資料時，預設為未知
function createUnknownTalentMultipliers(): EngineTalentMultiplierData {
    return {
        talent9: {
            status: 'unknown',
            value: null,
        },
        talent12: {
            status: 'unknown',
            value: null,
        },
        talent15: {
            status: 'unknown',
            value: null,
        },
    }
}

function createSkillLevel(
    row: readonly unknown[],
    cooldownIndex: number,
    coefficientIndex: number,
    effectIndex: number,
    skillType: string
): EngineSkillLevel {
    const cooldown = cellToText(
        cooldownIndex >= 0 ? row[cooldownIndex] : ''
    )

    const coefficient = cellToText(
        row[coefficientIndex]
    )

    const effectText = cellToText(
        row[effectIndex],
        true
    )

    const effects = parseEffectText(effectText)

    const calculations = parseCalculationData(
        coefficient,
        effectText,
        skillType
    )

    const reviewIssues = [
        ...effects.flatMap(effect => effect.reviewIssues),
        ...calculations.flatMap(item => item.reviewIssues),
    ]

    return {
        cooldown,
        coefficient,
        effectText,

        effects,
        calculations,

        reviewRequired: reviewIssues.length > 0,
        reviewIssues,
    }
}

function createSkill(
    initialRow: readonly unknown[],
    maxRow: readonly unknown[],
    typeIndex: number,
    cooldownIndex: number,
    coefficientIndex: number,
    effectIndex: number,
    ultimate = false
): EngineSkill {
    const skillType = cellToText(
        initialRow[typeIndex]
    )

    return {
        type: skillType,

        initial: createSkillLevel(
            initialRow,
            ultimate ? -1 : cooldownIndex,
            coefficientIndex,
            effectIndex,
            skillType
        ),

        max: createSkillLevel(
            maxRow,
            ultimate ? -1 : cooldownIndex,
            coefficientIndex,
            effectIndex,
            skillType
        ),
    }
}

/**
 * 將角色試算表的兩列資料轉換成 EngineCharacter。
 *
 * initialRow：初始等級資料
 * maxRow：最大等級資料
 *
 * 欄位位置依照「魔法角色_編輯用」及「物理角色_編輯用」：
 *
 * 0 角色名
 * 1 稀有度
 * 2 屬性
 * 3 職業
 * 4 必殺技
 * 5 必殺技係數
 * 6 必殺技效果
 * 7 2技能
 * 8 2技能CD
 * 9 2技能係數
 * 10 2技能效果
 * 11 1技能
 * 12 1技能CD
 * 13 1技能係數
 * 14 1技能效果
 * 15 天賦
 * 16 頁數
 * 17 補充
 * 18 特性（滿突）
 */
export function createEngineCharacterFromSheetRows(
    initialRow: readonly unknown[],
    maxRow: readonly unknown[],
    options: SheetCharacterOptions = {}
): EngineCharacter {
    const name = cellToText(initialRow[0])
    const maxName = cellToText(maxRow[0])

    if (!name) {
        throw new Error('角色名稱不可為空')
    }

    if (name !== maxName) {
        throw new Error(
            `初始等級與最大等級角色不一致：${name} / ${maxName}`
        )
    }

    const talent = parseTalentText(
        cellToText(initialRow[15])
    )

    const ultimate = createSkill(
        initialRow,
        maxRow,
        4,
        -1,
        5,
        6,
        true
    )

    const skill2 = createSkill(
        initialRow,
        maxRow,
        7,
        8,
        9,
        10
    )

    const skill1 = createSkill(
        initialRow,
        maxRow,
        11,
        12,
        13,
        14
    )

    const allLevels = [
        ultimate.initial,
        ultimate.max,
        skill2.initial,
        skill2.max,
        skill1.initial,
        skill1.max,
    ]

    const reviewIssues = [
        ...talent.reviewIssues,
        ...allLevels.flatMap(level => level.reviewIssues),
    ]

    return {
        id: options.id ?? name,
        name,

        rarity: cellToText(initialRow[1]),
        element: cellToText(initialRow[2]),
        class: cellToText(initialRow[3]),

        attackType: options.attackType,

        // 所有角色共通的普攻基礎倍率
        normalAttack: {
            initial: 1.00,
            max: 1.20,
        },

        ultimate,
        skill2,
        skill1,

        talent,
        talentMultipliers: createUnknownTalentMultipliers(),

        talentPages: cellToText(initialRow[16]),
        notes: cellToText(initialRow[17]),
        maxBreakthroughTrait: cellToText(initialRow[18]),

        reviewRequired: reviewIssues.length > 0,
        reviewIssues,
    }
}
