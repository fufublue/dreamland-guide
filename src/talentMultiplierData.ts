
import { fetchWithVersionCache } from './versionCache'
import { DATA_VERSIONS } from './data/dataVersions'

// 角色天賦倍率 API
// 與原本角色資料使用同一個 Apps Script 部署
const TALENT_MULTIPLIER_API_URL =
    'https://script.google.com/macros/s/AKfycbyp8IGZv3SaqvlIQ8SwyELS1aUkNafWW-U0GGsOpDsK-Udyvhm1QAGfIxy85oAZfMlB/exec?type=talent-multiplier'

// 單一角色的天賦倍率資料
export interface TalentMultiplier {
    name: string
    talent9: number | null
    talent12: number | null
    talent15: number | null
    confirmed: boolean
}

// API 回傳格式
export interface TalentMultiplierApiResponse {
    success: boolean
    updatedAt: string
    count: number
    talentMultipliers: TalentMultiplier[]
}

// 讀取角色天賦倍率資料
async function requestTalentMultiplierData(): Promise<TalentMultiplierApiResponse> {

    const response = await fetch(TALENT_MULTIPLIER_API_URL, {
        cache: 'no-cache'
    })

    if (!response.ok) {
        throw new Error('角色天賦倍率資料讀取失敗，請稍後再試。')
    }

    const responseText = await response.text()

    let data: TalentMultiplierApiResponse

    try {
        data = JSON.parse(responseText)
    } catch {
        throw new Error('角色天賦倍率 JSON 解析失敗。')
    }

    if (
        !data.success ||
        !Array.isArray(data.talentMultipliers)
    ) {
        throw new Error('角色天賦倍率資料格式錯誤。')
    }

    return data
}

// 提供其他功能共用
export async function fetchTalentMultiplierData(): Promise<TalentMultiplierApiResponse> {
    return fetchWithVersionCache(
        'talent-multiplier-data',
        DATA_VERSIONS.talentMultiplierData,
        () => requestTalentMultiplierData()
    )
}
