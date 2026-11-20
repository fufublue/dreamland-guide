
import { useEffect, useMemo, useState } from 'react'
import './CharacterListPage.css'

import type { EngineCharacter } from '../engine'
import { useCharacterDataset } from './useCharacterDataset'
import CharacterListItem from './CharacterListItem'

interface CharacterListPageProps {
    attackType: 'physical' | 'magic'
    onSelectCharacter: (character: EngineCharacter) => void
    focusCharacterId?: string | null
}

export default function CharacterListPage({
    attackType,
    onSelectCharacter,
    focusCharacterId,
}: CharacterListPageProps) {
    const [keyword, setKeyword] = useState('')
    const [selectedRarities, setSelectedRarities] = useState<string[]>([])
    const [selectedElements, setSelectedElements] = useState<string[]>([])
    const [selectedClasses, setSelectedClasses] = useState<string[]>([])

    const {
        characters,
        loading,
        error,
    } = useCharacterDataset(attackType)
       

    // 自動取得資料中實際存在的篩選選項
    const filterOptions = useMemo(() => ({
        rarities: [...new Set(characters.map(character => character.rarity))],
        elements: [...new Set(characters.map(character => character.element))],
        classes: [...new Set(characters.map(character => character.class))],
    }), [characters])

    // 切換多選條件
    const toggleFilter = (
        value: string,
        setSelected: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        setSelected(current =>
            current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value]
        )
    }

    // 搜尋及篩選
    const filteredCharacters = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLowerCase()

        return characters.filter(character => {
            const matchesKeyword =
                !normalizedKeyword ||
                character.name.toLowerCase().includes(normalizedKeyword)

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
                matchesKeyword &&
                matchesRarity &&
                matchesElement &&
                matchesClass
            )
        })
    }, [
        characters,
        keyword,
        selectedRarities,
        selectedElements,
        selectedClasses,
    ])

    // 返回列表時，將指定角色移至接近畫面頂端的位置
    useEffect(() => {
        if (!focusCharacterId || loading) return

        const frame = requestAnimationFrame(() => {
            const target = document.getElementById(
                `character-${focusCharacterId}`
            )

            if (!target) return

            const top =
                target.getBoundingClientRect().top +
                window.scrollY -
                100

            window.scrollTo({
                top,
                behavior: 'smooth',
            })
        })

        return () => cancelAnimationFrame(frame)
    }, [focusCharacterId, loading])

    const pageTitle =
        attackType === 'physical' ? '物理角色資料' : '魔法角色資料'

    // 屬性對應標籤顏色
    const elementClassMap: Record<string, string> = {
        水: 'element-water',
        火: 'element-fire',
        風: 'element-wind',
        地: 'element-earth',
        雷: 'element-thunder',
        光: 'element-light',
        暗: 'element-dark',
    }

    const hasFilters =
        keyword.trim() ||
        selectedRarities.length > 0 ||
        selectedElements.length > 0 ||
        selectedClasses.length > 0

    return (
        <div className="character-page">
            <div className="character-search">
                <input
                    type="search"
                    value={keyword}
                    onChange={event => setKeyword(event.target.value)}
                    placeholder="搜尋角色名稱..."
                    aria-label="搜尋角色名稱"
                />
            </div>

            {/* 稀有度篩選 */}
            <div className="character-filter-group">
                <span className="character-filter-label">稀有度</span>

                <div className="character-filter-options">
                    <button
                        type="button"
                        className={`character-filter-button ${selectedRarities.length === 0 ? 'active' : ''}`}
                        onClick={() => setSelectedRarities([])}
                    >
                        全部
                    </button>

                    {filterOptions.rarities.map(rarity => (
                        <button
                            key={rarity}
                            type="button"
                            className={`character-filter-button character-tag rarity-${rarity.toLowerCase()} ${selectedRarities.includes(rarity) ? 'active' : ''}`}
                            onClick={() => toggleFilter(
                                rarity,
                                setSelectedRarities
                            )}
                        >
                            {rarity}
                        </button>
                    ))}
                </div>
            </div>

            {/* 屬性篩選 */}
            <div className="character-filter-group">
                <span className="character-filter-label">屬性</span>

                <div className="character-filter-options">
                    <button
                        type="button"
                        className={`character-filter-button ${selectedElements.length === 0 ? 'active' : ''}`}
                        onClick={() => setSelectedElements([])}
                    >
                        全部
                    </button>

                    {filterOptions.elements.map(element => (
                        <button
                            key={element}
                            type="button"
                            className={`character-filter-button character-tag ${elementClassMap[element] || ''} ${selectedElements.includes(element) ? 'active' : ''}`}
                            onClick={() => toggleFilter(
                                element,
                                setSelectedElements
                            )}
                        >
                            {element}
                        </button>
                    ))}
                </div>
            </div>

            {/* 職業篩選 */}
            <div className="character-filter-group">
                <span className="character-filter-label">職業</span>

                <div className="character-filter-options">
                    <button
                        type="button"
                        className={`character-filter-button ${selectedClasses.length === 0 ? 'active' : ''}`}
                        onClick={() => setSelectedClasses([])}
                    >
                        全部
                    </button>

                    {filterOptions.classes.map(characterClass => (
                        <button
                            key={characterClass}
                            type="button"
                            className={`character-filter-button character-tag character-class ${selectedClasses.includes(characterClass) ? 'active' : ''}`}
                            onClick={() => toggleFilter(
                                characterClass,
                                setSelectedClasses
                            )}
                        >
                            {characterClass}
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="character-page-message">
                    正在載入角色資料...
                </div>
            )}

            {!loading && error && (
                <div className="character-page-error">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <div className="character-list">
                    {filteredCharacters.length > 0 ? (
                        filteredCharacters.map(character => (
                            <div
                                key={character.id}
                                id={`character-${character.id}`}
                            >
                                <CharacterListItem
                                    character={character}
                                    onClick={onSelectCharacter}
                                    autoExpand={character.id === focusCharacterId}
                                />
                            </div>
                        ))
                    ) : (
                        <div className="character-page-message">
                            找不到符合條件的角色。
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
