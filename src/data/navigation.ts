
import type { NavigationItem } from "../types";

export const navigation: NavigationItem[] = [
    {
        id: "home",
        label: "首頁",
        icon: "home.svg",
        description: "資料站首頁與常用功能",
    },
    {
        id: "events",
        label: "活動中心",
        icon: "events.svg",
        description: "查看活動資訊、日期與活動日曆",
    },
    {
        id: "tools",
        label: "工具中心",
        icon: "tools.svg",
        description: "使用各種遊戲計算與查詢工具",
    },
    {
        id: "database",
        label: "遊戲資料庫",
        icon: "database.svg",
        description: "查詢角色、敵人及遊戲資料",
    },
    {
        id: "personal",
        label: "個人中心",
        icon: "personal.svg",
        description: "管理收藏、隊伍與個人設定",
    },
];
