
/* ===== 主導覽頁面 ===== */

export type PageId =
    | "home"
    | "events"
    | "tools"
    | "database"
    | "personal";

export interface NavigationItem {
    id: PageId;
    label: string;
    icon: string;
    description: string;
}

/* ===== 工具中心 ===== */

export type ToolGroupId =
    | "gacha"
    | "lookup"
    | "analysis";

export type ToolId =
    | "gacha-calculator"
    | "pool-search"
    | "seventy-converter"
    | "function-search"
    | "physical-characters"
    | "magic-characters"
    | "strength-calculator"
    | "specified-comparison";

export interface ToolItem {
    id: ToolId;
    title: string;
    description: string;
    icon: string;
}

export interface ToolGroup {
    id: ToolGroupId;
    title: string;
    description: string;
    tools: ToolItem[];
}

/* ===== 活動中心 ===== */

export interface ActivityImages {
    pool1?: string;
    pool2?: string;
    pool3?: string;
    freeCharacter?: string;
    ssr?: string;
    carriage?: string;
}

export interface ActivityEvent {
    id: string;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    dateText: string;
    rerun: string;
    images?: ActivityImages;
    note?: string;
    link?: string;
}

export interface ActivityDataResponse {
    success: boolean;
    updatedAt: string;
    count: number;
    events: ActivityEvent[];
}

/* ===== 活動中心共用型別 ===== */

export type ActivityView = "list" | "calendar";

export interface CalendarDay {
    date: Date;
    dateKey: string;
    isCurrentMonth: boolean;
    events: ActivityEvent[];
}

/* ===== 遊戲資料庫 ===== */

export type DatabaseItemId =
    | "physical-characters"
    | "magic-characters"
    | "monster-database";

    