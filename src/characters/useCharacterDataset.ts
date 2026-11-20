//共用資料載入層，讓物理角色和魔法角色使用同一份資料，不必各自向 GAS 請求，也避免重複載入

import { useEffect, useState } from 'react'

import {
    loadCharacterDataset,
    type CharacterDataResult,
} from '../engine/data/characterDataSource'

import type { EngineCharacter } from '../engine/types/character'

interface CharacterDatasetState {
    characters: EngineCharacter[]
    loading: boolean
    error: string
    metadata: Omit<CharacterDataResult, 'dataset'> | null
}

// ========================================
// 全域角色資料快取
// ========================================

// 已完成載入的資料
let cachedDataset: CharacterDataResult | null = null

// 正在執行的載入請求
let datasetPromise: Promise<CharacterDataResult> | null = null

// 取得資料：優先使用快取，避免重複請求
function getCharacterDataset(): Promise<CharacterDataResult> {
    if (cachedDataset) {
        return Promise.resolve(cachedDataset)
    }

    if (!datasetPromise) {
        datasetPromise = loadCharacterDataset()
            .then(result => {
                cachedDataset = result
                return result
            })
            .catch(error => {
                // 載入失敗時清除請求，允許下次重新載入
                datasetPromise = null
                throw error
            })
    }

    return datasetPromise
}

// 整理共用資料
function getMetadata(
    result: CharacterDataResult
): Omit<CharacterDataResult, 'dataset'> {
    return {
        physicalCount: result.physicalCount,
        magicCount: result.magicCount,
        totalCount: result.totalCount,
        warningCount: result.warningCount,
        physicalUpdatedAt: result.physicalUpdatedAt,
        magicUpdatedAt: result.magicUpdatedAt,
        talentMultiplierUpdatedAt: result.talentMultiplierUpdatedAt,
        talentMultiplierCount: result.talentMultiplierCount,
    }
}

export function useCharacterDataset(
    attackType: 'physical' | 'magic'
): CharacterDatasetState {

    // 如果資料已經載入，直接使用快取初始化
    const [characters, setCharacters] = useState<EngineCharacter[]>(() => {
        return cachedDataset
            ? cachedDataset.dataset.getAll().filter(
                character => character.attackType === attackType
            )
            : []
    })

    const [loading, setLoading] = useState(() => !cachedDataset)
    const [error, setError] = useState('')

    const [metadata, setMetadata] =
        useState<Omit<CharacterDataResult, 'dataset'> | null>(() => {
            return cachedDataset ? getMetadata(cachedDataset) : null
        })

    useEffect(() => {
        let active = true

        async function load() {
            // 已經有快取時，不需要重新等待 GAS
            if (cachedDataset) {
                const filteredCharacters = cachedDataset.dataset
                    .getAll()
                    .filter(character => character.attackType === attackType)

                setCharacters(filteredCharacters)
                setMetadata(getMetadata(cachedDataset))
                setLoading(false)
                setError('')
                return
            }

            setLoading(true)
            setError('')

            console.log('[Dataset Hook] 開始載入角色資料')

            try {
                const result = await getCharacterDataset()

                if (!active) return

                console.log(
                    '[Dataset Hook] 載入完成，第一位角色：',
                    result.dataset.getAll()[0]
                )

                console.log(
                    '[Dataset Hook] 第一位角色普攻：',
                    result.dataset.getAll()[0]?.normalAttack
                )

                const filteredCharacters = result.dataset
                    .getAll()
                    .filter(character => character.attackType === attackType)

                setCharacters(filteredCharacters)
                setMetadata(getMetadata(result))

            } catch (err) {
                if (!active) return

                console.error('[Dataset Hook] 載入失敗：', err)

                setError(
                    err instanceof Error
                        ? err.message
                        : '角色資料載入失敗。'
                )

            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        }

        load()

        return () => {
            active = false
        }
    }, [attackType])

    return {
        characters,
        loading,
        error,
        metadata,
    }
}
