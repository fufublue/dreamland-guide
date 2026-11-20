
import type { EngineCharacter } from '../../../engine'

import type {
    CharacterBaseStats,
    CharacterCombatStats,
    WeaponQuality,
    HangingTraitType,
    HangingTraitRarity,
    AccessoryQuality,
} from '../types'

import type { StrengthBaseDataV2 } from '../data/strengthBaseAdapter'

// ======================================================
// 計算結果
// ======================================================

type BaseAdditionalStats = Partial<
    Pick<CharacterCombatStats, 'attributeResistance'>
>

export type BaseStatsResult = {
    stats: CharacterBaseStats

    // 武器傷害加成
    weaponDamageBonus: number | null

    // 掛件傷害特性
    hangingTraitDamageBonus: number | null

    // 飾品提供的額外能力
    additionalStats: BaseAdditionalStats

    warnings: string[]
}

// ======================================================
// 安全數值處理
// ======================================================

function isValidNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

function addBaseAndBonus(
    base: number | null,
    bonus: number | null,
): number | null {
    if (base === null || bonus === null) {
        return null
    }

    return base + bonus
}

// 輔助面板數值 × 0.6，無條件捨去
function getAssistantBonus(value: unknown): number {
    if (!isValidNumber(value)) {
        return 0
    }

    return Math.floor(value * 0.6)
}

// ======================================================
// 取得角色基礎資料
// ======================================================

function findGeneralStat(
    character: EngineCharacter,
    data: StrengthBaseDataV2,
) {
    return data.generalStats.find(
        row =>
            row.rarity === character.rarity &&
            row.class === character.class,
    )
}

// ======================================================
// 取得輔助面板職業
// ======================================================

function getHangingTraitClass(
    character: EngineCharacter,
    autoApplyWandEffects: boolean,
): string {
    if (autoApplyWandEffects) {
        if (character.class === '物杖') {
            return '物杖'
        }

        if (character.class === '魔杖') {
            return '魔杖'
        }
    }

    if (character.attackType === 'physical') {
        return '拳'
    }

    if (character.attackType === 'magic') {
        return '書'
    }

    return character.class
}

// ======================================================
// 取得 UR 輔助面板
// ======================================================

function findHangingTraitStat(
    character: EngineCharacter,
    data: StrengthBaseDataV2,
    autoApplyWandEffects: boolean,
) {
    const hangingClass = getHangingTraitClass(
        character,
        autoApplyWandEffects,
    )

    return data.generalStats.find(
        row =>
            row.rarity === 'UR' &&
            row.class === hangingClass,
    )
}

// ======================================================
// 取得武器加成
// ======================================================

function findWeaponBonus(
    character: EngineCharacter,
    data: StrengthBaseDataV2,
    quality: WeaponQuality,
) {
    const weaponClass = data.weaponBonuses.byClass.find(
        row => row.class === character.class,
    )

    if (!weaponClass) {
        return null
    }

    return weaponClass[quality]
}

// ======================================================
// 取得飾品加成
// ======================================================

function findAccessoryBonus(
    data: StrengthBaseDataV2,
    quality: AccessoryQuality,
) {
    return data.accessoryBonuses[quality]
}

// ======================================================
// 角色基礎面板計算
// ======================================================

export function calculateBaseStats(
    character: EngineCharacter,
    data: StrengthBaseDataV2,
    weaponQuality: WeaponQuality,
    hangingTraitType: HangingTraitType,
    hangingTraitRarity: HangingTraitRarity,
    accessoryQuality: AccessoryQuality,
    autoApplyWandEffects: boolean,
): BaseStatsResult {
    const warnings: string[] = []

    // 舊掛件類型及稀有度參數暫時保留，
    // 避免目前呼叫此函式的地方發生參數不相容。
    void hangingTraitType
    void hangingTraitRarity

    // --------------------------------------------------
    // 角色本體基礎面板
    // --------------------------------------------------

    const general = findGeneralStat(character, data)

    if (!general) {
        return {
            stats: {
                health: null,
                physicalAttack: null,
                magicAttack: null,
                healing: null,
                speed: null,
                criticalRate: null,
                criticalDamage: null,
                counterElementResistance: null,
                physicalDefense: null,
                magicDefense: null,
            },
            weaponDamageBonus: null,
            hangingTraitDamageBonus: null,
            additionalStats: {},
            warnings: [
                `找不到 ${character.rarity}／${character.class} 的角色基礎面板資料。`,
            ],
        }
    }

    // --------------------------------------------------
    // 取得輔助 UR 面板
    // --------------------------------------------------

    const assistant = findHangingTraitStat(
        character,
        data,
        autoApplyWandEffects,
    )

    if (!assistant) {
        warnings.push(
            `${character.name} 找不到 UR ${getHangingTraitClass(character, autoApplyWandEffects)} 輔助面板資料。`,
        )
    }

    // 輔助六維：60%，無條件捨去
    const assistantHealth = getAssistantBonus(assistant?.health)
    const assistantHealing = getAssistantBonus(assistant?.healing)
    const assistantPhysicalAttack = getAssistantBonus(assistant?.physicalAttack)
    const assistantMagicAttack = getAssistantBonus(assistant?.magicAttack)
    const assistantPhysicalDefense = getAssistantBonus(assistant?.physicalDefense)
    const assistantMagicDefense = getAssistantBonus(assistant?.magicDefense)

    // --------------------------------------------------
    // 武器加成
    // --------------------------------------------------

    const weapon = findWeaponBonus(
        character,
        data,
        weaponQuality,
    )

    if (!weapon) {
        warnings.push(
            `找不到 ${character.class} 的${weaponQuality === 'rainbow' ? '彩色' : '金色'}武器資料。`,
        )
    }

    const weaponAttack =
        weapon && isValidNumber(weapon.attack)
            ? weapon.attack
            : 0

    const weaponHealing =
        weapon && isValidNumber(weapon.healing)
            ? weapon.healing
            : 0

    const weaponPhysicalDefense =
        weapon && isValidNumber(weapon.physicalDefense)
            ? weapon.physicalDefense
            : 0

    const weaponMagicDefense =
        weapon && isValidNumber(weapon.magicDefense)
            ? weapon.magicDefense
            : 0

    // --------------------------------------------------
    // 飾品加成
    // --------------------------------------------------

    const accessory = findAccessoryBonus(
        data,
        accessoryQuality,
    )

    let accessoryHealth = 0
    let accessoryAttributeResistance: number | null = null

    if (!accessory) {
        warnings.push(
            `找不到${accessoryQuality === 'rainbow' ? '彩色' : '金色'}飾品資料。`,
        )
    } else {
        if (isValidNumber(accessory.health)) {
            accessoryHealth = accessory.health
        } else {
            warnings.push('飾品生命數值無效，未套用。')
        }

        if (isValidNumber(accessory.attributeResistance)) {
            accessoryAttributeResistance =
                accessory.attributeResistance
        } else {
            warnings.push('飾品屬性抗性數值無效，未套用。')
        }
    }

    // --------------------------------------------------
    // 組合最終六維
    //
    // 本體 + 輔助面板 × 0.6（無條件捨去）
    //      + 武器 + 飾品
    // --------------------------------------------------

    let physicalAttack: number | null = addBaseAndBonus(
        general.physicalAttack,
        assistantPhysicalAttack,
    )

    let magicAttack: number | null = addBaseAndBonus(
        general.magicAttack,
        assistantMagicAttack,
    )

    // 武器攻擊只加到角色對應的攻擊類型
    if (character.attackType === 'physical') {
        physicalAttack = addBaseAndBonus(
            physicalAttack,
            weaponAttack,
        )
    } else if (character.attackType === 'magic') {
        magicAttack = addBaseAndBonus(
            magicAttack,
            weaponAttack,
        )
    } else {
        warnings.push(
            `${character.name} 缺少有效的攻擊類型，未套用武器攻擊加成。`,
        )
    }

    const stats: CharacterBaseStats = {
        health: addBaseAndBonus(
            addBaseAndBonus(
                addBaseAndBonus(
                    general.health,
                    assistantHealth,
                ),
                accessoryHealth,
            ),
            0,
        ),

        healing: addBaseAndBonus(
            addBaseAndBonus(
                general.healing,
                assistantHealing,
            ),
            weaponHealing,
        ),

        physicalAttack,

        magicAttack,

        physicalDefense: addBaseAndBonus(
            addBaseAndBonus(
                general.physicalDefense,
                assistantPhysicalDefense,
            ),
            weaponPhysicalDefense,
        ),

        magicDefense: addBaseAndBonus(
            addBaseAndBonus(
                general.magicDefense,
                assistantMagicDefense,
            ),
            weaponMagicDefense,
        ),

        // 以下數值不套用輔助面板 60%
        speed: addBaseAndBonus(
            general.speed,
            weapon && isValidNumber(weapon.speed)
                ? weapon.speed
                : 0,
        ),

        criticalRate: addBaseAndBonus(
            general.criticalRate,
            weapon && isValidNumber(weapon.criticalRate)
                ? weapon.criticalRate
                : 0,
        ),

        criticalDamage: general.criticalDamage,

        counterElementResistance:
            general.counterElementResistance,
    }

    // --------------------------------------------------
    // 額外能力值
    // --------------------------------------------------

    const additionalStats: BaseAdditionalStats = {}

    if (accessoryAttributeResistance !== null) {
        additionalStats.attributeResistance =
            accessoryAttributeResistance
    }

    return {
        stats,

        weaponDamageBonus:
            weapon && isValidNumber(weapon.damageBonus)
                ? weapon.damageBonus
                : 0,

        // 掛件傷害特性百分比會在後續串接使用者設定
        hangingTraitDamageBonus: 0,

        additionalStats,

        warnings,
    }
}
