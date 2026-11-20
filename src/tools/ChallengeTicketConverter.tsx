
import { useState } from 'react'

const difficulties = [
    { name: '地獄', cost: 30, badges: 72 },
    { name: '惡夢', cost: 25, badges: 50 },
    { name: '極難', cost: 20, badges: 36 },
    { name: '困難', cost: 15, badges: 24 },
    { name: '普通', cost: 10, badges: 14 },
    { name: '簡單', cost: 5, badges: 6 },
]

type Plan = {
    badges: number
    counts: number[]
}

export default function ChallengeTicketConverter() {
    const [target, setTarget] = useState<70 | 30>(70)
    const [completed, setCompleted] = useState('15')
    const [tickets, setTickets] = useState('1384')

    function toNumber(value: string) {
        const result = Number(value)
        return Number.isFinite(result) ? result : 0
    }

    const completedCount = Math.max(
        0,
        Math.floor(toNumber(completed))
    )

    const currentTickets = Math.max(
        0,
        Math.floor(toNumber(tickets))
    )

    const remainingRuns = Math.max(0, target - completedCount)
    const minimumCost = remainingRuns * 5
    const isInsufficient = currentTickets < minimumCost

    let bestPlan: Plan | null = null
    let bestUsedTickets = 0

    if (!isInsufficient) {
        // 所有難度的券數都是 5 的倍數，以 5 張為一個單位計算
        const budget = Math.floor(currentTickets / 5)

        // runs 會在達成目標後固定為 remainingRuns
        // 因此也能搜尋超過目標的最佳組合
        const dp: (Plan | null)[][] = Array.from(
            { length: budget + 1 },
            () => Array.from(
                { length: remainingRuns + 1 },
                () => null
            )
        )

        dp[0][0] = {
            badges: 0,
            counts: difficulties.map(() => 0),
        }

        // 完全背包：每種難度都可以重複挑戰
        for (let cost = 0; cost <= budget; cost++) {
            for (let runs = 0; runs <= remainingRuns; runs++) {
                const current = dp[cost][runs]

                if (!current) continue

                difficulties.forEach((difficulty, index) => {
                    const nextCost = cost + difficulty.cost / 5

                    if (nextCost > budget) return

                    const nextRuns = Math.min(
                        remainingRuns,
                        runs + 1
                    )

                    const nextBadges =
                        current.badges + difficulty.badges

                    const existing = dp[nextCost][nextRuns]

                    if (!existing || nextBadges > existing.badges) {
                        const nextCounts = [...current.counts]
                        nextCounts[index] += 1

                        dp[nextCost][nextRuns] = {
                            badges: nextBadges,
                            counts: nextCounts,
                        }
                    }
                })
            }
        }

        // 從所有達成目標的組合中選出徽章最多者
        // 徽章相同時，優先使用較多挑戰券
        for (let cost = 0; cost <= budget; cost++) {
            const plan = dp[cost][remainingRuns]

            if (!plan) continue

            const usedTickets = cost * 5

            if (
                !bestPlan ||
                plan.badges > bestPlan.badges ||
                (
                    plan.badges === bestPlan.badges &&
                    usedTickets > bestUsedTickets
                )
            ) {
                bestPlan = plan
                bestUsedTickets = usedTickets
            }
        }
    }

    const bestCounts = bestPlan?.counts ?? difficulties.map(() => 0)

    const totalRuns = bestCounts.reduce(
        (sum, count) => sum + count,
        0
    )

    const finalTotalRuns = completedCount + totalRuns
    const remainingTickets = currentTickets - bestUsedTickets
    const extraRuns = Math.max(0, totalRuns - remainingRuns)

    return (
        <div className="challenge-converter">
            <div className="challenge-converter-intro">
                輸入已完成次數與目前持有的挑戰券，
                自動找出徽章最多的挑戰組合。
            </div>

            {/* 目標次數切換 */}
            <div className="challenge-target-switch">
                <button
                    type="button"
                    className={target === 70 ? 'active' : ''}
                    onClick={() => setTarget(70)}
                >
                    70 次
                </button>

                <button
                    type="button"
                    className={target === 30 ? 'active' : ''}
                    onClick={() => setTarget(30)}
                >
                    30 次
                </button>
            </div>

            <section className="challenge-calculator">

                {/* 輸入資料 */}
                <div className="challenge-input-grid">
                    <label className="challenge-input">
                        <span>已完成次數</span>
                        <div className="challenge-input-field">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={completed}
                                onChange={(event) => setCompleted(event.target.value)}
                            />
                            <span>次</span>
                        </div>
                    </label>

                    <label className="challenge-input">
                        <span>目前持有挑戰券</span>
                        <div className="challenge-input-field">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={tickets}
                                onChange={(event) => setTickets(event.target.value)}
                            />
                            <span>張</span>
                        </div>
                    </label>
                </div>

                {/* 最佳挑戰配置 */}
                <div className="challenge-section challenge-plan-section">
                    <div className="challenge-section-title">
                        <strong>最佳挑戰配置</strong>
                        <span>至少 {remainingRuns} 場</span>
                    </div>

                    <div className="challenge-difficulty-grid">
                        {difficulties.map((difficulty, index) => (
                            <div
                                className={`challenge-difficulty-card difficulty-${index}${!isInsufficient && bestCounts[index] > 0 ? ' has-runs' : ''
                                    }`}
                                key={difficulty.name}
                            >
                                <span>{difficulty.name}</span>
                                <strong>
                                    {isInsufficient
                                        ? '—'
                                        : bestCounts[index].toLocaleString('zh-TW')}
                                </strong>
                                <small>場</small>
                            </div>
                        ))}
                    </div>

                    {isInsufficient ? (
                        <div className="challenge-warning">
                            <strong>挑戰券不足，無法完成目標</strong>
                            <p>
                                至少需要 {minimumCost.toLocaleString('zh-TW')} 張，
                                目前還差 {(minimumCost - currentTickets).toLocaleString('zh-TW')} 張。
                            </p>
                        </div>
                    ) : (
                        <div className="challenge-total-runs">
                            <span>本次預計挑戰場數</span>
                            <strong>{totalRuns.toLocaleString('zh-TW')} 場</strong>
                        </div>
                    )}
                </div>

                {/* 預計成果 */}
                <div className="challenge-section challenge-reward-section">
                    <strong className="challenge-section-heading">
                        預計成果
                    </strong>

                    <div className="challenge-reward-grid">
                        <div className="challenge-reward-item">
                            <span>徽章總數</span>
                            <strong>
                                {isInsufficient
                                    ? '—'
                                    : bestPlan!.badges.toLocaleString('zh-TW')}
                            </strong>
                        </div>

                        <div className="challenge-reward-item">
                            <span>剩餘挑戰券</span>
                            <strong>
                                {isInsufficient
                                    ? currentTickets.toLocaleString('zh-TW')
                                    : remainingTickets.toLocaleString('zh-TW')}
                            </strong>
                        </div>
                    </div>

                    {isInsufficient ? (
                        <div className="challenge-final-runs">
                            <span>最終累計總場數</span>
                            <strong>—</strong>
                        </div>
                    ) : (
                        <>
                            {extraRuns > 0 && (
                                <div className="challenge-extra-runs">
                                    <span>超出目標場數</span>
                                    <strong>{extraRuns.toLocaleString('zh-TW')} 場</strong>
                                </div>
                            )}

                            <div className="challenge-final-runs">
                                <span>最終累計總場數</span>
                                <strong>
                                    {finalTotalRuns.toLocaleString('zh-TW')}
                                    <small> 場</small>
                                </strong>
                            </div>
                        </>
                    )}
                </div>

                {/* 計算細節 */}
                <details className="challenge-details">
                    <summary>查看計算細節</summary>

                    <div className="challenge-detail-list">
                        <div>
                            <span>目標次數</span>
                            <strong>{target} 次</strong>
                        </div>

                        <div>
                            <span>原本已完成</span>
                            <strong>{completedCount.toLocaleString('zh-TW')} 次</strong>
                        </div>

                        <div>
                            <span>剩餘目標次數</span>
                            <strong>{remainingRuns.toLocaleString('zh-TW')} 次</strong>
                        </div>

                        <div>
                            <span>完成目標最低成本</span>
                            <strong>{minimumCost.toLocaleString('zh-TW')} 張</strong>
                        </div>

                        {!isInsufficient && (
                            <>
                                <div>
                                    <span>實際使用挑戰券</span>
                                    <strong>{bestUsedTickets.toLocaleString('zh-TW')} 張</strong>
                                </div>

                                <div>
                                    <span>未使用挑戰券</span>
                                    <strong>{remainingTickets.toLocaleString('zh-TW')} 張</strong>
                                </div>

                                <div>
                                    <span>最終累計場數</span>
                                    <strong>{finalTotalRuns.toLocaleString('zh-TW')} 場</strong>
                                </div>
                            </>
                        )}
                    </div>
                </details>

            </section>
        </div>
    )
}
