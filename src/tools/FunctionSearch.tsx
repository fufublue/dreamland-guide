
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
    fetchCharacterData,
    type Character,
} from '../characterData'
import {
    parseCharacter,
    getEffectCategoryName,
    type ParsedCharacter,
    type ParsedSkill,
    type ParsedSkillEffect,
    type EffectAction,
    type EffectTargetSide,
    type EffectRange,
    type EffectCategory,
} from '../characterEffectParser'
import './FunctionSearch.css'

type SearchMode = 'original' | 'talent' | 'all'
type EffectLevel = 'initial' | 'max'

interface SearchMatch {
    skill: ParsedSkill
    skillName: string
    sourceName: string
    cooldown: string
    coefficient: string
    effect: ParsedSkillEffect
    comparisonMatches?: SearchMatch[]
}

interface SkillSearchGroup {
    skillName: string
    matches: SearchMatch[]
}

interface CharacterSearchResult {
    character: Character
    parsedCharacter: ParsedCharacter
    skills: SkillSearchGroup[]
}

const ACTION_OPTIONS: {
    value: EffectAction
    label: string
}[] = [
        { value: 'increase', label: '增加' },
        { value: 'decrease', label: '降低' },
        { value: 'clear', label: '清除' },
        { value: 'heal', label: '治療' },
        { value: 'other', label: '其他' },
    ]

const TARGET_OPTIONS: {
    value: EffectTargetSide
    label: string
}[] = [
        { value: 'ally', label: '我方' },
        { value: 'enemy', label: '敵方' },
        { value: 'self', label: '自身' },
        { value: 'unknown', label: '未註明' },
    ]

const RANGE_OPTIONS: {
    value: EffectRange
    label: string
}[] = [
        { value: 'all', label: '全體' },
        { value: 'single', label: '單體／自身' },
        { value: 'unknown', label: '未註明' },
    ]

const MAGNITUDE_OPTIONS = ['小幅', '中幅', '大幅']

const TALENT_MODE_OPTIONS = [
    { value: 'all', label: '全部' },
    { value: 'original', label: '未解鎖天賦' },
    { value: 'talent', label: '已解鎖天賦' },
]

const EFFECT_LEVEL_OPTIONS = [
    { value: 'initial', label: '初級效果' },
    { value: 'max', label: '滿技效果' },
]

const SKILL_NAMES: Record<ParsedSkill['skillName'], string> = {
    ultimate: '必殺技',
    skill2: '2技能',
    skill1: '1技能',
}

const SKILL_ORDER: Record<ParsedSkill['skillName'], number> = {
    ultimate: 0,
    skill2: 1,
    skill1: 2,
}

// 根據技能種類取得對應的天賦等級
function getTalentNumber(
    skillName: ParsedSkill['skillName']
): number {
    switch (skillName) {
        case 'skill1':
            return 9
        case 'skill2':
            return 12
        case 'ultimate':
            return 15
    }
}

function hasTalentEffectChanges(
    originalEffects: ParsedSkillEffect[],
    talentEffects: ParsedSkillEffect[]
): boolean {
    const getEffectSignature = (effects: ParsedSkillEffect[]) =>
        JSON.stringify(
            effects.map(effect => ({
                action: effect.action,
                targetSide: effect.targetSide,
                range: effect.range,
                categories: [...effect.searchableCategories].sort(),
                magnitude: effect.magnitude,
                value: effect.value,
                duration: effect.duration,
                chance: effect.chance,
                originalText: effect.originalText.replace(/\s+/g, '').trim(),
            }))
        )

    return (
        getEffectSignature(originalEffects) !==
        getEffectSignature(talentEffects)
    )
}

function getSkillLevels(
    skill: ParsedSkill,
    mode: SearchMode,
    effectLevel: EffectLevel
) {
    const levels: {
        sourceName: string
        cooldown: string
        coefficient: string
        effects: ParsedSkillEffect[]
    }[] = []

    const originalLevel =
        effectLevel === 'initial' ? skill.initial : skill.max

    const talentLevel =
        effectLevel === 'initial'
            ? skill.talentInitial
            : skill.talentMax

    const talentChangedEffects = hasTalentEffectChanges(
        originalLevel.effects,
        talentLevel.effects
    )

    // 未解鎖天賦：只顯示原始技能
    if (mode === 'original') {
        levels.push({
            sourceName: '初始',
            cooldown: originalLevel.cooldown,
            coefficient: originalLevel.coefficient,
            effects: originalLevel.effects,
        })
    }

    // 已解鎖天賦：顯示天賦套用後的技能
    if (mode === 'talent') {
        levels.push({
            sourceName: talentChangedEffects ? '天賦' : '初始',
            cooldown: talentLevel.cooldown,
            coefficient: talentLevel.coefficient,
            effects: talentLevel.effects,
        })
    }

    // 全部：
    // 有實際改變效果才同時顯示兩個版本
    // 沒有改變效果就只顯示一份
    if (mode === 'all') {
        if (talentChangedEffects) {
            levels.push({
                sourceName: '天賦',
                cooldown: talentLevel.cooldown,
                coefficient: talentLevel.coefficient,
                effects: talentLevel.effects,
            })

            levels.push({
                sourceName: '初始',
                cooldown: originalLevel.cooldown,
                coefficient: originalLevel.coefficient,
                effects: originalLevel.effects,
            })
        } else {
            levels.push({
                sourceName: '初始',
                cooldown: talentLevel.cooldown,
                coefficient: talentLevel.coefficient,
                effects: talentLevel.effects,
            })
        }
    }

    return levels
}


function SelectFilter({
    title,
    value,
    options,
    onChange,
    disabled = false,
    placeholder = '不限',
    className = '',
    includeAnyOption = true,
}: {
    title: string
    value: string
    options: { value: string; label: string }[]
    onChange: (value: string) => void
    disabled?: boolean
    placeholder?: string
    className?: string
    includeAnyOption?: boolean
}) {
    return (
        <label className={`function-select-group ${className}`}>
            <span className="function-select-title">{title}</span>

            <select
                className="function-filter-select"
                value={value}
                disabled={disabled}
                onChange={event => onChange(event.target.value)}
            >
                {includeAnyOption && (
                    <option value="">{placeholder}</option>
                )}

                {!includeAnyOption && value === '' && (
                    <option value="" disabled>
                        請選擇主詞條
                    </option>
                )}

                {options.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    )
}



function MultiSelectFilter({
    title,
    values,
    options,
    onChange,
}: {
    title: string
    values: string[]
    options: { value: string; label: string }[]
    onChange: (values: string[]) => void
}) {
    function toggleValue(value: string) {
        if (values.includes(value)) {
            onChange(values.filter(item => item !== value))
        } else {
            onChange([...values, value])
        }
    }

    return (
        <div className="function-select-group function-tag-filter">
            <span className="function-select-title">{title}</span>

            <div className="function-tag-options">
                {options.map(option => {
                    const selected = values.includes(option.value)

                    return (
                        <button
                            key={option.value}
                            type="button"
                            className={`function-tag-option ${selected ? 'selected' : ''}`}
                            onClick={() => toggleValue(option.value)}
                            aria-pressed={selected}
                        >
                            {option.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}



function getRarityClass(value: string) {
    const rarity = value.toUpperCase()

    if (rarity.startsWith('UR')) return 'rarity-ur'
    if (rarity.startsWith('SSR')) return 'rarity-ssr'
    if (rarity.startsWith('SR')) return 'rarity-sr'
    if (rarity.startsWith('R')) return 'rarity-r'

    return ''
}

function getElementClass(value: string) {
    const elementMap: Record<string, string> = {
        水: 'element-water',
        火: 'element-fire',
        風: 'element-wind',
        地: 'element-earth',
        雷: 'element-thunder',
        光: 'element-light',
        暗: 'element-dark',
    }

    return elementMap[value] || ''
}

function getRarityOrder(value: string) {
    const order = ['UR', 'SSR', 'SR', 'R', 'N']

    const index = order.findIndex(item =>
        value.toUpperCase().startsWith(item)
    )

    return index === -1 ? order.length : index
}

export default function FunctionSearch() {
    logCalculationParserTest()
    const [characters, setCharacters] = useState<Character[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // 天賦狀態：預設全部
    const [mode, setMode] = useState<SearchMode>('all')

    // 效果等級：預設滿技
    const [effectLevel, setEffectLevel] =
        useState<EffectLevel>('max')

    const [action, setAction] = useState('')
    const [category, setCategory] = useState('')
    const [targetSide, setTargetSide] = useState('')
    const [range, setRange] = useState('')
    const [magnitude, setMagnitude] = useState('')

    const [rarity, setRarity] = useState<string[]>([])
    const [element, setElement] = useState<string[]>([])
    const [characterClass, setCharacterClass] = useState<string[]>([])

    const [detailExpanded, setDetailExpanded] = useState(false)
    const [expandedCharacter, setExpandedCharacter] = useState('')

    useEffect(() => {
        let cancelled = false

        async function loadCharacters() {
            setLoading(true)
            setError('')

            try {
                const [physicalData, magicData] = await Promise.all([
                    fetchCharacterData('physical'),
                    fetchCharacterData('magic'),
                ])

                if (cancelled) return

                setCharacters([
                    ...physicalData.characters,
                    ...magicData.characters,
                ])
            } catch (err) {
                if (cancelled) return

                setError(
                    err instanceof Error
                        ? err.message
                        : '角色資料讀取失敗，請稍後再試。'
                )
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadCharacters()

        return () => {
            cancelled = true
        }
    }, [])

    const parsedCharacters = useMemo(() => {
        return characters.map(character => ({
            character,
            parsed: parseCharacter(character),
        }))
    }, [characters])


    // 稀有度：UR 排最前面
    const rarityOptions = useMemo(() => {
        return [
            ...new Set(
                characters
                    .map(item => item.rarity)
                    .filter(Boolean)
            ),
        ]
            .sort((a, b) => {
                const orderDifference =
                    getRarityOrder(a) - getRarityOrder(b)

                return orderDifference !== 0
                    ? orderDifference
                    : a.localeCompare(b)
            })
            .map(value => ({ value, label: value }))
    }, [characters])

    // 屬性：依照指定順序
    const elementOptions = useMemo(() => {
        const preferredOrder = [
            '水',
            '火',
            '風',
            '地',
            '雷',
            '光',
            '暗',
        ]

        const values = [
            ...new Set(
                characters
                    .map(item => item.element)
                    .filter(Boolean)
            ),
        ]

        return values
            .sort((a, b) => {
                const indexA = preferredOrder.indexOf(a)
                const indexB = preferredOrder.indexOf(b)

                if (indexA === -1 && indexB === -1) {
                    return a.localeCompare(b)
                }

                if (indexA === -1) return 1
                if (indexB === -1) return -1

                return indexA - indexB
            })
            .map(value => ({ value, label: value }))
    }, [characters])

    // 職業：只顯示資料中實際存在的選項
    const classOptions = useMemo(() => {
        return [
            ...new Set(
                characters
                    .map(item => item.class)
                    .filter(Boolean)
            ),
        ]
            .sort()
            .map(value => ({ value, label: value }))
    }, [characters])

    // 副詞條依照主詞條，從實際技能資料動態產生
    const categoryOptions = useMemo(() => {
        if (!action) return []

        const categories = new Set<EffectCategory>()

        for (const item of parsedCharacters) {
            for (const skill of item.parsed.skills) {
                const levels = getSkillLevels(
                    skill,
                    mode,
                    effectLevel
                )

                for (const level of levels) {
                    for (const effect of level.effects) {
                        if (effect.action !== action) continue

                        for (const category of effect.searchableCategories) {
                            categories.add(category)
                        }
                    }
                }
            }
        }

        return [...categories].map(value => ({
            value,
            label: getEffectCategoryName(value),
        }))
    }, [parsedCharacters, action, mode, effectLevel])


    const results = useMemo(() => {
        const grouped = new Map<string, CharacterSearchResult>()

        for (const item of parsedCharacters) {
            const { character, parsed } = item

            // 角色條件篩選
            if (rarity.length > 0 && !rarity.includes(character.rarity)) continue
            if (element.length > 0 && !element.includes(character.element)) continue
            if (characterClass.length > 0 && !characterClass.includes(character.class)) continue

            for (const skill of parsed.skills) {
                const levels = getSkillLevels(
                    skill,
                    mode,
                    effectLevel
                )

                // 先判斷這個技能是否有任何效果符合搜尋條件
                const hasMatchingEffect = levels.some(level =>
                    level.effects.some(effect => {
                        if (action && effect.action !== action) return false

                        if (
                            category &&
                            !effect.searchableCategories.includes(
                                category as EffectCategory
                            )
                        ) {
                            return false
                        }

                        if (targetSide && effect.targetSide !== targetSide) return false
                        if (range && effect.range !== range) return false
                        if (magnitude && effect.magnitude !== magnitude) return false

                        return true
                    })
                )

                if (!hasMatchingEffect) continue

                if (!grouped.has(character.id)) {
                    grouped.set(character.id, {
                        character,
                        parsedCharacter: parsed,
                        skills: [],
                    })
                }

                const result = grouped.get(character.id)!

                let skillGroup = result.skills.find(
                    group => group.skillName === SKILL_NAMES[skill.skillName]
                )

                if (!skillGroup) {
                    skillGroup = {
                        skillName: SKILL_NAMES[skill.skillName],
                        matches: [],
                    }

                    result.skills.push(skillGroup)
                }

                // 符合搜尋條件後，收集這個技能的全部效果
                for (const level of levels) {
                    for (const effect of level.effects) {
                        const currentCategories = [
                            ...effect.searchableCategories,
                        ].sort()


                        const duplicate = skillGroup.matches.find(match => {
                            // 只允許不同版本的效果互相比較
                            if (match.sourceName === level.sourceName) {
                                return false
                            }

                            const existingCategories = [
                                ...match.effect.searchableCategories,
                            ].sort()

                            const sameCategories =
                                JSON.stringify(existingCategories) ===
                                JSON.stringify(currentCategories)

                            return (
                                match.effect.action === effect.action &&
                                sameCategories &&
                                match.effect.targetSide === effect.targetSide &&
                                match.effect.range === effect.range
                            )
                        })


                        const currentMatch: SearchMatch = {
                            skill,
                            skillName: SKILL_NAMES[skill.skillName],
                            sourceName: level.sourceName,
                            cooldown: level.cooldown,
                            coefficient: level.coefficient,
                            effect,
                        }

                        if (duplicate) {
                            if (!duplicate.comparisonMatches) {
                                duplicate.comparisonMatches = []
                            }

                            duplicate.comparisonMatches.push(currentMatch)
                            continue
                        }

                        skillGroup.matches.push(currentMatch)
                    }
                }
            }
        }

        // 技能順序固定：必殺技、2技能、1技能
        for (const result of grouped.values()) {
            result.skills.sort((a, b) => {
                const skillA = Object.keys(SKILL_NAMES).find(
                    key =>
                        SKILL_NAMES[key as ParsedSkill['skillName']] ===
                        a.skillName
                ) as ParsedSkill['skillName'] | undefined

                const skillB = Object.keys(SKILL_NAMES).find(
                    key =>
                        SKILL_NAMES[key as ParsedSkill['skillName']] ===
                        b.skillName
                ) as ParsedSkill['skillName'] | undefined

                return (
                    SKILL_ORDER[skillA ?? 'skill1'] -
                    SKILL_ORDER[skillB ?? 'skill1']
                )
            })
        }

        return [...grouped.values()].sort((a, b) => {
            return (
                getRarityOrder(a.character.rarity) -
                getRarityOrder(b.character.rarity)
            )
        })
    }, [
        parsedCharacters,
        mode,
        effectLevel,
        action,
        category,
        targetSide,
        range,
        magnitude,
        rarity,
        element,
        characterClass,
    ])


    function clearFilters() {
        setMode('all')
        setEffectLevel('max')
        setAction('')
        setCategory('')
        setTargetSide('')
        setRange('')
        setMagnitude('')
        setRarity([])
        setElement([])
        setCharacterClass([])
        setExpandedCharacter('')
    }

    if (loading) {
        return (
            <div className="function-search">
                <div className="function-message">
                    正在讀取角色與技能資料……
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="function-search">
                <div className="function-error">{error}</div>
            </div>
        )
    }

    return (
        <div className="function-search">
            <div className="function-filters">
                <div className="function-filter-heading">
                    <div className="function-section-title">效果篩選</div>

                    <button
                        type="button"
                        className="function-clear-filters"
                        onClick={clearFilters}
                    >
                        清除所有條件
                    </button>
                </div>

                {/* 第一列：主詞條、副詞條 */}
                <div className="function-select-grid function-select-grid-primary">
                    <SelectFilter
                        title="主詞條"
                        value={action}
                        options={ACTION_OPTIONS}
                        includeAnyOption={false}
                        onChange={value => {
                            setAction(value)
                            setCategory('')
                        }}
                    />

                    <SelectFilter
                        title="副詞條"
                        value={category}
                        options={categoryOptions}
                        disabled={!action || categoryOptions.length === 0}
                        placeholder={
                            !action
                                ? '請先選擇主詞條'
                                : categoryOptions.length === 0
                                    ? '目前沒有對應詞條'
                                    : '不限'
                        }
                        onChange={setCategory}
                    />
                </div>

                {/* 第二列：天賦狀態、效果等級 */}
                <div className="function-select-grid function-select-grid-secondary">
                    <SelectFilter
                        title="天賦狀態"
                        value={mode}
                        options={TALENT_MODE_OPTIONS}
                        includeAnyOption={false}
                        onChange={value => setMode(value as SearchMode)}
                    />

                    <SelectFilter
                        title="效果等級"
                        value={effectLevel}
                        options={EFFECT_LEVEL_OPTIONS}
                        onChange={value =>
                            setEffectLevel(value as EffectLevel)
                        }
                    />
                </div>

                {/* 第三列：效果對象、效果範圍、幅度 */}
                <div className="function-select-grid function-select-grid-compact">
                    <SelectFilter
                        title="效果對象"
                        value={targetSide}
                        options={TARGET_OPTIONS}
                        onChange={setTargetSide}
                    />

                    <SelectFilter
                        title="效果範圍"
                        value={range}
                        options={RANGE_OPTIONS}
                        onChange={setRange}
                    />

                    <SelectFilter
                        title="幅度"
                        value={magnitude}
                        options={MAGNITUDE_OPTIONS.map(value => ({
                            value,
                            label: value,
                        }))}
                        onChange={setMagnitude}
                    />
                </div>

                <div className="function-detail-filter">
                    <button
                        type="button"
                        className="function-detail-toggle"
                        onClick={() => setDetailExpanded(!detailExpanded)}
                    >
                        <span>詳細篩選</span>
                        <span className="function-detail-toggle-right">
                            {detailExpanded ? '收合 ▲' : '展開 ▼'}
                        </span>
                    </button>

                    {detailExpanded && (
                        <div className="function-detail-filter-content">
                            <MultiSelectFilter
                                title="稀有度"
                                values={rarity}
                                options={rarityOptions}
                                onChange={setRarity}
                            />

                            <MultiSelectFilter
                                title="屬性"
                                values={element}
                                options={elementOptions}
                                onChange={setElement}
                            />

                            <MultiSelectFilter
                                title="職業"
                                values={characterClass}
                                options={classOptions}
                                onChange={setCharacterClass}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="function-results-section">
                <div className="function-results-heading">
                    <span>搜尋結果</span>

                    {action && (
                        <span className="function-result-count">
                            {results.length} 位角色
                        </span>
                    )}
                </div>

                {!action ? (
                    <div className="function-empty">
                        請先選擇主詞條。
                    </div>
                ) : results.length === 0 ? (
                    <div className="function-empty">
                        找不到符合條件的角色或技能效果。
                        <br />
                        可以嘗試減少篩選條件。
                    </div>
                ) : (
                    <div className="function-results">

                        {results.map(result => {
                            const isExpanded =
                                expandedCharacter === result.character.id

                            const totalMatches = result.skills.reduce(
                                (total, skill) =>
                                    total + skill.matches.length,
                                0
                            )

                            const rarityClass = getRarityClass(
                                result.character.rarity
                            )

                            const elementClass = getElementClass(
                                result.character.element
                            )

                            return (
                                <div
                                    key={result.character.id}
                                    className="function-result"
                                >
                                    <button
                                        type="button"
                                        className="function-result-main"
                                        onClick={() =>
                                            setExpandedCharacter(
                                                isExpanded
                                                    ? ''
                                                    : result.character.id
                                            )
                                        }
                                    >
                                        {/* 角色名稱與三個標籤並排 */}
                                        <div className="function-result-top">
                                            <span className="function-result-name">
                                                {result.character.name}
                                            </span>

                                            <div className="function-result-tags character-row-tags">
                                                <span
                                                    className={`character-rarity ${rarityClass}`}
                                                >
                                                    {result.character.rarity}
                                                </span>

                                                <span
                                                    className={`character-element ${elementClass}`}
                                                >
                                                    {result.character.element}
                                                </span>

                                                <span className="character-class">
                                                    {result.character.class}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 符合效果數量 */}
                                        <div className="function-result-match-count">
                                            符合 {totalMatches} 項效果
                                        </div>

                                        {/* 技能效果摘要 */}
                                        <div className="function-result-effect-list">
                                            {result.skills.map(skillGroup => (
                                                <div
                                                    key={skillGroup.skillName}
                                                    className="function-result-skill-group"
                                                >
                                                    <div className="function-match-skill">
                                                        {skillGroup.skillName}
                                                    </div>


                                                    {skillGroup.matches.map((match, index) => {
                                                        const allMatches = [
                                                            match,
                                                            ...(match.comparisonMatches || []),
                                                        ]


                                                        const talentMatch = allMatches.find(
                                                            item => item.sourceName === '天賦'
                                                        )

                                                        const originalMatch = allMatches.find(
                                                            item => item.sourceName === '初始'
                                                        )

                                                        const displayMatch = talentMatch || allMatches[0]

                                                        // 只有新增或實際變更的效果才標註天賦
                                                        const isTalent = Boolean(
                                                            talentMatch &&
                                                            (
                                                                !originalMatch ||
                                                                originalMatch.effect.originalText !== talentMatch.effect.originalText
                                                            )
                                                        )


                                                        const lines = displayMatch.effect.originalText
                                                            .split(/\r?\n/)
                                                            .map(line => line.trim())
                                                            .filter(Boolean)

                                                        const talentNumber = getTalentNumber(match.skill.skillName)

                                                        return (
                                                            <Fragment key={`${match.effect.originalText}-${index}`}>
                                                                {lines.map((line, lineIndex) => (
                                                                    <div
                                                                        key={lineIndex}
                                                                        className="function-result-effect"
                                                                    >
                                                                        <span>
                                                                            {line}
                                                                            {isTalent && (
                                                                                <span className="function-talent-tag">
                                                                                    (天賦 {talentNumber})
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </Fragment>
                                                        )
                                                    })}

                                                </div>
                                            ))}
                                        </div>

                                        <div className="function-result-bottom">
                                            <span>
                                                {isExpanded
                                                    ? '收合 ▲'
                                                    : '效果詳細資料 ▼'}
                                            </span>
                                        </div>
                                    </button>

                                    {/* 展開後的技能詳細資料 */}
                                    {isExpanded && (
                                        <div className="function-result-detail">
                                            {result.skills.map(skillGroup => (
                                                <div
                                                    key={skillGroup.skillName}
                                                    className="function-match-detail"
                                                >
                                                    <div className="function-detail-title">
                                                        {skillGroup.skillName}
                                                    </div>

                                                    {skillGroup.matches.map(
                                                        (match, index) => {
                                                            const allMatches = [
                                                                match,
                                                                ...(match.comparisonMatches || []),
                                                            ]

                                                            return (
                                                                <div
                                                                    key={`${match.effect.originalText}-${index}`}
                                                                    className="function-match-detail-item"
                                                                >


                                                                    {(() => {
                                                                        const originalMatch = allMatches.find(
                                                                            item => item.sourceName === '初始'
                                                                        )

                                                                        const talentMatch = allMatches.find(
                                                                            item => item.sourceName === '天賦'
                                                                        )

                                                                        const hasComparison = Boolean(
                                                                            originalMatch && talentMatch
                                                                        )

                                                                        const baseMatch =
                                                                            originalMatch || talentMatch || allMatches[0]

                                                                        const afterMatch = talentMatch || baseMatch

                                                                        // 沒有初始效果，但天賦後出現效果，代表新增
                                                                        const isAddedEffect = (
                                                                            !originalMatch &&
                                                                            afterMatch.sourceName === '天賦'
                                                                        )

                                                                        const showChance = (
                                                                            afterMatch.effect.action !== 'clear' &&
                                                                            afterMatch.effect.searchableCategories.some(category =>
                                                                                ['binding', 'seal', 'darkness', 'poison'].includes(category)
                                                                            )
                                                                        )

                                                                        // 統一處理前後數值比較
                                                                        const showChange = (
                                                                            before: string,
                                                                            after: string,
                                                                            suffix = ''
                                                                        ) => {
                                                                            const afterValue = after || '未標示'

                                                                            if (hasComparison) {
                                                                                const beforeValue = before || '未標示'

                                                                                if (beforeValue !== afterValue) {
                                                                                    return (
                                                                                        <>
                                                                                            <span className="function-change-before">
                                                                                                {beforeValue}
                                                                                            </span>
                                                                                            <span className="function-change-arrow">
                                                                                                {' → '}
                                                                                            </span>
                                                                                            <span className="function-change-after">
                                                                                                {afterValue}{suffix}
                                                                                            </span>
                                                                                        </>
                                                                                    )
                                                                                }
                                                                            }

                                                                            if (isAddedEffect && after) {
                                                                                return (
                                                                                    <>
                                                                                        <span className="function-change-before">
                                                                                            無
                                                                                        </span>
                                                                                        <span className="function-change-arrow">
                                                                                            {' → '}
                                                                                        </span>
                                                                                        <span className="function-change-after">
                                                                                            {after}{suffix}
                                                                                        </span>
                                                                                    </>
                                                                                )
                                                                            }

                                                                            return `${afterValue}${suffix}`
                                                                        }

                                                                        return (
                                                                            <div>
                                                                                <div className="function-match-source">
                                                                                    {hasComparison || isAddedEffect
                                                                                        ? `初始 → 天賦 ${getTalentNumber(match.skill.skillName)}`
                                                                                        : afterMatch.sourceName === '天賦'
                                                                                            ? `天賦 ${getTalentNumber(match.skill.skillName)} 效果`
                                                                                            : '初始效果'}
                                                                                </div>

                                                                                {/* 效果內容 */}
                                                                                <div className="function-detail-row-content">
                                                                                    <div className="function-detail-label">
                                                                                        效果內容
                                                                                    </div>

                                                                                    <div className="function-detail-content">
                                                                                        {(() => {
                                                                                            const beforeLines = (originalMatch?.effect.originalText || '')
                                                                                                .split(/\r?\n/)
                                                                                                .map(line => line.trim())
                                                                                                .filter(Boolean)

                                                                                            const afterLines = afterMatch.effect.originalText
                                                                                                .split(/\r?\n/)
                                                                                                .map(line => line.trim())
                                                                                                .filter(Boolean)

                                                                                            // 前後版本逐行配對
                                                                                            if (hasComparison) {
                                                                                                const lineCount = Math.max(
                                                                                                    beforeLines.length,
                                                                                                    afterLines.length
                                                                                                )

                                                                                                return Array.from({ length: lineCount }, (_, lineIndex) => {
                                                                                                    const before = beforeLines[lineIndex]
                                                                                                    const after = afterLines[lineIndex]

                                                                                                    // 前後相同，只顯示一次
                                                                                                    if (before === after) {
                                                                                                        return (
                                                                                                            <div
                                                                                                                key={lineIndex}
                                                                                                                className="function-detail-effect-line"
                                                                                                            >
                                                                                                                {after}
                                                                                                            </div>
                                                                                                        )
                                                                                                    }

                                                                                                    // 前後不同，只顯示效果比較，不加天賦標記
                                                                                                    return (
                                                                                                        <div
                                                                                                            key={lineIndex}
                                                                                                            className="function-detail-effect-line"
                                                                                                        >
                                                                                                            {before || '無'}
                                                                                                            <span className="function-change-arrow">
                                                                                                                {' → '}
                                                                                                            </span>
                                                                                                            <span className="function-change-after">
                                                                                                                {after || '無'}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    )

                                                                                                })
                                                                                            }

                                                                                            // 天賦新增的效果
                                                                                            if (isAddedEffect) {
                                                                                                return afterLines.map((line, lineIndex) => (
                                                                                                    <div
                                                                                                        key={lineIndex}
                                                                                                        className="function-detail-effect-line"
                                                                                                    >
                                                                                                        <span className="function-change-before">無</span>
                                                                                                        <span className="function-change-arrow">
                                                                                                            {' → '}
                                                                                                        </span>
                                                                                                        <span className="function-change-after">
                                                                                                            {line}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                ))
                                                                                            }

                                                                                            // 沒有天賦變化，單純逐行顯示
                                                                                            return afterLines.map((line, lineIndex) => (
                                                                                                <div
                                                                                                    key={lineIndex}
                                                                                                    className="function-detail-effect-line"
                                                                                                >
                                                                                                    {line}
                                                                                                </div>
                                                                                            ))
                                                                                        })()}
                                                                                    </div>
                                                                                </div>

                                                                                {/* 效果短資訊 */}
                                                                                <div className="function-detail-grid">

                                                                                    <div className="function-detail-cell">
                                                                                        <span className="function-detail-label">效果對象</span>
                                                                                        <span className="function-detail-value">
                                                                                            {baseMatch.effect.targetSide === 'ally'
                                                                                                ? '我方'
                                                                                                : baseMatch.effect.targetSide === 'enemy'
                                                                                                    ? '敵方'
                                                                                                    : baseMatch.effect.targetSide === 'self'
                                                                                                        ? '自身'
                                                                                                        : '未註明'}
                                                                                        </span>
                                                                                    </div>

                                                                                    <div className="function-detail-cell">
                                                                                        <span className="function-detail-label">效果範圍</span>
                                                                                        <span className="function-detail-value">
                                                                                            {baseMatch.effect.range === 'all'
                                                                                                ? '全體'
                                                                                                : baseMatch.effect.range === 'single'
                                                                                                    ? '單體／自身'
                                                                                                    : '未註明'}
                                                                                        </span>
                                                                                    </div>

                                                                                    <div className="function-detail-cell">
                                                                                        <span className="function-detail-label">幅度</span>
                                                                                        <span className="function-detail-value">
                                                                                            {showChange(
                                                                                                originalMatch?.effect.magnitude || '',
                                                                                                afterMatch.effect.magnitude || ''
                                                                                            )}
                                                                                        </span>
                                                                                    </div>

                                                                                    <div className="function-detail-cell">
                                                                                        <span className="function-detail-label">持續時間</span>
                                                                                        <span className="function-detail-value">
                                                                                            {showChange(
                                                                                                originalMatch?.effect.duration || '',
                                                                                                afterMatch.effect.duration || ''
                                                                                            )}
                                                                                        </span>
                                                                                    </div>

                                                                                    {showChance && (
                                                                                        <div className="function-detail-cell">
                                                                                            <span className="function-detail-label">發動機率</span>
                                                                                            <span className="function-detail-value">
                                                                                                {showChange(
                                                                                                    originalMatch?.effect.chance || '',
                                                                                                    afterMatch.effect.chance || '',
                                                                                                    '%'
                                                                                                )}
                                                                                            </span>
                                                                                        </div>
                                                                                    )}

                                                                                    {match.skill.skillName !== 'ultimate' && (
                                                                                        <div className="function-detail-cell">
                                                                                            <span className="function-detail-label">冷卻時間</span>
                                                                                            <span className="function-detail-value">
                                                                                                {showChange(
                                                                                                    originalMatch?.cooldown || '',
                                                                                                    afterMatch.cooldown || '',
                                                                                                    ' 秒'
                                                                                                )}
                                                                                            </span>
                                                                                        </div>
                                                                                    )}

                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })()}


                                                                </div>
                                                            )
                                                        }
                                                    )}
                                                </div>
                                            ))}

                                            {result.character.talent && (
                                                <>
                                                    <div className="function-detail-title">
                                                        天賦效果
                                                    </div>

                                                    <div className="function-detail-text">
                                                        {result.character.talent
                                                            .split(/<br\s*\/?>|\r?\n/i)
                                                            .map(line =>
                                                                line.replace(/<[^>]*>/g, '').trim()
                                                            )
                                                            .filter(Boolean)
                                                            .map((line, index) => (
                                                                <div key={index}>
                                                                    {line}
                                                                </div>
                                                            ))}
                                                    </div>
                                                </>
                                            )}

                                            {result.character.maxBreakthroughTrait && (
                                                <>
                                                    <div className="function-detail-title">
                                                        突破特性
                                                    </div>

                                                    <div className="function-detail-text">
                                                        {result.character.maxBreakthroughTrait}
                                                    </div>
                                                </>
                                            )}

                                            {result.character.notes && (
                                                <>
                                                    <div className="function-detail-title">
                                                        備註
                                                    </div>

                                                    <div className="function-detail-text">
                                                        {result.character.notes}
                                                    </div>
                                                </>
                                            )}

                                            {result.parsedCharacter.reviewRequired && (
                                                <div className="function-review-warning">
                                                    <div>此角色有部分資料需要人工確認：</div>

                                                    {result.parsedCharacter.reviewIssues.map(
                                                        (issue, index) => (
                                                            <div key={index}>
                                                                ・{issue}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                    </div>
                )}
            </div>
        </div>
    )
}
