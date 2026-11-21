
import { useEffect, useState } from 'react'
import {
    fetchCharacterData,
    type Character,
    type CharacterElementType,
} from '../characterData'
import {
    fetchTalentMultiplierData,
    type TalentMultiplier,
} from '../talentMultiplierData'
import {
    fetchStrengthBaseData,
    type StrengthBaseApiResponse,
} from '../strengthBaseData'
import './StrengthCalculator.css'
import {
    calculateFinalDamage,
    classifyCalculationEffects,
    getCalculationWarnings
} from '../damageCalculator'

import {
    getCalculationReviewSummary,
    parseCharacter,
    type ParsedCharacter,
} from '../characterEffectParser'

type CalculatorSettings = {
    rarity: string
    element: string
    weapon: string
    type: string
    skillRange: string
    role: string
    skillLevel: string
    talentLevel: number
    teammateTalentNode: number
    enemyCount: number
    allyCount: number
    hpMechanic: boolean
    characterHpPercent: number
    calculationMethod: string
    ultimateUses: number
    battleDuration: number
    teammate: string
    teammateTrait: string
    healingTrait: boolean
    damageMarker: number
    healingMarker: number
}

const defaultSettings: CalculatorSettings = {
    rarity: '全部',
    element: '火',
    weapon: '彩武',
    type: '不分類',
    skillRange: '不分類',
    role: '不區分',
    skillLevel: '標準',
    talentLevel: 5,
    teammateTalentNode: 0,
    enemyCount: 1.5,
    allyCount: 3,
    hpMechanic: true,
    characterHpPercent: 100,
    calculationMethod: '持久（最大值）',
    ultimateUses: 2,
    battleDuration: 50,
    teammate: 'UR書',
    teammateTrait: '純通用特性',
    healingTrait: false,
    damageMarker: 5,
    healingMarker: 3,
}

type SelectOption = string | {
    label: string
    value: string
}

type SelectFieldProps = {
    label: string
    value: string
    options: SelectOption[]
    onChange: (value: string) => void
}

function SelectField({
    label,
    value,
    options,
    onChange,
}: SelectFieldProps) {
    return (
        <label className="strength-field">
            <span>{label}</span>
            <select
                value={value}
                onChange={event => onChange(event.target.value)}
            >
                {options.map(option => {
                    const optionValue =
                        typeof option === 'string'
                            ? option
                            : option.value

                    const optionLabel =
                        typeof option === 'string'
                            ? option
                            : option.label

                    return (
                        <option key={optionValue} value={optionValue}>
                            {optionLabel}
                        </option>
                    )
                })}
            </select>
        </label>
    )
}

type NumberFieldProps = {
    label: string
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    step?: number
    suffix?: string
}

function NumberField({
    label,
    value,
    onChange,
    min = 0,
    max,
    step = 1,
    suffix,
}: NumberFieldProps) {
    return (
        <label className="strength-field">
            <span>{label}</span>
            <div className="strength-number-input">
                <input
                    type="number"
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={event => {
                        const nextValue = event.target.value
                        if (nextValue === '') return
                        onChange(Number(nextValue))
                    }}
                />
                {suffix && <span>{suffix}</span>}
            </div>
        </label>
    )
}

type ToggleFieldProps = {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
}

function ToggleField({
    label,
    checked,
    onChange,
}: ToggleFieldProps) {
    return (
        <label className="strength-toggle">
            <input
                type="checkbox"
                checked={checked}
                onChange={event => onChange(event.target.checked)}
            />
            <span>{label}</span>
        </label>
    )
}

export default function StrengthCalculator() {
    const [physicalCharacters, setPhysicalCharacters] = useState<Character[]>([])
    const [magicCharacters, setMagicCharacters] = useState<Character[]>([])
    const [parsedCharacters, setParsedCharacters] = useState<ParsedCharacter[]>([])
    const [talentMultipliers, setTalentMultipliers] = useState<TalentMultiplier[]>([])
    const [strengthBase, setStrengthBase] = useState<StrengthBaseApiResponse | null>(null)
    type ParsedBreakthroughTrait = {
        type: 'elementalDamage' | 'physicalDamage' | 'magicDamage' | 'healing'
        element?: string
        value: number
    }

    function parseBreakthroughTrait(trait: string): ParsedBreakthroughTrait[] {
        const results: ParsedBreakthroughTrait[] = []

        const parts = trait.split(/[&＆]/)

        for (const part of parts) {
            const text = part.trim()
            const match = text.match(/(水|火|風|地|雷|光|暗)?(傷|治癒)\+(\d+(?:\.\d+)?)%/)

            if (!match) continue

            const element = match[1]
            const category = match[2]
            const value = Number(match[3])

            if (category === '治癒') {
                results.push({
                    type: 'healing',
                    value,
                })
            } else if (element) {
                results.push({
                    type: 'elementalDamage',
                    element,
                    value,
                })
            } else if (text.startsWith('物傷')) {
                results.push({
                    type: 'physicalDamage',
                    value,
                })
            } else if (text.startsWith('法傷')) {
                results.push({
                    type: 'magicDamage',
                    value,
                })
            }
        }

        return results
    }
    function getCharacterBaseStat(character: Character) {
        if (!strengthBase) return undefined

        return strengthBase.generalStats.find(
            stat =>
                stat.rarity === character.rarity &&
                stat.class === character.class
        )
    }
    

    // 取得目前掛件可選擇的天賦節點
    function getTeammateTalentNodes() {
        if (!strengthBase) return []

        const match = settings.teammate.match(
            /^(UR|SSR|SR)(拳|鞋|書|物杖|魔杖|盾)$/
        )

        if (!match) return []

        const [, rarity, characterClass] = match

        const talentData = strengthBase.talentNodeBonuses.find(
            item =>
                item.rarity === rarity &&
                item.class === characterClass
        )

        if (!talentData) return []

        return talentData.nodes.filter(
            node =>
                !node.includedInBase &&
                node.node !== 18 &&
                node.stat !== null
        )
    }

    // 計算隊友已解鎖的天賦節點效果
    // 計算隊友已解鎖的天賦節點效果
    function getTeammateTalentBonus() {
        if (!strengthBase) return {}

        const nodes = getTeammateTalentNodes()
        const selectedNode = settings.teammateTalentNode

        const unlockedNodes = nodes.filter(
            node => node.node <= selectedNode
        )

        const bonus: Record<string, { flat: number; percent: number }> = {}

        unlockedNodes.forEach(node => {
            if (
                node.includedInBase ||
                node.effectType !== 'stat' ||
                !node.stat ||
                node.value === null
            ) {
                return
            }

            if (!bonus[node.stat]) {
                bonus[node.stat] = {
                    flat: 0,
                    percent: 0,
                }
            }

            if (node.unit === 'flat') {
                bonus[node.stat].flat += node.value
            } else if (node.unit === 'percent') {
                bonus[node.stat].percent += node.value
            }
        })

        return bonus
    }
    // 天賦節點的簡化顯示名稱
    function getTalentNodeHint(node: number): string {
        const hints: Record<number, string> = {
            1: '防禦',
            2: '生命',
            3: '攻擊',
            4: '爆傷抵抗',
            5: '速度',
            7: '爆擊',
            8: '異常抵抗',
            10: '剋屬抵抗',
            11: '爆擊抵抗',
            13: '爆傷',
            14: '攻擊',
            16: '防禦',
            17: '屬性強化',
        }

        return hints[node] ?? '效果'
    }
    //武器加成資料
    function getCharacterWeaponBonus(character: Character) {
        if (!strengthBase) return undefined

        const classBonus = strengthBase.weaponBonuses.byClass.find(
            item => item.class === character.class
        )

        if (!classBonus) return undefined

        const weapon = settings.weapon === '彩武'
            ? classBonus.rainbow
            : classBonus.gold

        return {
            physicalAttack:
                character.attackType === 'physical' ? weapon.attack : 0,

            magicAttack:
                character.attackType === 'magic' ? weapon.attack : 0,

            healing: weapon.healing,
            speed: weapon.speed,
            physicalDefense: weapon.physicalDefense,
            magicDefense: weapon.magicDefense,
            criticalRate: weapon.criticalRate,
            damageBonus: weapon.damageBonus,
        }
    }
    function getCharacterBreakthroughBonus(character: Character) {
        const traits = parseBreakthroughTrait(
            character.maxBreakthroughTrait || ''
        )

        return {
            elementalDamage: traits
                .filter(
                    trait =>
                        trait.type === 'elementalDamage' &&
                        trait.element === character.element
                )
                .reduce((total, trait) => total + trait.value / 100, 0),

            physicalDamage: traits
                .filter(trait => trait.type === 'physicalDamage')
                .reduce((total, trait) => total + trait.value / 100, 0),

            magicDamage: traits
                .filter(trait => trait.type === 'magicDamage')
                .reduce((total, trait) => total + trait.value / 100, 0),

            healing: traits
                .filter(trait => trait.type === 'healing')
                .reduce((total, trait) => total + trait.value / 100, 0),
        }
    }
    function getCharacterTotalTraitBonus(character: Character) {
        const characterBonus = getCharacterBreakthroughBonus(character)
        const teammateBonus = getHangingTraitBonus() ?? 0

        return {
            elementalDamage:
                characterBonus.elementalDamage +
                (settings.healingTrait ? 0 : teammateBonus),

            physicalDamage:
                characterBonus.physicalDamage +
                (settings.healingTrait ? 0 : teammateBonus),

            magicDamage:
                characterBonus.magicDamage +
                (settings.healingTrait ? 0 : teammateBonus),

            healing:
                characterBonus.healing +
                (settings.healingTrait ? teammateBonus : 0),
        }
    }
    function getHangingTraitBonus() {
        if (!strengthBase) return undefined

        const teammateRarity = settings.teammate.startsWith('UR')
            ? 'UR'
            : settings.teammate.startsWith('SSR')
                ? 'SSR'
                : 'SR'

        const traitType = settings.teammateTrait.replace('特性', '')

        const trait = strengthBase.hangingTraitBonuses.find(
            item => item.type === traitType
        )

        if (!trait) return undefined

        return trait[teammateRarity]
    }

    function getTeammateBaseStat() {
        if (!strengthBase) return undefined

        const match = settings.teammate.match(
            /^(UR|SSR|SR)(拳|鞋|書|物杖|魔杖|盾)$/
        )

        if (!match) return undefined

        const rarity = match[1]
        const characterClass = match[2]

        return strengthBase.generalStats.find(
            stat =>
                stat.rarity === rarity &&
                stat.class === characterClass
        )
    }
    //掛件加成
    function getTeammateBonus() {
        const stat = getTeammateBaseStat()

        if (!stat) return undefined

        const talent = getTeammateTalentBonus()

        const flat = (name: string) => talent[name]?.flat ?? 0
        const percent = (name: string) => talent[name]?.percent ?? 0

        return {
            physicalAttack: Math.floor(
                (stat.physicalAttack + flat('物攻')) * 0.6
            ),

            magicAttack: Math.floor(
                (stat.magicAttack + flat('魔攻')) * 0.6
            ),

            healing: Math.floor(
                (stat.healing + flat('治癒')) * 0.6
            ),

            health: Math.floor(flat('生命') * 0.6),

            physicalDefense: Math.floor(flat('物防') * 0.6),

            magicDefense: Math.floor(flat('魔防') * 0.6),

            counterElementResistance:
                stat.counterElementResistance +
                percent('剋屬抵抗'),

            attributeBoost: percent('屬性強化'),
            damageBonus: percent('傷害加成'),
            attributeResistance: percent('屬性抗性'),
            abnormalResistance: percent('異常抵抗'),
            criticalDamageResistance: percent('爆傷抵抗'),
            criticalResistance: percent('爆擊抵抗'),
        }
    }
    //隊友加成真正接入角色最終能力值
    function getCharacterFinalStats(character: Character) {
        const base = getCharacterBaseStat(character)

        if (!base) return undefined

        const weapon = getCharacterWeaponBonus(character)
        const teammate = getTeammateBonus()

        return {
            health:
                teammate?.health ?? 0,

            physicalAttack:
                base.physicalAttack +
                (weapon?.physicalAttack ?? 0) +
                (teammate?.physicalAttack ?? 0),

            magicAttack:
                base.magicAttack +
                (weapon?.magicAttack ?? 0) +
                (teammate?.magicAttack ?? 0),

            healing:
                base.healing +
                (weapon?.healing ?? 0) +
                (teammate?.healing ?? 0),

            speed:
                base.speed +
                (weapon?.speed ?? 0),

            criticalRate:
                base.criticalRate +
                (weapon?.criticalRate ?? 0),

            criticalDamage:
                base.criticalDamage ,

            physicalDefense:
                (weapon?.physicalDefense ?? 0) +
                (teammate?.physicalDefense ?? 0),

            magicDefense:
                (weapon?.magicDefense ?? 0) +
                (teammate?.magicDefense ?? 0),

            damageBonus:
                (weapon?.damageBonus ?? 0) +
                (teammate?.damageBonus ?? 0),

            attributeBoost:
                teammate?.attributeBoost ?? 0,

            attributeResistance:
                teammate?.attributeResistance ?? 0,

            abnormalResistance:
                teammate?.abnormalResistance ?? 0,

            criticalDamageResistance:
                teammate?.criticalDamageResistance ?? 0,

            criticalResistance:
                teammate?.criticalResistance ?? 0,

            counterElementResistance:
                base.counterElementResistance +
                (teammate?.counterElementResistance ?? 0),
        }
    }

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [calculationReviewSummary, setCalculationReviewSummary] =
        useState<ReturnType<typeof getCalculationReviewSummary> | null>(null)

    const [settings, setSettings] = useState<CalculatorSettings>(defaultSettings)

    // 先依照角色基本條件篩選
    const basicFilteredCharacters = [
        ...physicalCharacters,
        ...magicCharacters,
    ].filter(character => {
        if (
            settings.rarity !== '全部' &&
            character.rarity !== settings.rarity
        ) {
            return false
        }

        if (character.element !== settings.element) {
            return false
        }

        if (
            settings.type === '物理' &&
            character.attackType !== 'physical'
        ) {
            return false
        }

        if (
            settings.type === '魔法' &&
            character.attackType !== 'magic'
        ) {
            return false
        }

        return true
    })

    // 將篩選後的角色與已解析技能資料配對
    const charactersWithParsedData = basicFilteredCharacters.map(character => ({
        character,
        parsed: parsedCharacters.find(
            item => item.characterId === character.id
        ) ?? null,
        finalStats: getCharacterFinalStats(character),
    }))



    // 依照技能等級與天賦等級取得技能資料
    const charactersWithSkills = charactersWithParsedData.map(item => {
        if (!item.parsed) {
            return {
                ...item,
                selectedSkills: [],
            }
        }

        const selectedSkills = item.parsed.skills.map(skill => {
            const useMaxSkill = settings.skillLevel === '最大'

            // 各技能對應的天賦等級
            const talentLevelRequired =
                skill.skillName === 'skill1' ? 9 :
                    skill.skillName === 'skill2' ? 12 :
                        skill.skillName === 'ultimate' ? 15 :
                            null

            const hasTalent =
                talentLevelRequired !== null &&
                settings.talentLevel >= talentLevelRequired

            // 原始技能資料
            const originalLevel = useMaxSkill
                ? skill.max
                : skill.initial

            // 依照天賦等級選擇目前生效的技能資料
            const selectedLevel = hasTalent
                ? (useMaxSkill ? skill.talentMax : skill.talentInitial)
                : originalLevel

            // 目前技能中的天賦效果
            const talentEffects = selectedLevel.effects.filter(
                effect => effect.source === 'talent'
            )

            // 收集技能與天賦的所有結構化計算效果
            const calculations = selectedLevel.effects.flatMap(effect => {
                const effectCalculations =
                    effect.calculations ??
                    (effect.calculation ? [effect.calculation] : [])

                return effectCalculations.map(calculation => ({
                    ...calculation,
                    source: effect.source,
                    originalText: effect.originalText,

                    // 保留原始技能效果的目標資訊
                    targetSide: effect.targetSide,
                    target: effect.target,
                }))
            })

            const originalCoefficient =
                originalLevel.coefficientPercent ?? 0

            const selectedCoefficient =
                selectedLevel.coefficientPercent ?? 0

            return {
                skillName: skill.skillName,

                // 原始資料（供收合區使用）
                originalLevel,
                originalCoefficient,
                originalEffects: originalLevel.effects,

                // 目前生效資料
                selectedLevel,
                coefficient: selectedCoefficient,
                effects: selectedLevel.effects,

                // 天賦資訊
                hasTalent,
                talentLevelRequired,
                talentEffects,
                calculations,

                // 倍率是否受到天賦影響
                coefficientChanged:
                    hasTalent &&
                    originalCoefficient !== selectedCoefficient,
            }
        })

        return {
            ...item,
            selectedSkills,
        }
    })



    // 依照必殺技範圍與定位篩選
    const filteredCharactersWithSkills = charactersWithSkills.filter(item => {
        const ultimate = item.selectedSkills.find(
            skill => skill.skillName === 'ultimate'
        )

        if (!ultimate) return false
        // 直接依照原始角色資料的必殺技類型判斷定位
        const ultimateType = item.character.ultimate.type

        const hasDamage = ultimateType.includes('攻擊')
        const hasHealing = ultimateType.includes('回血')

        // 角色定位：傷害優先，傷害＋回血仍歸類為攻擊
        if (settings.role === '攻擊' && !hasDamage) {
            return false
        }

        if (settings.role === '回血' && (hasDamage || !hasHealing)) {
            return false
        }  
        if (
            settings.skillRange === '全體' &&
            !ultimateType.includes('全體')
        ) {
            return false
        }

        if (
            settings.skillRange === '單體' &&
            !ultimateType.includes('單體')
        ) {
            return false
        }

        return true
    })


    const damageResults = filteredCharactersWithSkills.map(item => {
        const attack =
            item.character.attackType === 'physical'
                ? item.finalStats?.physicalAttack ?? 0
                : item.finalStats?.magicAttack ?? 0

        // 角色突破特性
        const breakthroughTraits = parseBreakthroughTrait(
            item.character.maxBreakthroughTrait || ''
        ).map(trait => {
            const typeName =
                trait.type === 'elementalDamage' ? `${trait.element}屬性傷害` :
                    trait.type === 'physicalDamage' ? '物理傷害' :
                        trait.type === 'magicDamage' ? '魔法傷害' :
                            '治癒'

            const isElementMatched =
                trait.type !== 'elementalDamage' ||
                trait.element === item.character.element

            const isAttackTypeMatched =
                (
                    trait.type === 'physicalDamage' &&
                    item.character.attackType === 'physical'
                ) ||
                (
                    trait.type === 'magicDamage' &&
                    item.character.attackType === 'magic'
                )

            return {
                ...trait,
                typeName,
                isElementMatched,
                isAttackTypeMatched,
                isActive:
                    trait.type === 'elementalDamage'
                        ? isElementMatched
                        : trait.type === 'physicalDamage' ||
                            trait.type === 'magicDamage'
                            ? isAttackTypeMatched
                            : false,
            }
        })

        // 掛件特性
        const hangingTraitValue = getHangingTraitBonus() ?? 0

        const hangingTrait = settings.teammateTrait
            ? {
                name: settings.teammateTrait,
                value: hangingTraitValue * 100,
                target: settings.healingTrait ? '治癒' : '傷害',
                isActive: hangingTraitValue > 0,
            }
            : null

        // 每個技能的傷害計算
        const damageSkills = item.selectedSkills.map(skill => {
            // 分類技能及天賦效果
            const calculationEffects = classifyCalculationEffects(
                skill.calculations ?? []
            )
            // 判斷目前生命值是否符合條件增傷
            const activeConditionalEffects =
                settings.hpMechanic
                    ? calculationEffects.conditionalDamages.filter(effect => {
                        if (!effect.condition) return false

                        if (effect.condition.type === 'hp') {
                            return (
                                settings.characterHpPercent >=
                                effect.condition.thresholdPercent
                            )
                        }

                        return false
                    })
                    : []

            // 有指定實際技能倍率時，使用條件成立後的倍率
            const conditionalCoefficient =
                activeConditionalEffects.find(
                    effect => effect.effectiveCoefficientPercent !== undefined
                )?.effectiveCoefficientPercent

            // 沒有指定實際技能倍率時，才將條件增傷加入傷害加成
            const conditionalDamageBonus =
                activeConditionalEffects
                    .filter(
                        effect => effect.effectiveCoefficientPercent === undefined
                    )
                    .reduce(
                        (total, effect) =>
                            total + (effect.damageBonusPercent ?? 0),
                        0
                    )

            // 判斷效果是否符合角色的攻擊類型
            const matchesAttackType = (stat?: string) => {
                return item.character.attackType === 'physical'
                    ? stat === 'physicalAttack' || stat === 'dualAttack'
                    : stat === 'magicAttack' || stat === 'dualAttack'
            }

            // 判斷防禦降低是否符合角色的攻擊類型
            const matchesDefenseType = (stat?: string) => {
                return item.character.attackType === 'physical'
                    ? stat === 'physicalDefense' || stat === 'dualDefense'
                    : stat === 'magicDefense' || stat === 'dualDefense'
            }

            // 自身攻擊提升
            const attackBonusPercent =
                calculationEffects.attackBuffs
                    .filter(effect =>
                        effect.targetSide === 'self' &&
                        matchesAttackType(effect.attackStat)
                    )
                    .reduce(
                        (total, effect) =>
                            total + (effect.attackBonus ?? 0),
                        0
                    )

            // 自身攻擊降低
            const attackReductionPercent =
                calculationEffects.attackDebuffs
                    .filter(effect =>
                        effect.targetSide === 'self' &&
                        matchesAttackType(effect.attackStat)
                    )
                    .reduce(
                        (total, effect) =>
                            total + (effect.attackReductionPercent ?? 0),
                        0
                    )

            // 對敵人的防禦降低
            const defenseReductionPercent =
                calculationEffects.defenseDebuffs
                    .filter(effect =>
                        effect.targetSide === 'enemy' &&
                        matchesDefenseType(effect.defenseStat)
                    )
                    .reduce(
                        (total, effect) =>
                            total + (effect.defenseReductionPercent ?? 0),
                        0
                    )

            // 攻擊降低後的實際攻擊力
            const effectiveAttack =
                attack * Math.max(
                    0,
                    1 - Math.min(attackReductionPercent, 100) / 100
                )


            // 一般傷害加成
            const skillDamageBonus =
                calculationEffects.damageBuffs.reduce(
                    (total, effect) =>
                        total + (effect.damageBonusPercent ?? 0),
                    0
                )

            // 符合角色屬性的屬性傷害加成
            const skillElementalBonus =
                calculationEffects.elementalDamageBuffs.reduce(
                    (total, effect) =>
                        total +
                        (
                            effect.element === item.character.element
                                ? effect.damageBonusPercent ?? 0
                                : 0
                        ),
                    0
                )

            // 角色突破特性加成
            const characterTraitBonus =
                breakthroughTraits
                    .filter(trait => trait.isActive)
                    .reduce(
                        (total, trait) => total + trait.value,
                        0
                    )

            // 掛件傷害加成
            const hangingDamageBonus =
                hangingTrait?.isActive &&
                    hangingTrait.target === '傷害'
                    ? hangingTrait.value
                    : 0

            // 武器及隊友傷害加成
            // finalStats.damageBonus 已包含兩者
            // 武器及隊友傷害加成：原始資料為小數，轉成百分數
            const baseDamageBonus =
                (item.finalStats?.damageBonus ?? 0) * 100

            // 合計目前能直接確認的傷害加成
            const totalDamageBonus =
                baseDamageBonus +
                characterTraitBonus +
                hangingDamageBonus +
                skillDamageBonus +
                skillElementalBonus +
                conditionalDamageBonus

            // 非暴擊傷害
            const normalDamage = calculateFinalDamage(
                effectiveAttack,
                conditionalCoefficient ?? skill.coefficient,
                attackBonusPercent,
                defenseReductionPercent,
                totalDamageBonus + conditionalDamageBonus,
                item.finalStats?.criticalDamage ?? 0,
                false
            )

            // 暴擊傷害
            const criticalDamage = calculateFinalDamage(
                effectiveAttack,
                conditionalCoefficient ?? skill.coefficient,
                attackBonusPercent,
                defenseReductionPercent,
                totalDamageBonus + conditionalDamageBonus,
                (item.finalStats?.criticalDamage ?? 2.2) * 100,
                true
            )

            // 暴擊率（JSON 使用小數格式，例如 0.1 = 10%）
            const criticalRate = Math.min(
                Math.max(item.finalStats?.criticalRate ?? 0, 0),
                1
            )

            // 平均期望傷害
            const expectedDamage =
                normalDamage * (1 - criticalRate) +
                criticalDamage * criticalRate

            return {
                ...skill,
                damage: expectedDamage,
                normalDamage,
                criticalDamage,
                expectedDamage,
                criticalRate,
                calculationEffects,
                totalDamageBonus,
                pendingConditionalEffects:
                    calculationEffects.conditionalDamages,
                pendingAttackEffects: [
                    ...calculationEffects.attackBuffs,
                    ...calculationEffects.attackDebuffs,
                ],
                pendingDefenseEffects: [
                    ...calculationEffects.defenseDebuffs,
                    ...calculationEffects.defenseBuffs,
                ],
            }
        })

        // 角色與掛件合併後的特性加成
        const totalTraitBonus = getCharacterTotalTraitBonus(
            item.character
        )

        return {
            characterId: item.character.id,
            characterName: item.character.name,
            attack,
            damageSkills,
            breakthroughTraits,
            hangingTrait,
            totalTraitBonus,
            warnings: item.parsed
                ? getCalculationWarnings(item.parsed)
                : ['找不到角色技能解析資料'],
        }
    })






    function updateSetting<K extends keyof CalculatorSettings>(
        key: K,
        value: CalculatorSettings[K]
    ) {
        setSettings(previous => ({
            ...previous,
            [key]: value,
        }))
    }

    useEffect(() => {
        let cancelled = false

        async function loadData() {
            try {
                setLoading(true)
                setError('')

                const [
                    physicalData,
                    magicData,
                    talentData,
                    baseData,
                ] = await Promise.all([
                    fetchCharacterData('physical' as CharacterElementType),
                    fetchCharacterData('magic' as CharacterElementType),
                    fetchTalentMultiplierData(),
                    fetchStrengthBaseData(),
                ])

                if (cancelled) return

                const physicalCharactersWithType = physicalData.characters.map(
                    character => ({
                        ...character,
                        attackType: 'physical' as const,
                    })
                )

                const magicCharactersWithType = magicData.characters.map(
                    character => ({
                        ...character,
                        attackType: 'magic' as const,
                    })
                )

                setPhysicalCharacters(physicalCharactersWithType)
                setMagicCharacters(magicCharactersWithType)
                setTalentMultipliers(talentData.talentMultipliers)
                setStrengthBase(baseData)

                // 解析全部角色的技能與天賦效果
                const allCharacters = [
                    ...physicalCharactersWithType,
                    ...magicCharactersWithType,
                ]

                setParsedCharacters(
                    allCharacters.map(character => parseCharacter(character))
                )
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : '資料讀取失敗，請稍後再試。'
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

    useEffect(() => {
        if (
            physicalCharacters.length === 0 &&
            magicCharacters.length === 0
        ) {
            return
        }

        const summary = getCalculationReviewSummary([
            ...physicalCharacters,
            ...magicCharacters,
        ])

        setCalculationReviewSummary(summary)
    }, [physicalCharacters, magicCharacters])

    useEffect(() => {
        if (!strengthBase) return

        const allCharacters = [
            ...physicalCharacters,
            ...magicCharacters,
        ]

        if (allCharacters.length === 0) return

        const matched = allCharacters.filter(
            character => getCharacterBaseStat(character)
        )

        const unmatched = allCharacters.filter(
            character => !getCharacterBaseStat(character)
        )
    
        console.log('角色基礎能力對應檢查', {
            總角色數: allCharacters.length,
            成功對應: matched.length,
            無法對應: unmatched.map(character => ({
                name: character.name,
                rarity: character.rarity,
                class: character.class,
            })),
        })
        console.log(
            '角色最終能力測試',
            allCharacters
                .filter(character => character.rarity !== 'R')
                .slice(0, 10)
                .map(character => ({
                    name: character.name,
                    attackType: character.attackType,
                    base: getCharacterBaseStat(character),
                    weapon: getCharacterWeaponBonus(character),
                    teammate: getTeammateBonus(),
                    final: getCharacterFinalStats(character),
                }))
        )
        console.log(
            '天賦節點完整資料',
            JSON.stringify(
                strengthBase.talentNodeBonuses.find(
                    item => item.rarity === 'UR' && item.class === '拳'
                ),
                null,
                2
            )
        )

    }, [
        strengthBase,
        physicalCharacters,
        magicCharacters,
        settings.healingTrait,
        settings.teammateTrait,
        settings.teammate,
        settings.weapon,
        settings.teammate,
    ])

    if (loading) {
        return (
            <div className="strength-calculator">
                <h2>強度計算</h2>
                <p>正在讀取角色與計算基準資料……</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="strength-calculator">
                <h2>強度計算</h2>
                <p>資料讀取失敗：{error}</p>
                <button onClick={() => window.location.reload()}>
                    重新載入
                </button>
            </div>
        )
    }

    return (
        <div className="strength-calculator">
            <div className="strength-page-heading">
                <h2>強度計算</h2>
                <p>依照角色培養與配置計算能力數值。</p>
            </div>

            {/* ① 角色篩選 */}
            <section className="strength-section">
                <div className="strength-section-heading">
                    <div>
                        <h3>① 角色篩選</h3>
                        <p>選擇要納入比較的角色條件。</p>
                    </div>
                </div>

                <div className="strength-fields-grid">
                    <SelectField
                        label="稀有度"
                        value={settings.rarity}
                        options={['全部', 'UR', 'SSR', 'SR']}
                        onChange={value => updateSetting('rarity', value)}
                    />
                    <SelectField
                        label="屬性"
                        value={settings.element}
                        options={['水', '火', '風', '地', '雷', '光', '暗']}
                        onChange={value => updateSetting('element', value)}
                    />
                    <SelectField
                        label="武器"
                        value={settings.weapon}
                        options={['彩武', '金武']}
                        onChange={value => updateSetting('weapon', value)}
                    />
                    <SelectField
                        label="攻擊類型"
                        value={settings.type}
                        options={['不分類', '物理', '魔法']}
                        onChange={value => updateSetting('type', value)}
                    />
                </div>
            </section>

            {/* ② 計算設定 */}
            <section className="strength-section">
                <div className="strength-section-heading">
                    <div>
                        <h3>② 計算設定</h3>
                        <p>調整技能、戰鬥條件與輔助配置。</p>
                    </div>
                </div>

                <div className="strength-setting-group">
                    <h4>技能條件</h4>
                    <div className="strength-fields-grid">
                        <SelectField
                            label="技能範圍"
                            value={settings.skillRange}
                            options={['不分類', '全體', '單體']}
                            onChange={value => updateSetting('skillRange', value)}
                        />
                        <SelectField
                            label="角色定位"
                            value={settings.role}
                            options={['不區分', '攻擊', '回血']}
                            onChange={value => updateSetting('role', value)}
                        />
                        <SelectField
                            label="技能等級"
                            value={settings.skillLevel}
                            options={['標準', '最大']}
                            onChange={value => updateSetting('skillLevel', value)}
                        />
                        <SelectField
                            label="天賦等級"
                            value={String(settings.talentLevel)}
                            options={['5', '6', '9', '12', '15']}
                            onChange={value => updateSetting('talentLevel', Number(value))}
                        />
                    </div>
                </div>

                <div className="strength-setting-group">
                    <h4>戰鬥條件</h4>
                    <div className="strength-fields-grid">
                        <NumberField
                            label="敵方數量"
                            value={settings.enemyCount}
                            step={0.5}
                            onChange={value => updateSetting('enemyCount', value)}
                        />
                        <NumberField
                            label="我方數量"
                            value={settings.allyCount}
                            onChange={value => updateSetting('allyCount', value)}
                        />
                        <SelectField
                            label="計算方式"
                            value={settings.calculationMethod}
                            options={['爆發', '持久（最大值）']}
                            onChange={value => updateSetting('calculationMethod', value)}
                        />
                        <NumberField
                            label="大招使用次數"
                            value={settings.ultimateUses}
                            onChange={value => updateSetting('ultimateUses', value)}
                        />
                        <NumberField
                            label="戰鬥時間"
                            value={settings.battleDuration}
                            suffix="秒"
                            onChange={value => updateSetting('battleDuration', value)}
                        />
                    </div>
                </div>


                <div className="strength-setting-group">
                    <h4>特殊機制</h4>

                    <div className="strength-toggle-list">
                        <ToggleField
                            label="啟用 HP 條件倍率"
                            checked={settings.hpMechanic}
                            onChange={value => updateSetting('hpMechanic', value)}
                        />
                        <NumberField
                            label="角色目前生命值"
                            value={settings.characterHpPercent}
                            onChange={value => updateSetting('characterHpPercent', value)}
                            min={0}
                            max={100}
                            step={1}
                            suffix="%"
                        />
                    </div>
                </div>


                <div className="strength-setting-group">
                    <h4>隊友輔助</h4>
                    <div className="strength-fields-grid">
                        <SelectField
                            label="輔助隊友"
                            value={settings.teammate}
                            options={['UR書', 'UR拳', 'UR鞋', 'UR物杖', 'UR魔杖', 'UR盾', 'SSR書', 'SSR拳', 'SSR鞋', 'SSR物杖', 'SSR魔杖', 'SSR盾']}
                            onChange={value => updateSetting('teammate', value)}
                        />
                        <SelectField
                            label="隊友特性"
                            value={settings.teammateTrait}
                            options={['相同特性', '純通用特性', '半通用特性', '完全通用特性', '不同特性']}
                            onChange={value => updateSetting('teammateTrait', value)}
                        />
                        <SelectField
                            label="隊友天賦"
                            value={String(settings.teammateTalentNode)}
                            options={[
                                { label: '未解鎖', value: '0' },
                                ...getTeammateTalentNodes().map(node => ({
                                    label: `節點${node.node}（+${getTalentNodeHint(node.node)}）`,
                                    value: String(node.node),
                                })),
                            ]}
                            onChange={value => updateSetting('teammateTalentNode', Number(value))}
                        />
                    </div>

                    <div className="strength-toggle-list">
                        <ToggleField
                            label="隊友使用治療特性"
                            checked={settings.healingTrait}
                            onChange={value => updateSetting('healingTrait', value)}
                        />
                    </div>
                </div>

                <div className="strength-setting-group">
                    <h4>排名標記</h4>
                    <div className="strength-fields-grid">
                        <NumberField
                            label="傷害排名標記前幾名"
                            value={settings.damageMarker}
                            min={1}
                            onChange={value => updateSetting('damageMarker', value)}
                        />
                        <NumberField
                            label="治療排名標記前幾名"
                            value={settings.healingMarker}
                            min={1}
                            onChange={value => updateSetting('healingMarker', value)}
                        />
                    </div>
                </div>
            </section>

            {/* ③ 計算結果 */}
            <section className="strength-section">
                <div className="strength-section-heading">
                    <div>
                        <h3>③ 計算結果</h3>
                        <p>依照目前選擇的條件呈現角色能力。</p>
                    </div>
                </div>
                <div className="strength-result-list">
                    {damageResults.map(result => (
                        <div
                            className="strength-result-card"
                            key={result.characterId}
                        >
                            <strong>{result.characterName}</strong>

                            {result.damageSkills.map(skill => {
                                const skillName =
                                    skill.skillName === 'ultimate'
                                        ? '必殺技'
                                        : skill.skillName === 'skill2'
                                            ? '2 技能'
                                            : '1 技能'

                                const hasTalentChanges =
                                    skill.hasTalent &&
                                    (
                                        skill.coefficientChanged ||
                                        skill.talentEffects.length > 0
                                    )

                                return (
                                    <div
                                        className="strength-skill-result"
                                        key={skill.skillName}
                                    >
                                        <div className="strength-skill-heading">
                                            <strong>{skillName}</strong>

                                            {hasTalentChanges && (
                                                <span className="strength-talent-label">
                                                    天賦 {skill.talentLevelRequired}
                                                </span>
                                            )}
                                        </div>

                                        <div className="strength-skill-numbers">
                                            <span>
                                                普通傷害：
                                                {skill.normalDamage.toLocaleString('zh-TW', {
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>

                                            <span>
                                                暴擊傷害：
                                                {skill.criticalDamage.toLocaleString('zh-TW', {
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>

                                            <span>
                                                暴擊率：
                                                {(skill.criticalRate * 100).toLocaleString('zh-TW', {
                                                    maximumFractionDigits: 2,
                                                })}%
                                            </span>

                                            <span>
                                                期望傷害：
                                                {skill.expectedDamage.toLocaleString('zh-TW', {
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>

                                            <span>
                                                倍率：
                                                {skill.coefficient}%
                                            </span>
                                        </div>

                                        {skill.coefficientChanged && (
                                            <div className="strength-talent-change">
                                                原始倍率 {skill.originalCoefficient}%
                                                {' → '}
                                                {skill.coefficient}%
                                                <span>
                                                    （天賦 {skill.talentLevelRequired}）
                                                </span>
                                            </div>
                                        )}

                                        {skill.effects.length > 0 && (
                                            <div className="strength-skill-effects">
                                                {skill.effects.map((effect, index) => (
                                                    <div key={index}>
                                                        {effect.originalText}

                                                        {effect.source === 'talent' && (
                                                            <span className="strength-talent-label">
                                                                天賦 {skill.talentLevelRequired}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {hasTalentChanges && (
                                            <details className="strength-original-details">
                                                <summary>查看原始技能效果</summary>

                                                <div>
                                                    原始倍率：{skill.originalCoefficient}%
                                                </div>

                                                {skill.originalEffects.length > 0 && (
                                                    <div>
                                                        {skill.originalEffects.map((effect, index) => (
                                                            <div key={index}>
                                                                {effect.originalText}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </details>
                                        )}
                                    </div>
                                )
                            })}

                            {result.warnings.length > 0 && (
                                <div>
                                    {result.warnings.map((warning, index) => (
                                        <div key={index}>{warning}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>


            </section>

            {/* ④ 角色排名 */}
            <section className="strength-section">
                <div className="strength-section-heading">
                    <div>
                        <h3>④ 角色排名</h3>
                        <p>依照目前篩選條件排列角色。</p>
                    </div>
                </div>

                <div className="strength-ranking-grid">
                    <div className="strength-ranking-card">
                        <h4>傷害排名</h4>
                        <p>計算公式完成後，將在此顯示角色排名。</p>
                    </div>
                    <div className="strength-ranking-card">
                        <h4>治療排名</h4>
                        <p>計算公式完成後，將在此顯示角色排名。</p>
                    </div>
                </div>
            </section>

            <section className="strength-section">
                <div className="strength-section-heading">
                    <div>
                        <h3>⑤ 效果解析審查</h3>
                        <p>檢查目前角色資料中，尚未支援強度計算的技能效果。</p>
                    </div>
                </div>

                {calculationReviewSummary ? (
                    <>
                        <div className="strength-result-grid">
                            <div className="strength-result-card">
                                <span>檢查角色</span>
                                <strong>{calculationReviewSummary.totalCharacters} 位</strong>
                            </div>
                            <div className="strength-result-card">
                                <span>待確認效果</span>
                                <strong>{calculationReviewSummary.totalIssues} 項</strong>
                            </div>
                        </div>

                        <p>
                            其中有 {calculationReviewSummary.reviewedCharacters} 位角色
                            存在尚未支援的效果。
                        </p>

                        {calculationReviewSummary.issues.map(item => (
                            <details key={item.characterId}>
                                <summary>
                                    {item.characterName}（{item.messages.length} 項）
                                </summary>
                                <ul>
                                    {item.messages.map((message, index) => (
                                        <li key={`${item.characterId}-${index}`}>
                                            {message}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ))}
                    </>
                ) : (
                    <p>正在整理效果解析審查資料……</p>
                )}
            </section>

            <div className="strength-data-status">
                已解析角色：{parsedCharacters.length} 位。
            </div>

            <div className="strength-data-status">
                已載入物理角色 {physicalCharacters.length} 位、
                魔法角色 {magicCharacters.length} 位、
                天賦倍率 {talentMultipliers.length} 筆、
                基準資料 {strengthBase?.generalStats.length ?? 0} 筆。
            </div>
        </div>
    )
}
