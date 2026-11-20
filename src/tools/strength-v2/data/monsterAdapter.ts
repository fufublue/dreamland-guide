
import type { MonsterData } from '../../../enemies/monsterTypes'
import type {
    StrengthEnemyKind,
    NullableNumber,
    EnemyDefenseType,
} from '../types'

// ======================================================
// 敵人資料轉換後的型別
// ======================================================

export type AdaptedMonsterData = Omit<MonsterData, 'defenseType'> & {
    kind: StrengthEnemyKind
    maxHp: NullableNumber
    defenseType: EnemyDefenseType
}

// ======================================================
// 敵人 HP 預設值
// ======================================================

const MONSTER_DEFAULT_HP = {
    boss: null,
    minion: 2344,
    bossMinion: 200000,
} satisfies Record<StrengthEnemyKind, NullableNumber>

// ======================================================
// 防禦類型確認
// ======================================================

function adaptDefenseType(value: string): EnemyDefenseType {
    switch (value) {
        case '弱物':
        case '弱魔':
        case '物魔雙弱':
        case '物魔雙高':
        case '無弱點':
            return value

        default:
            throw new Error(
                `未知的敵人防禦類型：${value}`,
            )
    }
}

// ======================================================
// 將原始敵人資料轉換成計算器使用的資料
// ======================================================

export function adaptMonsterData(
    monsters: MonsterData[],
): AdaptedMonsterData[] {
    return monsters.map((monster) => {
        let kind: StrengthEnemyKind

        switch (monster.monsterType) {
            case 'BOSS':
                kind = 'boss'
                break

            case '小怪':
                kind = 'minion'
                break

            case 'BOSS小怪':
                kind = 'bossMinion'
                break

            default:
                throw new Error(
                    `敵人「${monster.name}」的類型尚未確認。`,
                )
        }

        return {
            ...monster,
            kind,
            maxHp: MONSTER_DEFAULT_HP[kind],
            defenseType: adaptDefenseType(
                monster.defenseType.value,
            ),
        }
    })
}
