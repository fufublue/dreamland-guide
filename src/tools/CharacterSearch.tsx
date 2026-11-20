
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    fetchCharacterData,
    type Character,
    type CharacterElementType,
    type CharacterSkill,
    type CharacterSkillLevel,
} from '../characterData'
import './CharacterSearch.css'

interface CharacterSearchProps {
    element: CharacterElementType
}

const rarityOrder = ['UR', 'SSR', 'SR']

export default function CharacterSearch({
    element,
}: CharacterSearchProps) {
    const [characters, setCharacters] = useState<Character[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedCharacter, setSelectedCharacter] =
        useState<Character | null>(null)

    const [searchText, setSearchText] = useState('')
    const [selectedRarities, setSelectedRarities] = useState<string[]>([])
    const [selectedElements, setSelectedElements] = useState<string[]>([])
    const [selectedClasses, setSelectedClasses] = useState<string[]>([])

    const listScrollPosition = useRef(0)

    useEffect(() => {
        let active = true

        async function loadCharacters() {
            setLoading(true)
            setError('')

            try {
                const data = await fetchCharacterData(element)

                if (!active) return

                setCharacters(data.characters)
            } catch (err) {
                if (!active) return

                setError(
                    err instanceof Error
                        ? err.message
                        : '角色資料讀取失敗。'
                )
            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        }

        loadCharacters()

        return () => {
            active = false
        }
    }, [element])

    const rarityOptions = useMemo(
        () => [...new Set(characters.map(item => item.rarity).filter(Boolean))],
        [characters]
    )

    const elementOrder = ['水', '火', '風', '地', '雷', '光', '暗']

    const elementOptions = useMemo(() => {
        return [...new Set(characters.map(item => item.element).filter(Boolean))]
            .sort((a, b) => {
                const aIndex = elementOrder.indexOf(a.trim().replace(/屬性$/, ''))
                const bIndex = elementOrder.indexOf(b.trim().replace(/屬性$/, ''))

                return (aIndex === -1 ? 999 : aIndex) -
                    (bIndex === -1 ? 999 : bIndex)
            })
    }, [characters])

    const classOptions = useMemo(
        () => [...new Set(characters.map(item => item.class).filter(Boolean))],
        [characters]
    )

    const filteredCharacters = useMemo(() => {
        return characters
            .filter(character => {
                const matchesSearch =
                    character.name
                        .toLowerCase()
                        .includes(searchText.trim().toLowerCase())

                const matchesRarity =
                    selectedRarities.length === 0 ||
                    selectedRarities.includes(character.rarity)

                const matchesElement =
                    selectedElements.length === 0 ||
                    selectedElements.includes(character.element)

                const matchesClass =
                    selectedClasses.length === 0 ||
                    selectedClasses.includes(character.class)

                return (
                    matchesSearch &&
                    matchesRarity &&
                    matchesElement &&
                    matchesClass
                )
            })
            .sort((a, b) => {
                const aIndex = rarityOrder.indexOf(a.rarity)
                const bIndex = rarityOrder.indexOf(b.rarity)

                const aOrder = aIndex === -1 ? 999 : aIndex
                const bOrder = bIndex === -1 ? 999 : bIndex

                return aOrder - bOrder
            })
    }, [
        characters,
        searchText,
        selectedRarities,
        selectedElements,
        selectedClasses,
    ])

    function toggleFilter(
        value: string,
        setSelected: React.Dispatch<React.SetStateAction<string[]>>
    ) {
        setSelected(current =>
            current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value]
        )
    }

    function clearFilters() {
        setSearchText('')
        setSelectedRarities([])
        setSelectedElements([])
        setSelectedClasses([])
    }

    function openCharacter(character: Character) {
        listScrollPosition.current = window.scrollY
        setSelectedCharacter(character)
    }

    function backToList() {
        setSelectedCharacter(null)

        requestAnimationFrame(() => {
            window.scrollTo(0, listScrollPosition.current)
        })
    }

    if (loading) {
        return <div className="character-message">正在讀取角色資料……</div>
    }

    if (error) {
        return (
            <div className="character-message character-error">
                {error}
                <button onClick={() => window.location.reload()}>
                    重新載入
                </button>
            </div>
        )
    }

    // 角色詳細資料頁
    if (selectedCharacter) {
        return (
            <CharacterDetail
                character={selectedCharacter}
                onBack={backToList}
            />
        )
    }

    const hasFilters =
        searchText.trim() !== '' ||
        selectedRarities.length > 0 ||
        selectedElements.length > 0 ||
        selectedClasses.length > 0

    return (
        <div className="character-search">
            <div className="character-search-header">
                <input
                    type="text"
                    className="character-search-input"
                    placeholder="搜尋角色名稱……"
                    value={searchText}
                    onChange={event => setSearchText(event.target.value)}
                />
            </div>

            <div className="character-filters">
                <FilterGroup
                    title="稀有度"
                    options={rarityOptions}
                    selected={selectedRarities}
                    onToggle={value =>
                        toggleFilter(value, setSelectedRarities)
                    }
                />

                <FilterGroup
                    title="屬性"
                    options={elementOptions}
                    selected={selectedElements}
                    onToggle={value =>
                        toggleFilter(value, setSelectedElements)
                    }
                />

                <FilterGroup
                    title="職業"
                    options={classOptions}
                    selected={selectedClasses}
                    onToggle={value =>
                        toggleFilter(value, setSelectedClasses)
                    }
                />

                {hasFilters && (
                    <button
                        className="character-clear-filters"
                        onClick={clearFilters}
                    >
                        清除篩選
                    </button>
                )}
            </div>
            <div className="character-count">
                共 {filteredCharacters.length} / {characters.length} 位角色
            </div>

            <div className="character-list">
                {filteredCharacters.length === 0 ? (
                    <div className="character-empty">
                        找不到符合條件的角色。
                    </div>
                ) : (
                    filteredCharacters.map(character => (
                        <button
                            className="character-row"
                            key={character.id}
                            type="button"
                            onClick={() => openCharacter(character)}
                        >
                            <div className="character-row-content">
                                <div className="character-name">
                                    {character.name}
                                </div>

                                <div className="character-row-tags">
                                    <span className={`character-rarity rarity-${character.rarity.toLowerCase()}`}>
                                        {character.rarity}
                                    </span>

                                    <span className={`character-element ${getElementClass(character.element)}`}>
                                        {character.element}
                                    </span>

                                    <span className="character-class">
                                        {character.class}
                                    </span>
                                </div>
                            </div>

                            <span className="character-row-arrow">›</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}

// 角色屬性顏色
function getElementClass(element: string): string {
    const elementClasses: Record<string, string> = {
        '水': 'element-water',
        '火': 'element-fire',
        '風': 'element-wind',
        '地': 'element-earth',
        '雷': 'element-thunder',
        '光': 'element-light',
        '暗': 'element-dark',
    }

    return elementClasses[element.trim().replace(/屬性$/, '')] || ''
}

// 角色詳細資料
interface CharacterDetailProps {
    character: Character
    onBack: () => void
}


function CharacterDetail({
    character,
    onBack,
}: CharacterDetailProps) {
    return (
        <div className="character-detail">
            <section className="character-detail-basic">
                <div className="character-detail-heading">
                    <div className="character-detail-name">
                        {character.name}
                    </div>

                    <button
                        className="character-back-button"
                        onClick={onBack}
                        type="button"
                    >
                        ← 返回角色列表
                    </button>
                </div>

                <div className="character-detail-tags">
                    <span className={`character-rarity rarity-${character.rarity.toLowerCase()}`}>
                        {character.rarity}
                    </span>

                    <span className={`character-element ${getElementClass(character.element)}`}>
                        {character.element}
                    </span>

                    <span className="character-class">{character.class}</span>
                </div>
            </section>

            <section className="character-detail-section">
                <h3>技能資料</h3>

                <SkillDetail
                    title="必殺技"
                    skill={character.ultimate}
                    hasCooldown={false}
                />

                <SkillDetail
                    title="2 技能"
                    skill={character.skill2}
                    hasCooldown={true}
                />

                <SkillDetail
                    title="1 技能"
                    skill={character.skill1}
                    hasCooldown={true}
                />
            </section>

            <section className="character-detail-section">
                <h3>天賦強化</h3>

                {character.talent?.trim() && (
                    <div className="character-detail-text">
                        {character.talent}
                    </div>
                )}
            </section>

            <section className="character-detail-section">
                <h3>滿突特性</h3>

                {character.maxBreakthroughTrait?.trim() && (
                    <div className="character-detail-text">
                        {character.maxBreakthroughTrait}
                    </div>
                )}
            </section>

            <section className="character-detail-section">
                <h3>補充資訊</h3>

                {character.notes?.trim() && (
                    <div className="character-detail-text">
                        {character.notes}
                    </div>
                )}
            </section>
        </div>
    )
}


// 單一技能區塊
interface SkillDetailProps {
    title: string
    skill: CharacterSkill
    hasCooldown: boolean
}

function SkillDetail({
    title,
    skill,
    hasCooldown,
}: SkillDetailProps) {
    return (
        <div className="character-skill">
            <div className="character-skill-heading">
                <strong>{title}</strong>
                <span className="character-skill-type">{skill.type}</span>
            </div>

            <div className="character-skill-levels">
                <SkillLevel
                    title="初始"
                    level={skill.initial}
                    hasCooldown={hasCooldown}
                />

                <SkillLevel
                    title="滿等"
                    level={skill.max}
                    hasCooldown={hasCooldown}
                />
            </div>
        </div>
    )
}

// 技能初始／滿等資料
interface SkillLevelProps {
    title: string
    level: CharacterSkillLevel
    hasCooldown: boolean
}

function SkillLevel({
    title,
    level,
    hasCooldown,
}: SkillLevelProps) {
    return (
        <div className="character-skill-level">
            <div className="character-skill-level-title">
                {title}
            </div>

            {hasCooldown && level.cooldown && (
                <div className="character-skill-field">
                    <span>CD</span>
                    <span>{level.cooldown}</span>
                </div>
            )}

            {level.coefficient && (
                <div className="character-skill-field">
                    <span>係數</span>
                    <span>{level.coefficient}</span>
                </div>
            )}

            {level.effect && (
                <div className="character-skill-effect">
                    <div className="character-skill-effect-title">
                        效果
                    </div>
                    <div className="character-detail-text">
                        {level.effect}
                    </div>
                </div>
            )}
        </div>
    )
}

interface FilterGroupProps {
    title: string
    options: string[]
    selected: string[]
    onToggle: (value: string) => void
}

function FilterGroup({
    title,
    options,
    selected,
    onToggle,
}: FilterGroupProps) {
    return (
        <div className="character-filter-group">
            <span className="character-filter-title">{title}</span>

            <div className="character-filter-options">
                {options.map(option => (
                    <button
                        key={option}
                        className={`character-filter-option ${title === '屬性' && getElementClass(option)
                                ? `filter-${getElementClass(option)}`
                                : ''
                            } ${selected.includes(option) ? 'selected' : ''}`}
                        onClick={() => onToggle(option)}
                        type="button"
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    )
}
