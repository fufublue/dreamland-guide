
/**
 * 強度計算器 V2：傷害計算輔助
 *
 * 本檔案只處理傷害計算所需的時間換算，
 * 不處理疊分樂分數，也不模擬完整戰鬥。
 */

// 行動條速度換算常數
export const ACTION_GAUGE_SPEED_CONSTANT = 335

/**
 * 計算角色行動條累積一格所需時間。
 *
 * 公式：
 * 335 / 角色速度
 */
export function calculateActionGaugeTime(
    speed: number | null,
): number | null {
    if (
        speed === null ||
        !Number.isFinite(speed) ||
        speed <= 0
    ) {
        return null
    }

    return ACTION_GAUGE_SPEED_CONSTANT / speed
}

/**
 * 依角色速度與計算時間，產生所有行動時間點。
 *
 * 例如：
 * 速度 100
 * 計算時間 10 秒
 *
 * 行動時間點：
 * 0、3.35、6.70
 */
export function generateActionTimes(
    speed: number | null,
    remainingSeconds: number,
): number[] {
    const interval = calculateActionGaugeTime(speed);

    if (
        interval === null ||
        !Number.isFinite(remainingSeconds) ||
        remainingSeconds < 0
    ) {
        return [];
    }

    const times: number[] = [];

    for (let index = 0; ; index++) {
        const time = index * interval;

        if (time > remainingSeconds + 1e-9) {
            break;
        }

        times.push(Number(time.toFixed(6)));
    }

    return times;
}

/**
 * 將技能冷卻時間轉換成秒數。
 *
 * 支援：
 * "10秒" → 10
 * "12.5秒" → 12.5
 * "10" → 10
 *
 * 無法辨識時回傳 null，不擅自當成 0。
 */
export function parseCooldownSeconds(
    cooldown: string | null | undefined,
): number | null {
    if (!cooldown || !cooldown.trim()) {
        return null;
    }

    const normalized = cooldown.trim();

    const match = normalized.match(
        /^(\d+(?:\.\d+)?)\s*(秒)?$/,
    );

    if (!match) {
        return null;
    }

    const seconds = Number(match[1]);

    if (!Number.isFinite(seconds) || seconds < 0) {
        return null;
    }

    return seconds;
}

/**
 * 判斷技能在目前行動時間點是否可以施放。
 */
export function isSkillReadyAtTime(
    lastCastAt: number | null,
    cooldownSeconds: number | null,
    actionTime: number,
): boolean {
    // 尚未施放過，可以使用
    if (lastCastAt === null) {
        return true;
    }

    if (cooldownSeconds === null) {
        return false;
    }

    return actionTime + 1e-9 >= lastCastAt + cooldownSeconds;
}
