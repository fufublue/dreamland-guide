import { useEffect, useMemo, useState } from "react";
import type {
  ActivityEvent,
  ActivityDataResponse,
  ActivityView,
} from "../types";
import { fetchWithVersionCache } from "../versionCache";
import { DATA_VERSIONS } from "../data/dataVersions";
import PageHeader from "../components/PageHeader";
import Icon from "../components/Icon";

/* ===== 日期處理 ===== */

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

function parseDate(value: string, hour = 0, minute = 0): Date | null {
  const match = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);

  if (!match) return null;

  const [, year, month, day] = match;

  return new Date(Number(year), Number(month) - 1, Number(day), hour, minute);
}

function getStartDate(event: ActivityEvent): Date | null {
  return parseDate(event.startDate, 11, 30);
}

function getEndDate(event: ActivityEvent): Date | null {
  return parseDate(event.endDate, 4, 0);
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}/${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function getDaysDifference(from: Date, to: Date): number {
  const first = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  ).getTime();

  const second = new Date(
    to.getFullYear(),
    to.getMonth(),
    to.getDate(),
  ).getTime();

  return Math.round((second - first) / 86400000);
}

function sortByStartDate(events: ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((a, b) => {
    const dateA = getStartDate(a)?.getTime() ?? 0;
    const dateB = getStartDate(b)?.getTime() ?? 0;
    return dateA - dateB;
  });
}

function getRerunClass(value: string): string {
  if (value.includes("不復刻")) return "activity-no-rerun";
  if (value.includes("非復刻") || value === "否") {
    return "activity-not-rerun";
  }
  return "";
}

/* ===== 活動項目 ===== */

/* ===== CSV 資料解析 ===== */

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  text = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
/* ===== 活動資料的圖片配對程式 ===== */
function resolveImagePath(path?: string): string | undefined {
  if (!path) return undefined;

  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

interface ActivityItemProps {
  event: ActivityEvent;
  expanded: boolean;
  onToggle: () => void;
  endingSoon?: boolean;
}

function ActivityItem({
  event,
  expanded,
  onToggle,
  endingSoon = false,
}: ActivityItemProps) {
  const images = event.images
    ? Object.entries(event.images).filter(([, value]) => Boolean(value))
    : [];

  return (
    <article className="activity-event" id={`activity-${event.id}`}>
      <button
        type="button"
        className="activity-event-button"
        onClick={onToggle}
      >
        <div className="activity-event-main">
          <div className="activity-event-title-row">
            <strong>{event.name}</strong>

            <div className="activity-event-meta">
              <span className="activity-type" data-type={event.type}>
                {event.type}
              </span>

              {event.rerun && (
                <span
                  className={`activity-rerun ${getRerunClass(event.rerun)}`}
                >
                  {event.rerun}
                </span>
              )}

              {endingSoon && (
                <span className="activity-status-tag ending">即將結束</span>
              )}
            </div>
          </div>

          <span className="activity-date">
            {event.dateText || `${event.startDate} ～ ${event.endDate}`}
          </span>
        </div>

        <span className="activity-expand-icon">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="activity-event-detail">
          <p>開始：{event.startDate}</p>
          <p>結束：{event.endDate}</p>

          {event.note && <p>{event.note}</p>}

          {images.length > 0 && (
            <div className="activity-event-images">
              {images.map(([name, src]) => (
                <img
                  key={name}
                  src={src}
                  alt={`${event.name} ${name}`}
                  loading="lazy"
                />
              ))}
            </div>
          )}

          {event.link && (
            <p>
              <a href={event.link} target="_blank" rel="noreferrer">
                查看活動相關連結 ↗
              </a>
            </p>
          )}
        </div>
      )}
    </article>
  );
}

/* ===== 月曆活動色帶 ===== */

interface CalendarWeekProps {
  days: {
    date: Date;
    dateKey: string;
    isCurrentMonth: boolean;
  }[];
  events: ActivityEvent[];
  selectedDate: string;
  todayKey: string;
  onSelectDate: (dateKey: string) => void;
}

function CalendarWeek({
  days,
  events,
  selectedDate,
  todayKey,
  onSelectDate,
}: CalendarWeekProps) {
  const weekStart = days[0].date;

  const segments = events
    .map((event) => {
      const start = parseDate(event.startDate);
      const end = parseDate(event.endDate);

      if (!start || !end) return null;

      const startIndex = Math.max(0, getDaysDifference(weekStart, start));

      const endIndex = Math.min(6, getDaysDifference(weekStart, end));

      if (endIndex < 0 || startIndex > 6) return null;

      return {
        event,
        startIndex,
        endIndex,
      };
    })
    .filter(
      (
        item,
      ): item is {
        event: ActivityEvent;
        startIndex: number;
        endIndex: number;
      } => item !== null,
    );

  const rowEnds: number[] = [];

  const positionedSegments = segments.map((segment) => {
    let row = rowEnds.findIndex((lastEnd) => lastEnd < segment.startIndex);

    if (row === -1) {
      row = rowEnds.length;
    }

    rowEnds[row] = segment.endIndex;

    return {
      ...segment,
      row,
    };
  });

  return (
    <div className="calendar-week">
      {days.map((day) => (
        <button
          key={day.dateKey}
          type="button"
          className={[
            "calendar-day",
            !day.isCurrentMonth ? "other-month" : "",
            day.dateKey === selectedDate ? "selected" : "",
            day.dateKey === todayKey ? "today" : "",
          ].join(" ")}
          onClick={() => onSelectDate(day.dateKey)}
        >
          <span className="calendar-day-number">{day.date.getDate()}</span>
        </button>
      ))}

      <div className="calendar-week-bars">
        {positionedSegments.map((segment) => (
          <span
            key={segment.event.id}
            className="calendar-event-chip"
            data-type={segment.event.type}
            title={segment.event.name}
            style={{
              gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
              gridRow: segment.row + 1,
            }}
          >
            {segment.event.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===== 活動中心主元件 ===== */

interface ActivityCenterProps {
  icon: string;
}

export default function ActivityCenter({ icon }: ActivityCenterProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState<ActivityView>("list");
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("全部");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const [selectedDate, setSelectedDate] = useState(() =>
    getDateKey(new Date()),
  );

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  /* 載入活動資料 */

  useEffect(() => {
    let cancelled = false;

    async function loadActivities() {
      try {
        setLoading(true);
        setError("");

        const data = (await fetchWithVersionCache(
          "activity-data",
          DATA_VERSIONS.activityData,
          async () => {
            const csvUrl =
              "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUhkNXcmlY_9hVmBx6uQPcrQpJJUdgOaMVFOIuVDW3na0ir98e6DqzFh8WvkMJUgbNVNKmaB6wZxW1/pub?gid=1900196781&single=true&output=csv";

            const [csvResponse, jsonResponse] = await Promise.all([
              fetch(csvUrl),
              fetch(`${import.meta.env.BASE_URL}data/activities.json`),
            ]);

            if (!csvResponse.ok) {
              throw new Error("CSV 活動資料讀取失敗");
            }

            if (!jsonResponse.ok) {
              throw new Error("舊活動圖片資料讀取失敗");
            }

            const csvText = await csvResponse.text();
            const legacyData =
              (await jsonResponse.json()) as ActivityDataResponse;

            if (!legacyData.success || !Array.isArray(legacyData.events)) {
              throw new Error("舊活動圖片資料格式不正確");
            }

            const rows = parseCSV(csvText);

            if (rows.length < 3) {
              throw new Error("CSV 活動資料格式不正確");
            }

            const headers = rows[1].map((value) => value.trim());

            const getColumn = (name: string) => headers.indexOf(name);

            const requiredColumns = [
              "台服時間線",
              "復刻情況",
              "活動",
              "活動類型",
            ];

            if (requiredColumns.some((name) => getColumn(name) === -1)) {
              throw new Error("CSV 缺少必要的活動欄位");
            }

            // 依照活動名稱、類型與日期配對圖片，不再依賴工作表列號
            const normalizeMatchValue = (value: string) =>
              value.trim().replace(/\s+/g, " ");

            const getMatchKey = (
              event: Pick<
                ActivityEvent,
                "name" | "type" | "startDate" | "endDate"
              >,
            ) =>
              JSON.stringify([
                normalizeMatchValue(event.name),
                normalizeMatchValue(event.type),
                normalizeMatchValue(event.startDate),
                normalizeMatchValue(event.endDate),
              ]);

            const legacyMap = new Map<string, ActivityEvent[]>();

            legacyData.events.forEach((event) => {
              const key = getMatchKey(event);
              const matched = legacyMap.get(key) ?? [];
              matched.push(event);
              legacyMap.set(key, matched);
            });

            const events: ActivityEvent[] = [];

            for (const [rowIndex, row] of rows.slice(2).entries()) {
              const getValue = (name: string) => {
                const index = getColumn(name);
                return index === -1 ? "" : (row[index]?.trim() ?? "");
              };

              const dateText = getValue("台服時間線");
              const name = getValue("活動");
              const type = getValue("活動類型");

              if (!dateText || !name || !type) continue;

              const dateParts = dateText
                .split("~")
                .map((value) => value.trim());

              const startDate = dateParts[0];
              const endDate = dateParts[1] || startDate;

              const rerun = getValue("復刻情況");
              const matchKey = getMatchKey({
                name,
                type,
                startDate,
                endDate,
              });
              const matchedEvents = legacyMap.get(matchKey);
              const legacyEvent = matchedEvents?.shift();

              // 活動 ID 仍保留原本列號規則，只有圖片配對改用活動內容
              const legacyId = `row-${rowIndex + 3}`;

              const csvLink = getValue("連結");

              events.push({
                id: legacyId,
                name,
                type,
                startDate,
                endDate,
                dateText,
                rerun,
                images: legacyEvent?.images
                  ? {
                      pool1: resolveImagePath(legacyEvent.images.pool1),
                      pool2: resolveImagePath(legacyEvent.images.pool2),
                      pool3: resolveImagePath(legacyEvent.images.pool3),
                      freeCharacter: resolveImagePath(
                        legacyEvent.images.freeCharacter,
                      ),
                      ssr: resolveImagePath(legacyEvent.images.ssr),
                      carriage: resolveImagePath(legacyEvent.images.carriage),
                    }
                  : undefined,
                note: getValue("備註") || legacyEvent?.note || "",
                link: /^https?:\/\//i.test(csvLink)
                  ? csvLink
                  : legacyEvent?.link || "",
              });
            }

            return {
              success: true,
              updatedAt: new Date().toISOString(),
              count: events.length,
              events,
            };
          },
        )) as ActivityDataResponse;

        if (!data.success || !Array.isArray(data.events)) {
          throw new Error("活動資料格式不正確");
        }

        if (!cancelled) {
          setEvents(sortByStartDate(data.events));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "讀取活動資料時發生錯誤",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadActivities();

    return () => {
      cancelled = true;
    };
  }, []);

  /* 活動分類與搜尋 */

  const activityTypes = useMemo(() => {
    return [
      "全部",
      ...Array.from(new Set(events.map((event) => event.type).filter(Boolean))),
    ];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch = event.name
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const matchesType =
        selectedType === "全部" || event.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [events, search, selectedType]);

  /* 活動時間狀態 */

  const currentEvents = useMemo(() => {
    return events.filter((event) => {
      const start = getStartDate(event);
      const end = getEndDate(event);

      return start && end && now >= start && now <= end;
    });
  }, [events, now]);

  const endingSoonIds = useMemo(() => {
    return new Set(
      currentEvents
        .filter((event) => {
          const end = getEndDate(event);

          return (
            end !== null && end.getTime() - now.getTime() <= 24 * 60 * 60 * 1000
          );
        })
        .map((event) => event.id),
    );
  }, [currentEvents, now]);

  const upcomingEvents = useMemo(() => {
    return events.filter((event) => {
      const start = getStartDate(event);

      if (!start || start <= now) return false;

      return getDaysDifference(now, start) <= 14;
    });
  }, [events, now]);

  const recentEvents = useMemo(() => {
    return events.filter((event) => {
      const end = getEndDate(event);

      if (!end || end >= now) return false;

      return getDaysDifference(end, now) <= 14;
    });
  }, [events, now]);

  /* 月曆資料 */

  const calendarWeeks = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);

    const start = new Date(
      firstDay.getFullYear(),
      firstDay.getMonth(),
      1 - firstDay.getDay(),
    );

    const allDays = Array.from({ length: 42 }, (_, index) => {
      const date = addDays(start, index);

      return {
        date,
        dateKey: getDateKey(date),
        isCurrentMonth: date.getMonth() === month.getMonth(),
      };
    });

    return Array.from({ length: 6 }, (_, weekIndex) =>
      allDays.slice(weekIndex * 7, weekIndex * 7 + 7),
    );
  }, [month]);

  const selectedDateEvents = useMemo(() => {
    const selected = parseDate(selectedDate);

    if (!selected) return [];

    return events.filter((event) => {
      const start = parseDate(event.startDate);
      const end = parseDate(event.endDate);

      return start && end && selected >= start && selected <= end;
    });
  }, [events, selectedDate]);

  /* 活動定位 */

  function locateEvent(event: ActivityEvent) {
    setView("list");
    setSearch("");
    setSelectedType("全部");
    setExpandedId(event.id);

    window.setTimeout(() => {
      document.getElementById(`activity-${event.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
  }

  /* 月份切換 */

  function changeMonth(amount: number) {
    setMonth(
      (previous) =>
        new Date(previous.getFullYear(), previous.getMonth() + amount, 1),
    );
  }

  function goToCurrentMonth() {
    const today = new Date();

    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(getDateKey(today));
  }

  const todayKey = getDateKey(now);

  /* 載入狀態 */

  if (loading) {
    return (
      <div className="activity-page">
        <div className="activity-empty">正在載入活動資料……</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="activity-page">
        <div className="activity-empty">
          <h2>活動資料載入失敗</h2>
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            重新載入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="center-page activity-page">
      {/* 頁面標題 */}
      <PageHeader
        icon={<Icon name={icon} />}
        title="活動中心"
        description={"查看活動資訊、活動日期與近期活動安排。"}
        size="large"
        as="h1"
      />

      {/* 活動列表與月曆 */}
      <div className="activity-toolbar">
        <div className="activity-view-switch">
          <button
            type="button"
            className={view === "list" ? "selected" : ""}
            onClick={() => setView("list")}
          >
            活動列表
          </button>

          <button
            type="button"
            className={view === "calendar" ? "selected" : ""}
            onClick={() => setView("calendar")}
          >
            月曆
          </button>
        </div>

        {view === "list" && (
          <div className="activity-filter-group">
            <input
              type="search"
              className="activity-search"
              placeholder="搜尋活動名稱……"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="activity-type-filter"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              {activityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 目前進行中與近期活動：只在活動列表顯示 */}

      {view === "list" && (
        <>
          <section className="current-activity-section">
            <h2>目前進行中</h2>

            {currentEvents.length === 0 ? (
              <p>目前沒有進行中的活動。</p>
            ) : (
              <div className="current-activity-list">
                {currentEvents.map((event) => {
                  const currentId = `current-${event.id}`;

                  return (
                    <div className="current-activity-item" key={event.id}>
                      <div
                        className="current-activity-info"
                        onClick={() =>
                          setExpandedId((previous) =>
                            previous === currentId ? null : currentId,
                          )
                        }
                      >
                        <strong>
                          <span className="current-activity-title">
                            <span>{event.name}</span>

                            <span
                              className="activity-type"
                              data-type={event.type}
                            >
                              {event.type}
                            </span>

                            {event.rerun && (
                              <span
                                className={`activity-rerun ${getRerunClass(event.rerun)}`}
                              >
                                {event.rerun}
                              </span>
                            )}

                            {endingSoonIds.has(event.id) && (
                              <span className="activity-status-tag ending">
                                即將結束
                              </span>
                            )}
                          </span>
                        </strong>

                        <span>
                          {event.startDate} ～ {event.endDate}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="current-activity-view"
                        onClick={() => locateEvent(event)}
                      >
                        查看
                      </button>

                      <button
                        type="button"
                        className="current-activity-toggle"
                        aria-label="展開或收合活動"
                        onClick={() =>
                          setExpandedId((previous) =>
                            previous === currentId ? null : currentId,
                          )
                        }
                      >
                        {expandedId === currentId ? "−" : "+"}
                      </button>

                      {expandedId === currentId && (
                        <div className="current-activity-detail">
                          <p>活動類型：{event.type}</p>

                          {event.note && <p>{event.note}</p>}

                          {event.link && (
                            <p>
                              <a
                                href={event.link}
                                target="_blank"
                                rel="noreferrer"
                              >
                                查看活動相關連結 ↗
                              </a>
                            </p>
                          )}

                          {event.images && (
                            <div className="activity-event-images">
                              {Object.entries(event.images)
                                .filter(([, value]) => Boolean(value))
                                .map(([name, src]) => (
                                  <img
                                    key={name}
                                    src={src}
                                    alt={`${event.name} ${name}`}
                                    loading="lazy"
                                  />
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {(recentEvents.length > 0 || upcomingEvents.length > 0) && (
            <section className="activity-neighbor-links">
              {recentEvents.length > 0 && (
                <div className="activity-neighbor-item">
                  <span className="activity-neighbor-label">近期結束</span>

                  {recentEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className="activity-neighbor-name"
                      onClick={() => locateEvent(event)}
                    >
                      {event.name}
                    </button>
                  ))}
                </div>
              )}

              {upcomingEvents.length > 0 && (
                <div className="activity-neighbor-item upcoming">
                  <span className="activity-neighbor-label">即將開始</span>

                  {upcomingEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className="activity-neighbor-name"
                      onClick={() => locateEvent(event)}
                    >
                      {event.name}
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
      {/* 活動列表 */}

      {view === "list" && (
        <>
          <h2 className="activity-list-heading">活動一覽</h2>

          <div className="activity-list">
            {filteredEvents.length === 0 ? (
              <div className="activity-empty">沒有符合條件的活動。</div>
            ) : (
              filteredEvents.map((event) => (
                <ActivityItem
                  key={event.id}
                  event={event}
                  expanded={expandedId === event.id}
                  endingSoon={endingSoonIds.has(event.id)}
                  onToggle={() =>
                    setExpandedId((previous) =>
                      previous === event.id ? null : event.id,
                    )
                  }
                />
              ))
            )}
          </div>
        </>
      )}

      {/* 月曆 */}

      {view === "calendar" && (
        <div className="activity-calendar">
          <div className="calendar-heading">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="上一個月"
            >
              ‹
            </button>

            <h2>
              {month.getFullYear()} 年 {month.getMonth() + 1} 月
            </h2>

            <div className="calendar-next-controls">
              <button
                type="button"
                className="calendar-today-button"
                onClick={goToCurrentMonth}
                aria-label="回到今天"
              >
                <span className="calendar-today-day">{now.getDate()}</span>
              </button>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="下一個月"
              >
                ›
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            <div className="calendar-weekdays">
              {weekdays.map((day) => (
                <div key={day} className="calendar-weekday">
                  {day}
                </div>
              ))}
            </div>

            <div className="calendar-weeks">
              {calendarWeeks.map((week, index) => (
                <CalendarWeek
                  key={index}
                  days={week}
                  events={events}
                  selectedDate={selectedDate}
                  todayKey={todayKey}
                  onSelectDate={setSelectedDate}
                />
              ))}
            </div>
          </div>

          {/* 當日活動 */}

          <div className="calendar-selected-events">
            <h3>{formatDate(parseDate(selectedDate) ?? new Date())}</h3>

            <div className="activity-list">
              {selectedDateEvents.length === 0 ? (
                <div className="activity-empty">這一天沒有活動。</div>
              ) : (
                selectedDateEvents.map((event) => (
                  <ActivityItem
                    key={event.id}
                    event={event}
                    expanded={expandedId === `calendar-${event.id}`}
                    endingSoon={endingSoonIds.has(event.id)}
                    onToggle={() =>
                      setExpandedId((previous) =>
                        previous === `calendar-${event.id}`
                          ? null
                          : `calendar-${event.id}`,
                      )
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
