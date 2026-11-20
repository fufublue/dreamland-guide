
import type { EngineCharacter } from '../types/character'

export interface CharacterFilter {
    attackType?: 'physical' | 'magic'
    element?: string
    rarity?: string
    class?: string
    keyword?: string
}

export class CharacterDataset {
    private characters: EngineCharacter[] = []

    /**
     * 設定整份角色資料
     */
    setCharacters(characters: EngineCharacter[]): void {
        const ids = new Set<string>()

        for (const character of characters) {
            if (ids.has(character.id)) {
                throw new Error(
                    `角色 ID 重複：${character.id}`
                )
            }

            ids.add(character.id)
        }

        this.characters = [...characters]
    }

    /**
     * 取得全部角色
     */
    getAll(): EngineCharacter[] {
        return [...this.characters]
    }

    /**
     * 取得角色總數
     */
    get count(): number {
        return this.characters.length
    }

    /**
     * 依 ID 取得單一角色
     */
    getById(id: string): EngineCharacter | undefined {
        return this.characters.find(
            character => character.id === id
        )
    }

    /**
     * 依條件篩選角色
     */
    filter(filters: CharacterFilter): EngineCharacter[] {
        const keyword = filters.keyword
            ?.trim()
            .toLowerCase()

        return this.characters.filter(character => {
            if (
                filters.attackType &&
                character.attackType !== filters.attackType
            ) {
                return false
            }

            if (
                filters.element &&
                character.element !== filters.element
            ) {
                return false
            }

            if (
                filters.rarity &&
                character.rarity !== filters.rarity
            ) {
                return false
            }

            if (
                filters.class &&
                character.class !== filters.class
            ) {
                return false
            }

            if (
                keyword &&
                !character.name.toLowerCase().includes(keyword)
            ) {
                return false
            }

            return true
        })
    }

    /**
     * 依名稱搜尋角色
     */
    search(keyword: string): EngineCharacter[] {
        return this.filter({ keyword })
    }

    /**
     * 清空資料
     */
    clear(): void {
        this.characters = []
    }
}
