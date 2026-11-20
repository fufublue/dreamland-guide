
import { fetchWithVersionCache } from './versionCache'
import { DATA_VERSIONS } from './data/dataVersions'

// Apps Script 角色資料 API
const CHARACTER_API_URL =
    'https://script.google.com/macros/s/AKfycbyp8IGZv3SaqvlIQ8SwyELS1aUkNafWW-U0GGsOpDsK-Udyvhm1QAGfIxy85oAZfMlB/exec?type=character'

// 角色分類
export type CharacterElementType = 'physical' | 'magic'

// 技能初始、滿等資料
export interface CharacterSkillLevel {
    cooldown: string
    coefficient: string
    effect: string
}

// 技能資料
export interface CharacterSkill {
    type: string
    initial: CharacterSkillLevel
    max: CharacterSkillLevel
}

// 角色資料
export interface Character {
    id: string
    name: string
    rarity: string
    element: string
    class: string
    attackType?: 'physical' | 'magic'

    ultimate: CharacterSkill
    skill2: CharacterSkill
    skill1: CharacterSkill

    talent: string
    talentPages: string
    notes: string
    maxBreakthroughTrait: string

    sourceRows: number[]
    reviewRequired: boolean
    reviewIssues: string[]
}

// API 回傳格式
export interface CharacterApiResponse {
    success: boolean
    element: CharacterElementType
    updatedAt: string
    count: number
    characters: Character[]
    warningCount?: number
}

// 讀取指定類型角色資料

async function requestCharacterData(
    element: CharacterElementType
): Promise<CharacterApiResponse> {
    const url =
        `${CHARACTER_API_URL}&element=${element}`

    const response = await fetch(url, {
        cache: 'no-cache',
    })

    if (!response.ok) {
        throw new Error('角色資料讀取失敗，請稍後再試。')
    }

    // 先取得原始文字，方便確認 API 實際回傳內容
    const responseText = await response.text()

    let data: CharacterApiResponse

    try {
        data = JSON.parse(responseText)
    } catch (error) {
        console.error('角色 API 回傳的內容不是合法 JSON：', {
            element,
            status: response.status,
            responseText: responseText.slice(0, 500),
            error,
        })

        throw new Error('角色資料 JSON 解析失敗。')
    }

    if (
        !data.success ||
        !Array.isArray(data.characters)
    ) {
        console.error('角色 API 資料格式錯誤：', data)
        throw new Error('角色資料格式錯誤。')
    }

    return data
}


// 讀取角色資料（使用網站版本快取）
export async function fetchCharacterData(
    element: CharacterElementType
): Promise<CharacterApiResponse> {
    return fetchWithVersionCache(
        `character-data-${element}`,
        DATA_VERSIONS.characterData,
        () => requestCharacterData(element)
    )
}
