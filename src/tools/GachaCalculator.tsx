
import { useEffect, useMemo, useState } from 'react'
import './GachaCalculator.css'

type ActivityEvent = {
    id: string
    name: string
    type: string
    startDate: string
    endDate: string
    rerun: string
}

type ActivityDataResponse = {
    success: boolean
    events: ActivityEvent[]
}

type Plan = {
    label: string
    diamondMin: number
    diamondMax: number
    tickets: number
}

const plans: Record<string, Plan> = {
    free: {
        label: '無課（基礎）',
        diamondMin: 8000,
        diamondMax: 8800,
        tickets: 4,
    },
    small: {
        label: '小月卡',
        diamondMin: 5240,
        diamondMax: 6040,
        tickets: 44,
    },
    large: {
        label: '大月卡',
        diamondMin: 7640,
        diamondMax: 8440,
        tickets: 44,
    },
    double: {
        label: '雙月卡',
        diamondMin: 4880,
        diamondMax: 5680,
        tickets: 84,
    },
}

function parseDate(value: string): Date | null {
    const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)

    if (!match) return null

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])

    const date = new Date(year, month - 1, day)

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null
    }

    return date
}

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatNumber(value: number, digits = 1) {
    return Number(value.toFixed(digits)).toLocaleString('zh-TW')
}


function getEventEstimate(event: ActivityEvent) {
    // 限時活動
    if (event.type === '限時活動') {
        if (event.rerun === '復刻') {
            return {
                min: 15,
                max: 15,
                diamondMin: 2250,
                diamondMax: 2250,
                tickets: 3,
                label: '約 15 抽',
            }
        }

        if (event.rerun === '非復刻' || event.rerun === '不復刻') {
            return {
                min: 20,
                max: 20,
                diamondMin: 2560,
                diamondMax: 2560,
                tickets: 6,
                label: '約 20 抽',
            }
        }
    }

    // 專屬時刻：大富翁與三消採用平均參考值
    if (event.type === '專屬時刻') {
        if (event.rerun === '復刻') {
            return {
                min: 4.2,
                max: 4.3,
                diamondMin: 400,
                diamondMax: 430,
                tickets: 2,
                label: '約 4.2～4.3 抽',
            }
        }

        if (event.rerun === '非復刻' || event.rerun === '不復刻') {
            return {
                min: 5.2,
                max: 5.3,
                diamondMin: 400,
                diamondMax: 430,
                tickets: 3,
                label: '約 5.2～5.3 抽',
            }
        }
    }

    // 其他活動不列入估算
    return null
}


export default function GachaCalculator() {
    const [events, setEvents] = useState<ActivityEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)

    const [selectedPlan, setSelectedPlan] = useState('free')
    const [selectedEventId, setSelectedEventId] = useState('')
    // 計算到活動開始前，或活動結束前
    const [targetMode, setTargetMode] = useState<'start' | 'end'>('start')
    // 是否將本日 04:00 已發放的資源納入計算
    const [includeToday, setIncludeToday] = useState(true)


    // 讀取活動中心共用的活動資料
    useEffect(() => {
        let cancelled = false

        async function loadEvents() {
            try {
                const response = await fetch(
                    `${import.meta.env.BASE_URL}data/activities.json`,
                    { cache: 'no-cache' }
                )

                if (!response.ok) {
                    throw new Error('無法讀取活動資料')
                }

                const data: ActivityDataResponse = await response.json()

                if (!data.success || !Array.isArray(data.events)) {
                    throw new Error('活動資料格式錯誤')
                }

                if (!cancelled) {
                    setEvents(data.events)
                    setLoadError(false)
                }
            } catch (error) {
                console.error('抽卡計算器讀取活動資料失敗：', error)

                if (!cancelled) {
                    setLoadError(true)
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        loadEvents()

        return () => {
            cancelled = true
        }
    }, [])

    
    // 今天的日期與目前時間
    const now = new Date()
    const today = startOfDay(now)
    const selectedPlanData = plans[selectedPlan]

    // 活動開始時間：開始日期當天 11:30
    function getEventStartDateTime(event: ActivityEvent) {
        const date = parseDate(event.startDate)
        if (!date) return null

        date.setHours(11, 30, 0, 0)
        return date
    }

    // 活動結束時間：結束日期當天 04:00
    function getEventEndDateTime(event: ActivityEvent) {
        const date = parseDate(event.endDate)
        if (!date) return null

        date.setHours(4, 0, 0, 0)
        return date
    }

    // 只顯示尚未結束、且日期有效的活動
    const selectableEvents = useMemo(() => {
        return events
            .filter((event) => {
                const startDateTime = getEventStartDateTime(event)
                const endDateTime = getEventEndDateTime(event)

                return (
                    startDateTime !== null &&
                    endDateTime !== null &&
                    endDateTime > now
                )
            })
            .sort((a, b) => {
                return (
                    getEventStartDateTime(a)!.getTime() -
                    getEventStartDateTime(b)!.getTime()
                )
            })
    }, [events, today.getTime()])

    // 找出目前選擇的活動
    const selectedEvent = selectableEvents.find(
        (event) => event.id === selectedEventId
    )

    // 判斷目標活動是否已經開始
    const isOngoingEvent = selectedEvent
        ? now >= getEventStartDateTime(selectedEvent)! &&
        now < getEventEndDateTime(selectedEvent)!
        : false

    // 已開始的活動強制計算到結束前
    const effectiveTargetMode = isOngoingEvent ? 'end' : targetMode

    // 根據玩家選擇，決定計算終點
    const targetDateTime = selectedEvent
        ? effectiveTargetMode === 'start'
            ? getEventStartDateTime(selectedEvent)
            : getEventEndDateTime(selectedEvent)
        : null

    // 計算每日 04:00 資源發放次數
    function calculateDayCount(target: Date | null) {
        if (!target) return 0

        // 活動開始前、活動結束前，都以目標日期的 04:00 作為截止點
        const cutoff = new Date(target)
        cutoff.setHours(4, 0, 0, 0)

        // 預設從今天開始
        const firstIssuance = new Date(today)

        // 如果不計入本日，從明天開始
        if (!includeToday) {
            firstIssuance.setDate(firstIssuance.getDate() + 1)
        }

        firstIssuance.setHours(4, 0, 0, 0)

        let count = 0
        const issuance = new Date(firstIssuance)

        // 不計入截止日當天 04:00
        while (issuance < cutoff) {
            count += 1
            issuance.setDate(issuance.getDate() + 1)
        }

        return count
    }

    const dayCount = calculateDayCount(targetDateTime)


    // 篩選目前時間至計算目標時間之間會遇到的活動
    const intermediateEvents = selectedEvent && targetDateTime
        ? events
            .filter((event) => {
                // 排除玩家選擇的目標活動本身
                if (event.id === selectedEvent.id) return false

                const eventStart = getEventStartDateTime(event)
                const eventEnd = getEventEndDateTime(event)

                if (!eventStart || !eventEnd) return false

                // 活動必須與目前至目標時間的區間有重疊
                return eventStart < targetDateTime && eventEnd > now
            })
            .sort((a, b) => {
                return (
                    getEventStartDateTime(a)!.getTime() -
                    getEventStartDateTime(b)!.getTime()
                )
            })
        : []

    // 計算各項中間活動的額外資源參考量
    const eventEstimates = intermediateEvents.map((event) => ({
        event,
        estimate: getEventEstimate(event),
    }))

    // 活動額外鑽石
    const extraDiamondMin = eventEstimates.reduce(
        (total, item) => total + (item.estimate?.diamondMin ?? 0),
        0
    )

    const extraDiamondMax = eventEstimates.reduce(
        (total, item) => total + (item.estimate?.diamondMax ?? 0),
        0
    )

    // 活動額外粉票
    const extraTickets = eventEstimates.reduce(
        (total, item) => total + (item.estimate?.tickets ?? 0),
        0
    )

    // 活動額外參考抽數：鑽石合計後換算完整抽數，再加粉票
    const extraMin = Math.floor(extraDiamondMin / 180) + extraTickets
    const extraMax = Math.floor(extraDiamondMax / 180) + extraTickets
   
    // 每月資源以 30 天換算每日累積量
    const diamondMin = Math.floor((selectedPlanData.diamondMin / 30) * dayCount)
    const diamondMax = Math.floor((selectedPlanData.diamondMax / 30) * dayCount)
    const ticketCount =
        (selectedPlanData.tickets / 30) * dayCount

    const totalPullMin = diamondMin / 180 + ticketCount
    const totalPullMax = diamondMax / 180 + ticketCount

    // 合併後的總鑽石
    const totalDiamondMin = diamondMin + extraDiamondMin
    const totalDiamondMax = diamondMax + extraDiamondMax

    // 合併後的總粉票
    const totalTickets = ticketCount + extraTickets

    // 合併後的總抽數
    const combinedPullMin = Math.floor(totalDiamondMin / 180) + totalTickets
    const combinedPullMax = Math.floor(totalDiamondMax / 180) + totalTickets

    return (
        <section className="gacha-calculator-page">
            <section
                className="gacha-panel"
                id="gacha-calculator-operation"
            >
                <h2>計算條件</h2>

                <p className="gacha-hint">
                    選擇課金方案與目標活動，估算活動開始前或結束前可累積的抽卡資源。
                </p>

                <div className="gacha-condition-section">
                    {/* 課金方案 */}
                    <div className="gacha-condition-group">
                        <span className="gacha-condition-label">課金方案</span>

                        <div className="gacha-plan-options">
                            {Object.entries(plans).map(([key, plan]) => (
                                <button
                                    type="button"
                                    key={key}
                                    className={
                                        selectedPlan === key
                                            ? 'gacha-choice-button active'
                                            : 'gacha-choice-button'
                                    }
                                    onClick={() => setSelectedPlan(key)}
                                >
                                    {plan.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 目標活動 */}
                    <div className="gacha-condition-group">
                        <label className="gacha-field">
                            <span>目標活動</span>

                            <select
                                value={selectedEventId}
                                onChange={(event) => setSelectedEventId(event.target.value)}
                                disabled={loading || loadError}
                            >
                                <option value="">請選擇目標活動</option>

                                {selectableEvents.map((event) => (
                                    <option value={event.id} key={event.id}>
                                        {event.name}（{event.rerun || '未標示'}｜{event.startDate}）
                                    </option>
                                ))}
                            </select>
                        </label>

                        {loading && (
                            <p className="gacha-hint">正在讀取活動資料……</p>
                        )}

                        {loadError && (
                            <p className="gacha-error">
                                活動資料讀取失敗，暫時無法選擇目標活動。
                            </p>
                        )}
                    </div>

                    {/* 選擇活動後才顯示計算時間條件 */}
                    {selectedEvent && (
                        <>                          

                            <div className="gacha-condition-bottom">
                                {/* 計算時間點 */}

                                <div className="gacha-condition-group">
                                    <div className="gacha-condition-heading">
                                        <span className="gacha-condition-label">
                                            計算時間點
                                        </span>
                                        <div className="gacha-hint">
                                            目前計入資源發放：{dayCount} 天
                                        </div>
                                    </div>

                                    {isOngoingEvent ? (
                                        <p className="gacha-hint">
                                            活動已開始，將自動計算至活動結束前。
                                        </p>
                                    ) : (
                                        <div className="gacha-time-options">
                                            <button
                                                type="button"
                                                className={
                                                    targetMode === 'start'
                                                        ? 'gacha-time-button active'
                                                        : 'gacha-time-button'
                                                }
                                                onClick={() => setTargetMode('start')}
                                            >
                                                活動開始前
                                            </button>

                                            <button
                                                type="button"
                                                className={
                                                    targetMode === 'end'
                                                        ? 'gacha-time-button active'
                                                        : 'gacha-time-button'
                                                }
                                                onClick={() => setTargetMode('end')}
                                            >
                                                活動結束前
                                            </button>
                                        </div>
                                    )}
                                </div>


                                {/* 計入本日資源 */}
                                <div className="gacha-condition-group">
                                    <span className="gacha-condition-label">
                                        計入本日資源
                                    </span>

                                    <label className="gacha-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={includeToday}
                                            onChange={(event) =>
                                                setIncludeToday(event.target.checked)
                                            }
                                        />
                                        <span>計入本日 04:00 的資源</span>
                                    </label>
                                </div>
                            </div>

                        </>
                    )}
                </div>
            </section>


            {selectedEvent && (
                <>
                    <section className="gacha-panel gacha-summary-panel">
                        <h2>總共可獲得資源</h2>

                        <div className="gacha-summary-notes">
                            <p className="gacha-hint">
                                基礎資源+活動額外資源，詳細數據請查看下方區塊。
                            </p>
                            <p className="gacha-hint">
                                ※未計入免費月票資源（ 180鑽石 + 1抽 ）
                            </p>
                        </div>

                        <div className="gacha-summary-total">
                            <div className="gacha-summary-item">
                                <span>總鑽石</span>
                                <strong>
                                    {formatNumber(totalDiamondMin)}
                                    ～
                                    {formatNumber(totalDiamondMax)}
                                </strong>
                            </div>

                            <div className="gacha-summary-item">
                                <span>總粉票</span>
                                <strong>
                                    {formatNumber(totalTickets)} 張
                                </strong>
                            </div>

                            <div className="gacha-summary-item">
                                <span>預估總抽數</span>
                                <strong>
                                    {formatNumber(combinedPullMin)}
                                    ～
                                    {formatNumber(combinedPullMax)} 抽
                                </strong>
                            </div>
                        </div>
                    </section>
                    <section className="gacha-panel">
                        <h2>基礎資源</h2>

                        <p className="gacha-hint">
                            依照所選方案的每月資源範圍及實際計入的 04:00 發放次數估算。
                            此區不包含活動額外資源。
                        </p>

                        <div className="gacha-result-grid">
                            <div className="gacha-result-item">
                                <span>預計累積鑽石</span>
                                <strong>
                                    {formatNumber(diamondMin, 0)} ～ {formatNumber(diamondMax, 0)}
                                </strong>
                            </div>

                            <div className="gacha-result-item">
                                <span>預計累積粉票</span>
                                <strong>{formatNumber(ticketCount, 1)} 張</strong>
                            </div>

                            <div className="gacha-result-item gacha-result-total">
                                <span>換算總抽數</span>
                                <strong>
                                    {formatNumber(totalPullMin)} ～ {formatNumber(totalPullMax)} 抽
                                </strong>
                            </div>
                        </div>
                    </section>

                    <section className="gacha-panel">
                        <h2>活動額外資源</h2>

                        <p className="gacha-hint">
                            以下為活動資源的參考估算，不會併入上方基礎資源。
                        </p>
                        <p className="gacha-hint">
                            限時活動與專屬時刻會依照復刻狀態估算額外抽數。
                            其他活動類型不列入估算。
                        </p>

                        {eventEstimates.some(({ estimate }) => estimate !== null) ? (
                            <div className="gacha-event-estimates">
                                {eventEstimates
                                    .filter(({ estimate }) => estimate !== null)
                                    .map(({ event, estimate }) => (
                                        <div className="gacha-event-estimate" key={event.id}>
                                            <div className="gacha-event-header">
                                                <strong>{event.name}</strong>
                                                <span>
                                                    {event.startDate} ～ {event.endDate}
                                                </span>
                                            </div>

                                            {estimate ? (
                                                <>
                                                    <div className="gacha-event-details">
                                                        <div className="gacha-event-detail">
                                                            <span>活動類型</span>
                                                            <strong>{event.rerun}</strong>
                                                        </div>

                                                        <div className="gacha-event-detail">
                                                            <span>額外鑽石</span>
                                                            <strong>
                                                                {formatNumber(estimate.diamondMin)}
                                                                {estimate.diamondMin !== estimate.diamondMax
                                                                    ? `～${formatNumber(estimate.diamondMax)}`
                                                                    : ''}
                                                            </strong>
                                                        </div>

                                                        <div className="gacha-event-detail">
                                                            <span>額外粉票</span>
                                                            <strong>{formatNumber(estimate.tickets)} 張</strong>
                                                        </div>

                                                        <div className="gacha-event-detail gacha-event-detail-pull">
                                                            <span>參考抽數</span>
                                                            <strong>{estimate.label}</strong>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="gacha-event-unavailable">
                                                    不列入抽數估算
                                                </div>
                                            )}
                                        </div>
                                ))}
                            </div>
                        ) : (
                            <p className="gacha-hint">
                                這段期間沒有可列入估算的中間活動。
                            </p>
                        )}

                        <div className="gacha-extra-total">
                            <h3>活動額外資源總量</h3>

                            <div className="gacha-extra-total-grid">
                                <div className="gacha-extra-total-item">
                                    <span>額外鑽石</span>
                                    <strong>
                                        {formatNumber(extraDiamondMin)} ～ {formatNumber(extraDiamondMax)}
                                    </strong>
                                </div>

                                <div className="gacha-extra-total-item">
                                    <span>額外粉票</span>
                                    <strong>{formatNumber(extraTickets)} 張</strong>
                                </div>

                                <div className="gacha-extra-total-item gacha-extra-total-pull">
                                    <span>參考抽數</span>
                                    <strong>
                                        {extraMin === extraMax
                                            ? `${extraMin} 抽`
                                            : `${extraMin} ～ ${extraMax} 抽`}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </section>


                </>
            )}
        </section>
    )
}
