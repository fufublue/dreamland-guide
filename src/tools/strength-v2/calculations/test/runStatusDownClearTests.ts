import { parseEffectText } from '../../../../engine/parser/effectParser'
import {
    applyEffectsAtCast,
    createInitialEffectTimelineState,
} from '../effectTimeline'
import type { EngineEffect } from '../../../../engine/types/effect'

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`清除全體狀態下降測試失敗：${message}`)
    }
}

function parseOne(text: string): EngineEffect {
    const result = parseEffectText(text, 'skill')
    assert(result.length === 1, `應解析成一項效果：${text}`)
    return result[0]
}

// 新詞彙應被視為已知清除效果，目標我方全體。
const clearEffect = parseOne('清除全體狀態下降')
assert(clearEffect.action === 'clear', '動作應解析為 clear')
assert(clearEffect.targetSide === 'ally', '未明確標示敵我時，清除預設作用於我方')
assert(clearEffect.range === 'all', '範圍應解析為全體')
assert(clearEffect.category === 'special', '狀態下降清除應歸為已知特殊效果')
assert(!clearEffect.reviewRequired, '清除全體狀態下降不應被標記為未知效果')

// 建立我方能力下降、有害狀態、正面增益，以及敵方負面效果。
const alliedAttackDown = parseOne('降低我方小幅20%物攻15秒')
const alliedSpeedDown = parseOne('降低我方小幅10%速度15秒')
const alliedControl = parseOne('我方全體束縛15秒')
const alliedPoison = parseOne('我方全體中毒15秒')
const alliedHarmfulStatus = parseOne('我方全體有害狀態15秒')
const alliedAttackBuff = parseOne('增加我方小幅20%物攻15秒')
const enemyAttackDown = parseOne('降低敵方小幅20%物攻15秒')

const initial = createInitialEffectTimelineState()
const seeded = applyEffectsAtCast(
    initial,
    [
        alliedAttackDown,
        alliedSpeedDown,
        alliedControl,
        alliedPoison,
        alliedHarmfulStatus,
        alliedAttackBuff,
        enemyAttackDown,
    ],
    0,
)
assert(seeded.states.length === 1, '100%效果應維持單一狀態分支')
assert(seeded.states[0].activeEffects.length === 7, '清除前應有七項持續效果')

const cleared = applyEffectsAtCast(seeded.states, [clearEffect], 1)
assert(cleared.states.length === 1, '100%清除應維持單一狀態分支')
const remaining = cleared.states[0].activeEffects.map(item => item.effect)

assert(
    !remaining.includes(alliedAttackDown) && !remaining.includes(alliedSpeedDown),
    '應清除我方物攻與速度下降',
)
assert(
    !remaining.includes(alliedControl) &&
        !remaining.includes(alliedPoison) &&
        !remaining.includes(alliedHarmfulStatus),
    '應清除我方控制、持續傷害及泛稱有害狀態',
)
assert(remaining.includes(alliedAttackBuff), '不應清除我方正面攻擊增益')
assert(remaining.includes(enemyAttackDown), '不應清除敵方身上的負面效果')
assert(remaining.length === 2, '清除後應只留下我方正面增益與敵方負面效果')

console.log('清除全體狀態下降解析與效果時間軸測試通過。')
