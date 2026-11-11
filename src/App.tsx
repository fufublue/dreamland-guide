import { useState } from 'react'
import './App.css'

const navigation = [
  { id: 'home', label: '首頁', icon: '⌂', description: '攻略站首頁與常用功能' },
  { id: 'events', label: '活動中心', icon: '▦', description: '查看活動資訊、日期與活動日曆' },
  { id: 'tools', label: '工具中心', icon: '⌘', description: '使用各種遊戲計算與查詢工具' },
  { id: 'database', label: '遊戲資料庫', icon: '▤', description: '查詢角色、敵人及遊戲資料' },
  { id: 'personal', label: '個人中心', icon: '♙', description: '管理收藏、隊伍與個人設定' },
]

const toolGroups = [
  {
    id: 'gacha',
    title: '抽卡與資源',
    description: '規劃抽卡資源，查詢卡池與挑戰換算。',
    tools: [
      { id: 'gacha-calculator', title: '抽卡資源計算', description: '整理持有資源與未來抽卡規劃。', icon: '✧' },
      { id: 'pool-search', title: '混池範圍查詢', description: '查詢各期混池的角色範圍。', icon: '⌕' },
      { id: 'seventy-converter', title: '70次換算', description: '進行70次挑戰相關數值換算。', icon: '↗' },
    ],
  },
  {
    id: 'lookup',
    title: '遊戲資料查詢',
    description: '快速查找遊戲內的功能與角色資料。',
    tools: [
      { id: 'function-search', title: '功能查找', description: '搜尋遊戲功能、名稱與相關說明。', icon: '⌕' },
      { id: 'physical-characters', title: '物理角色資料', description: '查詢物理角色的技能與能力資料。', icon: '⚔' },
      { id: 'magic-characters', title: '魔法角色資料', description: '查詢魔法角色的技能與能力資料。', icon: '✦' },
    ],
  },
  {
    id: 'analysis',
    title: '角色分析與模擬',
    description: '分析角色能力，規劃隊伍與戰鬥配置。',
    tools: [
      { id: 'strength-calculator', title: '強度計算', description: '依照角色培養與配置計算能力數值。', icon: '▥' },
    ],
  },
]

// 活動資料之後會從原始試算表讀取，目前先保持空白，不放入假資料。
type ActivityEvent = {
  id: string
  name: string
  type: string
  startDate: string
  endDate: string
  isRerun: boolean
  characters?: string[]
  note?: string
}

const activityEvents: ActivityEvent[] = []

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

function ActivityCenter() {
  const [view, setView] = useState<'list' | 'calendar' | 'timeline'>('list')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [month, setMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const filteredEvents = activityEvents.filter((event) =>
    event.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const calendarDays = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  function changeMonth(offset: number) {
    setMonth(new Date(year, monthIndex + offset, 1))
  }

  function renderEvent(event: ActivityEvent) {
    const expanded = expandedId === event.id

    return (
      <article className="activity-event" key={event.id}>
        <button
          className="activity-event-button"
          onClick={() => setExpandedId(expanded ? null : event.id)}
        >
          <span className="activity-event-main">
            <strong>{event.name}</strong>
            <span className="activity-event-meta">
              <span className="activity-type">{event.type}</span>
              <span>{event.startDate} ～ {event.endDate}</span>
              {event.isRerun && <span className="activity-rerun">復刻</span>}
            </span>
          </span>
          <span className="activity-expand-icon">{expanded ? '−' : '+'}</span>
        </button>

        {expanded && (
          <div className="activity-event-detail">
            <p>活動期間：{event.startDate} ～ {event.endDate}</p>
            {event.characters && event.characters.length > 0 && (
              <p>相關角色：{event.characters.join('、')}</p>
            )}
            {event.note && <p>備註：{event.note}</p>}
          </div>
        )}
      </article>
    )
  }

  return (
    <section className="activity-page">
      <div className="eyebrow">ACTIVITY CENTER</div>
      <h1 className="page-title">活動中心</h1>
      <p className="page-description">
        查看活動時程，掌握過去與未來的活動安排。
      </p>

      <div className="activity-toolbar">
        <div className="activity-view-switch">
          <button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}>清單</button>
          <button className={view === 'calendar' ? 'selected' : ''} onClick={() => setView('calendar')}>月曆</button>
          <button className={view === 'timeline' ? 'selected' : ''} onClick={() => setView('timeline')}>時間軸</button>
        </div>

        <input
          className="activity-search"
          type="search"
          placeholder="搜尋活動名稱"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {view === 'list' && (
        <div className="activity-list">
          {filteredEvents.length > 0
            ? filteredEvents.map(renderEvent)
            : <div className="activity-empty">目前尚無活動資料，待串接原始試算表後顯示。</div>}
        </div>
      )}

      {view === 'calendar' && (
        <section className="activity-calendar">
          <div className="calendar-heading">
            <button onClick={() => changeMonth(-1)} aria-label="上一個月">←</button>
            <h2>{year} 年 {monthIndex + 1} 月</h2>
            <button onClick={() => changeMonth(1)} aria-label="下一個月">→</button>
          </div>

          <div className="calendar-grid">
            {weekdays.map((day) => (
              <div className="calendar-weekday" key={day}>{day}</div>
            ))}
            {calendarDays.map((day, index) => (
              <div className={`calendar-day ${day === null ? 'empty' : ''}`} key={index}>
                {day !== null && <span>{day}</span>}
              </div>
            ))}
          </div>
          <p className="activity-empty">活動日期將在串接試算表後顯示於月曆。</p>
        </section>
      )}

      {view === 'timeline' && (
        <div className="activity-timeline">
          <div className="activity-empty">
            活動時間軸將在串接試算表後顯示。
          </div>
        </div>
      )}
    </section>
  )
}

function App() {
  const [activePage, setActivePage] = useState('home')
  const [darkMode, setDarkMode] = useState(false)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)

  const currentPage = navigation.find((item) => item.id === activePage)!

  const selectedTool = toolGroups
    .flatMap((group) => group.tools)
    .find((tool) => tool.id === selectedToolId)

  function goToPage(pageId: string) {
    setSelectedToolId(null)
    setActivePage(pageId)
  }

  return (
    <div className={`app-shell ${darkMode ? 'dark' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">夢</div>
          <div>
            <div className="brand-name">夢樂園攻略站</div>
            <div className="brand-subtitle">DREAMLAND GUIDE</div>
          </div>
        </div>

        <div className="nav-label">MENU</div>

        <nav className="side-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => goToPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>夢樂園攻略站</span>
          <span>資料持續整理中</span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">夢樂園攻略站</div>

          <div className="topbar-actions">
            <button className="theme-button" onClick={() => setDarkMode(!darkMode)} title="切換主題">
              {darkMode ? '☀' : '☾'}
              <span>{darkMode ? '淺色模式' : '深色模式'}</span>
            </button>
            <button className="login-button" onClick={() => goToPage('personal')}>登入</button>
          </div>
        </header>

        <div className="page-content">
          {activePage === 'home' ? (
            <>
              <section className="welcome-section">
                <div className="eyebrow">DREAMLAND GUIDE</div>
                <h1>夢樂園攻略站</h1>
                <p>探索遊戲資料，規劃你的夢樂園旅程。</p>
              </section>

              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <h2>功能導覽</h2>
                    <p>選擇想使用的功能分類</p>
                  </div>
                </div>
                <div className="category-grid">
                  {navigation.slice(1).map((item) => (
                    <button key={item.id} className="category-card" onClick={() => goToPage(item.id)}>
                      <span className="category-icon">{item.icon}</span>
                      <span className="category-title">{item.label}</span>
                      <span className="category-description">{item.description}</span>
                      <span className="category-arrow">→</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <h2>關於本站</h2>
                    <p>夢樂園攻略站</p>
                  </div>
                </div>
                <div className="info-panel">
                  <p>本站將整理夢樂園相關遊戲資料、活動資訊及實用工具，方便玩家查詢與規劃。</p>
                  <p>部分個人功能未來可選擇登入，以便在不同裝置間同步資料。</p>
                </div>
              </section>
            </>
          ) : activePage === 'events' ? (
            <ActivityCenter />
          ) : activePage === 'tools' ? (
            selectedTool ? (
              <section className="tool-detail-page">
                <button className="back-button" onClick={() => setSelectedToolId(null)}>← 返回工具中心</button>
                <div className="eyebrow">TOOL CENTER</div>
                <div className="tool-detail-heading">
                  <div className="tool-detail-icon">{selectedTool.icon}</div>
                  <div>
                    <h1>{selectedTool.title}</h1>
                    <p>{selectedTool.description}</p>
                  </div>
                </div>
                <div className="coming-soon">
                  <div className="coming-icon">✧</div>
                  <h2>功能準備中</h2>
                  <p>這項工具已加入網站規劃，後續會依照原始遊戲資料逐步建置。</p>
                </div>
              </section>
            ) : (
              <section className="tools-page">
                <div className="eyebrow">TOOL CENTER</div>
                <h1 className="page-title">工具中心</h1>
                <p className="page-description">依照功能分類，選擇需要使用的工具。</p>
                {toolGroups.map((group) => (
                  <section className="tool-group" key={group.id}>
                    <div className="tool-group-heading">
                      <h2>{group.title}</h2>
                      <p>{group.description}</p>
                    </div>
                    <div className="tool-grid">
                      {group.tools.map((tool) => (
                        <button className="tool-card" key={tool.id} onClick={() => setSelectedToolId(tool.id)}>
                          <span className="tool-card-icon">{tool.icon}</span>
                          <span className="tool-card-content">
                            <span className="tool-card-title">{tool.title}</span>
                            <span className="tool-card-description">{tool.description}</span>
                          </span>
                          <span className="tool-card-arrow">→</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </section>
            )
          ) : (
            <section className="subpage">
              <div className="eyebrow">DREAMLAND GUIDE</div>
              <h1>{currentPage.label}</h1>
              <p>{currentPage.description}</p>
              <div className="coming-soon">
                <div className="coming-icon">{currentPage.icon}</div>
                <h2>功能準備中</h2>
                <p>這個區域將在後續階段逐步建置。</p>
              </div>
            </section>
          )}

          <footer className="page-footer">夢樂園攻略站 · DREAMLAND GUIDE</footer>
        </div>
      </main>

      <nav className="mobile-nav">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={`mobile-nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => goToPage(item.id)}
          >
            <span>{item.icon}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App