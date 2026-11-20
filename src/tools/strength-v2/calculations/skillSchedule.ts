
import {
    generateActionTimes,
    parseCooldownSeconds,
} from './ranking'

import type { EngineEffect } from '../../../engine/types/effect'

import {
    applyEffectsAtCast,
    createInitialEffectTimelineState,
    mergeEffectTimelineStates,
    type EffectTimelineState,
    type TimedEffect,
} from './effectTimeline'

export type ScheduledSkillKey =
    | 'normalAttack'
    | 'skill1'
    | 'skill2'
    | 'ultimate'

export interface SkillScheduleInput {
    speed: number | null
    remainingSeconds: number

    normalAttackDamage: number | null
    skill1Damage: number | null
    skill2Damage: number | null
    ultimateDamage: number | null

    skill1Cooldown: string | null
    skill2Cooldown: string | null

    ultimateUses: number | null

    calculateDamage?: (
        skillKey: ScheduledSkillKey,
        actionTime: number,
        activeEffects: TimedEffect[],
    ) => number | null

    calculateHealing?: (
        skillKey: ScheduledSkillKey,
        actionTime: number,
        activeEffects: TimedEffect[],
    ) => number | null

    getEffectsForSkill?: (
        skillKey: ScheduledSkillKey,
    ) => EngineEffect[]

    // 支援單一狀態或多個初始機率狀態
    initialEffectState?:
    | EffectTimelineState
    | EffectTimelineState[]
}

export interface ScheduledAction {
    skillKey: ScheduledSkillKey
    actionTime: number
    damage: number | null
    healing: number | null
}

export interface ScheduledActionProbability {
    skillKey: ScheduledSkillKey
    actionTime: number
    probability: number
    expectedDamage: number
    expectedHealing: number
}

export interface SkillScheduleResult {
    actions: ScheduledAction[]
    actionProbabilities: ScheduledActionProbability[]
    totalDamage: number | null
    totalHealing: number
    warnings: string[]
}

interface SearchState {
    lastSkill1Cast: number | null
    lastSkill2Cast: number | null
    ultimateUses: number
    effectState: EffectTimelineState
}

interface InternalActionProbability {
    skillKey: ScheduledSkillKey
    actionTime: number
    probability: number
    damageContribution: number
    healingContribution: number
}

interface SearchResult {
    totalDamage: number
    totalHealing: number
    actions: ScheduledAction[]
    representativeProbability: number
    actionProbabilities: InternalActionProbability[]
    warnings: string[]
}

const EPSILON = 1e-9

/**
 * 取得指定時間點仍有效的效果。
 *
 * 到期時間等於行動時間時，
 * 效果仍參與當次傷害計算。
 */
function getActiveEffects(
    effects: TimedEffect[],
    actionTime: number,
): TimedEffect[] {
    return effects.filter(effect => {
        if (effect.appliedAt > actionTime) {
            return false
        }

        return (
            effect.expiresAt === null ||
            effect.expiresAt >= actionTime
        )
    })
}

/**
 * 當次傷害完成後，移除已到期效果。
 */
function expireEffectsAfterDamage(
    state: EffectTimelineState,
    actionTime: number,
): EffectTimelineState {
    return {
        ...state,
        activeEffects: state.activeEffects.filter(effect => {
            return (
                effect.expiresAt === null ||
                effect.expiresAt > actionTime
            )
        }),
    }
}

/**
 * 建立效果狀態識別字串。
 *
 * 機率不參與狀態識別。
 */
function createEffectStateKey(
    state: EffectTimelineState,
): string {
    return JSON.stringify(
        state.activeEffects
            .map(effect => ({
                effectKey: effect.effectKey,
                appliedAt: effect.appliedAt,
                expiresAt: effect.expiresAt,
                magnitudeValue: effect.magnitudeValue,
            }))
            .sort((a, b) =>
                a.effectKey.localeCompare(b.effectKey),
            ),
    )
}

/**
 * 合併不同分支的行動機率及傷害貢獻。
 */
function mergeActionProbabilities(
    target: InternalActionProbability[],
    source: InternalActionProbability[],
    weight: number,
): void {
    for (const item of source) {
        const existing = target.find(
            current =>
                current.skillKey === item.skillKey &&
                Math.abs(
                    current.actionTime - item.actionTime,
                ) < EPSILON,
        )

        if (existing) {
            existing.probability +=
                item.probability * weight

            existing.damageContribution +=
                item.damageContribution * weight
            existing.healingContribution +=
                item.healingContribution * weight
        } else {
            target.push({
                skillKey: item.skillKey,
                actionTime: item.actionTime,
                probability: item.probability * weight,
                damageContribution:
                    item.damageContribution * weight,
                healingContribution:
                    item.healingContribution * weight,
            })
        }
    }
}

/**
 * 建立技能施放排程。
 *
 * 每個行動時間點只能施放一個技能。
 * 技能一、技能二依冷卻時間判定。
 * 必殺技依使用者設定次數施放，不檢查冷卻。
 * 普通攻擊填補其他行動。
 *
 * 支援效果觸發機率分支。
 * 每個效果狀態分支都能獨立最佳化後續技能順序。
 */
export function createSkillSchedule(
    input: SkillScheduleInput,
): SkillScheduleResult {
    const actionTimes = generateActionTimes(
        input.speed,
        input.remainingSeconds,
    )

    if (actionTimes.length === 0) {
        return {
            actions: [],
            actionProbabilities: [],
            totalDamage: null,
            totalHealing: 0,
            warnings: [
                '無法產生行動時間點，請檢查角色速度及計算時間。',
            ],
        }
    }

    const skill1Cooldown = parseCooldownSeconds(
        input.skill1Cooldown,
    )

    const skill2Cooldown = parseCooldownSeconds(
        input.skill2Cooldown,
    )

    const warnings: string[] = []

    if (skill1Cooldown === null) {
        warnings.push(
            '技能一冷卻時間無法辨識，暫不安排技能一。',
        )
    }

    if (skill2Cooldown === null) {
        warnings.push(
            '技能二冷卻時間無法辨識，暫不安排技能二。',
        )
    }

    let ultimateUses = 0

    if (input.ultimateUses === null) {
        warnings.push('尚未設定必殺技施放次數。')
    } else if (
        !Number.isFinite(input.ultimateUses) ||
        !Number.isInteger(input.ultimateUses) ||
        input.ultimateUses < 0
    ) {
        warnings.push(
            '必殺技施放次數必須是大於或等於零的整數。',
        )
    } else {
        ultimateUses = input.ultimateUses
    }

    const damageValues: Record<
        ScheduledSkillKey,
        number | null
    > = {
        normalAttack: input.normalAttackDamage,
        skill1: input.skill1Damage,
        skill2: input.skill2Damage,
        ultimate: input.ultimateDamage,
    }

    // 取得初始效果狀態。
    // createInitialEffectTimelineState 回傳的是陣列。
    const rawInitialStates = input.initialEffectState

        ? Array.isArray(input.initialEffectState)
            ? input.initialEffectState
            : [input.initialEffectState]

        : createInitialEffectTimelineState()

    // 排除無效的初始效果狀態。
    const validInitialStates = rawInitialStates.filter(
        state =>
            Number.isFinite(state.probability) &&
            state.probability > 0,
    )

    if (validInitialStates.length !== rawInitialStates.length) {
        warnings.push(
            '部分初始效果狀態的機率無效，已排除。',
        )
    }

    const initialStates = mergeEffectTimelineStates(
        validInitialStates,
    )

    const initialProbabilityTotal =
        initialStates.reduce(
            (sum, state) => sum + state.probability,
            0,
        )

    if (
        !Number.isFinite(initialProbabilityTotal) ||
        initialProbabilityTotal <= 0
    ) {
        return {
            actions: [],
            actionProbabilities: [],
            totalDamage: null,
            totalHealing: 0,
            warnings: [
                ...warnings,
                '有效初始效果狀態的總機率必須大於零。',
            ],
        }
    }

    // 每個效果狀態分支獨立搜尋。
    const memo = new Map<string, SearchResult>()

    function search(
        actionIndex: number,
        state: SearchState,
    ): SearchResult {
        if (actionIndex >= actionTimes.length) {
            return {
                totalDamage: 0,
                totalHealing: 0,
                actions: [],
                representativeProbability: 1,
                actionProbabilities: [],
                warnings: [],
            }
        }

        const memoKey = [
            actionIndex,
            state.lastSkill1Cast ?? 'none',
            state.lastSkill2Cast ?? 'none',
            state.ultimateUses,
            createEffectStateKey(state.effectState),
        ].join('|')

        const cached = memo.get(memoKey)

        if (cached) {
            return cached
        }

        const actionTime = actionTimes[actionIndex]

        const candidates: ScheduledSkillKey[] = [
            'normalAttack',
        ]

        if (
            skill1Cooldown !== null &&
            (
                state.lastSkill1Cast === null ||
                actionTime + EPSILON >=
                state.lastSkill1Cast + skill1Cooldown
            )
        ) {
            candidates.push('skill1')
        }

        if (
            skill2Cooldown !== null &&
            (
                state.lastSkill2Cast === null ||
                actionTime + EPSILON >=
                state.lastSkill2Cast + skill2Cooldown
            )
        ) {
            candidates.push('skill2')
        }

        if (state.ultimateUses < ultimateUses) {
            candidates.push('ultimate')
        }

        let bestResult: SearchResult | null = null

        for (const skillKey of candidates) {
            const activeEffects = getActiveEffects(
                state.effectState.activeEffects,
                actionTime,
            )

            // 計算當次傷害
            const damageResult = input.calculateDamage
                ? input.calculateDamage(
                    skillKey,
                    actionTime,
                    activeEffects,
                )
                : damageValues[skillKey]

            // 計算當次治療量
            const healingResult = input.calculateHealing
                ? input.calculateHealing(
                    skillKey,
                    actionTime,
                    activeEffects,
                )
                : null

            const candidateWarnings: string[] = []

            // 傷害數值有效時才保留
            const damage =
                damageResult !== null &&
                    Number.isFinite(damageResult) &&
                    damageResult >= 0
                    ? damageResult
                    : null

            // 治療數值有效時才保留
            let healing = 0

            if (healingResult !== null && healingResult !== undefined) {
                if (
                    Number.isFinite(healingResult) &&
                    healingResult >= 0
                ) {
                    healing = healingResult
                } else {
                    candidateWarnings.push(
                        `${skillKey} 在 ${actionTime} 秒的治療量無效，已視為 0。`,
                    )
                }
            }

            // 傷害與治療都沒有有效數值，才跳過這次技能
            if (damage === null && healing <= 0) {
                continue
            }

            // 純治療技能的傷害貢獻視為 0
            const damageValue = damage ?? 0

            // 先計算當次傷害，再判定技能附帶效果。
            const skillEffects =
                input.getEffectsForSkill?.(skillKey) ?? []

            let nextEffectStates: EffectTimelineState[]

            if (skillEffects.length > 0) {
                const applied = applyEffectsAtCast(
                    [state.effectState],
                    skillEffects,
                    actionTime,
                )

                nextEffectStates = applied.states
                candidateWarnings.push(...applied.warnings)
            } else {
                nextEffectStates = [state.effectState]
            }

            // 當次傷害完成後，才移除到期效果。
            nextEffectStates = mergeEffectTimelineStates(
                nextEffectStates.map(nextState =>
                    expireEffectsAfterDamage(
                        nextState,
                        actionTime,
                    ),
                ),
            )

            const nextStateBase = {
                lastSkill1Cast:
                    skillKey === 'skill1'
                        ? actionTime
                        : state.lastSkill1Cast,

                lastSkill2Cast:
                    skillKey === 'skill2'
                        ? actionTime
                        : state.lastSkill2Cast,

                ultimateUses:
                    state.ultimateUses +
                    (skillKey === 'ultimate' ? 1 : 0),
            }

            // 計算每個效果分支相對於目前狀態的機率。
            const currentProbability =
                state.effectState.probability

            const transitions = nextEffectStates.map(
                nextState => ({
                    state: nextState,
                    probability:
                        currentProbability > 0
                            ? nextState.probability /
                            currentProbability
                            : 0,
                }),
            )

            const totalTransitionProbability =
                transitions.reduce(
                    (sum, transition) =>
                        sum + transition.probability,
                    0,
                )

            if (totalTransitionProbability <= 0) {
                continue
            }

            let expectedFutureDamage = 0
            let expectedFutureHealing = 0

            let representativeActions: ScheduledAction[] = []

            let representativeProbability = 0

            const actionProbabilities: InternalActionProbability[] = [
                {
                    skillKey,
                    actionTime,
                    probability: 1,
                    damageContribution: damageValue,
                    healingContribution: healing,
                },
            ]

            for (const transition of transitions) {
                const transitionProbability =
                    transition.probability /
                    totalTransitionProbability

                if (transitionProbability <= 0) {
                    continue
                }

                // 每個機率分支各自重新最佳化後續技能順序。
                const futureResult = search(
                    actionIndex + 1,
                    {
                        ...nextStateBase,
                        effectState: transition.state,
                    },
                )

                expectedFutureDamage +=
                    futureResult.totalDamage *
                    transitionProbability

                expectedFutureHealing +=
                    futureResult.totalHealing *
                    transitionProbability

                mergeActionProbabilities(
                    actionProbabilities,
                    futureResult.actionProbabilities,
                    transitionProbability,
                )

                candidateWarnings.push(
                    ...futureResult.warnings,
                )

                // 找出機率最高的完整排程分支。
                const branchProbability =
                    transitionProbability *
                    futureResult.representativeProbability

                if (
                    branchProbability >
                    representativeProbability
                ) {
                    representativeProbability =
                        branchProbability

                    representativeActions =
                        futureResult.actions
                }
            }

            const candidateResult: SearchResult = {
                totalDamage:
                    damageValue + expectedFutureDamage,

                totalHealing:
                    healing + expectedFutureHealing,

                actions: [
                    {
                        skillKey,
                        actionTime,
                        damage,
                        healing,
                    },
                    ...representativeActions,
                ],

                representativeProbability,

                actionProbabilities,

                warnings: [
                    ...new Set(candidateWarnings),
                ],
            }

            if (
                bestResult === null ||
                candidateResult.totalDamage >
                bestResult.totalDamage
            ) {
                bestResult = candidateResult
            }
        }

        const result = bestResult ?? {
            totalDamage: 0,
            totalHealing: 0,
            actions: [],
            representativeProbability: 1,
            actionProbabilities: [],
            warnings: [],
        }

        memo.set(memoKey, result)

        return result
    }

    // 將所有初始狀態的計算結果合併。
    let expectedTotalDamage = 0
    let expectedTotalHealing = 0

    let representativeActions: ScheduledAction[] = []

    let representativeProbability = -1

    const combinedActionProbabilities:
        InternalActionProbability[] = []

    const resultWarnings: string[] = []

    for (const initialState of initialStates) {
        const initialWeight =
            initialState.probability /
            initialProbabilityTotal

        if (initialWeight <= 0) {
            continue
        }

        const result = search(
            0,
            {
                lastSkill1Cast: null,
                lastSkill2Cast: null,
                ultimateUses: 0,
                effectState: initialState,
            },
        )

        expectedTotalDamage +=
            result.totalDamage * initialWeight
        expectedTotalHealing +=
            result.totalHealing * initialWeight

        mergeActionProbabilities(
            combinedActionProbabilities,
            result.actionProbabilities,
            initialWeight,
        )

        resultWarnings.push(...result.warnings)

        const branchProbability =
            initialWeight *
            result.representativeProbability

        if (
            branchProbability >
            representativeProbability
        ) {
            representativeProbability =
                branchProbability

            representativeActions = result.actions
        }
    }

    const actionProbabilities: ScheduledActionProbability[] =
        combinedActionProbabilities.map(item => ({
            skillKey: item.skillKey,
            actionTime: item.actionTime,
            probability: item.probability,

            expectedDamage:
                item.probability > 0
                    ? item.damageContribution /
                    item.probability
                    : 0,

            expectedHealing:
                item.probability > 0
                    ? item.healingContribution /
                    item.probability
                    : 0,
        }))
    return {
        actions: representativeActions,
        actionProbabilities,
        totalDamage:
            combinedActionProbabilities.length > 0
                ? expectedTotalDamage
                : null,
        totalHealing: expectedTotalHealing,
        warnings: [
            ...new Set([
                ...warnings,
                ...resultWarnings,
            ]),
        ],
    }
}
