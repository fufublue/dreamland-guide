//資料載入入口

import {
    createEngineCharacterFromJson,
    type JsonCharacter,
} from '../adapters/jsonCharacterAdapter'

import type {
    EngineTalentMultiplierData,
    EngineTalentMultiplierValue,
} from '../types/talent'

import { CharacterDataset } from '../dataset/characterDataset'
import { fetchWithVersionCache } from '../../versionCache'
import { DATA_VERSIONS } from '../../data/dataVersions'

const GAS_API_BASE_URL =
    'https://script.google.com/macros/s/AKfycbyp8IGZv3SaqvlIQ8SwyELS1aUkNafWW-U0GGsOpDsK-Udyvhm1QAGfIxy85oAZfMlB/exec'

interface CharacterApiResponse {
    success: boolean
    element: string
    updatedAt?: string
    count?: number
    characters: JsonCharacter[]
    warningCount?: number
}

interface TalentMultiplierApiItem {
    name: string
    talent9: EngineTalentMultiplierValue
    talent12: EngineTalentMultiplierValue
    talent15: EngineTalentMultiplierValue
}

interface TalentMultiplierApiResponse {
    success: boolean
    updatedAt?: string
    count?: number
    talentMultipliers: TalentMultiplierApiItem[]
}

export interface CharacterDataResult {
    dataset: CharacterDataset
    physicalCount: number
    magicCount: number
    totalCount: number
    warningCount: number
    physicalUpdatedAt: string
    magicUpdatedAt: string
    talentMultiplierUpdatedAt: string
    talentMultiplierCount: number
}

async function fetchCharacters(
    attackType: 'physical' | 'magic',
    fetcher: typeof fetch
): Promise<CharacterApiResponse> {
    const url =
        `${GAS_API_BASE_URL}?type=character&element=${attackType}`

    const response = await fetcher(url, {
        method: 'GET',
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new Error(
            `GAS 請求失敗（${attackType}）：HTTP ${response.status}`
        )
    }

    const responseText = await response.text()


    const data = JSON.parse(responseText) as CharacterApiResponse

    if (data.success !== true) {
        throw new Error(`GAS 回傳失敗（${attackType}）`)
    }

    if (!Array.isArray(data.characters)) {
        throw new Error(
            `GAS 回傳的角色資料格式錯誤（${attackType}）`
        )
    }

    return data
}

// 取得尚未確認的預設倍率資料
function createUnknownMultiplier(): EngineTalentMultiplierValue {
    return {
        status: 'unknown',
        value: null,
    }
}


// 驗證單一倍率資料
function normalizeMultiplierValue(
    value: unknown
): EngineTalentMultiplierValue {
    if (!value || typeof value !== 'object') {
        return createUnknownMultiplier()
    }

    const item = value as {
        status?: unknown
        value?: unknown
    }

    if (item.status === 'increase') {
        if (
            typeof item.value === 'number' &&
            Number.isFinite(item.value) &&
            item.value >= 0
        ) {
            return {
                status: 'increase',
                value: item.value,
            }
        }

        return createUnknownMultiplier()
    }

    if (item.status === 'none') {
        return {
            status: 'none',
            value: null,
        }
    }

    return createUnknownMultiplier()
}

// 整理角色的三個天賦倍率
function normalizeTalentMultipliers(
    item: TalentMultiplierApiItem
): EngineTalentMultiplierData {
    return {
        talent9: normalizeMultiplierValue(item.talent9),
        talent12: normalizeMultiplierValue(item.talent12),
        talent15: normalizeMultiplierValue(item.talent15),
    }
}

// 取得 GAS 天賦倍率資料
async function fetchTalentMultipliers(
    fetcher: typeof fetch
): Promise<TalentMultiplierApiResponse> {
    const url = `${GAS_API_BASE_URL}?type=talent-multiplier`

    const response = await fetcher(url, {
        method: 'GET',
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new Error(
            `GAS 天賦倍率請求失敗：HTTP ${response.status}`
        )
    }

    const responseText = await response.text()


    const data = JSON.parse(responseText) as TalentMultiplierApiResponse

    if (data.success !== true) {
        throw new Error('GAS 天賦倍率資料回傳失敗')
    }

    if (!Array.isArray(data.talentMultipliers)) {
        throw new Error('GAS 天賦倍率資料格式錯誤')
    }

    return data
}

export async function loadCharacterDataset(
    fetcher: typeof fetch = fetch
): Promise<CharacterDataResult> {
   
    // 同時取得物理、魔法及天賦倍率資料
    // 天賦倍率 API 失敗時，不影響角色資料載入
    const [
        physicalData,
        magicData,
        talentMultiplierData,
    ] = await Promise.all([
        // 與功能查找、角色搜尋共用同一份本機角色快取。
        // 第一次載入後，重新整理也不需要再次向 GAS 下載角色資料。
        fetchWithVersionCache(
            'character-data-physical',
            DATA_VERSIONS.characterData,
            () => fetchCharacters('physical', fetcher)
        ),
        fetchWithVersionCache(
            'character-data-magic',
            DATA_VERSIONS.characterData,
            () => fetchCharacters('magic', fetcher)
        ),

        // 引擎使用的天賦倍率回傳格式不同，使用獨立快取。
        fetchWithVersionCache(
            'engine-talent-multiplier-data',
            DATA_VERSIONS.talentMultiplierData,
            () => fetchTalentMultipliers(fetcher)
        ).catch(error => {
            console.warn(
                '[Data Source] 天賦倍率資料取得失敗，改用 unknown 預設值：',
                error
            )

            return {
                success: false,
                talentMultipliers: [],
            } as TalentMultiplierApiResponse
        }),
    ])

    // 建立角色名稱與倍率資料的對照表
    const talentMultiplierMap = new Map<
        string,
        EngineTalentMultiplierData
    >()

    for (const item of talentMultiplierData.talentMultipliers) {
        if (!item.name) continue

        talentMultiplierMap.set(
            item.name,
            normalizeTalentMultipliers(item)
        )
    }

    // 建立物理角色
    const physicalCharacters = physicalData.characters.map(character =>
        createEngineCharacterFromJson(
            character,
            'physical',
            talentMultiplierMap.get(character.name)
        )
    )

    // 建立魔法角色
    const magicCharacters = magicData.characters.map(character =>
        createEngineCharacterFromJson(
            character,
            'magic',
            talentMultiplierMap.get(character.name)
        )
    )

    // 合併角色資料
    const dataset = new CharacterDataset()

    dataset.setCharacters([
        ...physicalCharacters,
        ...magicCharacters,
    ])

    return {
        dataset,

        physicalCount: physicalCharacters.length,
        magicCount: magicCharacters.length,
        totalCount: dataset.count,

        warningCount:
            (physicalData.warningCount ?? 0) +
            (magicData.warningCount ?? 0),

        physicalUpdatedAt: physicalData.updatedAt ?? '',
        magicUpdatedAt: magicData.updatedAt ?? '',

        talentMultiplierUpdatedAt:
            talentMultiplierData.updatedAt ?? '',

        talentMultiplierCount:
            talentMultiplierData.talentMultipliers.length,
    }
}
