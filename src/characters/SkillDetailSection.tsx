
/*
建立技能資料的共用顯示元件。

負責：
- 顯示技能名稱與技能類型。
- 合併顯示初始與最大等級的技能資料。
- 相同數值只顯示一次，不同數值顯示 初始 → 最大。
- 必殺技不顯示冷卻時間。
- 顯示該技能對應的個別天賦效果。
- 在各自的天賦區塊顯示修改前後的效果比較。
- 將需要人工確認的資料標示出來。
*/

import type {
    EngineSkill,
    EngineTalentRule,
} from '../engine'

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

interface SkillDetailSectionProps {
    title: string
    skill: EngineSkill
    rules: EngineTalentRule[]
    talentComparisons?: Record<number, TalentEffectComparison>
}

// 技能類型對應顏色
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

// 將小數倍率轉換成百分比
function formatCoefficient(value: string): string {
    const text = value.trim()

    if (!text) {
        return '尚未確認'
    }

    if (text.includes('%')) {
        return text
    }

    const number = Number(text)

    if (!Number.isFinite(number)) {
        return text
    }

    return `${Number((number * 100).toFixed(4))}%`
}

// 比較初始與最大等級
function getComparison(
    initial: string,
    max: string,
    fallback: string
): string {
    const initialValue = initial.trim() || fallback
    const maxValue = max.trim() || fallback

    if (initialValue === maxValue) {
        return initialValue
    }

    return `${initialValue} → ${maxValue}`
}

/* 依照天賦操作類型整理顯示文字
function getTalentDescription(rule: EngineTalentRule): string {
    switch (rule.operation) {
        case 'replaceMagnitude':
        case 'replaceDuration':
        case 'replaceHealing':
        case 'replaceChance':
        case 'replaceCooldown':
            return rule.replacement
                ? `${rule.originalText} → ${rule.replacement}`
                : rule.originalText

        case 'addEffect':
            return rule.replacement
                ? `新增效果：${rule.replacement}`
                : rule.originalText

        case 'unknown':
        default:
            return rule.originalText
    }
}
*/

// 顯示單一等級的天賦修改前後效果

function TalentLevelComparison({
    label,
    before,
    after,
}: {
    label: string
    before: string
    after: string
}) {
    const beforeValue = before.trim() || '無特殊效果'
    const afterValue = after.trim() || '無特殊效果'

    if (beforeValue === afterValue) {
        return null
    }

    return (
        <p className="skill-talent-comparison">
            {label && (
                <span className="skill-talent-comparison-label">
                    {label}：
                </span>
            )}
            <span>{beforeValue}</span>
            <span className="function-change-arrow">
                {' → '}
            </span>
            <span className="skill-talent-comparison-after">
                {afterValue}
            </span>
        </p>
    )
}


export default function SkillDetailSection({
    title,
    skill,
    rules,
    talentComparisons = {},
}: SkillDetailSectionProps) {

    // 必殺技不顯示冷卻時間
    const showCooldown = title !== '必殺技'

    const coefficient = getComparison(
        formatCoefficient(skill.initial.coefficient),
        formatCoefficient(skill.max.coefficient),
        '尚未確認'
    )

    // 技能資料區只顯示原始技能效果
    const effectText = getComparison(
        skill.initial.originalEffectText ?? skill.initial.effectText,
        skill.max.originalEffectText ?? skill.max.effectText,
        '無特殊效果'
    )

    const cooldown = getComparison(
        skill.initial.cooldown
            ? `${skill.initial.cooldown} 秒`
            : '',
        skill.max.cooldown
            ? `${skill.max.cooldown} 秒`
            : '',
        '尚未確認'
    )

    return (
        <section className="skill-detail-section">

            {/* 技能名稱與類型 */}
            <div className="skill-detail-heading">
                <h3 className="skill-detail-title">
                    <span className="skill-detail-title-text">{title}</span>
                </h3>

                {skill.type && (
                    <span
                        className={`skill-type-tag ${getSkillTypeClass(skill.type)}`}
                    >
                        {skill.type}
                    </span>
                )}
            </div>

            {/* 原始技能資料 */}
            <div className="skill-detail-content">

                {showCooldown && (
                    <div className="skill-detail-row">
                        <span className="skill-detail-label">
                            冷卻時間
                        </span>
                        <strong className="skill-detail-value">
                            {cooldown}
                        </strong>
                    </div>
                )}

                <div className="skill-detail-row">
                    <span className="skill-detail-label">
                        主倍率
                    </span>
                    <strong className="skill-detail-value">
                        {coefficient}
                    </strong>
                </div>

                <div className="skill-detail-effect">
                    <span className="skill-detail-label">
                        技能效果
                    </span>
                    <p>{effectText}</p>
                </div>

            </div>

            {/* 個別天賦效果 */}
            <div className="skill-talent-info">

                {rules.length === 0 && (
                    <div className="skill-talent-rule">
                        <strong>對應天賦</strong>
                        <p>無天賦變化</p>
                    </div>
                )}

                {rules.map((rule, index) => {
                    const comparison = talentComparisons[rule.node]

                    // 同一個天賦若有多條規則，只在第一條規則下顯示比較
                    const showComparison = rules.findIndex(
                        item => item.node === rule.node
                    ) === index

                    return (
                        <div
                            key={rule.id}
                            className="skill-talent-rule"
                        >
                            <strong>對應天賦 {rule.node}</strong>

                            {rule.reviewRequired && (
                                <p className="skill-review-warning">
                                    尚未確認：{rule.originalText}
                                </p>
                            )}

                            {comparison && showComparison && (
                                <div className="skill-talent-comparisons">
                                    <TalentLevelComparison
                                        label=""
                                        before={comparison.initial.before}
                                        after={comparison.initial.after}
                                    />
                                </div>
                            )}

                            {rule.reviewIssues.map((issue, issueIndex) => (
                                <p
                                    key={`${rule.id}-${issueIndex}`}
                                    className="skill-review-warning"
                                >
                                    {issue}
                                </p>
                            ))}
                        </div>
                    )
                })}

            </div>

        </section>
    )
}
