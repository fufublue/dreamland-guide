
import type { ToolGroup } from "../types";

export const toolGroups: ToolGroup[] = [
    {
        id: "gacha",
        title: "抽卡與資源",
        description: "計算抽卡資源及查詢卡池資訊",
        tools: [
            {
                id: "gacha-calculator",
                title: "抽卡資源計算",
                description: "計算目前資源與抽卡所需數量",
                icon: "gacha-calculator.svg",
            },
            {
                id: "pool-search",
                title: "混池範圍查詢",
                description: "查詢角色混池與卡池範圍",
                icon: "pool-search.svg",
            },
            {
                id: "seventy-converter",
                title: "挑戰券換算",
                description: "換算挑戰券與相關資源",
                icon: "challenge-ticket-converter.svg",
            },
        ],
    },
    {
        id: "lookup",
        title: "遊戲資料查詢",
        description: "查找遊戲內各項功能及資訊",
        tools: [
            {
                id: "function-search",
                title: "功能查找",
                description: "搜尋遊戲內各項功能及資訊",
                icon: "function-search.svg",
            },
        ],
    },
    {
        id: "analysis",
        title: "角色分析與模擬",
        description: "分析角色能力及戰鬥表現",
        tools: [
            {
                id: "strength-calculator",
                title: "強度計算",
                description: "計算及比較角色的戰鬥表現",
                icon: "strength-calculator.svg",
            },
            {
                id: "specified-comparison",
                title: "指定比較",
                description: "自行選擇兩位角色及各自條件，比較戰鬥表現",
                icon: "指定比較.svg",
            },
        ],
    },
];
