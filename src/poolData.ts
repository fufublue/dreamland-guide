
import { fetchWithVersionCache } from './versionCache'
import { DATA_VERSIONS } from './data/dataVersions'

const POOL_API_URL =
    'https://script.google.com/macros/s/AKfycbyp8IGZv3SaqvlIQ8SwyELS1aUkNafWW-U0GGsOpDsK-Udyvhm1QAGfIxy85oAZfMlB/exec?type=pool'

// 角色類型
export type PoolCharacterType =
    | '限定角色'
    | '常駐角色'
    | '專屬時刻(限定)'

// 混池角色資料
export interface PoolCharacter {
    character: string
    poolRange: string
    type: PoolCharacterType
    activity: string | null
    isPrediction: boolean
    poolStatus: '已歸入' | '尚未歸入'
}

// API 回傳格式
export interface PoolApiResponse {
    success: boolean
    updatedAt: string
    count: number
    characters: PoolCharacter[]
}

// 實際向 API 讀取混池資料
async function requestPoolData(): Promise<PoolApiResponse> {
    const response = await fetch(POOL_API_URL, {
        cache: 'no-cache',
    })

    if (!response.ok) {
        throw new Error('混池資料讀取失敗，請稍後再試。')
    }

    const data: PoolApiResponse = await response.json()

    if (
        !data.success ||
        !Array.isArray(data.characters)
    ) {
        throw new Error('混池資料格式錯誤。')
    }

    return data
}

// 讀取混池資料（使用網站版本快取）
export async function fetchPoolData(): Promise<PoolApiResponse> {
    return fetchWithVersionCache(
        'pool-data',
        DATA_VERSIONS.poolData,
        requestPoolData
    )
}
