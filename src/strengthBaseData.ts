
import { fetchWithVersionCache } from './versionCache'
import { DATA_VERSIONS } from './data/dataVersions'

// 強度計算基準資料 API
const STRENGTH_BASE_API_URL =
    'https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnTIpTvQyQokTe_Dn5dLl5qwjsrW9RpleCYhUc1lRGEKnx9uw99bnSv9jVrop-UtpRW303awoi01WBeNR3hM9h1qG2pIQbZ_AtjcNvlmFTMgvejLReLGuWmlI49UmTWj5vaYAn97-19OF7ckV1s7tdXpQkCj50sXbU2BhBh7QWFLygtsb8H_6gCUGnZwmWZTy-WA9Lp0wwCv8OqnUP8_CUbS-xYE0NpZo8rlf0e3PeOhE78GhRdmkvt4YJ7kE3fQ-qtbqy_J59jlDidzry8WWYglp1tc1UxGw6DW2daYBr5oW9j_Uck&lib=MOX1pYxO8RuR6XrGG9CnCDWb-c7rEWU4q'


// ==============================
// 一般能力值
// ==============================
export interface GeneralStat {
    rarity: string
    class: string
    physicalAttack: number
    magicAttack: number
    healing: number
    speed: number
    criticalRate: number
    criticalDamage: number
    counterElementResistance: number
    health: number
    physicalDefense: number
    magicDefense: number
}


// ==============================
// 掛件特性加成
// ==============================

export interface HangingTraitBonus {
    type: string
    UR: number
    SSR: number
    SR: number
}


// ==============================
// 武器加成
// ==============================

export interface WeaponClassStat {
    attack: number
    healing: number
    speed: number
    physicalDefense: number
    magicDefense: number
    criticalRate: number
    damageBonus: number
}

export interface WeaponClassBonus {
    class: string
    gold: WeaponClassStat
    rainbow: WeaponClassStat
}

export interface WeaponClassAttackBonus {
    class: string
    gold: number
    rainbow: number
}

export interface WeaponBonuses {
    byClass: WeaponClassBonus[]

    // 舊版相容資料：新版 API 可以不提供
    attackByClass?: WeaponClassAttackBonus[]
}


// ==============================
// 飾品加成
// ==============================

export interface AccessoryStat {
    health: number
    attributeResistance: number
}

export interface AccessoryBonuses {
    gold: AccessoryStat
    rainbow: AccessoryStat
}


// ==============================
// 天賦節點效果
// ==============================

export interface TalentNodeEffect {
    node: number
    includedInBase: boolean
    effectText: string
    effectType: string
    stat: string | null
    value: number | null
    unit: string | null
}

export interface TalentNodeBonus {
    rarity: string
    class: string
    nodes: TalentNodeEffect[]
}


// ==============================
// API 回傳格式
// ==============================

export interface StrengthBaseApiResponse {
    success: boolean
    version: number
    sourceSheet: string
    updatedAt: string

    generalStats: GeneralStat[]

    hangingTraitBonuses: HangingTraitBonus[]

    weaponBonuses: WeaponBonuses

    accessoryBonuses: AccessoryBonuses

    talentNodeBonuses: TalentNodeBonus[]

    warningCount: number
    warnings: string[]
}


// ==============================
// 讀取 API 資料
// ==============================

async function requestStrengthBaseData(): Promise<StrengthBaseApiResponse> {

    const response = await fetch(STRENGTH_BASE_API_URL, {
        cache: 'no-cache'
    })

    if (!response.ok) {
        throw new Error('強度計算基準資料讀取失敗，請稍後再試。')
    }

    const responseText = await response.text()

    let data: StrengthBaseApiResponse

    try {
        data = JSON.parse(responseText)
    } catch {
        throw new Error('強度計算基準資料 JSON 解析失敗。')
    }

    // 檢查主要資料結構，並列出不符合的欄位
    const problems: string[] = []

    if (!data || data.success !== true) {
        problems.push('success 不為 true')
    }

    if (data?.version !== 3) {
        problems.push(`version：收到 ${data?.version ?? 'undefined'}，預期 3`)
    }

    if (!Array.isArray(data?.generalStats)) {
        problems.push('generalStats 不是陣列')
    }

    if (!Array.isArray(data?.hangingTraitBonuses)) {
        problems.push('hangingTraitBonuses 不是陣列')
    }

    if (!data?.weaponBonuses) {
        problems.push('缺少 weaponBonuses')
    } else if (!Array.isArray(data.weaponBonuses.byClass)) {
        problems.push('weaponBonuses.byClass 不是陣列')
    }

    if (!data?.accessoryBonuses) {
        problems.push('缺少 accessoryBonuses')
    } else {
        if (!data.accessoryBonuses.gold) {
            problems.push('缺少 accessoryBonuses.gold')
        }

        if (!data.accessoryBonuses.rainbow) {
            problems.push('缺少 accessoryBonuses.rainbow')
        }
    }

    if (!Array.isArray(data?.talentNodeBonuses)) {
        problems.push('talentNodeBonuses 不是陣列')
    }

    if (problems.length > 0) {
        console.error('強度計算基準資料實際回應：', data)
        throw new Error(
            `強度計算基準資料格式錯誤：${problems.join('；')}`
        )
    }

    return data
}


// ==============================
// 提供其他功能共用
// ==============================

export async function fetchStrengthBaseData(): Promise<StrengthBaseApiResponse> {

    return fetchWithVersionCache(
        'strength-base-data',
        DATA_VERSIONS.strengthBaseData,
        () => requestStrengthBaseData()
    )
}
