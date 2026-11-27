import { useState, useEffect } from 'react'

import type { EngineCharacter } from '../engine'

import CharacterListPage from './CharacterListPage'
import CharacterDetailPage from './CharacterDetailPage'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import { useCharacterDataset } from './useCharacterDataset'

interface CharacterBrowserPageProps {
    attackType: 'physical' | 'magic'
    onDetailPageChange?: (isDetailPage: boolean) => void
}

export default function CharacterBrowserPage({
    attackType,
    onDetailPageChange,
}: CharacterBrowserPageProps) {
    // 角色詳細頁的 ID 同步存在網址，讓瀏覽器上一頁／下一頁可以操作它
    const [selectedCharacterId, setSelectedCharacterId] =
        useState<string | null>(() => {
            return new URLSearchParams(window.location.search).get('character')
        })

    const [focusCharacterId, setFocusCharacterId] =
        useState<string | null>(null)

    // 取得角色資料及共用資料
    const { characters, loading, metadata } = useCharacterDataset(attackType)

    const selectedCharacter = characters.find(
        character => character.id === selectedCharacterId
    ) ?? null

    const pageTitle =
        attackType === 'physical' ? '物理角色資料' : '魔法角色資料'

    const characterCount =
        attackType === 'physical'
            ? metadata?.physicalCount ?? 0
            : metadata?.magicCount ?? 0

    // 監聽瀏覽器上一頁／下一頁，依網址還原角色列表或詳細資料
    useEffect(() => {
        function handlePopState() {
            const characterId = new URLSearchParams(
                window.location.search
            ).get('character')

            if (!characterId && selectedCharacterId) {
                setFocusCharacterId(selectedCharacterId)
            }

            setSelectedCharacterId(characterId)
            onDetailPageChange?.(Boolean(characterId))
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [selectedCharacterId, onDetailPageChange])

    // 進入詳細頁時回到最頂端
    useEffect(() => {
        if (!selectedCharacter) return

        const frame = requestAnimationFrame(() => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth',
            })
        })

        return () => cancelAnimationFrame(frame)
    }, [selectedCharacter])

    const handleSelectCharacter = (character: EngineCharacter) => {
        setFocusCharacterId(null)

        const url = new URL(window.location.href)
        url.searchParams.set('character', character.id)

        window.history.pushState(
            { characterDetail: true },
            '',
            url
        )

        setSelectedCharacterId(character.id)
        onDetailPageChange?.(true)
    }

    const handleBackToList = () => {
        // 從角色列表點進來的情況，直接退回上一筆瀏覽紀錄
        if (window.history.state?.characterDetail) {
            window.history.back()
            return
        }

        // 若使用者直接開啟／重新整理角色詳細頁，則就地回到列表網址
        const url = new URL(window.location.href)
        url.searchParams.delete('character')
        window.history.replaceState({}, '', url)

        setFocusCharacterId(selectedCharacterId)
        setSelectedCharacterId(null)
        onDetailPageChange?.(false)
    }

    return (
        <div className="character-browser">

            {/* 共用角色資料標題 */}
            <PageHeader
                icon={<Icon name={attackType === 'physical' ? 'physical-characters.svg' : 'magic-characters.svg'} />}
                title={pageTitle}
                description={`共 ${characterCount} 位角色`}
                size="large"
            />

            {/* 角色列表或詳細頁 */}
            {selectedCharacter ? (
                <CharacterDetailPage
                    character={selectedCharacter}
                    onBack={handleBackToList}
                />
            ) : selectedCharacterId && loading ? (
                <div className="character-page-message">
                    正在載入角色資料...
                </div>
            ) : (
                <CharacterListPage
                    attackType={attackType}
                    onSelectCharacter={handleSelectCharacter}
                    focusCharacterId={focusCharacterId}
                />
            )}

        </div>
    )
}
