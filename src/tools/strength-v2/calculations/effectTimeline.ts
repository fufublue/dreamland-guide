/*
第二種模式需要的「效果時間軸核心」：追蹤效果持續時間、發動機率、同類效果覆蓋，以及機率狀態合併。它不會自行計算傷害，也不會改動另外兩種計算模式
它會負責：
1. 效果觸發：每次技能施放時，每個效果獨立建立成功與失敗的機率分支。
2. 效果持續：從技能施放時開始計算持續時間。
3. 效果覆蓋：同類效果不相加，幅度取較高者，持續時間採後施放效果的時間。
4. 機率合併：完全相同的效果狀態合併，避免不必要的分支膨脹。
技能施放時的效果判定。多效果獨立機率分支。效果持續時間。同類效果覆蓋與刷新。相同狀態合併及機率加總。各時間點的期望效果狀態。

第二步：時間軸的資料設計
資料	用途
probability	這個狀態發生的機率
activeEffects	目前有效的效果
groupKey	判斷是否屬於同類效果
magnitude	效果幅度
startTime	效果開始時間
expiresAt	效果到期時間

有持續時間：從技能施放時開始生效，直到持續時間結束。
即時效果：例如治療、清除及必殺值增加，不加入持續中的效果清單。
其他沒有持續時間或無法辨識持續時間的效果：暫不加入時間軸，並留下警告。
有發動機率：仍依照每次技能施放獨立判定的機率期望值處理。
沒有標示發動機率：依照先前確認的規則，視為 100%。
會保留每個效果的原始 EngineEffect 資料，不急著把「小幅」「中幅」等文字轉成數值，避免尚未確認的效果幅度被錯誤計算

實作時會遵守三個重要原則：
1. 效果獨立分支：同一技能的不同效果，各自依發動機率建立分支，並合併完全相同的狀態。
2. 覆蓋與刷新分開處理：成功發動後，效果幅度取新舊較高者，但持續時間一律採新效果的時間。
3. 到期時間採包含邊界：效果到期時間等於當前施放時間時，仍參與當次效果判定及傷害計算。
另外，我會讓這個模組只負責效果時間軸及機率狀態，不直接修改角色能力值。
後續再由傷害計算模組讀取時間軸結果，這樣比較容易維護，也能避免影響第一、第三種模式。

這個版本先完成的功能
- 每次技能施放都重新判定發動機率。
- 未標示機率時視為 100%。
- 同一技能的不同效果獨立判定。
- 同類效果不相加，幅度取較高者。
- 新效果成功發動時，重新計算持續時間。
- 不同效果可以同時存在。
- 效果到期與施放同時發生時，保留到當次傷害計算結束。
- 完全相同的機率狀態會合併。
目前還沒有把效果轉換成攻擊力、暴擊率或敵方防禦的實際數值變化。 這是刻意保留的，下一階段才會將時間軸接到傷害計算，避免混淆效果追蹤與能力值計算。
*/


import type { EngineEffect } from '../../../engine/types/effect';

/**
 * 時間軸中的單一效果。
 *
 * expiresAt:
 * - number：效果到期時間（秒）
 * - null：沒有到期時間，視為持續有效。
 *   正常透過 applyEffectsAtCast 加入的效果，
 *   必須先通過持續時間檢查。
 *
 * magnitudeValue：
 * - 用於比較同類效果的數值
 * - 不會直接取代 EngineEffect 原始資料
 */
export type TimedEffect = {
    effect: EngineEffect;
    effectKey: string;
    appliedAt: number;
    expiresAt: number | null;
    magnitudeValue: number | null;
};

/**
 * 一種可能的效果狀態。
 *
 * probability 代表這種狀態發生的機率。
 */
export type EffectTimelineState = {
    activeEffects: TimedEffect[];
    probability: number;
};

/**
 * 套用效果後的結果。
 */
export type EffectTimelineResult = {
    states: EffectTimelineState[];
    warnings: string[];
};

/**
 * 建立初始時間軸狀態。
 */
export function createInitialEffectTimelineState(): EffectTimelineState[] {
    return [
        {
            activeEffects: [],
            probability: 1,
        },
    ];
}

/**
 * 取得百分比數值。
 *
 * 例如：
 * "20%" -> 20
 * "小幅20%" -> 20
 */
function parsePercent(value: string | null | undefined): number | null {
    if (!value) return null;

    const match = value.match(/-?\d+(?:\.\d+)?/);

    if (!match) return null;

    const result = Number(match[0]);

    return Number.isFinite(result) ? result : null;
}

/**
 * 取得效果發動機率。
 *
 * 未標示機率時，視為 100%。
 * 有標示但無法解析時，回傳 null。
 */
function parseEffectChance(
    chance: string | null | undefined,
): number | null {
    if (!chance || !chance.trim()) {
        return 1
    }

    const value = parsePercent(chance)

    if (value === null) {
        return null
    }

    return Math.max(0, Math.min(100, value)) / 100
}
/**
 * 將持續時間轉換成秒數。
 *
 * 支援：
 * - 10秒
 * - 10 秒
 * - 1分鐘
 * - 1.5分鐘
 *
 * 沒有填寫持續時間時回傳 null。
 * 無法辨識的非空文字也回傳 null，但會另外產生警告。
 */
function parseDuration(
    duration: string | null | undefined,
): {
    seconds: number | null;
    invalid: boolean;
} {
    if (!duration || !duration.trim()) {
        return {
            seconds: null,
            invalid: true,
        };
    }

    const normalized = duration.trim();

    const match = normalized.match(
        /(\d+(?:\.\d+)?)\s*(秒|分鐘|分)/,
    );

    if (!match) {
        return {
            seconds: null,
            invalid: true,
        };
    }

    const value = Number(match[1]);

    if (!Number.isFinite(value) || value < 0) {
        return {
            seconds: null,
            invalid: true,
        };
    }

    const unit = match[2];

    return {
        seconds: unit === '秒' ? value : value * 60,
        invalid: false,
    };
}

// 不需要進入持續效果時間軸的即時效果
function isNonTimelineEffect(effect: EngineEffect): boolean {
    const text = effect.originalText || '';

    return (
        /回血|治療|清除|必殺值|立即退場/.test(text) ||
        /自身生命\d+%以上/.test(text)
    );
}

/**
 * 判斷兩個效果是否屬於同一類。
 *
 * 增益與減益分開處理。
 * 不同目標、不同屬性的效果也不會互相覆蓋。
 * 這樣後續的同類效果覆蓋及狀態合併，也會一併區分效果範圍。
 */
function createEffectKey(effect: EngineEffect): string {
    const attribute = effect.attribute || effect.category;

    return [
        effect.targetSide,
        effect.range,
        effect.action,
        effect.category,
        attribute,
    ].join('|');
}

/**
 * 取得效果的比較數值。
 *
 * 優先使用 magnitude，沒有時才使用 value。
 */
function getMagnitudeValue(
    effect: EngineEffect,
): number | null {
    return (
        parsePercent(effect.magnitude) ??
        parsePercent(effect.value)
    );
}

/**
 * 比較新舊效果幅度。
 *
 * 同類效果覆蓋時：
 * - 幅度採較高者
 * - 持續時間仍然使用新效果的持續時間
 */
function getHigherMagnitude(
    previous: number | null,
    incoming: number | null,
): number | null {
    if (previous === null) return incoming;
    if (incoming === null) return previous;

    return Math.max(previous, incoming);
}

/**
 * 成功發動效果後，更新時間軸。
 */
function applySuccessfulEffect(
    state: EffectTimelineState,
    effect: EngineEffect,
    castTime: number,
): EffectTimelineState {
    const effectKey = createEffectKey(effect);
    const magnitudeValue = getMagnitudeValue(effect);

    const durationResult = parseDuration(effect.duration);

    const expiresAt =
        durationResult.seconds === null
            ? null
            : castTime + durationResult.seconds;

    const previousIndex = state.activeEffects.findIndex(
        (item) => item.effectKey === effectKey,
    );

    const nextEffects = [...state.activeEffects];

    if (previousIndex >= 0) {
        const previous = nextEffects[previousIndex]

        const higherMagnitude = getHigherMagnitude(
            previous.magnitudeValue,
            magnitudeValue,
        )

        // 如果新效果幅度較高或相同，使用新效果資料。
        // 如果舊效果幅度較高，保留舊效果資料。
        const useIncomingEffect =
            magnitudeValue !== null &&
            (
                previous.magnitudeValue === null ||
                magnitudeValue >= previous.magnitudeValue
            )

        nextEffects[previousIndex] = {
            effect: useIncomingEffect
                ? effect
                : previous.effect,

            effectKey,

            // 開始時間更新為本次施放時間。
            appliedAt: castTime,

            // 持續時間一律採用新效果。
            expiresAt,

            // 幅度保留新舊效果中較高者。
            magnitudeValue: higherMagnitude,
        }
    } else {
        nextEffects.push({
            effect,
            effectKey,
            appliedAt: castTime,
            expiresAt,
            magnitudeValue,
        });
    }

    return {
        activeEffects: nextEffects,
        probability: state.probability,
    };
}

/**
 * 產生狀態識別字串。
 *
 * 完全相同的效果狀態可以合併機率。
 */

function createStateKey(
    state: EffectTimelineState,
): string {
    return JSON.stringify(
        state.activeEffects
            .map(item => ({
                effectKey: item.effectKey,
                appliedAt: item.appliedAt,
                expiresAt: item.expiresAt,
                magnitudeValue: item.magnitudeValue,

                // 納入完整原始效果資料，避免不同效果被錯誤合併
                effect: item.effect,
            }))
            .sort((a, b) =>
                JSON.stringify(a).localeCompare(
                    JSON.stringify(b),
                ),
            ),
    )
}


/**
 * 合併完全相同的機率狀態。
 */
export function mergeEffectTimelineStates(
    states: EffectTimelineState[],
): EffectTimelineState[] {
    const merged = new Map<string, EffectTimelineState>();

    for (const state of states) {
        if (state.probability <= 0) continue;

        const key = createStateKey(state);
        const existing = merged.get(key);

        if (existing) {
            existing.probability += state.probability;
        } else {
            merged.set(key, {
                activeEffects: [...state.activeEffects],
                probability: state.probability,
            });
        }
    }

    return Array.from(merged.values());
}

/**
 * 在技能施放當下判定效果。
 *
 * 每個效果的發動機率獨立判定。
 * 每次技能施放都會重新判定。
 *
 * 注意：
 * 這裡不會先移除「剛好在施放時間到期」的效果。
 * 舊效果會保留到當次傷害計算完成後。
 * 即時治療、清除、必殺值增加等效果不會被誤報持續時間錯誤。
 * 攻擊提升、暴擊率提升、敵方防禦降低等持續效果，仍會檢查持續時間。
 * 缺少持續時間的持續效果，仍會保留警告並暫不加入時間軸。
 */
export function applyEffectsAtCast(
    states: EffectTimelineState[],
    effects: EngineEffect[],
    castTime: number,
): EffectTimelineResult {
    // 先移除施放時間之前就已經到期的效果。
    // 到期時間剛好等於施放時間的效果仍然保留，
    // 讓它可以參與當次效果判定及傷害計算。
    let currentStates = states.map(state => ({
        ...state,
        activeEffects: state.activeEffects.filter(
            item =>
                item.expiresAt === null ||
                item.expiresAt >= castTime,
        ),
    }))

    const warnings: string[] = []

    for (const effect of effects) {

        // 即時效果不進入持續效果時間軸
        if (isNonTimelineEffect(effect)) {
            continue;
        }
        const durationResult = parseDuration(effect.duration);

        if (durationResult.invalid) {
            warnings.push(
                `效果持續時間未提供或無法辨識：「${effect.duration || '空白'}」，此效果暫不加入時間軸。`,
            );
            continue;
        }

        const chance = parseEffectChance(effect.chance);

        // 有標示機率但無法解析時，跳過此效果並留下警告。
        if (chance === null) {
            warnings.push(
                `效果發動機率無法辨識：「${effect.chance}」，此效果暫不加入時間軸。`,
            );
            continue;
        }
        const nextStates: EffectTimelineState[] = [];

        for (const state of currentStates) {
            // 未發動分支。
            if (chance < 1) {
                nextStates.push({
                    activeEffects: [...state.activeEffects],
                    probability: state.probability * (1 - chance),
                });
            }

            // 成功發動分支。
            if (chance > 0) {
                const appliedState = applySuccessfulEffect(
                    state,
                    effect,
                    castTime,
                );

                nextStates.push({
                    activeEffects: appliedState.activeEffects,
                    probability: state.probability * chance,
                });
            }
        }

        currentStates = mergeEffectTimelineStates(nextStates);
    }

    return {
        states: currentStates,
        warnings: Array.from(new Set(warnings)),
    };
}

/**
 * 取得指定時間點仍然有效的效果。
 *
 * 效果開始時間小於或等於指定時間才會生效。
 * 到期時間等於指定時間時，仍然視為有效。
 */
export function getActiveEffectsAtTime(
    state: EffectTimelineState,
    time: number,
): TimedEffect[] {
    return state.activeEffects.filter(
        (item) =>
            item.appliedAt <= time &&
            (
                item.expiresAt === null ||
                item.expiresAt >= time
            ),
    );
}
/**
 * 當次傷害計算完成後，移除已到期效果。
 *
 * 到期時間等於當前時間的效果，
 * 會在這一步才正式移除。
 */
export function expireEffectsAfterDamage(
    state: EffectTimelineState,
    actionTime: number,
): EffectTimelineState {
    return {
        activeEffects: state.activeEffects.filter(
            (item) =>
                item.expiresAt === null ||
                item.expiresAt > actionTime,
        ),
        probability: state.probability,
    };
}
