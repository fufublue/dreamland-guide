
import type { EngineCharacter } from '../engine'
import type { TalentUnlockState } from '../engine/types/talent'
import { applyTalents } from '../engine/resolver/talentResolver'
import SkillDetailSection from './SkillDetailSection'
import './CharacterDetailPage.css'

type SkillKey = 'skill1' | 'skill2' | 'ultimate'

const elementClassMap: Record<string, string> = {
    水: 'water',
    火: 'fire',
    風: 'wind',
    地: 'earth',
    雷: 'thunder',
    光: 'light',
    暗: 'dark',
}

interface TalentEffectComparison {
    initial: {
        before: string
        after: string
    }
    max: {
        before: string
        after: string
    }
}

export default function CharacterDetailPage({
    character,
    onBack,
}: {
    character: EngineCharacter
    onBack: () => void
}) {

    // 建立各階段的天賦解鎖狀態
    const states: Record<number, {
        before: TalentUnlockState
        after: TalentUnlockState
    }> = {
        9: {
            before: {
                node6: false,
                node9: false,
                node12: false,
                node15: false,
            },
            after: {
                node6: false,
                node9: true,
                node12: false,
                node15: false,
            },
        },

        12: {
            before: {
                node6: false,
                node9: true,
                node12: false,
                node15: false,
            },
            after: {
                node6: false,
                node9: true,
                node12: true,
                node15: false,
            },
        },

        15: {
            before: {
                node6: false,
                node9: true,
                node12: true,
                node15: false,
            },
            after: {
                node6: false,
                node9: true,
                node12: true,
                node15: true,
            },
        },
    }

    // 計算單一技能在指定天賦解鎖前後的效果
    function getTalentComparison(
        skillKey: SkillKey
    ): Record<number, TalentEffectComparison> {

        const comparisons: Record<number, TalentEffectComparison> = {}

        for (const node of [9, 12, 15]) {
            const state = states[node]

            const beforeCharacter = applyTalents(
                character,
                state.before
            )

            const afterCharacter = applyTalents(
                character,
                state.after
            )

            const beforeSkill = beforeCharacter[skillKey]
            const afterSkill = afterCharacter[skillKey]

            comparisons[node] = {
                initial: {
                    before: beforeSkill.initial.effectText,
                    after: afterSkill.initial.effectText,
                },
                max: {
                    before: beforeSkill.max.effectText,
                    after: afterSkill.max.effectText,
                },
            }
        }

        return comparisons
    }

    const skill1Comparisons = getTalentComparison('skill1')
    const skill2Comparisons = getTalentComparison('skill2')
    const ultimateComparisons = getTalentComparison('ultimate')

    const skill1Rules = character.talent.rules.filter(
        rule => rule.targetSkill === 'skill1'
    )

    const skill2Rules = character.talent.rules.filter(
        rule => rule.targetSkill === 'skill2'
    )

    const ultimateRules = character.talent.rules.filter(
        rule => rule.targetSkill === 'ultimate'
    )

    return (
        <div className="character-detail-page">

            {/* 角色基本資料 */}
            <header className="character-detail-header">

                <div className="character-detail-title-row">
                    <h1>{character.name}</h1>

                    <button
                        type="button"
                        className="character-detail-back"
                        onClick={onBack}
                    >
                        <span aria-hidden="true">←</span>
                        返回角色列表
                    </button>
                </div>

                {character.maxBreakthroughTrait && (
                    <p className="character-breakthrough-trait">
                        {character.maxBreakthroughTrait}
                    </p>
                )}

                <div className="character-detail-tags">
                    <span className={`character-tag rarity-${character.rarity.toLowerCase()}`}>
                        {character.rarity}
                    </span>

                    <span className={`character-tag element-${elementClassMap[character.element]}`}>
                        {character.element}
                    </span>

                    <span className="character-tag character-class">
                        {character.class}
                    </span>
                </div>

                {character.notes && (
                    <div className="character-detail-extra">
                        <div className="character-detail-notes">
                            <span className="character-detail-extra-label">
                                角色備註
                            </span>
                            <p>{character.notes}</p>
                        </div>
                    </div>
                )}

            </header>

            {/* 技能資料 */}
            <div className="character-skills">

                <div className="character-skills-heading">
                    <div>
                        <span className="character-section-eyebrow">
                            SKILL DETAILS
                        </span>
                        <h2>技能資料</h2>
                    </div>
                    <p>比較技能初始與最大等級的數值及效果</p>
                </div>

                <SkillDetailSection
                    title="必殺技"
                    skill={character.ultimate}
                    rules={ultimateRules}
                    talentComparisons={ultimateComparisons}
                />

                <SkillDetailSection
                    title="二技能"
                    skill={character.skill2}
                    rules={skill2Rules}
                    talentComparisons={skill2Comparisons}
                />

                <SkillDetailSection
                    title="一技能"
                    skill={character.skill1}
                    rules={skill1Rules}
                    talentComparisons={skill1Comparisons}
                />

            </div>

            {/* 資料待確認 */}
            {(character.reviewRequired ||
                character.talent.reviewRequired) && (

                    <section className="character-review-section">

                        <div className="character-section-heading">
                            <div>
                                <span className="character-section-eyebrow">
                                    DATA REVIEW
                                </span>
                                <h3>資料待確認</h3>
                            </div>
                        </div>

                        {character.reviewIssues.map((issue, index) => (
                            <p key={`character-${index}`}>{issue}</p>
                        ))}

                        {character.talent.reviewIssues.map((issue, index) => (
                            <p key={`talent-${index}`}>{issue}</p>
                        ))}

                    </section>
                )}

        </div>
    )
}
