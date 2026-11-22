import type { EngineCharacter, EngineSkillLevel } from '../../../../engine/types/character'
import type { TalentNodeSelection } from '../../types'
import { parseTalentText } from '../../../../engine/parser/talentParser'
import { getSkillEffectsWithTalent } from '../effects'

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`技能天賦效果測試失敗：${message}`)
    }
}

function createSkillLevel(effectText: string): EngineSkillLevel {
    return {
        cooldown: '20',
        coefficient: '100%',
        effectText,
        originalEffectText: effectText,
        effects: [],
        calculations: [],
        reviewRequired: false,
        reviewIssues: [],
    }
}

function createCharacter(
    name: string,
    ultimateEffectText: string,
    talentText: string,
): EngineCharacter {
    const emptyLevel = createSkillLevel('')
    const ultimateLevel = createSkillLevel(ultimateEffectText)

    return {
        id: name,
        name,
        rarity: 'UR',
        element: '風',
        class: '魔杖',
        attackType: 'magic',
        normalAttack: { initial: 100, max: 100 },
        ultimate: {
            type: '全體回血',
            initial: ultimateLevel,
            max: ultimateLevel,
        },
        skill2: {
            type: '全體攻擊',
            initial: emptyLevel,
            max: emptyLevel,
        },
        skill1: {
            type: '單體攻擊',
            initial: emptyLevel,
            max: emptyLevel,
        },
        talent: parseTalentText(talentText),
        talentMultipliers: {
            talent9: { status: 'none', value: null },
            talent12: { status: 'none', value: null },
            talent15: { status: 'none', value: null },
        },
        talentPages: '3',
        notes: '',
        maxBreakthroughTrait: '',
        reviewRequired: false,
        reviewIssues: [],
    }
}

// 戈狄[宅包出行]：天賦15將必殺技所有效果的持續時間改為20秒。
const godi = createCharacter(
    '戈狄[宅包出行]',
    '加全體小幅20%魔攻15秒\n加全體中幅40%風傷15秒',
    '天賦15時必殺技所有效果改為20秒',
)
const godiResult = getSkillEffectsWithTalent(
    godi,
    'ultimate',
    'initial',
    15 as TalentNodeSelection,
)
assert(
    godiResult.effectLines.length === 2 &&
        godiResult.effectLines.every(line => line.text.endsWith('20秒')),
    '戈狄天賦15應將兩項效果的持續時間都改為20秒',
)
assert(
    godiResult.effectLines.every(line => line.source === 'talent' && line.talentNode === 15),
    '戈狄兩項被修改的效果都應標記天賦15',
)
assert(
    !godiResult.warnings.some(issue => issue.includes('持續時間不只一處')),
    '戈狄不應再出現持續時間不只一處的警告',
)
assert(
    godiResult.effects.length === 2 && godiResult.effects.every(effect => effect.source === 'talent'),
    '戈狄解析後的兩項效果來源都應為 talent',
)

// 繆爾夏[懲戒鐐銬]：天賦15新增效果，只標記新增的那一項。
const muresha = createCharacter(
    '繆爾夏[懲戒鐐銬]',
    '加全體大幅60%風傷15秒',
    '天賦15時必殺技效果新增加全體小幅20%魔攻15秒',
)
const mureshaResult = getSkillEffectsWithTalent(
    muresha,
    'ultimate',
    'initial',
    15 as TalentNodeSelection,
)
assert(mureshaResult.effectLines.length === 2, '繆爾夏必殺技應有兩項效果')
assert(
    mureshaResult.effectLines[0].text === '加全體大幅60%風傷15秒' &&
        mureshaResult.effectLines[0].source === 'skill',
    '繆爾夏原始風傷效果不應被標記為天賦',
)
assert(
    mureshaResult.effectLines[1].text === '加全體小幅20%魔攻15秒' &&
        mureshaResult.effectLines[1].source === 'talent' &&
        mureshaResult.effectLines[1].talentNode === 15,
    '繆爾夏新增魔攻效果應獨立標記天賦15',
)
assert(
    mureshaResult.effects.length === 2 &&
        mureshaResult.effects[0].source === 'skill' &&
        mureshaResult.effects[1].source === 'talent',
    '繆爾夏解析後的效果來源應分別保留 skill 與 talent',
)

console.log('戈狄多項持續時間修改與繆爾夏逐項天賦標記測試全部通過。')
