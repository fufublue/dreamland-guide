
import type {
    Character,
    CharacterSkill,
    CharacterSkillLevel,
} from './characterData'

// ======================================================
// 效果分類
// ======================================================

// 增加與施加統一歸類為 increase
export type EffectAction =
    | 'increase'
    | 'decrease'
    | 'clear'
    | 'heal'
    | 'other'

// 效果對象
export type EffectTargetSide =
    | 'enemy'
    | 'ally'
    | 'self'
    | 'unknown'

// 效果範圍
export type EffectRange =
    | 'all'
    | 'single'
    | 'unknown'

// 保留舊名稱，避免其他程式引用時出錯
export type EffectTarget = EffectRange


// 副詞條：效果項目
export type EffectCategory =
    | 'physicalAttack'
    | 'magicAttack'
    | 'dualAttack'
    | 'physicalDefense'
    | 'magicDefense'
    | 'dualDefense'
    | 'speed'
    | 'ultimateGauge'
    | 'elementalDamage'
    | 'attributeResistance'
    | 'criticalRate'
    | 'criticalDamage'
    | 'binding'
    | 'seal'
    | 'darkness'
    | 'poison'
    | 'harmfulStatus'
    | 'attributeDown'
    | 'taunt'
    | 'healing'
    | 'invincible'
    | 'selfDestruct'
    | 'other'

// ======================================================
// 解析結果介面
// ======================================================

// 強度計算用的結構化效果資料
export interface ParsedCalculationEffect {
    type:
    | 'attack-buff'
    | 'ultimate-gauge'
    | 'conditional-damage'
    | 'unknown'
    | 'damage-buff'
    | 'damage-debuff'
    | 'elemental-damage-buff'
    | 'defense-debuff'
    | 'defense-buff'
    | 'attack-debuff'
    | 'speed-buff'
    | 'speed-debuff'
    | 'ultimate-gauge-debuff'
    | 'healing'

    // 攻擊力提升或降低
    attackStat?: 'physicalAttack' | 'magicAttack' | 'dualAttack'
    attackReductionPercent?: number
    attackBonus?: number
    durationSeconds?: number

    // 屬性傷害提升
    element?: string

    // 必殺值增加或減少
    ultimateGaugePercent?: number
    ultimateGaugeReductionPercent?: number

    // 治療效果
    healingPercent?: number

    // 條件增傷
    condition?: {
        type: 'hp'
        operator: '>='
        thresholdPercent: number
    }
    damageBonusPercent?: number

    // 條件成立時的實際技能倍率
    effectiveCoefficientPercent?: number

    // 防禦力降低或提升
    defenseStat?: 'physicalDefense' | 'magicDefense' | 'dualDefense'
    defenseReductionPercent?: number
    defenseBonusPercent?: number

    // 速度變化
    speedBonusPercent?: number
    speedReductionPercent?: number
}

export interface ParsedSkillEffect {
    action: EffectAction
    targetSide: EffectTargetSide
    range: EffectRange

    // 保留舊欄位名稱，代表效果範圍
    target: EffectTarget

    category: EffectCategory
    attribute: string
    searchableCategories: EffectCategory[]

    magnitude: string
    value: string
    duration: string
    chance: string

    originalText: string
    source: 'skill' | 'talent'

    reviewRequired: boolean

    // 強度計算是否需要人工確認
    calculationReviewRequired?: boolean

    // 舊欄位：保留第一個計算效果，維持相容性
    calculation?: ParsedCalculationEffect

    // 新欄位：保存這段文字中所有可解析的計算效果
    calculations?: ParsedCalculationEffect[]
}

export interface ParsedSkillLevel {
    cooldown: string
    coefficient: string
    coefficientPercent?: number
    originalEffect: string
    effects: ParsedSkillEffect[]
}

export interface ParsedSkill {
    skillName: 'ultimate' | 'skill2' | 'skill1'

    // 舊欄位：維持天賦強化後的滿等資料
    cooldown: string
    coefficient: string
    originalEffect: string
    effects: ParsedSkillEffect[]

    // 原始技能資料，不套用天賦
    initial: ParsedSkillLevel
    max: ParsedSkillLevel

    // 天賦強化後資料
    talentInitial: ParsedSkillLevel
    talentMax: ParsedSkillLevel
}

export interface TalentParseResult {
    // 未知節點時為 null，並標記需要確認
    skillName: 'ultimate' | 'skill2' | 'skill1' | null
    node: number
    changes: TalentChange[]
    originalText: string
    reviewRequired: boolean
}

export interface TalentChange {
    type:
    | 'replace'
    | 'add'
    | 'cooldown'
    | 'healing'
    | 'chance'

    field: string
    value: string
    originalText: string

    // 指定效果序號：0 = 首效果、1 = 次效果、2 = 第三效果
    effectIndex?: number

    // 指定效果類別，例如 magicAttack
    effectCategory?: EffectCategory
}

export interface ParsedCharacter {
    characterId: string
    characterName: string
    skills: ParsedSkill[]
    talentResults: TalentParseResult[]
    reviewRequired: boolean
    reviewIssues: string[]
    calculationReviewIssues: string[]
}

// ======================================================
// 副詞條分類資料
// ======================================================


const CATEGORY_NAMES: Record<EffectCategory, string> = {
    physicalAttack: '物攻',
    magicAttack: '魔攻',
    dualAttack: '雙攻',
    physicalDefense: '物防',
    magicDefense: '魔防',
    dualDefense: '雙防',
    speed: '速度',
    ultimateGauge: '必殺值',
    elementalDamage: '屬性傷害',
    attributeResistance: '屬性抗性',
    criticalRate: '爆擊率',
    criticalDamage: '爆擊傷害',
    binding: '束縛',
    seal: '封印',
    darkness: '黑暗',
    poison: '中毒',
    harmfulStatus: '有害狀態',
    attributeDown: '屬性下降',
    taunt: '嘲諷',
    healing: '治療',
    invincible: '無敵',
    selfDestruct: '立即退場',
    other: '其他',
}


// 搜尋名稱與分類的對應
// 雙攻、雙防可以透過個別攻擊或防禦項目搜尋
const CATEGORY_ALIASES: Record<string, EffectCategory[]> = {
    物攻: ['physicalAttack', 'dualAttack'],
    魔攻: ['magicAttack', 'dualAttack'],
    雙攻: ['dualAttack'],

    物防: ['physicalDefense', 'dualDefense'],
    魔防: ['magicDefense', 'dualDefense'],
    雙防: ['dualDefense'],

    速度: ['speed'],
    必殺值: ['ultimateGauge'],
    屬性傷害: ['elementalDamage'],

    束縛: ['binding'],
    封印: ['seal'],
    黑暗: ['darkness'],
    中毒: ['poison'],
    有害狀態: ['harmfulStatus'],

    屬性下降: ['attributeDown'],
    嘲諷: ['taunt'],
    治療: ['healing'],
}

// ======================================================
// 共用工具
// ======================================================

function unique<T>(items: T[]): T[] {
    return [...new Set(items)]
}

function splitTalentLines(talent: string): string[] {
    return talent
        .split(/<br\s*\/?>|\r\n|\r|\n/gi)
        .map(line => line.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)
}

function getTalentSkill(
    node: number
): 'ultimate' | 'skill2' | 'skill1' | null {
    if (node === 9) return 'skill1'
    if (node === 12) return 'skill2'
    if (node === 15) return 'ultimate'

    return null
}

// ======================================================
// 天賦解析
// ======================================================

export function parseTalentLine(
    line: string
): TalentParseResult | null {
    const nodeMatch = line.match(/天賦\s*(\d+)\s*時/)

    if (!nodeMatch) return null

    const node = Number(nodeMatch[1])
    const skillName = getTalentSkill(node)

    const changes: TalentChange[] = []

    const content = line
        .slice(nodeMatch.index! + nodeMatch[0].length)
        .trim()

    // 解析天賦指定的效果範圍
    let effectIndex: number | undefined

    if (/首效果/.test(content)) {
        effectIndex = 0
    } else if (/次效果/.test(content)) {
        effectIndex = 1
    } else if (/第三效果/.test(content)) {
        effectIndex = 2
    }

    // 解析指定效果類別
    const effectCategoryMap: Record<string, EffectCategory> = {
        '物攻': 'physicalAttack',
        '魔攻': 'magicAttack',
        '雙攻': 'dualAttack',
        '物防': 'physicalDefense',
        '魔防': 'magicDefense',
        '雙防': 'dualDefense',
        '速度': 'speed',
        '必殺技量表': 'ultimateGauge',
        '屬性傷害': 'elementalDamage',
        '暴擊率': 'criticalRate',
        '暴擊傷害': 'criticalDamage',
        '束縛': 'binding',
        '封印': 'seal',
        '黑暗': 'darkness',
        '中毒': 'poison',
        '有害狀態': 'harmfulStatus',
        '能力下降': 'attributeDown',
        '嘲諷': 'taunt',
        '回血': 'healing',
        '無敵': 'invincible',
    }

    let effectCategory: EffectCategory | undefined

    for (const [keyword, category] of Object.entries(effectCategoryMap)) {
        if (content.includes(keyword + '效果')) {
            effectCategory = category
            break
        }
    }

    const effectScope = {
        ...(effectIndex !== undefined ? { effectIndex } : {}),
        ...(effectCategory ? { effectCategory } : {}),
    }


   

    // 新增效果
    const addMatch = content.match(
        /新增(.+)$/
    )

    if (addMatch) {
        changes.push({
            type: 'add',
            field: 'effect',
            value: addMatch[1].trim(),
            originalText: line,
            ...effectScope,
        })
    }

    // CD 修改
    const cooldownMatch = content.match(
        /CD\s*改為\s*(\d+(?:\.\d+)?)\s*秒?/i
    )

    if (cooldownMatch) {
        changes.push({
            type: 'cooldown',
            field: 'cooldown',
            value: cooldownMatch[1],
            originalText: line,
            ...effectScope,
        })
    }

    // 回血倍率修改
    const healingMatch = content.match(
        /回血改為\s*(\d+(?:\.\d+)?)%/
    )

    if (healingMatch) {
        changes.push({
            type: 'healing',
            field: 'healing',
            value: `${healingMatch[1]}%`,
            originalText: line,
            ...effectScope,
        })
    }

    // 狀態發動機率修改
    const chanceMatch = content.match(
        /(?:黑暗|中毒|束縛|封印|有害狀態)?機率改為\s*(\d+(?:\.\d+)?)%/
    )

    if (chanceMatch) {
        changes.push({
            type: 'chance',
            field: 'chance',
            value: `${chanceMatch[1]}%`,
            originalText: line,
            ...effectScope,
        })
    }

    // 效果改為持續時間
    const durationMatch = content.match(
        /效果改為\s*(\d+(?:\.\d+)?)秒/
    )

    if (durationMatch) {
        changes.push({
            type: 'replace',
            field: 'duration',
            value: `${durationMatch[1]}秒`,
            originalText: line,
            ...effectScope,
        })
    }

    // 效果改為幅度或幅度及數值
    const magnitudeMatch = content.match(
        /效果改為\s*((?:小幅|中幅|大幅)(?:\s*\d+(?:\.\d+)?%)?)/
    )

    if (magnitudeMatch) {
        changes.push({
            type: 'replace',
            field: 'magnitude',
            value: magnitudeMatch[1].trim(),
            originalText: line,
            ...effectScope,
        })
    }

    return {
        skillName,
        node,
        changes,
        originalText: line,

        // 不認識的天賦節點或沒有解析到任何變更，都需要確認
        reviewRequired:
            skillName === null || changes.length === 0,
    }
}

export function parseTalent(
    talent: string
): TalentParseResult[] {
    return splitTalentLines(talent)
        .map(parseTalentLine)
        .filter(
            (result): result is TalentParseResult =>
                result !== null
        )
}

// ======================================================
// 效果動作判斷
// ======================================================

function parseAction(text: string): EffectAction {
    if (/清除|解除/.test(text)) {
        return 'clear'
    }

    if (/回血|治療|恢復生命/.test(text)) {
        return 'heal'
    }

    if (/降低|下降|減少|削弱|減|降/.test(text)) {
        return 'decrease'
    }

    // 增加與施加統一歸類
    if (
        /增加|提升|提高|上升|加|施加|附加|賦予/.test(text)
    ) {
        return 'increase'
    }

    return 'other'
}

// ======================================================
// 效果對象及範圍
// ======================================================


function parseTargetSide(text: string): EffectTargetSide {
    // 嘲諷固定視為自身
    if (/嘲諷/.test(text)) {
        return 'self'
    }

    // 明確標示自身，優先判定自身
    if (/自身|自己/.test(text)) {
        return 'self'
    }

    // 原文有明確標示敵方或我方時，優先採用原文
    if (/敵方|敵人/.test(text)) {
        return 'enemy'
    }

    if (/我方|友方|隊友/.test(text)) {
        return 'ally'
    }

    // 依照效果動作推斷對象
    const action = parseAction(text)

    // 正向效果：我方
    if (
        action === 'increase' ||
        action === 'heal' ||
        action === 'clear'
    ) {
        return 'ally'
    }

    // 負向效果：敵方
    if (action === 'decrease') {
        return 'enemy'
    }

    // 無法判斷的特殊效果不自行猜測
    return 'unknown'
}


function parseRange(text: string): EffectRange {
    if (/全體/.test(text)) {
        return 'all'
    }

    if (/單體/.test(text)) {
        return 'single'
    }

    if (/自身|自己|嘲諷/.test(text)) {
        return 'single'
    }

    return 'unknown'
}

// ======================================================
// 效果項目判斷
// ======================================================


function parseCategories(
    text: string
): EffectCategory[] {
    const categories: EffectCategory[] = []

    // 攻擊與防禦
    if (/雙攻/.test(text)) {
        categories.push('dualAttack')
    }

    if (/雙防/.test(text)) {
        categories.push('dualDefense')
    }

    if (/物攻|物理攻擊/.test(text)) {
        categories.push('physicalAttack')
    }

    if (/魔攻|魔法攻擊/.test(text)) {
        categories.push('magicAttack')
    }

    if (/物防|物理防禦/.test(text)) {
        categories.push('physicalDefense')
    }

    if (/魔防|魔法防禦/.test(text)) {
        categories.push('magicDefense')
    }

    // 速度與必殺值
    if (/速度/.test(text)) {
        categories.push('speed')
    }

    if (/必殺值/.test(text)) {
        categories.push('ultimateGauge')
    }

    // 屬性傷害，支援「風傷」「風屬傷」「風屬性傷害」等寫法
    if (
        /(?:水|火|風|地|雷|光|暗)(?:屬性)?(?:傷害|屬傷|傷)|屬性傷害/.test(text)
    ) {
        categories.push('elementalDamage')
    }

    // 屬性抗性
    if (
        /(?:水|火|風|地|雷|光|暗)(?:屬性)?(?:抗性|抗)|屬性抗性/.test(text)
    ) {
        categories.push('attributeResistance')
    }


    // 爆擊
    if (/爆擊率|暴擊率/.test(text)) {
        categories.push('criticalRate')
    }

    if (/爆擊傷害|暴擊傷害|爆傷/.test(text)) {
        categories.push('criticalDamage')
    }

    // 有害狀態
    if (/束縛/.test(text)) {
        categories.push('binding')
    }

    if (/封印/.test(text)) {
        categories.push('seal')
    }

    if (/黑暗/.test(text)) {
        categories.push('darkness')
    }

    if (/中毒/.test(text)) {
        categories.push('poison')
    }

    if (/有害狀態/.test(text)) {
        categories.push('harmfulStatus')
    }

    // 屬性抗性
    if (
        /(?:水|火|風|地|雷|光|暗)(?:屬性)?(?:抗性|抗)|屬性抗性/.test(text)
    ) {
        categories.push('attributeResistance')
    }

    if (/屬性下降/.test(text)) {
        categories.push('attributeDown')
    }

    // 特殊效果
    if (/嘲諷/.test(text)) {
        categories.push('taunt')
    }

    if (/無敵/.test(text)) {
        categories.push('invincible')
    }

    if (/立即退場/.test(text)) {
        categories.push('selfDestruct')
    }

    // 治療
    if (/回血|治療|恢復生命/.test(text)) {
        categories.push('healing')
    }

    return unique(categories)
}


// 取得搜尋時可命中的分類
function getSearchableCategories(
    categories: EffectCategory[]
): EffectCategory[] {
    const result = [...categories]

    for (const category of categories) {
        if (category === 'dualAttack') {
            result.push('physicalAttack', 'magicAttack')
        }

        if (category === 'dualDefense') {
            result.push('physicalDefense', 'magicDefense')
        }
    }

    return unique(result)
}

// ======================================================
// 將複合效果拆成獨立效果
// ======================================================


function splitCompoundEffects(text: string): string[] {
    // 先依照換行及分號拆分獨立效果
    const parts = text
        .split(/[；;\r\n]+/)
        .map(item => item.trim())
        .filter(Boolean)

    const segments: string[] = []

    for (const part of parts) {
        // 清除全體束縛及封印：
        // 拆成「清除全體束縛」與「清除全體封印」
        const clearMatch = part.match(
            /^(清除|解除)(.*?)(束縛|封印|黑暗|中毒)(?:及|和|與)(束縛|封印|黑暗|中毒)(.*)$/
        )

        if (clearMatch) {
            const prefix = clearMatch[1]
            const middle = clearMatch[2]
            const first = clearMatch[3]
            const second = clearMatch[4]
            const suffix = clearMatch[5]

            segments.push(
                `${prefix}${middle}${first}${suffix}`,
                `${prefix}${middle}${second}${suffix}`
            )
        } else {
            segments.push(part)
        }
    }

    return segments
}


// ======================================================
// 單一效果解析
// ======================================================


// 判斷是否為技能自身的條件傷害描述
function isConditionalDamageDescription(text: string): boolean {
    return /自身生命(?:值)?\s*\d+(?:\.\d+)?%\s*以上\s*[+＋]\s*\d+(?:\.\d+)?%(?:\s*傷害)?(?:[（(]\s*\d+(?:\.\d+)?%\s*[）)])?/.test(text)
}



function parseCoefficientPercent(
    coefficient: string
): number | undefined {
    const match = coefficient.trim().match(
        /^(\d+(?:\.\d+)?)%$/
    )

    if (!match) {
        return undefined
    }

    return Number(match[1])
}


function parseCalculationEffect(
    text: string,
    matchedRanges: Array<{ start: number; end: number }> = []
): ParsedCalculationEffect[] {
    const results: ParsedCalculationEffect[] = []

    // 統一收集所有符合條件的匹配結果，並記錄原文位置
    function collectMatches(
        regex: RegExp,
        callback: (match: RegExpMatchArray) => ParsedCalculationEffect | null
    ) {
        for (const match of text.matchAll(regex)) {
            const result = callback(match)

            if (result) {
                results.push(result)

                if (match.index !== undefined) {
                    matchedRanges.push({
                        start: match.index,
                        end: match.index + match[0].length,
                    })
                }
            }
        }
    }

    // 治療效果：回血、治療、恢復生命
    collectMatches(
        /(?:全體|單體|自身|我方)?\s*(?:回血|治療|恢復生命(?:值)?)\s*(\d+(?:\.\d+)?)%/g,
        match => ({
            type: 'healing',
            healingPercent: Number(match[1]),
        })
    )



    // 1. 條件式增傷

    // 格式一：自身生命90%以上+120%傷害（491%）
    collectMatches(
        /自身生命(?:值)?\s*(\d+(?:\.\d+)?)%\s*以上\s*[+＋]\s*(\d+(?:\.\d+)?)%\s*傷害(?:[（(]\s*(\d+(?:\.\d+)?)%\s*[）)])?/g,
        match => ({
            type: 'conditional-damage',
            condition: {
                type: 'hp',
                operator: '>=',
                thresholdPercent: Number(match[1]),
            },
            damageBonusPercent: Number(match[2]),
            effectiveCoefficientPercent:
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined,
        })
    )

    // 格式二：自身生命90%以上+120%（491%）
    collectMatches(
        /自身生命(?:值)?\s*(\d+(?:\.\d+)?)%\s*以上\s*[+＋]\s*(\d+(?:\.\d+)?)%\s*[（(]\s*(\d+(?:\.\d+)?)%\s*[）)]/g,
        match => ({
            type: 'conditional-damage',
            condition: {
                type: 'hp',
                operator: '>=',
                thresholdPercent: Number(match[1]),
            },
            damageBonusPercent: Number(match[2]),
            effectiveCoefficientPercent: Number(match[3]),
        })
    )

    // 2. 攻擊力提升

    // 一般攻擊力提升
    collectMatches(
        /(?:增加|提升|提高|加|施加|賦予)(?:全體|我方|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*(物攻|魔攻)(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => ({
            type: 'attack-buff',
            attackStat:
                match[2] === '物攻'
                    ? 'physicalAttack'
                    : 'magicAttack',
            attackBonus: Number(match[1]),
            durationSeconds:
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined,
        })
    )

    // 雙攻提升：同時產生物攻與魔攻兩筆效果
    collectMatches(
        /(?:增加|提升|提高|加|施加|賦予)(?:全體|我方|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*雙攻(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => {
            const durationSeconds =
                match[2] !== undefined
                    ? Number(match[2])
                    : undefined

            results.push({
                type: 'attack-buff',
                attackStat: 'magicAttack',
                attackBonus: Number(match[1]),
                durationSeconds,
            })

            return {
                type: 'attack-buff',
                attackStat: 'physicalAttack',
                attackBonus: Number(match[1]),
                durationSeconds,
            }
        }
    )


    // 3. 屬性傷害提升
    // 支援：增加火屬性傷害20%
    // 支援：加全體中幅40%風屬傷害15秒
    collectMatches(
        /(?:增加|提升|提高|加|施加|賦予)(?:全體|我方|自身|單體)?(?:小幅|中幅|大幅)?\s*(水|火|風|地|雷|光|暗)(?:屬性)?(?:傷害|屬傷)\s*[+＋]?\s*(\d+(?:\.\d+)?)%(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => ({
            type: 'elemental-damage-buff',
            element: match[1],
            damageBonusPercent: Number(match[2]),
            durationSeconds:
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined,
        })
    )

    // 3-1. 屬性傷害提升（動作詞在傷害之後）
    // 支援：火屬性傷害增加20%
    collectMatches(
        /(水|火|風|地|雷|光|暗)(?:屬性)?(?:傷害|屬傷)(?:增加|提升|提高)\s*[+＋]?\s*(\d+(?:\.\d+)?)%(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => ({
            type: 'elemental-damage-buff',
            element: match[1],
            damageBonusPercent: Number(match[2]),
            durationSeconds:
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined,
        })
    )

    // 3-2. 屬性傷害提升（數值在屬性傷害之前）
    // 支援：增加20%火屬性傷害
    collectMatches(
        /(?:增加|提升|提高|加|施加|賦予)(?:全體|我方|自身|單體)?(?:小幅|中幅|大幅)?\s*[+＋]?\s*(\d+(?:\.\d+)?)%\s*(水|火|風|地|雷|光|暗)(?:屬性)?(?:傷害|屬傷)(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => ({
            type: 'elemental-damage-buff',
            element: match[2],
            damageBonusPercent: Number(match[1]),
            durationSeconds:
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined,
        })
    )
    // 4. 一般傷害增加或降低
    collectMatches(
        /(增加|提升|提高|加|降低|減少|削弱|降|減)(?:全體|我方|敵方|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*傷害(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => {
            const isIncrease = [
                '增加',
                '提升',
                '提高',
                '加',
            ].includes(match[1])

            return {
                type: isIncrease ? 'damage-buff' : 'damage-debuff',
                damageBonusPercent: Number(match[2]),
                durationSeconds:
                    match[3] !== undefined
                        ? Number(match[3])
                        : undefined,
            }
        }
    )

    // 4-1. 一般傷害增加或降低（動作詞在傷害之後）
    collectMatches(
        /傷害(?:增加|提升|提高|加|降低|減少|削弱|減)\s*[+＋]?\s*(\d+(?:\.\d+)?)%(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => {
            const prefix = match[0].match(
                /傷害(增加|提升|提高|加|降低|減少|削弱|減)/
            )?.[1]

            const isIncrease = [
                '增加',
                '提升',
                '提高',
                '加',
            ].includes(prefix ?? '')

            return {
                type: isIncrease ? 'damage-buff' : 'damage-debuff',
                damageBonusPercent: Number(match[1]),
                durationSeconds:
                    match[2] !== undefined
                        ? Number(match[2])
                        : undefined,
            }
        }
    )


    // 5. 防禦力降低

    // 一般防禦降低
    collectMatches(
        /(降低|減少|削弱|下降|降)(?:全體敵方|單體敵方|敵方|我方|全體|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*(物防|魔防|物理防禦|魔法防禦)(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => {
            const defenseText = match[3]

            const defenseStat =
                defenseText === '物防' || defenseText === '物理防禦'
                    ? 'physicalDefense'
                    : 'magicDefense'

            return {
                type: 'defense-debuff',
                defenseStat,
                defenseReductionPercent: Number(match[2]),
                durationSeconds:
                    match[4] !== undefined
                        ? Number(match[4])
                        : undefined,
            }
        }
    )

    // 雙防降低：同時產生物防與魔防兩筆效果
    collectMatches(
        /(降低|減少|削弱|下降|降)(?:全體敵方|單體敵方|敵方|我方|全體|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*雙防(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => {
            const durationSeconds =
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined

            // 先回傳物理防禦，魔法防禦由下方額外加入
            results.push({
                type: 'defense-debuff',
                defenseStat: 'magicDefense',
                defenseReductionPercent: Number(match[2]),
                durationSeconds,
            })

            return {
                type: 'defense-debuff',
                defenseStat: 'physicalDefense',
                defenseReductionPercent: Number(match[2]),
                durationSeconds,
            }
        }
    )



    // 5-1. 同一數值同時降低物防與魔防
    for (const match of text.matchAll(
        /(降低|減少|削弱|下降|降)(?:全體敵方|單體敵方|敵方|我方|全體|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*(物防|物理防禦|魔防|魔法防禦)(?:及|和|與)(物防|物理防禦|魔防|魔法防禦)(?:\s*(\d+(?:\.\d+)?)秒)?/g
    )) {
        if (match.index !== undefined) {
            matchedRanges.push({
                start: match.index,
                end: match.index + match[0].length,
            })
        }

        const toDefenseStat = (
            value: string
        ): 'physicalDefense' | 'magicDefense' =>
            value === '物防' || value === '物理防禦'
                ? 'physicalDefense'
                : 'magicDefense'

        const firstStat = toDefenseStat(match[3])
        const secondStat = toDefenseStat(match[4])

        // 兩個項目實際上相同時，不重複新增
        if (firstStat === secondStat) continue

        const durationSeconds =
            match[5] !== undefined
                ? Number(match[5])
                : undefined

        results.push({
            type: 'defense-debuff',
            defenseStat: secondStat,
            defenseReductionPercent: Number(match[2]),
            durationSeconds,
        })
    }


    // 6. 防禦力提升

    // 一般防禦力提升
    collectMatches(
        /(增加|提升|提高|加)(?:敵方|我方|全體|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*(物防|魔防|物理防禦|魔法防禦)(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => {
            const defenseText = match[3]

            const defenseStat =
                defenseText === '物防' || defenseText === '物理防禦'
                    ? 'physicalDefense'
                    : 'magicDefense'

            return {
                type: 'defense-buff',
                defenseStat,
                defenseBonusPercent: Number(match[2]),
                durationSeconds:
                    match[4] !== undefined
                        ? Number(match[4])
                        : undefined,
            }
        }
    )

    // 雙防提升：同時產生物防與魔防兩筆效果
    collectMatches(
        /(增加|提升|提高|加)(?:敵方|我方|全體|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*雙防(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => {
            const durationSeconds =
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined

            results.push({
                type: 'defense-buff',
                defenseStat: 'magicDefense',
                defenseBonusPercent: Number(match[2]),
                durationSeconds,
            })

            return {
                type: 'defense-buff',
                defenseStat: 'physicalDefense',
                defenseBonusPercent: Number(match[2]),
                durationSeconds,
            }
        }
    )

    // 6-1. 同一數值同時提升物防與魔防
    for (const match of text.matchAll(
        /(增加|提升|提高|加)(?:敵方|我方|全體|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*(物防|物理防禦|魔防|魔法防禦)(?:及|和|與)(物防|物理防禦|魔防|魔法防禦)(?:\s*(\d+(?:\.\d+)?)秒)?/g
    )) {
        if (match.index !== undefined) {
            matchedRanges.push({
                start: match.index,
                end: match.index + match[0].length,
            })
        }

        const toDefenseStat = (
            value: string
        ): 'physicalDefense' | 'magicDefense' =>
            value === '物防' || value === '物理防禦'
                ? 'physicalDefense'
                : 'magicDefense'

        const firstStat = toDefenseStat(match[3])
        const secondStat = toDefenseStat(match[4])

        if (firstStat === secondStat) continue

        const durationSeconds =
            match[5] !== undefined
                ? Number(match[5])
                : undefined

        results.push({
            type: 'defense-buff',
            defenseStat: secondStat,
            defenseBonusPercent: Number(match[2]),
            durationSeconds,
        })
    }

    // 7. 攻擊力降低
    // 一般攻擊力降低
    collectMatches(
        /(降低|減少|削弱|下降|降)(?:敵方|全體敵方|單體敵方|全體|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*(物攻|魔攻|物理攻擊|魔法攻擊)(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => {
            const attackText = match[3]

            const attackStat =
                attackText === '物攻' || attackText === '物理攻擊'
                    ? 'physicalAttack'
                    : 'magicAttack'

            return {
                type: 'attack-debuff',
                attackStat,
                attackReductionPercent: Number(match[2]),
                durationSeconds:
                    match[4] !== undefined
                        ? Number(match[4])
                        : undefined,
            }
        }
    )
    // 雙攻降低：同時產生物攻與魔攻兩筆效果
    collectMatches(
        /(降低|減少|削弱|下降|降)(?:敵方|全體敵方|單體敵方|全體|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*雙攻(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => {
            const durationSeconds =
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined

            results.push({
                type: 'attack-debuff',
                attackStat: 'magicAttack',
                attackReductionPercent: Number(match[2]),
                durationSeconds,
            })

            return {
                type: 'attack-debuff',
                attackStat: 'physicalAttack',
                attackReductionPercent: Number(match[2]),
                durationSeconds,
            }
        }
    )

    // 7-1. 同一數值同時降低物攻與魔攻
    for (const match of text.matchAll(
        /(降低|減少|削弱|下降|降)(?:敵方|全體敵方|單體敵方|全體|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*(物攻|物理攻擊|魔攻|魔法攻擊)(?:及|和|與)(物攻|物理攻擊|魔攻|魔法攻擊)(?:\s*(\d+(?:\.\d+)?)秒)?/g
    )) {
        if (match.index !== undefined) {
            matchedRanges.push({
                start: match.index,
                end: match.index + match[0].length,
            })
        }

        const toAttackStat = (
            value: string
        ): 'physicalAttack' | 'magicAttack' =>
            value === '物攻' || value === '物理攻擊'
                ? 'physicalAttack'
                : 'magicAttack'

        const firstStat = toAttackStat(match[3])
        const secondStat = toAttackStat(match[4])

        if (firstStat === secondStat) continue

        const durationSeconds =
            match[5] !== undefined
                ? Number(match[5])
                : undefined

        results.push({
            type: 'attack-debuff',
            attackStat: secondStat,
            attackReductionPercent: Number(match[2]),
            durationSeconds,
        })
    }

    // 8. 速度提升
    collectMatches(
        /(增加|提升|提高|加|施加|賦予)(?:敵方|我方|全體敵方|單體敵方|全體|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*速度(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => ({
            type: 'speed-buff',
            speedBonusPercent: Number(match[2]),
            durationSeconds:
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined,
        })
    )

    // 9. 速度降低
    collectMatches(
        /(降低|減少|削弱|下降|降|減)(?:敵方|全體敵方|單體敵方|我方|全體|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*速度(?:\s*(\d+(?:\.\d+)?)秒)?/g,
        match => ({
            type: 'speed-debuff',
            speedReductionPercent: Number(match[2]),
            durationSeconds:
                match[3] !== undefined
                    ? Number(match[3])
                    : undefined,
        })
    )

    // 10. 必殺值增加
    collectMatches(
        /(增加|提升|提高|加|施加|賦予)(?:敵方|全體敵方|單體敵方|我方|全體|自身|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*必殺值/g,
        match => ({
            type: 'ultimate-gauge',
            ultimateGaugePercent: Number(match[2]),
        })
    )

    // 11. 必殺值減少
    collectMatches(
        /(降低|減少|削弱|下降|降|減)(?:敵方|全體敵方|單體敵方|我方|全體|單體)?(?:小幅|中幅|大幅)?\s*(\d+(?:\.\d+)?)%\s*必殺值/g,
        match => ({
            type: 'ultimate-gauge-debuff',
            ultimateGaugeReductionPercent: Number(match[2]),
        })
    )


    return results
}



function hasUnparsedCalculationContent(
    text: string,
    matchedRanges: Array<{ start: number; end: number }>
): boolean {
    // 判斷指定位置是否已被某個解析規則涵蓋
    function isPositionMatched(position: number): boolean {
        return matchedRanges.some(
            range =>
                position >= range.start &&
                position < range.end
        )
    }

    // 可能涉及強度計算的效果關鍵詞
    const calculationKeywords =
        /雙攻|物攻|魔攻|物理攻擊|魔法攻擊|雙防|物防|魔防|物理防禦|魔法防禦|速度|必殺值|屬性傷害|[水火風地雷光暗](?:屬性)?傷害|傷害/g

    for (const match of text.matchAll(calculationKeywords)) {
        if (match.index === undefined) continue

        // 已經被解析規則涵蓋的關鍵詞不需要再次檢查
        if (isPositionMatched(match.index)) continue

        const position = match.index

        // 檢查關鍵詞附近是否存在效果動作
        // 避免單純提到某個屬性名稱就被判定為漏解析
        const nearbyText = text.slice(
            Math.max(0, position - 20),
            Math.min(text.length, position + match[0].length + 20)
        )

        const hasEffectAction =
            /增加|提升|提高|上升|降低|下降|減少|削弱|施加|賦予|附加|造成|加深|減弱|加/.test(
                nearbyText
            )

        if (hasEffectAction) {
            return true
        }
    }

    // 檢查有動作詞及百分比，但沒有被任何計算規則涵蓋的內容
    const percentageMatches = [...text.matchAll(
        /\d+(?:\.\d+)?%/g
    )]

    for (const match of percentageMatches) {
        if (match.index === undefined) continue

        if (isPositionMatched(match.index)) continue

        const position = match.index

        const nearbyText = text.slice(
            Math.max(0, position - 20),
            Math.min(text.length, position + match[0].length + 20)
        )

        const hasEffectAction =
            /增加|提升|提高|上升|降低|下降|減少|削弱|施加|賦予|附加|造成|加深|減弱|加/.test(
                nearbyText
            )

        if (hasEffectAction) {
            return true
        }
    }

    return false
}


function parseSingleEffect(
    originalText: string,
    source: 'skill' | 'talent'
): ParsedSkillEffect {
    const action = parseAction(originalText)
    const targetSide = parseTargetSide(originalText)
    const range = parseRange(originalText)

    const categories = parseCategories(originalText)

    // 取得這段文字中所有可解析的計算效果
    const calculationMatchRanges: Array<{
        start: number
        end: number
    }> = []

    const calculations = parseCalculationEffect(
        originalText,
        calculationMatchRanges
    )
    const hasUnparsedCalculation =
        hasUnparsedCalculationContent(
            originalText,
            calculationMatchRanges
        )

    // 判斷這段效果是否真的涉及強度計算
    const hasCalculationContent =
        /雙攻|物攻|魔攻|物理攻擊|魔法攻擊|雙防|物防|魔防|物理防禦|魔法防禦|速度|必殺值|屬性傷害|[水火風地雷光暗](?:屬性)?傷害|傷害|回血|治療/.test(
            originalText
        )


    const magnitudeMatch = originalText.match(
        /(小幅|中幅|大幅)/
    )

    const valueMatch = originalText.match(
        /(\d+(?:\.\d+)?)%/
    )

    const durationMatch = originalText.match(
        /(\d+(?:\.\d+)?)秒/
    )

    const chanceMatch = originalText.match(
        /(?:機率|概率)\s*(\d+(?:\.\d+)?)%/
    )

    const attribute = categories
        .map(category => CATEGORY_NAMES[category])
        .join('、')

    return {
        action,
        targetSide,
        range,
        target: range,

        category: categories[0] ?? 'other',
        attribute,

        searchableCategories:
            getSearchableCategories(categories),

        magnitude: magnitudeMatch?.[1] ?? '',
        value: valueMatch?.[1] ?? '',
        duration: durationMatch?.[1] ?? '',
        chance: chanceMatch?.[1] ?? '',

        originalText,
        source,

        // 沒有辨識到效果分類時，需要人工確認
        reviewRequired:
            categories.length === 0 &&
            !isConditionalDamageDescription(originalText),

        // 舊欄位保留第一筆，維持原有程式相容性
        calculation: calculations[0],

        // 新欄位保存所有解析成功的計算效果
        calculations,

        // 沒有任何計算效果，或複合數值效果沒有完整解析，都需要人工確認
        calculationReviewRequired:
            hasCalculationContent &&
            (
                calculations.length === 0 ||
                hasUnparsedCalculation
            ),
    }
}

// ======================================================
// 效果文字解析
// ======================================================

export function parseEffectText(
    text: string,
    source: 'skill' | 'talent' = 'skill'
): ParsedSkillEffect[] {
    if (!text?.trim()) return []

    const segments = splitCompoundEffects(text)

    return segments.map(segment =>
        parseSingleEffect(segment, source)
    )
}

// ======================================================
// 技能解析
// ======================================================

function parseSkillLevel(
    level: CharacterSkillLevel
): ParsedSkillLevel {
    const effect = level.effect ?? ''

    return {
        cooldown: level.cooldown ?? '',
        coefficient: level.coefficient ?? '',
        coefficientPercent: parseCoefficientPercent(
            level.coefficient ?? ''
        ),
        originalEffect: effect,
        effects: parseEffectText(effect),
    }
}

function parseSkill(
    skillName: 'ultimate' | 'skill2' | 'skill1',
    skill: CharacterSkill
): ParsedSkill {
    const initial = parseSkillLevel(skill.initial)
    const max = parseSkillLevel(skill.max)

    return {
        skillName,

        // 舊欄位先使用原始滿等資料
        cooldown: max.cooldown,
        coefficient: max.coefficient,
        originalEffect: max.originalEffect,
        effects: max.effects,

        initial,
        max,

        // 尚未套用天賦時，強化版與原始版相同
        talentInitial: { ...initial },
        talentMax: { ...max },
    }
}

// ======================================================
// 天賦效果套用
// ======================================================

function replaceMagnitude(
    text: string,
    value: string
): string {
    if (/(小幅|中幅|大幅)/.test(text)) {
        return text.replace(
            /(小幅|中幅|大幅)(?:\s*\d+(?:\.\d+)?%)?/,
            value
        )
    }

    return text
}


function replaceDuration(
    text: string,
    value: string
): string {
    return text.replace(
        /\d+(?:\.\d+)?秒/g,
        value
    )
}


function replaceHealing(
    text: string,
    value: string
): string {
    if (/回血/.test(text)) {
        return text.replace(
            /回血(?:\s*\d+(?:\.\d+)?%)?/,
            `回血${value}`
        )
    }

    return text
}

function replaceChance(
    text: string,
    value: string
): string {
    if (!/(黑暗|中毒|束縛|封印|有害狀態)/.test(text)) {
        return text
    }

    if (/(機率|概率)/.test(text)) {
        return text.replace(
            /((?:機率|概率)\s*)\d+(?:\.\d+)?%/,
            `$1${value}`
        )
    }

    return `${text}，機率${value}`
}


function applyChangeToLevel(
    level: ParsedSkillLevel,
    changes: TalentChange[]
): ParsedSkillLevel {
    let cooldown = level.cooldown

    // 將技能效果拆成獨立項目
    let effectSegments = splitCompoundEffects(
        level.originalEffect || ''
    )

    for (const change of changes) {
        // CD 修改：作用於整個技能
        if (change.type === 'cooldown') {
            cooldown = change.value
            continue
        }

        // 新增效果：保留原本行為
        if (change.type === 'add') {
            effectSegments.push(change.value)
            continue
        }

        // 逐項判斷是否符合天賦指定範圍
        effectSegments = effectSegments.map((segment, index) => {
            const parsedEffect = parseSingleEffect(segment, 'skill')

            // 指定效果序號
            if (
                change.effectIndex !== undefined &&
                change.effectIndex !== index
            ) {
                return segment
            }

            // 指定效果類別
            if (
                change.effectCategory &&
                !parsedEffect.searchableCategories.includes(
                    change.effectCategory
                ) &&
                parsedEffect.category !== change.effectCategory
            ) {
                return segment
            }

            let updated = segment

            if (change.type === 'replace') {
                if (change.field === 'magnitude') {
                    updated = replaceMagnitude(
                        updated,
                        change.value
                    )
                }

                if (change.field === 'duration') {
                    updated = replaceDuration(
                        updated,
                        change.value
                    )
                }
            }

            if (change.type === 'healing') {
                updated = replaceHealing(
                    updated,
                    change.value
                )
            }

            if (change.type === 'chance') {
                updated = replaceChance(
                    updated,
                    change.value
                )
            }

            return updated
        })
    }

    const originalEffect = effectSegments.join('；')

    return {
        cooldown,
        coefficient: level.coefficient,
        coefficientPercent: parseCoefficientPercent(
            level.coefficient
        ),
        originalEffect,
        effects: parseEffectText(originalEffect),
    }
}


function applyTalentChanges(
    skill: ParsedSkill,
    changes: TalentChange[]
): ParsedSkill {
    const talentInitial = applyChangeToLevel(
        skill.talentInitial,
        changes
    )

    const talentMax = applyChangeToLevel(
        skill.talentMax,
        changes
    )

    return {
        ...skill,

        // 舊欄位維持天賦強化後的滿等資料
        cooldown: talentMax.cooldown,
        coefficient: talentMax.coefficient,
        originalEffect: talentMax.originalEffect,
        effects: talentMax.effects,

        // 原始 initial / max 完全保留
        talentInitial,
        talentMax,
    }
}

// ======================================================
// 完整角色解析
// ======================================================

export function parseCharacter(
    character: Character
): ParsedCharacter {
    let skills: ParsedSkill[] = [
        parseSkill('ultimate', character.ultimate),
        parseSkill('skill2', character.skill2),
        parseSkill('skill1', character.skill1),
    ]

    const talentResults = parseTalent(character.talent)

    const reviewIssues: string[] = []
    const calculationReviewIssues: string[] = []

    if (character.reviewRequired) {
        reviewIssues.push(...character.reviewIssues)
    }

    for (const result of talentResults) {
        if (result.reviewRequired) {
            reviewIssues.push(
                `天賦解析需要確認：${result.originalText}`
            )
            continue
        }

        if (!result.skillName) {
            reviewIssues.push(
                `天賦技能對應需要確認：${result.originalText}`
            )
            continue
        }

        const index = skills.findIndex(
            item => item.skillName === result.skillName
        )

        if (index === -1) {
            reviewIssues.push(
                `找不到天賦對應技能：${result.originalText}`
            )
            continue
        }

        // 天賦依照節點順序累積套用
        skills[index] = applyTalentChanges(
            skills[index],
            result.changes
        )
    }


    // 檢查原始與天賦強化後的效果
    for (const skill of skills) {
        const levels = [
            ['原始初始', skill.initial],
            ['原始滿等', skill.max],
            ['天賦初始', skill.talentInitial],
            ['天賦滿等', skill.talentMax],
        ] as const

        for (const [levelName, level] of levels) {
            for (const effect of level.effects) {
                // 原本功能查詢的審查
                if (effect.reviewRequired) {
                    reviewIssues.push(
                        `${skill.skillName} ${levelName}效果需要確認：${effect.originalText}`
                    )
                }

                // 強度計算專用的審查
                if (effect.calculationReviewRequired) {
                    calculationReviewIssues.push(
                        `${skill.skillName} ${levelName}效果尚未支援強度計算：${effect.originalText}`
                    )
                }
            }
        }
    }    

    // 暫時列出尚未支援強度計算的效果
    if (calculationReviewIssues.length > 0) {
        console.log(
            `[強度計算待確認] ${character.name}`,
            unique(calculationReviewIssues)
        )
    }

    return {        
        characterId: character.id,
        characterName: character.name,
        skills,
        talentResults,
        reviewRequired: reviewIssues.length > 0,
        reviewIssues: unique(reviewIssues),
        calculationReviewIssues: unique(calculationReviewIssues),
    }
}

// ======================================================
// 搜尋分類輔助
// ======================================================

// 判斷效果是否符合指定副詞條
export function matchesEffectCategory(
    effect: ParsedSkillEffect,
    category: EffectCategory
): boolean {
    return effect.searchableCategories.includes(category)
}

// 依照使用者輸入的名稱取得分類
export function getEffectCategoriesByName(
    name: string
): EffectCategory[] {
    const normalized = name.trim()

    return CATEGORY_ALIASES[normalized] ?? []
}

// 取得副詞條顯示名稱
export function getEffectCategoryName(
    category: EffectCategory
): string {
    return CATEGORY_NAMES[category]
}

// ======================================================
// 測試工具：不會自動執行
// ======================================================

// ======================================================
// 測試工具：計算效果解析與未解析內容檢查
// ======================================================

export function testCalculationParser() {
    const testCases = [
        {
            text: '增加20%物攻',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '降低20%物防及魔防',
            expectedCount: 2,
            expectedReview: false,
        },
        {
            text: '增加30%物攻，降低15%魔防',
            expectedCount: 2,
            expectedReview: false,
        },
        {
            text: '增加20%物攻，增加30%速度',
            expectedCount: 2,
            expectedReview: false,
        },
        {
            text: '增加20%物攻，增加30%未知效果',
            expectedCount: 1,
            expectedReview: true,
        },
        {
            text: '增加20%物防及物防',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '降低20%物攻及魔攻',
            expectedCount: 2,
            expectedReview: false,
        },
        {
            text: '增加20%火屬性傷害',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '傷害增加20%',
            expectedCount: 1,
            expectedReview: false,
        },
        { text: '全體回血120%', expectedCount: 1, expectedReview: false },
        { text: '全體回血360%', expectedCount: 1, expectedReview: false },
        { text: '加全體大幅60%雙攻15秒', expectedCount: 2, expectedReview: false },
        { text: '加全體大幅60%雙防15秒', expectedCount: 2, expectedReview: false },
        { text: '增加20%雙防', expectedCount: 2, expectedReview: false },
        { text: '降全體小幅20%物攻10秒', expectedCount: 1, expectedReview: false },
        { text: '降單體中幅40%物攻10秒', expectedCount: 1, expectedReview: false },
        { text: '降單體中幅30%物防15秒', expectedCount: 1, expectedReview: false },
        { text: '降全體中幅30%物防10秒', expectedCount: 1, expectedReview: false },
        { text: '降低20%物防及魔防', expectedCount: 2, expectedReview: false }, 
        { text: '降低20%雙攻', expectedCount: 2, expectedReview: false },
        { text: '降全體大幅60%雙攻15秒', expectedCount: 2, expectedReview: false },
        { text: '加自身中幅40%速度15秒', expectedCount: 1, expectedReview: false },
        { text: '加全體小幅20%速度15秒', expectedCount: 1, expectedReview: false },
        { text: '增加20%速度', expectedCount: 1, expectedReview: false },
        { text: '提升全體30%速度10秒', expectedCount: 1, expectedReview: false },
        { text: '降全體大幅60%速度15秒', expectedCount: 1, expectedReview: false },
        { text: '降全體小幅20%速度10秒', expectedCount: 1, expectedReview: false },
        { text: '降單體中幅40%速度15秒', expectedCount: 1, expectedReview: false },
        { text: '增加全體40%必殺值', expectedCount: 1, expectedReview: false },
        { text: '增加20%必殺值', expectedCount: 1, expectedReview: false },
        { text: '提升自身30%必殺值', expectedCount: 1, expectedReview: false },
        { text: '降低敵方40%必殺值', expectedCount: 1, expectedReview: false },
        {
            text: '降自身大幅40%雙防10秒',
            expectedCount: 2,
            expectedReview: false,
        },
        {
            text: '降自身大幅40%物防10秒',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '加全體中幅40%風屬傷害15秒',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '加全體中幅40%風屬性傷害15秒',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '增加火屬性傷害20%',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '增加全體中幅40%傷害15秒',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '降低自身大幅40%傷害10秒',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '傷害增加20%',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '傷害降低20%',
            expectedCount: 1,
            expectedReview: false,
        },

        {
            text: '自身生命90%以上+120%傷害（491%）',
            expectedCount: 1,
            expectedReview: false,
        },
        {
            text: '自身生命90%以上+120%（491%）',
            expectedCount: 1,
            expectedReview: false,
        },

        
    ]

    return testCases.map(testCase => {
        
        const matchedRanges: Array<{
            start: number
            end: number
        }> = []

        const calculations = parseCalculationEffect(
            testCase.text,
            matchedRanges
        )

        const reviewRequired =
            calculations.length === 0 ||
            hasUnparsedCalculationContent(
                testCase.text,
                matchedRanges
            )

        return {
            ...testCase,
            actualCount: calculations.length,
            actualCalculations: calculations,
            actualReview: reviewRequired,
            passed:
                calculations.length === testCase.expectedCount &&
                reviewRequired === testCase.expectedReview,
            calculations,
            durationSeconds: calculations.map(item => item.durationSeconds),
        }
    })
}


export function logCalculationParserTest() {
    const results = testCalculationParser()

    console.table(
        results.map(item => ({
            原始文字: item.text,
            預期效果數量: item.expectedCount,
            實際效果數量: item.actualCount,
            預期待確認: item.expectedReview ? '是' : '否',
            實際待確認: item.actualReview ? '是' : '否',
            測試結果: item.passed ? '通過' : '失敗',
        }))
    )
    return results
}



export function testTalentParser() {
    const testCases = [
        '天賦9時1技能效果改為大幅60%',
        '天賦12時2技能效果改為中幅40%',
        '天賦12時2技能CD改為12秒',
        '天賦12時2技能新增降單體小幅20%魔防15秒',
        '天賦9時1技能黑暗機率改為80%',
        '天賦15時必殺技效果新增加全體小幅20%魔攻15秒',
        '天賦9時1技能效果改為15秒',
        '天賦12時2技能效果改為中幅',
        '天賦12時2技能回血改為198%',
    ]

    return testCases.map(text => ({
        text,
        result: parseTalentLine(text),
    }))
}

export function logTalentParserTest() {
    console.table(
        testTalentParser().map(item => ({
            原始文字: item.text,
            對應技能: item.result?.skillName ?? '未辨識',
            變更類型: item.result?.changes
                .map(change => change.type)
                .join('、') || '未辨識',
            解析結果: item.result?.changes
                .map(change => change.value)
                .join('、') || '無',
            需要確認: item.result?.reviewRequired ?? true,
        }))
    )
}


// 強度計算效果審查統計
export interface CalculationReviewSummary {
    totalCharacters: number
    reviewedCharacters: number
    totalIssues: number
    issues: {
        characterId: string
        characterName: string
        messages: string[]
    }[]
}

export function getCalculationReviewSummary(
    characters: Character[]
): CalculationReviewSummary {
    const issues: CalculationReviewSummary['issues'] = []

    for (const character of characters) {
        const parsed = parseCharacter(character)

        if (parsed.calculationReviewIssues.length > 0) {
            issues.push({
                characterId: character.id,
                characterName: character.name,
                messages: unique(parsed.calculationReviewIssues),
            })
        }
    }

    return {
        totalCharacters: characters.length,
        reviewedCharacters: issues.length,
        totalIssues: issues.reduce(
            (total, item) => total + item.messages.length,
            0
        ),
        issues,
    }
}

