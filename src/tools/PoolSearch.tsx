
import { useEffect, useMemo, useState } from 'react'
import {
    fetchPoolData,
    type PoolCharacter,
    type PoolCharacterType,
} from '../poolData'
import './PoolSearch.css'

const characterTypes: PoolCharacterType[] = [
    '限定角色',
    '常駐角色',
    '專屬時刻(限定)',
]

// 從混池名稱取得期數
function getPoolNumber(poolRange: string): number {
    const match = poolRange.match(/第([一二三四五六七八九十\d]+)次混池/)

    if (!match) return 999

    const numberMap: Record<string, number> = {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
    }

    const value = match[1]

    return numberMap[value] ?? Number(value)
}

function PoolSearch() {
    const [characters, setCharacters] = useState<PoolCharacter[]>([])
    const [search, setSearch] = useState('')
    const [selectedCharacter, setSelectedCharacter] =
        useState<PoolCharacter | null>(null)
    const [selectedPool, setSelectedPool] = useState<string | null>(null)
    const [mode, setMode] = useState<'character' | 'pool'>('character')

    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    // 讀取混池資料
    useEffect(() => {
        let cancelled = false

        async function loadData() {
            try {
                const data = await fetchPoolData()

                if (!cancelled) {
                    setCharacters(data.characters)
                    setLoadError('')
                }
            } catch (error) {
                console.error('混池資料讀取失敗：', error)

                if (!cancelled) {
                    setLoadError(
                        error instanceof Error
                            ? error.message
                            : '混池資料讀取失敗。'
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

    // 取得目前所有已歸入的混池期數
    const poolRanges = useMemo(() => {
        return Array.from(
            new Set(
                characters
                    .filter(
                        (character) =>
                            character.poolStatus === '已歸入' &&
                            character.poolRange
                    )
                    .map((character) => character.poolRange)
            )
        ).sort((a, b) => getPoolNumber(a) - getPoolNumber(b))
    }, [characters])

    // 搜尋角色
    const searchResults = useMemo(() => {
        const keyword = search.trim().toLowerCase()

        if (!keyword) return []

        return characters.filter((character) =>
            character.character.toLowerCase().includes(keyword)
        )
    }, [characters, search])

    // 取得目前選擇的混池期數
    const currentPoolRange =
        selectedPool || selectedCharacter?.poolRange || ''

    // 取得目前選擇的混池編號
    const currentPoolNumber = currentPoolRange
        ? getPoolNumber(currentPoolRange)
        : 0

    // 累積取得第 1 次至目前期數的所有角色
    const poolCharacters = useMemo(() => {
        if (!currentPoolRange || currentPoolNumber === 999) {
            return []
        }

        return characters.filter((character) => {
            if (
                character.poolStatus !== '已歸入' ||
                !character.poolRange
            ) {
                return false
            }

            const characterPoolNumber = getPoolNumber(character.poolRange)

            return (
                characterPoolNumber <= currentPoolNumber
            )
        })
    }, [characters, currentPoolRange, currentPoolNumber])

    // 依照角色類型分類
    function getCharactersByType(type: PoolCharacterType) {
        return poolCharacters.filter(
            (character) => character.type === type
        )
    }

    // 選擇角色
    function selectCharacter(character: PoolCharacter) {
        setSelectedCharacter(character)
        setSelectedPool(null)
        setSearch(character.character)
    }

    // 切換查詢模式
    function changeMode(nextMode: 'character' | 'pool') {
        setMode(nextMode)
        setSearch('')
        setSelectedCharacter(null)
        setSelectedPool(null)
    }

    // 清除查詢結果
    function clearSelection() {
        setSearch('')
        setSelectedCharacter(null)
        setSelectedPool(null)
    }


    // 判斷累積結果中是否包含預測角色
    const hasPrediction = poolCharacters.some(
        (character) => character.isPrediction
    )

    return (
        <section className="pool-search-page">

            {/* 查詢模式 */}
            <div className="pool-mode-switch">
                <button
                    className={mode === 'character' ? 'active' : ''}
                    onClick={() => changeMode('character')}
                >
                    角色查詢
                </button>

                <button
                    className={mode === 'pool' ? 'active' : ''}
                    onClick={() => changeMode('pool')}
                >
                    混池查詢
                </button>
            </div>

            {loading && (
                <div className="pool-search-message">
                    正在讀取混池資料……
                </div>
            )}

            {!loading && loadError && (
                <div className="pool-search-error">
                    {loadError}
                </div>
            )}

            {/* 角色查詢 */}
            {!loading && !loadError && mode === 'character' && (
                <>
                    <div className="pool-mode-description">
                        搜尋角色名稱，查看角色所屬的混池及累積角色。
                    </div>

                    <div className="pool-search-box">
                        <span className="pool-search-icon">⌕</span>

                        <input
                            type="search"
                            placeholder="輸入角色名稱，例如：德米安"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value)
                                setSelectedCharacter(null)
                            }}
                        />

                        {search && (
                            <button
                                className="pool-search-clear"
                                onClick={clearSelection}
                                aria-label="清除搜尋"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {search.trim() && !selectedCharacter && (
                        <div className="pool-search-results">
                            <div className="pool-results-heading">
                                搜尋結果（{searchResults.length}）
                            </div>

                            {searchResults.length > 0 ? (
                                searchResults.map((character) => (
                                    <button
                                        className="pool-result-item"
                                        key={`${character.character}-${character.type}`}
                                        onClick={() => selectCharacter(character)}
                                    >
                                        <span className="pool-result-name">
                                            {character.character}
                                        </span>

                                        <span className="pool-result-type">
                                            {character.type}
                                        </span>

                                        <span className="pool-result-arrow">→</span>
                                    </button>
                                ))
                            ) : (
                                <div className="pool-search-message">
                                    找不到符合的角色。
                                </div>
                            )}
                        </div>
                    )}

                    {!search.trim() && (
                        <div className="pool-search-hint">
                            請輸入完整或部分角色名稱開始查詢。
                        </div>
                    )}
                </>
            )}

            {/* 混池查詢 */}
            {!loading && !loadError && mode === 'pool' && (
                <>
                    <div className="pool-mode-description">
                        選擇混池期數，查看截至該期累積的所有角色。
                    </div>

                    <div className="pool-range-grid">
                        {poolRanges.map((poolRange) => {
                            const prediction = poolRange.includes('預測')

                            return (
                                <button
                                    key={poolRange}
                                    className={`pool-range-button ${selectedPool === poolRange ? 'active' : ''
                                        }`}
                                    onClick={() =>
                                        setSelectedPool(
                                            selectedPool === poolRange ? null : poolRange
                                        )
                                    }
                                >
                                    <span>{poolRange}</span>

                                    {prediction && (
                                        <span className="pool-prediction-tag">
                                            預測
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {poolRanges.length === 0 && (
                        <div className="pool-search-message">
                            目前沒有可查詢的混池資料。
                        </div>
                    )}
                </>
            )}

            {/* 查詢結果 */}
            {!loading && !loadError &&
                (selectedCharacter || selectedPool) && (
                    <div className="pool-selected-result">

                        <div className="pool-selected-heading">
                            <div>
                                <div className="pool-section-label">
                                    {selectedPool ? '混池累積內容' : '查詢角色'}
                                </div>

                                <h3>
                                    {selectedPool || selectedCharacter?.character}
                                </h3>
                            </div>

                            <button
                                className="pool-change-button"
                                onClick={clearSelection}
                            >
                                清除
                            </button>
                        </div>

                        {/* 角色資訊 */}
                        {selectedCharacter && (
                            <div className="pool-info-panel">
                                <div className="pool-info-row">
                                    <span>角色類型</span>
                                    <strong>{selectedCharacter.type}</strong>
                                </div>

                                <div className="pool-info-row">
                                    <span>混池範圍</span>
                                    <strong>
                                        {selectedCharacter.poolStatus === '已歸入'
                                            ? selectedCharacter.poolRange
                                            : '尚未歸入混池'}
                                    </strong>
                                </div>

                                {selectedCharacter.activity && (
                                    <div className="pool-info-row">
                                        <span>活動來源</span>
                                        <strong>{selectedCharacter.activity}</strong>
                                    </div>
                                )}

                                {selectedCharacter.poolStatus === '尚未歸入' && (
                                    <div className="pool-prediction-notice">
                                        此角色目前尚未歸入任何混池。
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 預測提醒 */}
                        {hasPrediction && (
                            <div className="pool-prediction-notice">
                                此累積範圍包含預測混池資料，預測角色並非已確認的正式混池。
                            </div>
                        )}

                        {/* 累積角色清單 */}
                        {currentPoolRange && poolCharacters.length > 0 && (
                            <div className="pool-group-section">
                                <h3 className="pool-group-title">
                                    累積混池角色
                                </h3>

                                <p className="pool-group-description">
                                    包含第一次混池至目前選擇期數的所有角色，不重複列出。
                                </p>

                                {characterTypes.map((type) => {
                                    const groupCharacters = getCharactersByType(type)

                                    if (groupCharacters.length === 0) {
                                        return null
                                    }

                                    return (
                                        <div className="pool-character-group" key={type}>
                                            <h4>
                                                {type}
                                                <span className="pool-character-count">
                                                    {groupCharacters.length}
                                                </span>
                                            </h4>

                                            <div className="pool-character-list">
                                                {groupCharacters.map((character) => (
                                                    <button
                                                        className={`pool-character-chip ${character.character === selectedCharacter?.character
                                                                ? 'current'
                                                                : ''
                                                            }`}
                                                        key={`${character.character}-${character.type}`}
                                                        onClick={() => {
                                                            setMode('character')
                                                            selectCharacter(character)
                                                        }}
                                                    >
                                                        {character.character}

                                                        {character.isPrediction && (
                                                            <span>預測</span>
                                                        )}

                                                        {character.character === selectedCharacter?.character && (
                                                            <span>目前查詢</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {selectedCharacter &&
                            selectedCharacter.poolStatus === '尚未歸入' && (
                                <div className="pool-search-message">
                                    目前沒有可顯示的同期混池角色。
                                </div>
                            )}
                    </div>
                )}
        </section>
    )
}

export default PoolSearch
