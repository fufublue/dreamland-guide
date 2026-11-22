
import { useEffect, useState } from 'react'
import type { EngineCharacter } from '../engine'

interface CharacterListItemProps {
    character: EngineCharacter
    onClick: (character: EngineCharacter) => void
    autoExpand?: boolean
}

const elementClassMap: Record<string, string> = {
    水: 'water',
    火: 'fire',
    風: 'wind',
    地: 'earth',
    雷: 'thunder',
    光: 'light',
    暗: 'dark',
}

function getSkillTypeClass(type: string): string {
    switch (type) {
      case "全體攻擊":
        return "skill-type-all-attack";
      case "單體攻擊":
        return "skill-type-single-attack";
      case "全體回血":
        return "skill-type-all-healing";
      case "單體回血":
        return "skill-type-single-healing";
      case "增益效果":
        return "skill-type-buff";
      default:
        return "";
    }
}


function getTalentDescription(
    rule: EngineCharacter['talent']['rules'][number]
): string {
    switch (rule.operation) {
        case 'replaceMagnitude':
        case 'replaceDuration':
        case 'replaceHealing':
        case 'replaceChance':
        case 'replaceCooldown':
            return rule.originalText

        case 'addEffect':
            return rule.replacement
                ? `新增效果：${rule.replacement}`
                : rule.originalText

        case 'unknown':
        default:
            return rule.originalText
    }
}


export default function CharacterListItem({
    character,
    onClick,
    autoExpand = false,
}: CharacterListItemProps) {
    const [expanded, setExpanded] = useState(false)

    useEffect(() => {
        if (autoExpand) {
            setExpanded(true)
        }
    }, [autoExpand])

    const rarityClass = `rarity-${character.rarity.toLowerCase()}`
    const elementClass = elementClassMap[character.element] ?? ''

    const skills = [
        { key: 'ultimate', title: '必殺技', skill: character.ultimate },
        { key: 'skill2', title: '二技能', skill: character.skill2 },
        { key: 'skill1', title: '一技能', skill: character.skill1 },
    ]

    const talentRules = [
        ...character.talent.rules.filter(rule => rule.targetSkill === 'ultimate'),
        ...character.talent.rules.filter(rule => rule.targetSkill === 'skill2'),
        ...character.talent.rules.filter(rule => rule.targetSkill === 'skill1'),
    ]

    return (
        <div className={`character-list-entry ${expanded ? 'expanded' : ''}`}>
            <div
                className="character-list-item"
                onClick={() => setExpanded(current => !current)}
            >
                <div className="character-list-item-main">
                    <span className="character-list-item-name">
                        {character.name}
                    </span>

                    <div className="character-list-item-info">
                        <span className={`character-tag ${rarityClass}`}>
                            {character.rarity}
                        </span>
                        <span className={`character-tag element-${elementClass}`}>
                            {character.element}
                        </span>
                        <span className="character-tag character-class">
                            {character.class}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    className="character-list-item-arrow"
                    onClick={event => {
                        event.stopPropagation()
                        onClick(character)
                    }}
                >
                    詳細資料 →
                </button>
            </div>

            {expanded && (
                <div
                    className="character-list-preview"
                    onClick={() => setExpanded(false)}
                    title="點擊收起"
                >
                    <div className="character-list-skills">
                        {skills.map(({ key, title, skill }) => (
                            <section key={key} className="character-list-skill">
                                <div className="character-list-skill-heading">
                                    <h4>{title}</h4>
                                    {skill.type && (
                                        <span className={`skill-type-tag ${getSkillTypeClass(skill.type)}`}>
                                            {skill.type}
                                        </span>
                                    )}
                                </div>
                                <p className="character-list-skill-effect">
                                    {skill.initial.effectText || '無特殊效果'}
                                </p>
                            </section>
                        ))}
                    </div>

                    {talentRules.length > 0 && (
                        <section className="character-list-talents">
                            <h4>天賦效果</h4>
                            {talentRules.map(rule => (
                                <div key={rule.id} className="character-list-talent">
                                    <strong>天賦 {rule.node}</strong>
                                    {rule.reviewRequired ? (
                                        <p className="character-list-talent-warning">
                                            尚未確認：{rule.originalText}
                                        </p>
                                    ) : (
                                        <p>{getTalentDescription(rule)}</p>
                                    )}
                                    {rule.reviewIssues.map((issue, index) => (
                                        <p
                                            key={`${rule.id}-${index}`}
                                            className="character-list-talent-warning"
                                        >
                                            {issue}
                                        </p>
                                    ))}
                                </div>
                            ))}
                        </section>
                    )}
                </div>
            )}
        </div>
    )
}
