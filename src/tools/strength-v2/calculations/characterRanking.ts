
import type { calculateCharacterDamage } from './characterDamage'

type CharacterDamageResult =
    ReturnType<typeof calculateCharacterDamage>

export interface CharacterRankingEntry {
    rank: number
    characterId: string
    characterName: string
    totalDamage: number | null
    result: CharacterDamageResult
}

/**
 * 依照角色排程的期望總傷害排序。
 *
 * 傷害較高者排名在前。
 * 無法計算總傷害的角色排在最後。
 */
export function rankCharactersByDamage(
    results: CharacterDamageResult[],
): CharacterRankingEntry[] {
    const sorted = [...results].sort((a, b) => {
        const damageA = a.schedule?.totalDamage ?? null
        const damageB = b.schedule?.totalDamage ?? null

        if (damageA === null && damageB === null) {
            return 0
        }

        if (damageA === null) {
            return 1
        }

        if (damageB === null) {
            return -1
        }

        return damageB - damageA
    })

    return sorted.map((result, index) => ({
        rank: index + 1,
        characterId: result.characterId,
        characterName: result.characterName,
        totalDamage: result.schedule?.totalDamage ?? null,
        result,
    }))
}
