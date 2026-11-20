
import type { LoadedStrengthBaseData } from './loadStrengthData'


// ======================================================
// 共用數值型別
// ======================================================

export type NullableStrengthNumber = number | null


// ======================================================
// 新版完整角色基礎面板
// ======================================================

export type StrengthBaseGeneralStat = {
    rarity: string
    class: string

    physicalAttack: NullableStrengthNumber
    magicAttack: NullableStrengthNumber
    healing: NullableStrengthNumber
    speed: NullableStrengthNumber
    criticalRate: NullableStrengthNumber
    criticalDamage: NullableStrengthNumber
    counterElementResistance: NullableStrengthNumber

    // 舊版 TypeScript 型別漏列，但 GAS 資料有提供
    health: NullableStrengthNumber
    physicalDefense: NullableStrengthNumber
    magicDefense: NullableStrengthNumber
}


// ======================================================
// 新版強度基準資料型別
// ======================================================

export type StrengthBaseDataV2 =
    Omit<LoadedStrengthBaseData, 'generalStats'> & {
        generalStats: StrengthBaseGeneralStat[]
    }


// ======================================================
// 轉接結果
// ======================================================

export type StrengthBaseAdapterResult = {
    data: StrengthBaseDataV2
    warnings: string[]
}


// ======================================================
// 安全讀取數值
// ======================================================

function readNullableNumber(
    value: unknown,
    fieldName: string,
    rowDescription: string,
    warnings: string[],
): NullableStrengthNumber {
    // 明確的 null 代表來源沒有提供數值
    if (value === null) {
        return null
    }

    // undefined 代表來源缺少預期欄位
    if (value === undefined) {
        warnings.push(
            `${rowDescription} 缺少「${fieldName}」欄位。`,
        )
        return null
    }

    // 只接受有限數字，不將其他內容擅自轉成 0
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        warnings.push(
            `${rowDescription} 的「${fieldName}」不是有效數字。`,
        )
        return null
    }

    return value
}


// ======================================================
// 強度基準資料轉接
// ======================================================

export function adaptStrengthBaseData(
    source: LoadedStrengthBaseData,
): StrengthBaseAdapterResult {
    const warnings: string[] = []

    // 舊版型別未列出完整面板欄位，
    // 這裡依照 GAS 實際回傳資料補上型別。
    const rawGeneralStats = source.generalStats as unknown as
        Array<Record<string, unknown>>

    const generalStats: StrengthBaseGeneralStat[] =
        rawGeneralStats.map((row, index) => {
            const rarity = typeof row.rarity === 'string'
                ? row.rarity
                : ''

            const characterClass = typeof row.class === 'string'
                ? row.class
                : ''

            const rowDescription =
                `${rarity || '未知稀有度'}／${characterClass || '未知職業'}（第 ${index + 1} 筆）`

            if (!rarity) {
                warnings.push(`${rowDescription} 缺少稀有度資料。`)
            }

            if (!characterClass) {
                warnings.push(`${rowDescription} 缺少職業資料。`)
            }

            return {
                rarity,
                class: characterClass,

                physicalAttack: readNullableNumber(
                    row.physicalAttack,
                    'physicalAttack',
                    rowDescription,
                    warnings,
                ),

                magicAttack: readNullableNumber(
                    row.magicAttack,
                    'magicAttack',
                    rowDescription,
                    warnings,
                ),

                healing: readNullableNumber(
                    row.healing,
                    'healing',
                    rowDescription,
                    warnings,
                ),

                speed: readNullableNumber(
                    row.speed,
                    'speed',
                    rowDescription,
                    warnings,
                ),

                criticalRate: readNullableNumber(
                    row.criticalRate,
                    'criticalRate',
                    rowDescription,
                    warnings,
                ),

                criticalDamage: readNullableNumber(
                    row.criticalDamage,
                    'criticalDamage',
                    rowDescription,
                    warnings,
                ),

                counterElementResistance: readNullableNumber(
                    row.counterElementResistance,
                    'counterElementResistance',
                    rowDescription,
                    warnings,
                ),

                health: readNullableNumber(
                    row.health,
                    'health',
                    rowDescription,
                    warnings,
                ),

                physicalDefense: readNullableNumber(
                    row.physicalDefense,
                    'physicalDefense',
                    rowDescription,
                    warnings,
                ),

                magicDefense: readNullableNumber(
                    row.magicDefense,
                    'magicDefense',
                    rowDescription,
                    warnings,
                ),
            }
        })

    return {
        data: {
            ...source,
            generalStats,
        },
        warnings,
    }
}
