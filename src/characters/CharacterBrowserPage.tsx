
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
    const [selectedCharacter, setSelectedCharacter] =
        useState<EngineCharacter | null>(null)

    const [focusCharacterId, setFocusCharacterId] =
        useState<string | null>(null)

    // 取得角色數量等共用資料
    const { metadata } = useCharacterDataset(attackType)

    const pageTitle =
        attackType === 'physical' ? '物理角色資料' : '魔法角色資料'

    const characterCount =
        attackType === 'physical'
            ? metadata?.physicalCount ?? 0
            : metadata?.magicCount ?? 0

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
        setSelectedCharacter(character)
        onDetailPageChange?.(true)
    }

    const handleBackToList = () => {
        setFocusCharacterId(selectedCharacter?.id ?? null)
        setSelectedCharacter(null)
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
