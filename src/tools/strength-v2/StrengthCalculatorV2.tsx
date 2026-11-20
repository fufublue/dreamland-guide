
import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadStrengthData } from './data/loadStrengthData'
import { DEFAULT_CHARACTER_FILTERS } from './settings'
import { calculateCharacterStats } from './calculations/characterStats'
import { calculateCharacterDamage } from './calculations/characterDamage'
import type {
    CharacterFilterSettings,
    CharacterRarity,
    CharacterElement,
    CharacterClass,
    AttackType,
    TalentNodeSelection,
    WeaponQuality,
    AccessoryQuality,
    HangingTraitDamageBonus,
    AutoApplyWandEffects,
    StrengthEnemySettings,
    CharacterCombatStats,
    SkillLevelType,
} from './types'
import {
    calculateBreakthroughTraitDamageBonus,
    calculateBreakthroughTraitHealingBonus,
} from './calculations/breakthroughTrait'

import './StrengthCalculatorV2.css'

type StrengthData = Awaited<ReturnType<typeof loadStrengthData>>

type EnemySelectionItem = {
    key: number
    enemy: StrengthEnemySettings | null
}

function getEnemyKindLabel(
    kind: StrengthEnemySettings['kind'],
): string {
    switch (kind) {
        case 'boss':
            return 'BOSS'
        case 'minion':
            return '小怪'
        case 'bossMinion':
            return 'BOSS小怪'
    }
}

// 技能類型標籤顏色
function getSkillTypeClass(type: string): string {
    switch (type) {
        case '全體攻擊':
            return 'skill-type-all-attack'
        case '單體攻擊':
            return 'skill-type-single-attack'
        case '全體回血':
            return 'skill-type-all-healing'
        case '單體回血':
            return 'skill-type-single-healing'
        default:
            return ''
    }
}

type FilterOption<T extends string> = {
    value: T
    label: string
    className: string
}

type FilterGroupProps<T extends string> = {
    title: string
    options: FilterOption<T>[]
    selected: T[]
    onChange: (value: T) => void
    onClear: () => void
    showClear?: boolean
}

const RARITY_OPTIONS: FilterOption<CharacterRarity>[] = [
    { value: 'UR', label: 'UR', className: 'rarity-ur' },
    { value: 'SSR', label: 'SSR', className: 'rarity-ssr' },
    { value: 'SR', label: 'SR', className: 'rarity-sr' },
    { value: 'R', label: 'R', className: 'rarity-r' },
]

const ELEMENT_OPTIONS: FilterOption<CharacterElement>[] = [
    { value: '水', label: '水', className: 'element-water' },
    { value: '火', label: '火', className: 'element-fire' },
    { value: '風', label: '風', className: 'element-wind' },
    { value: '地', label: '地', className: 'element-earth' },
    { value: '雷', label: '雷', className: 'element-thunder' },
    { value: '光', label: '光', className: 'element-light' },
    { value: '暗', label: '暗', className: 'element-dark' },
]

const CLASS_OPTIONS: FilterOption<CharacterClass>[] = [
    { value: '拳', label: '拳', className: 'character-class' },
    { value: '鞋', label: '鞋', className: 'character-class' },
    { value: '書', label: '書', className: 'character-class' },
    { value: '物杖', label: '物杖', className: 'character-class' },
    { value: '魔杖', label: '魔杖', className: 'character-class' },
    { value: '盾', label: '盾', className: 'character-class' },
]

const ATTACK_TYPE_OPTIONS: FilterOption<AttackType>[] = [
    { value: 'physical', label: '物理', className: 'attack-physical' },
    { value: 'magic', label: '魔法', className: 'attack-magic' },
]

function FilterGroup<T extends string>({
    title,
    options,
    selected,
    onChange,
    onClear,
    showClear = true,
}: FilterGroupProps<T>) {
    return (
        <div className="strength-v2-filter-group">
            <div className="strength-v2-filter-title">
                {title}
            </div>

            <div className="strength-v2-filter-options">
                {showClear && (
                    <button
                        type="button"
                        className={`strength-v2-filter-option ${selected.length === 0 ? 'is-active' : ''}`}
                        aria-pressed={selected.length === 0}
                        onClick={onClear}
                    >
                        全部
                    </button>
                )}

                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`strength-v2-filter-option ${option.className
                            ? `character-tag ${option.className}`
                            : ''
                            } ${selected.includes(option.value) ? 'is-active' : ''
                            }`}
                        aria-pressed={selected.includes(option.value)}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

function toggleFilterValue<T extends string>(
    selected: T[],
    value: T,
): T[] {
    return selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
}

type CalculationMode =
    | 'coefficient'
    | 'selfEffects'
    | 'maximum'

type EffectLevel = 'small' | 'medium' | 'large'

type CalculationSnapshot = {
    filters: CharacterFilterSettings
    calculationMode: CalculationMode

    skillLevel: SkillLevelType
    talentNode: number

    weaponQuality: WeaponQuality
    accessoryQuality: AccessoryQuality
    hangingTraitDamageBonus: HangingTraitDamageBonus
    autoApplyWandEffects: AutoApplyWandEffects

    treatSelfHpConditionAsMet: boolean

    remainingSeconds: number
    ultimateUses: number | null

    environmentEffects: {
        attackUp: boolean
        defenseDown: boolean
        elementalDamageUp: boolean
        elementalDamageUpLevel: EffectLevel
        elementalResistanceDown: boolean
        elementalResistanceDownLevel: EffectLevel
    }

    enemySelections: EnemySelectionItem[]
}

const CALCULATION_MODES: {
    value: CalculationMode
    label: string
    description: string
}[] = [
        {
            value: 'coefficient',
            label: '只看係數',
            description: '不計入角色戰鬥中觸發的自身增減益效果。',
        },
        {
            value: 'selfEffects',
            label: '角色自帶增減益效果',
            description: '計入角色技能及天賦在戰鬥中觸發的自身增減益效果。',
        },
        {
            value: 'maximum',
            label: '最大值',
            description: '使用者自行設定環境效果，開啟的效果視為全程生效。',
        },
    ]

const TALENT_NODE_OPTIONS = Array.from(
    { length: 14 },
    (_, index) => index + 4,
)

export default function StrengthCalculatorV2() {
    const [data, setData] = useState<StrengthData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // 敵人設定
    const [enemySelections, setEnemySelections] =
        useState<EnemySelectionItem[]>([])

    const [nextEnemyKey, setNextEnemyKey] = useState(1)

    // 計算模式
    const [calculationMode, setCalculationMode] =
        useState<CalculationMode>('maximum')

    // 戰鬥排程設定
    const [remainingSeconds, setRemainingSeconds] =
        useState(50)

    const [ultimateUses, setUltimateUses] =
        useState<number | null>(null)

    // 共用技能等級：預設初始等級
    const [skillLevel, setSkillLevel] =
        useState<SkillLevelType>('initial')

    // 共用天賦節點：3 代表尚未額外解鎖天賦 4～17
    const [talentNode, setTalentNode] = useState(3)

    // 裝備設定：預設沿用目前計算基準資料的彩武、相同掛件、彩色飾品
    const [weaponQuality, setWeaponQuality] =
        useState<WeaponQuality>('rainbow')

    // 掛件傷害特性百分比，預設 15%
    const [hangingTraitDamageBonus, setHangingTraitDamageBonus] =
        useState<HangingTraitDamageBonus>(15)

    // 是否將自身生命值條件視為成立，預設開啟
    const [treatSelfHpConditionAsMet, setTreatSelfHpConditionAsMet] =
        useState(true)

    // 是否自動將杖角色套用杖的效果，預設關閉
    const [autoApplyWandEffects, setAutoApplyWandEffects] =
        useState<AutoApplyWandEffects>(false)

    const [accessoryQuality, setAccessoryQuality] =
        useState<AccessoryQuality>('rainbow')

    // 最大值模式的環境效果
    const [environmentEffects, setEnvironmentEffects] = useState({
        attackUp: true,
        defenseDown: true,

        elementalDamageUp: false,
        elementalDamageUpLevel: 'medium' as EffectLevel,

        elementalResistanceDown: false,
        elementalResistanceDownLevel: 'medium' as EffectLevel,
    })

    // 篩選條件分成「正在編輯」與「已套用計算」兩份，避免每次點選都重新計算角色
    const [filters, setFilters] = useState<CharacterFilterSettings>(() => ({
        rarity: [...DEFAULT_CHARACTER_FILTERS.rarity],
        element: [...DEFAULT_CHARACTER_FILTERS.element],
        characterClass: [...DEFAULT_CHARACTER_FILTERS.characterClass],
        attackType: [...DEFAULT_CHARACTER_FILTERS.attackType],
    }))

    const [calculationSnapshot, setCalculationSnapshot] =
        useState<CalculationSnapshot | null>(null)

    const [hasCalculated, setHasCalculated] = useState(false)

    // 強度比較區設定
    const [comparisonTab, setComparisonTab] =
        useState<'damage' | 'healing'>('damage')

    // 傷害與治療各自獨立設定前幾名
    const [damageTopCount, setDamageTopCount] = useState(3)
    const [healingTopCount, setHealingTopCount] = useState(3)



    useEffect(() => {
        let cancelled = false

        async function loadData() {
            try {
                setLoading(true)
                setError(null)

                const result = await loadStrengthData()

                if (!cancelled) {
                    setData(result)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : '強度計算資料載入失敗。',
                    )
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        loadData()

        return () => {
            cancelled = true
        }
    }, [])

    // 只依篩選條件取得角色名單；這個步驟不會執行傷害計算
    const getFilteredCharacters = useCallback((selectedFilters: CharacterFilterSettings) => {
        if (!data) return []

        const allCharacters = data.characterData.dataset.getAll()

        return allCharacters.filter((character) => {
            const matchesRarity =
                selectedFilters.rarity.length === 0 ||
                selectedFilters.rarity.some(
                    (value) => value === character.rarity
                )

            const matchesElement =
                selectedFilters.element.length === 0 ||
                selectedFilters.element.some(
                    (value) => value === character.element
                )

            const matchesClass =
                selectedFilters.characterClass.length === 0 ||
                selectedFilters.characterClass.some(
                    (value) => value === character.class
                )

            const matchesAttackType =
                selectedFilters.attackType.length === 0 ||
                (
                    character.attackType !== undefined &&
                    selectedFilters.attackType.some(
                        (value) => value === character.attackType
                    )
                )

            return (
                matchesRarity &&
                matchesElement &&
                matchesClass &&
                matchesAttackType
            )
        })
    }, [data])

    // 即時更新符合條件的人數，僅篩選名單，不計算角色傷害
    const filteredCharacters = useMemo(
        () => getFilteredCharacters(filters),
        [getFilteredCharacters, filters],
    )




    const calculatedCharacters = useMemo(() => {
        const snapshot = calculationSnapshot

        if (!data || !snapshot) return []

        // 使用上次按下重新計算時保存的篩選條件
        const appliedCharacters = getFilteredCharacters(snapshot.filters)

        // 整理已選擇的敵人
        const enemies = snapshot.enemySelections.flatMap((item) =>
            item.enemy ? [item.enemy] : [],
        )

        // 環境效果
        const environment = {
            attackIncrease: snapshot.environmentEffects.attackUp,
            defenseReduction: snapshot.environmentEffects.defenseDown,

            attributeDamageIncrease: {
                enabled: snapshot.environmentEffects.elementalDamageUp,
                magnitude: snapshot.environmentEffects.elementalDamageUpLevel,
            },

            attributeResistanceReduction: {
                enabled: snapshot.environmentEffects.elementalResistanceDown,
                magnitude: snapshot.environmentEffects.elementalResistanceDownLevel,
            },
        }

        return appliedCharacters.map((character) => {
            const result = calculateCharacterStats(
                character,
                data.strengthBaseData,
                snapshot.weaponQuality,
                snapshot.talentNode as TalentNodeSelection,
                'same',
                'UR',
                snapshot.accessoryQuality,
                snapshot.hangingTraitDamageBonus,
                snapshot.autoApplyWandEffects,
            )

            // 只有 UR 使用目前選擇的技能等級
            const selectedSkillLevel: SkillLevelType =
                character.rarity === 'UR'
                    ? snapshot.skillLevel
                    : 'max'

            const damage = calculateCharacterDamage({
                character,

                normalAttackLevel: selectedSkillLevel,
                skillLevel: selectedSkillLevel,

                selectedNode: snapshot.talentNode as TalentNodeSelection,

                stats: {
                    ...result.stats,
                    damageBonus: null,
                    attributeBoost:
                        result.additionalStats.attributeBoost ?? null,
                    attributeResistance:
                        result.additionalStats.attributeResistance ?? null,
                    abnormalResistance:
                        result.additionalStats.abnormalResistance ?? null,
                    criticalDamageResistance:
                        result.additionalStats.criticalDamageResistance ?? null,
                    criticalResistance:
                        result.additionalStats.criticalResistance ?? null,
                } satisfies CharacterCombatStats,

                enemies,

                elementRelation: 'advantage',

                mode: snapshot.calculationMode,

                environment,

                weaponDamageBonus: result.weaponDamageBonus,
                hangingTraitDamageBonus: result.hangingTraitDamageBonus,
                hangingTraitHealingBonus: result.hangingTraitHealingBonus,

                treatSelfHpConditionAsMet:
                    snapshot.treatSelfHpConditionAsMet,

                scheduleSettings: {
                    remainingSeconds: snapshot.remainingSeconds,
                    ultimateUses: snapshot.ultimateUses,
                },
            })

            return {
                character,
                ...result,
                damage,
            }
        })
    }, [
        data,
        calculationSnapshot,
        getFilteredCharacters,
    ])

    // 依目前比較分頁，取得需要高亮的角色
    const highlightedCharacterIds = useMemo(() => {
        const topCount =
            comparisonTab === 'damage'
                ? damageTopCount
                : healingTopCount

        // 取得所有有效的比較數值
        const scores = calculatedCharacters.flatMap((item) => {
            const value =
                comparisonTab === 'damage'
                    ? item.damage.schedule?.totalDamage
                    : item.damage.schedule?.totalHealing

            if (typeof value !== 'number' || !Number.isFinite(value)) {
                return []
            }

            return [{
                id: item.character.id,
                value,
            }]
        })

        if (scores.length === 0) {
            return new Set<string>()
        }

        // 只用來判斷排名，不會改變原本角色排列順序
        const sortedScores = scores
            .map((item) => item.value)
            .sort((a, b) => b - a)

        // 取得名次門檻
        const cutoffIndex = Math.min(topCount - 1, sortedScores.length - 1)
        const cutoffScore = sortedScores[cutoffIndex]

        // 同分者全部納入，因此高亮數量可能超過設定名額
        return new Set(
            scores
                .filter((item) => item.value >= cutoffScore)
                .map((item) => item.id),
        )
    }, [
        calculatedCharacters,
        comparisonTab,
        damageTopCount,
        healingTopCount,
    ])


    const formatStat = (value: unknown) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return '資料缺漏'
        }

        return value.toLocaleString('zh-TW', {
            maximumFractionDigits: 2,
        })
    }

    // 點擊排名後，跳轉到對應角色名稱的開頭
    const scrollToCharacterDetails = (characterId: string) => {
        const target = document.getElementById(
            `strength-v2-detail-${characterId}`
        )

        if (!target) return

        const characterName = target.querySelector('h3')

        if (!characterName) return

        characterName.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })
    }

    return (
        <div className="strength-v2-page">

            {loading && (
                <div className="strength-v2-message">
                    正在載入角色與強度基準資料……
                </div>
            )}

            {!loading && error && (
                <div className="strength-v2-error">
                    <h3>資料載入失敗</h3>
                    <p>{error}</p>
                </div>
            )}

            {!loading && !error && data && (
                <>

                    <section className="strength-v2-section strength-v2-character-settings">
                        <h2>角色篩選與設定</h2>

                        {/* 角色篩選 */}
                        <div className="strength-v2-character-filters">
                            <p className="strength-v2-muted">
                                調整好篩選條件後，請至下方「計算結果」按下開始計算。
                            </p>

                            <FilterGroup
                                title="稀有度"
                                options={RARITY_OPTIONS}
                                selected={filters.rarity}
                                onChange={(value) => {
                                    setFilters((prev) => ({
                                        ...prev,
                                        rarity: toggleFilterValue(prev.rarity, value),
                                    }))
                                }}
                                onClear={() => {
                                    setFilters((prev) => ({
                                        ...prev,
                                        rarity: [],
                                    }))
                                }}
                            />

                            <FilterGroup
                                title="屬性"
                                options={ELEMENT_OPTIONS}
                                selected={filters.element}
                                onChange={(value) => {
                                    setFilters((prev) => ({
                                        ...prev,
                                        element: [value],
                                    }))
                                }}
                                onClear={() => {
                                    setFilters((prev) => ({
                                        ...prev,
                                        element: [],
                                    }))
                                }}
                            />

                            <FilterGroup
                                title="職業"
                                showClear={false}
                                options={CLASS_OPTIONS}
                                selected={filters.characterClass}
                                onChange={(value) => {
                                    setFilters((prev) => ({
                                        ...prev,
                                        characterClass: toggleFilterValue(
                                            prev.characterClass,
                                            value,
                                        ),
                                    }))
                                }}
                                onClear={() => {
                                    setFilters((prev) => ({
                                        ...prev,
                                        characterClass: [],
                                    }))
                                }}
                            />

                            <FilterGroup
                                title="攻擊類型"
                                showClear={false}
                                options={ATTACK_TYPE_OPTIONS}
                                selected={filters.attackType}
                                onChange={(value) => {
                                    setFilters((prev) => ({
                                        ...prev,
                                        attackType: [value],
                                    }))
                                }}
                                onClear={() => {
                                    setFilters((prev) => ({
                                        ...prev,
                                        attackType: [],
                                    }))
                                }}
                            />
                        </div>

                        {/* 角色技能與天賦 */}
                        <div className="strength-v2-character-options">
                            <div className="strength-v2-setting-group">
                                <h3>技能設定</h3>

                                <div className="strength-v2-setting-row">
                                    <label htmlFor="strength-v2-skill-level">
                                        UR技能等級
                                    </label>

                                    <select
                                        id="strength-v2-skill-level"
                                        value={skillLevel}
                                        onChange={(event) => {
                                            setSkillLevel(event.target.value as SkillLevelType)
                                        }}
                                    >
                                        <option value="initial">初始等級</option>
                                        <option value="max">最大等級</option>
                                    </select>
                                </div>

                                <p className="strength-v2-muted">
                                    此設定共用所有技能。其他角色一律使用最大技能等級。
                                </p>
                            </div>

                            <div className="strength-v2-setting-group">
                                <h3>天賦設定</h3>

                                <div className="strength-v2-setting-row">
                                    <label htmlFor="strength-v2-talent-node">
                                        天賦解鎖節點
                                    </label>

                                    <select
                                        id="strength-v2-talent-node"
                                        value={talentNode}
                                        onChange={(event) => {
                                            setTalentNode(Number(event.target.value))
                                        }}
                                    >
                                        <option value={3}>未額外解鎖</option>

                                        {TALENT_NODE_OPTIONS.map((node) => (
                                            <option key={node} value={node}>
                                                天賦 {node}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <p className="strength-v2-muted">
                                    選擇節點若超出角色實際擁有的節點，
                                    會以該角色的最大節點來計算。
                                </p>
                            </div>
                            {/* 自身生命值條件 */}
                            <div className="strength-v2-conditional-rule">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={treatSelfHpConditionAsMet}
                                        onChange={(event) => {
                                            setTreatSelfHpConditionAsMet(event.target.checked)
                                        }}
                                    />
                                    將自身生命值條件視為成立
                                </label>

                                <p>
                                    開啟後，有生命條件的技能一律採用達成後的倍率。
                                </p>
                            </div>
                        </div>

                        {/* 角色裝備設定 */}
                        <div className="strength-v2-character-equipment">
                            <h3>裝備與掛件設定</h3>

                            <div className="strength-v2-equipment-grid">
                                <div className="strength-v2-equipment-field">
                                    <label htmlFor="strength-v2-weapon-quality">
                                        武器品質
                                    </label>

                                    <select
                                        id="strength-v2-weapon-quality"
                                        value={weaponQuality}
                                        onChange={(event) => {
                                            setWeaponQuality(
                                                event.target.value as WeaponQuality
                                            )
                                        }}
                                    >
                                        <option value="gold">金色武器</option>
                                        <option value="rainbow">彩色武器</option>
                                    </select>
                                </div>

                                <div className="strength-v2-equipment-field">
                                    <label htmlFor="strength-v2-hanging-bonus">
                                        掛件特性
                                    </label>

                                    <select
                                        id="strength-v2-hanging-bonus"
                                        value={hangingTraitDamageBonus}
                                        onChange={(event) => {
                                            setHangingTraitDamageBonus(
                                                Number(event.target.value) as HangingTraitDamageBonus
                                            )
                                        }}
                                    >
                                        <option value={15}>15%</option>
                                        <option value={10}>10%</option>
                                        <option value={8}>8%</option>
                                        <option value={5}>5%</option>
                                    </select>
                                </div>
                            </div>

                            <div className="strength-v2-conditional-rule">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={autoApplyWandEffects}
                                        onChange={(event) => {
                                            setAutoApplyWandEffects(event.target.checked)
                                        }}
                                    />
                                    是否將杖角色套用杖掛件的對應效果
                                </label>

                                <p>
                                    開啟後，物杖與魔杖會將掛件特性由傷害特性轉為治癒特性。
                                </p>
                            </div>
                        </div>


                    </section>



                    {data.status.warnings.length > 0 && (
                        <section className="strength-v2-section">
                            <h2>資料檢查提醒</h2>

                            <p>
                                目前有 {data.status.warnings.length} 項提醒
                            </p>

                            <ul className="strength-v2-warning-list">
                                {data.status.warnings.map((warning, index) => (
                                    <li key={`${warning.source}-${index}`}>
                                        <strong>{warning.source}</strong>
                                        <p>{warning.message}</p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section className="strength-v2-section">
                        <h2>計算設定</h2>

                        {/* 計算模式 */}
                        <div className="strength-v2-setting-group">
                            <h3>計算模式</h3>

                            <div className="strength-v2-mode-options">
                                {CALCULATION_MODES.map((mode) => (
                                    <button
                                        key={mode.value}
                                        type="button"
                                        className={`strength-v2-mode-option ${calculationMode === mode.value
                                            ? 'is-active'
                                            : ''
                                            }`}
                                        aria-pressed={calculationMode === mode.value}
                                        onClick={() => setCalculationMode(mode.value)}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>

                            <p className="strength-v2-muted">
                                {
                                    CALCULATION_MODES.find(
                                        (mode) => mode.value === calculationMode,
                                    )?.description
                                }
                            </p>
                        </div>

                        {/* 戰鬥排程設定 */}
                        <div className="strength-v2-setting-group">
                            <h3>戰鬥條件</h3>

                            <div className="strength-v2-setting-row">
                                <label htmlFor="strength-v2-remaining-seconds">
                                    第三波剩餘時間（秒）
                                </label>

                                <input
                                    id="strength-v2-remaining-seconds"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={remainingSeconds}
                                    onChange={(event) => {
                                        const value = Number(event.target.value)

                                        if (Number.isFinite(value) && value >= 0) {
                                            setRemainingSeconds(Math.floor(value))
                                        }
                                    }}
                                />
                            </div>

                            <div className="strength-v2-setting-row">
                                <label htmlFor="strength-v2-ultimate-uses">
                                    必殺技使用次數
                                </label>

                                <input
                                    id="strength-v2-ultimate-uses"
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="不限制"
                                    value={ultimateUses ?? ''}
                                    onChange={(event) => {
                                        const value = event.target.value

                                        if (value === '') {
                                            setUltimateUses(null)
                                            return
                                        }

                                        const number = Number(value)

                                        if (
                                            Number.isFinite(number) &&
                                            number >= 0
                                        ) {
                                            setUltimateUses(Math.floor(number))
                                        }
                                    }}
                                />
                            </div>

                            <p className="strength-v2-muted">
                                必殺技次數留空代表不限制。
                                此設定會套用至所有角色。
                            </p>
                        </div>


                        {/* 最大值模式專用環境效果 */}
                        {calculationMode === 'maximum' && (
                            <div className="strength-v2-setting-group strength-v2-environment-settings">
                                <h3>環境效果</h3>

                                <p className="strength-v2-muted">
                                    開啟的效果視為全程 100% 生效，不需要設定覆蓋率。
                                </p>

                                {/* 攻擊提升 */}
                                <div className="strength-v2-environment-row">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={environmentEffects.attackUp}
                                            onChange={(event) => {
                                                setEnvironmentEffects((prev) => ({
                                                    ...prev,
                                                    attackUp: event.target.checked,
                                                }))
                                            }}
                                        />
                                        攻擊提升（大幅）
                                    </label>
                                </div>

                                {/* 防禦降低 */}
                                <div className="strength-v2-environment-row">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={environmentEffects.defenseDown}
                                            onChange={(event) => {
                                                setEnvironmentEffects((prev) => ({
                                                    ...prev,
                                                    defenseDown: event.target.checked,
                                                }))
                                            }}
                                        />
                                        防禦降低（大幅）
                                    </label>
                                </div>

                                {/* 屬性傷害提升 */}
                                <div className="strength-v2-environment-row">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={environmentEffects.elementalDamageUp}
                                            onChange={(event) => {
                                                setEnvironmentEffects((prev) => ({
                                                    ...prev,
                                                    elementalDamageUp: event.target.checked,
                                                }))
                                            }}
                                        />
                                        屬性傷害提升
                                    </label>

                                    <select
                                        value={environmentEffects.elementalDamageUpLevel}
                                        disabled={!environmentEffects.elementalDamageUp}
                                        onChange={(event) => {
                                            setEnvironmentEffects((prev) => ({
                                                ...prev,
                                                elementalDamageUpLevel:
                                                    event.target.value as EffectLevel,
                                            }))
                                        }}
                                    >
                                        <option value="small">小幅 20%</option>
                                        <option value="medium">中幅 40%</option>
                                        <option value="large">大幅 60%</option>
                                    </select>
                                </div>

                                {/* 屬性抗性降低 */}
                                <div className="strength-v2-environment-row">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={
                                                environmentEffects.elementalResistanceDown
                                            }
                                            onChange={(event) => {
                                                setEnvironmentEffects((prev) => ({
                                                    ...prev,
                                                    elementalResistanceDown:
                                                        event.target.checked,
                                                }))
                                            }}
                                        />
                                        屬性抗性降低
                                    </label>

                                    <select
                                        value={
                                            environmentEffects.elementalResistanceDownLevel
                                        }
                                        disabled={
                                            !environmentEffects.elementalResistanceDown
                                        }
                                        onChange={(event) => {
                                            setEnvironmentEffects((prev) => ({
                                                ...prev,
                                                elementalResistanceDownLevel:
                                                    event.target.value as EffectLevel,
                                            }))
                                        }}
                                    >
                                        <option value="small">小幅 20%</option>
                                        <option value="medium">中幅 30%</option>
                                        <option value="large">大幅 40%</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </section>
                    <section className="strength-v2-section strength-v2-enemy-section">
                        <h2>敵人設定</h2>

                        <p className="strength-v2-muted">
                            新增敵人後，從資料庫選擇敵人。
                            每個資料框代表一隻敵人，可以重複選擇相同敵人。
                        </p>

                        {enemySelections.map((item, index) => (
                            <div
                                className="strength-v2-setting-group strength-v2-enemy-item"
                                key={item.key}
                            >
                                <div className="strength-v2-setting-row">
                                    <h3>敵人 {index + 1}</h3>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEnemySelections((prev) =>
                                                prev.filter(
                                                    (enemy) => enemy.key !== item.key,
                                                ),
                                            )
                                        }}
                                    >
                                        刪除
                                    </button>
                                </div>

                                <div className="strength-v2-equipment-field">
                                    <select
                                        id={`strength-v2-enemy-${item.key}`}
                                        value={item.enemy?.id ?? ''}
                                        onChange={(event) => {
                                            const selectedMonster =
                                                data.monsterData.find(
                                                    (monster) =>
                                                        monster.id === event.target.value,
                                                )

                                            setEnemySelections((prev) =>
                                                prev.map((enemy) =>
                                                    enemy.key === item.key
                                                        ? {
                                                            ...enemy,
                                                            enemy: selectedMonster
                                                                ? {
                                                                    id: selectedMonster.id,
                                                                    name: selectedMonster.name,
                                                                    kind: selectedMonster.kind,
                                                                    defenseType:
                                                                        selectedMonster.defenseType,
                                                                    maxHp: selectedMonster.maxHp,
                                                                }
                                                                : null,
                                                        }
                                                        : enemy,
                                                ),
                                            )
                                        }}
                                    >
                                        <option value="">請選擇敵人</option>

                                        {data.monsterData.map((monster) => (
                                            <option
                                                key={monster.id}
                                                value={monster.id}
                                            >
                                                {monster.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {item.enemy && (
                                    <div className="strength-v2-result-stats">
                                        <div className="strength-v2-result-stat">
                                            <span>敵人種類</span>
                                            <strong>
                                                {getEnemyKindLabel(item.enemy.kind)}
                                            </strong>
                                        </div>

                                        <div className="strength-v2-result-stat">
                                            <span>防禦類型</span>
                                            <strong>
                                                {item.enemy.defenseType}
                                            </strong>
                                        </div>

                                        <div className="strength-v2-result-stat">
                                            <span>HP 上限</span>
                                            <strong>
                                                {item.enemy.maxHp === null
                                                    ? '無限'
                                                    : formatStat(item.enemy.maxHp)}
                                            </strong>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={() => {
                                setEnemySelections((prev) => [
                                    ...prev,
                                    {
                                        key: nextEnemyKey,
                                        enemy: null,
                                    },
                                ])

                                setNextEnemyKey((prev) => prev + 1)
                            }}
                        >
                            ＋ 新增敵人
                        </button>
                    </section>

                    <section className="strength-v2-section">
                        <h2>計算結果</h2>

                        <p className="strength-v2-muted">
                            每次更改條件都需要按下開始計算（重新計算）。
                        </p>

                        <div className="strength-v2-result-actions">
                            <div className="strength-v2-result-summary">
                                當前符合條件：{filteredCharacters.length} 名角色
                            </div>

                            <button
                                type="button"
                                className="strength-v2-calculate-button"
                                onClick={() => {
                                    setCalculationSnapshot({
                                        filters: {
                                            rarity: [...filters.rarity],
                                            element: [...filters.element],
                                            characterClass: [...filters.characterClass],
                                            attackType: [...filters.attackType],
                                        },

                                        calculationMode,

                                        skillLevel,
                                        talentNode,

                                        weaponQuality,
                                        accessoryQuality,
                                        hangingTraitDamageBonus,
                                        autoApplyWandEffects,

                                        treatSelfHpConditionAsMet,

                                        remainingSeconds,
                                        ultimateUses,

                                        environmentEffects: { ...environmentEffects },

                                        enemySelections: enemySelections.map((item) => ({
                                            ...item,
                                            enemy: item.enemy ? { ...item.enemy } : null,
                                        })),
                                    })

                                    setHasCalculated(true)
                                }}
                            >
                                {hasCalculated ? '重新計算' : '開始計算'}
                            </button>
                        </div>

                        {/* 角色總計比較區 */}
                        {calculatedCharacters.length > 0 && (
                            <div className="strength-v2-comparison">

                                <h3>總傷害／治療排行</h3>

                                {/* 傷害／治療分頁 */}
                                <div className="strength-v2-comparison-tabs">
                                    <button
                                        type="button"
                                        className={
                                            comparisonTab === 'damage'
                                                ? 'is-active'
                                                : ''
                                        }
                                        aria-pressed={comparisonTab === 'damage'}
                                        onClick={() => setComparisonTab('damage')}
                                    >
                                        傷害
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            comparisonTab === 'healing'
                                                ? 'is-active'
                                                : ''
                                        }
                                        aria-pressed={comparisonTab === 'healing'}
                                        onClick={() => setComparisonTab('healing')}
                                    >
                                        治療
                                    </button>
                                </div>

                                {/* 前幾名設定 */}
                                <div className="strength-v2-comparison-setting">
                                    <label htmlFor="strength-v2-comparison-top">
                                        標記前幾名
                                    </label>

                                    <select
                                        id="strength-v2-comparison-top"
                                        value={
                                            comparisonTab === 'damage'
                                                ? damageTopCount
                                                : healingTopCount
                                        }
                                        onChange={(event) => {
                                            const value = Number(event.target.value)

                                            if (comparisonTab === 'damage') {
                                                setDamageTopCount(value)
                                            } else {
                                                setHealingTopCount(value)
                                            }
                                        }}
                                    >
                                        {[1, 2, 3, 4, 5].map((count) => (
                                            <option key={count} value={count}>
                                                前 {count} 名
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 角色比較清單 */}
                                <div className="strength-v2-comparison-list">
                                    {calculatedCharacters.map((item) => {
                                        const value =
                                            comparisonTab === 'damage'
                                                ? item.damage.schedule?.totalDamage
                                                : item.damage.schedule?.totalHealing

                                        const isHighlighted =
                                            highlightedCharacterIds.has(item.character.id)

                                        const rarityClass =
                                            RARITY_OPTIONS.find(
                                                (option) =>
                                                    option.value === item.character.rarity,
                                            )?.className ?? ''

                                        const elementClass =
                                            ELEMENT_OPTIONS.find(
                                                (option) =>
                                                    option.value === item.character.element,
                                            )?.className ?? ''

                                        const classClass =
                                            CLASS_OPTIONS.find(
                                                (option) =>
                                                    option.value === item.character.class,
                                            )?.className ?? ''

                                        return (
                                            <div
                                                className={`strength-v2-comparison-row ${isHighlighted ? 'is-highlighted' : ''
                                                    }`}
                                                key={item.character.id}
                                                role="button"
                                                tabIndex={0}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => scrollToCharacterDetails(item.character.id)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault()
                                                        scrollToCharacterDetails(item.character.id)
                                                    }
                                                }}
                                            >
                                                {/* 左側：角色名稱與標籤 */}
                                                <div className="strength-v2-comparison-character">
                                                    <strong>
                                                        {item.character.name}
                                                    </strong>

                                                    <span className={`character-tag ${rarityClass}`}>
                                                        {item.character.rarity}
                                                    </span>

                                                    <span className={`character-tag ${elementClass}`}>
                                                        {item.character.element}
                                                    </span>

                                                    <span className={`character-tag ${classClass}`}>
                                                        {item.character.class}
                                                    </span>
                                                </div>

                                                {/* 右側：總傷害或總治療 */}
                                                <strong className="strength-v2-comparison-value">
                                                    {typeof value === 'number' &&
                                                        Number.isFinite(value)
                                                        ? Math.round(value).toLocaleString('zh-TW')
                                                        : '無法計算'}
                                                </strong>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        

                        {!hasCalculated ? null : calculatedCharacters.length === 0 ? (
                            <div className="strength-v2-empty">
                                沒有符合目前已套用篩選條件的角色。
                            </div>
                        ) : (
                            <div className="strength-v2-result-list">
                                {calculatedCharacters.map((item) => (
                                    <article
                                        className="strength-v2-result-character"
                                        key={item.character.id}
                                        id={`strength-v2-detail-${item.character.id}`}
                                    >

                                        <div className="strength-v2-result-heading">
                                            <div>
                                                <h3>{item.character.name}</h3>
                                                <p>
                                                    {item.character.rarity}／
                                                    {item.character.element}／
                                                    {item.character.class}／
                                                    {item.character.attackType === 'physical'
                                                        ? '物理'
                                                        : item.character.attackType === 'magic'
                                                            ? '魔法'
                                                            : '攻擊類型未確認'}
                                                    {item.character.maxBreakthroughTrait?.trim() && (
                                                        <>／{item.character.maxBreakthroughTrait}</>
                                                    )}
                                                </p>
                                            </div>

                                            <span>
                                                天賦計算至第 {item.effectiveNode} 節點
                                            </span>
                                        </div>

                                        <details className="strength-v2-panel-details">
                                            <summary>角色面板</summary>

                                            <div className="strength-v2-panel-groups">
                                                {/* 核心能力 */}
                                                <section className="strength-v2-panel-group strength-v2-panel-group-primary">
                                                    <h4>核心能力</h4>
                                                    <div className="strength-v2-panel-group-stats">
                                                        <div className="strength-v2-result-stat">
                                                            <span>
                                                                {item.character.attackType === 'physical'
                                                                    ? '物理攻擊'
                                                                    : '魔法攻擊'}
                                                            </span>
                                                            <strong>
                                                                {formatStat(
                                                                    item.character.attackType === 'physical'
                                                                        ? item.stats.physicalAttack
                                                                        : item.stats.magicAttack
                                                                )}
                                                            </strong>
                                                        </div>

                                                        <div className="strength-v2-result-stat">
                                                            <span>治療</span>
                                                            <strong>{formatStat(item.stats.healing)}</strong>
                                                        </div>
                                                    </div>
                                                </section>

                                                {/* 戰鬥屬性 */}
                                                <section className="strength-v2-panel-group">
                                                    <h4>戰鬥屬性</h4>
                                                    <div className="strength-v2-panel-group-stats">
                                                        <div className="strength-v2-result-stat">
                                                            <span>暴擊率</span>
                                                            <strong>
                                                                {formatStat(
                                                                    typeof item.stats.criticalRate === 'number'
                                                                        ? item.stats.criticalRate * 100
                                                                        : item.stats.criticalRate
                                                                )}%
                                                            </strong>
                                                        </div>

                                                        <div className="strength-v2-result-stat">
                                                            <span>暴擊傷害</span>
                                                            <strong>
                                                                {formatStat(
                                                                    typeof item.stats.criticalDamage === 'number'
                                                                        ? item.stats.criticalDamage * 100
                                                                        : item.stats.criticalDamage
                                                                )}%
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </section>

                                                {/* 角色特性 */}
                                                <section className="strength-v2-panel-group">
                                                    <h4>角色特性</h4>
                                                    <div className="strength-v2-panel-group-stats">
                                                        <div className="strength-v2-result-stat">
                                                            <span>角色傷害特性</span>
                                                            <strong>
                                                                {formatStat(
                                                                    calculateBreakthroughTraitDamageBonus(
                                                                        item.character.maxBreakthroughTrait,
                                                                        item.character.element ?? '',
                                                                        item.character.attackType ?? '',
                                                                    )
                                                                )}%
                                                            </strong>
                                                        </div>

                                                        <div className="strength-v2-result-stat">
                                                            <span>角色治療特性</span>
                                                            <strong>
                                                                {formatStat(
                                                                    calculateBreakthroughTraitHealingBonus(
                                                                        item.character.maxBreakthroughTrait,
                                                                    )
                                                                )}%
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </section>

                                                {/* 其他加成 */}
                                                <section className="strength-v2-panel-group">
                                                    <h4>其他加成</h4>
                                                    <div className="strength-v2-panel-group-stats">
                                                        <div className="strength-v2-result-stat">
                                                            <span>掛件傷害特性</span>
                                                            <strong>{formatStat(item.hangingTraitDamageBonus)}%</strong>
                                                        </div>

                                                        <div className="strength-v2-result-stat">
                                                            <span>掛件治癒特性</span>
                                                            <strong>{formatStat(item.hangingTraitHealingBonus)}%</strong>
                                                        </div>

                                                        <div className="strength-v2-result-stat">
                                                            <span>天賦傷害特性</span>
                                                            <strong>
                                                                {formatStat(item.additionalStats.attributeBoost ?? 0)}%
                                                            </strong>
                                                        </div>

                                                        <div className="strength-v2-result-stat">
                                                            <span>武器傷害加成</span>
                                                            <strong>
                                                                {formatStat(
                                                                    typeof item.weaponDamageBonus === 'number'
                                                                        ? item.weaponDamageBonus * 100
                                                                        : item.weaponDamageBonus
                                                                )}%
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </section>
                                            </div>
                                        </details>

                                        <div className="strength-v2-character-trait">
                                            <strong>技能資訊</strong>

                                            {[
                                                {
                                                    label: '必殺技',
                                                    type: item.character.ultimate.type,
                                                    info: {
                                                        ...item.character.ultimate[
                                                        item.character.rarity === 'UR' ? skillLevel : 'max'
                                                        ],
                                                        effectText: item.damage.ultimate.skillEffects.effectText,
                                                        cooldown: item.damage.ultimate.cooldown,
                                                    },
                                                    result: item.damage.ultimate,
                                                    healing: item.damage.ultimate.healing,
                                                    showCooldown: false,
                                                    talentLabel:
                                                        item.damage.ultimate.skillEffects.effectText !==
                                                            (
                                                                item.character.ultimate[
                                                                    item.character.rarity === 'UR' ? skillLevel : 'max'
                                                                ].originalEffectText ??
                                                                item.character.ultimate[
                                                                    item.character.rarity === 'UR' ? skillLevel : 'max'
                                                                ].effectText
                                                            )
                                                            ? '（天賦15）'
                                                            : '',
                                                },
                                                {
                                                    label: '二技能',
                                                    type: item.character.skill2.type,
                                                    info: {
                                                        ...item.character.skill2[
                                                        item.character.rarity === 'UR' ? skillLevel : 'max'
                                                        ],
                                                        effectText: item.damage.skill2.skillEffects.effectText,
                                                        cooldown: item.damage.skill2.cooldown,
                                                    },
                                                    result: item.damage.skill2,
                                                    healing: item.damage.skill2.healing,
                                                    showCooldown: true,
                                                    talentLabel:
                                                        item.damage.skill2.skillEffects.effectText !==
                                                            (
                                                                item.character.skill2[
                                                                    item.character.rarity === 'UR' ? skillLevel : 'max'
                                                                ].originalEffectText ??
                                                                item.character.skill2[
                                                                    item.character.rarity === 'UR' ? skillLevel : 'max'
                                                                ].effectText
                                                            )
                                                            ? '（天賦12）'
                                                            : '',
                                                },
                                                {
                                                    label: '一技能',
                                                    type: item.character.skill1.type,
                                                    info: {
                                                        ...item.character.skill1[
                                                        item.character.rarity === 'UR' ? skillLevel : 'max'
                                                        ],
                                                        effectText: item.damage.skill1.skillEffects.effectText,
                                                        cooldown: item.damage.skill1.cooldown,
                                                    },
                                                    result: item.damage.skill1,
                                                    healing: item.damage.skill1.healing,
                                                    showCooldown: true,
                                                    talentLabel:
                                                        item.damage.skill1.skillEffects.effectText !==
                                                            (
                                                                item.character.skill1[
                                                                    item.character.rarity === 'UR' ? skillLevel : 'max'
                                                                ].originalEffectText ??
                                                                item.character.skill1[
                                                                    item.character.rarity === 'UR' ? skillLevel : 'max'
                                                                ].effectText
                                                            )
                                                            ? '（天賦9）'
                                                            : '',
                                                },
                                                {
                                                    label: '普攻',
                                                    type: '',
                                                    info: null,
                                                    result: item.damage.normalAttack,
                                                    healing: null,
                                                    showCooldown: false,
                                                },
                                            ].map((skill) => (
                                                <div
                                                    className="strength-v2-result-skill"
                                                    key={skill.label}
                                                >
                                                    {/* 技能名稱與類型 */}
                                                    <div className="strength-v2-skill-heading">
                                                        <strong>{skill.label}</strong>

                                                        {skill.type && (
                                                            <span
                                                                className={`strength-v2-skill-type-tag ${getSkillTypeClass(skill.type)}`}
                                                            >
                                                                {skill.type}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* 技能基本資訊 */}
                                                    <div className="strength-v2-skill-basic">
                                                        <div className="strength-v2-result-stat">
                                                            <span>技能倍率</span>
                                                            <strong>
                                                                {formatStat(skill.result.coefficient)}%
                                                            </strong>
                                                        </div>

                                                        {skill.info && (
                                                            <>
                                                                {skill.showCooldown && (
                                                                    <div className="strength-v2-result-stat">
                                                                        <span>冷卻時間</span>
                                                                        <strong>
                                                                            {skill.info.cooldown
                                                                                ? `${skill.info.cooldown} 秒`
                                                                                : '尚未確認'}
                                                                        </strong>
                                                                    </div>
                                                                )}

                                                                <div className="strength-v2-skill-effect">
                                                                    <span>技能效果</span>
                                                                    <p>
                                                                        {skill.info.effectText ??
                                                                            skill.info.originalEffectText ??
                                                                            '無特殊效果'}
                                                                        {skill.talentLabel}
                                                                    </p>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* 傷害／治療計算明細 */}
                                                    <details className="strength-v2-skill-calculation">
                                                        <summary>計算明細</summary>

                                                        <div className="strength-v2-result-stats">
                                                            {skill.healing !== null ? (
                                                                <div className="strength-v2-result-stat">
                                                                    <span>治療量</span>
                                                                    <strong>
                                                                        {formatStat(skill.healing.healing)}
                                                                    </strong>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="strength-v2-result-stat">
                                                                        <span>普通傷害</span>
                                                                        <strong>
                                                                            {formatStat(skill.result.damage?.normalDamage)}
                                                                        </strong>
                                                                    </div>

                                                                    <div className="strength-v2-result-stat">
                                                                        <span>暴擊傷害</span>
                                                                        <strong>
                                                                            {formatStat(skill.result.damage?.criticalDamage)}
                                                                        </strong>
                                                                    </div>

                                                                    <div className="strength-v2-result-stat">
                                                                        <span>期望傷害</span>
                                                                        <strong>
                                                                            {formatStat(skill.result.damage?.expectedDamage)}
                                                                        </strong>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </details>
                                                </div>
                                            ))}
                                        </div>

                                        {item.warnings.length > 0 && (
                                            <div className="strength-v2-result-warnings">
                                                <strong>此角色的資料提醒</strong>
                                                <ul>
                                                    {item.warnings.map((warning, index) => (
                                                        <li key={`${item.character.id}-warning-${index}`}>
                                                            {warning}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    )
}
