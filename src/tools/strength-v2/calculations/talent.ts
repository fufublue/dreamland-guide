
import type { EngineCharacter } from '../../../engine'
import type {
    CharacterBaseStats,
    CharacterCombatStats,
    TalentNodeSelection,
} from '../types'
import type { StrengthBaseDataV2 } from '../data/strengthBaseAdapter'

type AdditionalTalentStats = Partial<
    Pick<
        CharacterCombatStats,
        | 'attributeBoost'
        | 'attributeResistance'
        | 'abnormalResistance'
        | 'criticalDamageResistance'
        | 'criticalResistance'
    >
>

export type TalentStatsResult = {
    stats: CharacterBaseStats
    additionalStats: AdditionalTalentStats
    effectiveNode: number
    appliedNodes: number[]
    warnings: string[]
}

type TalentNodeEffectRow = {
    node?: unknown
    includedInBase?: unknown
    effectType?: unknown
    stat?: unknown
    value?: unknown
    unit?: unknown
    effectText?: unknown
}

type TalentNodeRow = {
    rarity?: unknown
    class?: unknown
    nodes?: TalentNodeEffectRow[]
}

const STAT_FIELD_MAP: Record<
    string,
    keyof CharacterBaseStats | keyof AdditionalTalentStats
> = {
    // 基礎能力值
    physicalAttack: 'physicalAttack',
    magicAttack: 'magicAttack',
    healing: 'healing',
    speed: 'speed',
    criticalRate: 'criticalRate',
    criticalDamage: 'criticalDamage',
    counterElementResistance: 'counterElementResistance',
    health: 'health',
    physicalDefense: 'physicalDefense',
    magicDefense: 'magicDefense',

    // 額外能力值
    attributeBoost: 'attributeBoost',
    '屬性強化': 'attributeBoost',
    attributeResistance: 'attributeResistance',
    abnormalResistance: 'abnormalResistance',
    criticalDamageResistance: 'criticalDamageResistance',
    criticalResistance: 'criticalResistance',

    // 遊戲天賦資料使用的中文名稱
    '物攻': 'physicalAttack',
    '魔攻': 'magicAttack',
    '治療': 'healing',
    '速度': 'speed',
    '爆擊': 'criticalRate',
    '爆傷': 'criticalDamage',
    '剋屬抵抗': 'counterElementResistance',
    '生命': 'health',
    '物防': 'physicalDefense',
    '魔防': 'magicDefense',
    '屬性傷害提升': 'attributeBoost',
    '屬性抗性': 'attributeResistance',
    '異常抵抗': 'abnormalResistance',
    '爆傷抵抗': 'criticalDamageResistance',
    '爆擊抵抗': 'criticalResistance',
}

function isValidNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 將 EngineCharacter.talentPages 字串轉成實際頁數。
 *
 * 已確認每頁 6 個節點：
 * 1 頁 = 6
 * 2 頁 = 12
 * 3 頁 = 18
 *
 * 空白或無效資料回傳 null，不擅自當成 0 頁。
 */
function parseTalentPageCount(value: string): number | null {
    const normalized = value.trim()

    if (!normalized) return null

    const pageCount = Number(normalized)

    if (
        !Number.isInteger(pageCount) ||
        pageCount < 1 ||
        pageCount > 3
    ) {
        return null
    }

    return pageCount
}

function addBonus(
    current: number | null,
    bonus: number,
): number | null {
    if (current === null) return null
    return current + bonus
}

/**
 * 依照角色實際天賦頁數限制可計算的節點。
 *
 * 若頁數資料缺漏，暫時保留使用者選擇的節點，
 * 並由 calculateTalentStats 附加警告。
 */
export function getEffectiveTalentNode(
    character: EngineCharacter,
    selectedNode: TalentNodeSelection,
): number {
    const pageCount = parseTalentPageCount(character.talentPages)

    if (pageCount === null) {
        // 天賦頁數無法確認時，暫時以 3 頁（18 節點）計算
        return Math.min(selectedNode, 18)
    }

    const maxAvailableNode = pageCount * 6

    return Math.min(selectedNode, maxAvailableNode)
}

export function calculateTalentStats(
    character: EngineCharacter,
    data: StrengthBaseDataV2,
    baseStats: CharacterBaseStats,
    selectedNode: TalentNodeSelection,
): TalentStatsResult {
    const warnings: string[] = []

    const pageCount = parseTalentPageCount(character.talentPages)

    const effectiveNode = getEffectiveTalentNode(
        character,
        selectedNode,
    )

    if (pageCount === null) {
        const originalValue = character.talentPages.trim()

        if (!originalValue) {
            warnings.push(
                `${character.name} 缺少天賦頁數資料，暫時以 3 頁天賦（最多第 18 節點）計算。`,
            )
        } else {
            warnings.push(
                `${character.name} 的天賦頁數資料「${originalValue}」無法辨識，暫時以 3 頁天賦（最多第 18 節點）計算。`,
            )
        }
    }

    const stats: CharacterBaseStats = { ...baseStats }
    const additionalStats: AdditionalTalentStats = {}
    const appliedNodes: number[] = []

    const rows = data.talentNodeBonuses as unknown as TalentNodeRow[]

    // 先找出符合角色稀有度及職業的資料，
    // 再將內層 nodes 展開成單一節點資料。
    const characterRows = rows
        .filter(row =>
            row.rarity === character.rarity &&
            row.class === character.class
        )
        .flatMap(row =>
            (row.nodes ?? []).map(node => ({
                ...node,
                rarity: row.rarity,
                class: row.class,
            }))
        )
        .filter(row =>
            isValidNumber(row.node) &&
            row.node >= 4 &&
            row.node <= effectiveNode
        )

    for (const row of characterRows) {
        const node = row.node as number

        // 基礎面板已包含的天賦不重複計算
        if (row.includedInBase === true) continue

        if (row.effectType !== 'stat') continue

        if (typeof row.stat !== 'string' || !row.stat) {
            warnings.push(`天賦 ${node} 缺少有效的能力類型資料。`)
            continue
        }

        if (!isValidNumber(row.value)) {
            warnings.push(
                `天賦 ${node} 的「${row.stat}」數值無效，未套用。`,
            )
            continue
        }

        const field = STAT_FIELD_MAP[row.stat]

        if (!field) {
            warnings.push(
                `天賦 ${node} 的能力類型「${row.stat}」尚未支援。`,
            )
            continue
        }

        const bonus = row.value

        if (field in stats) {
            const key = field as keyof CharacterBaseStats
            const current = stats[key]

            if (typeof current !== 'number' && current !== null) {
                warnings.push(
                    `天賦 ${node} 無法套用至「${row.stat}」。`,
                )
                continue
            }

            ; (stats[key] as number | null) = addBonus(
                current,
                bonus,
            )
        } else {
            const key = field as keyof AdditionalTalentStats
            const current = additionalStats[key] ?? 0

            additionalStats[key] = current + bonus
        }

        if (!appliedNodes.includes(node)) {
            appliedNodes.push(node)
        }
    }

    if (effectiveNode < selectedNode) {
        warnings.push(
            `${character.name} 只有 ${pageCount} 頁天賦，已自動以第 ${effectiveNode} 節點計算。`,
        )
    }

    return {
        stats,
        additionalStats,
        effectiveNode,
        appliedNodes,
        warnings,
    }
}
