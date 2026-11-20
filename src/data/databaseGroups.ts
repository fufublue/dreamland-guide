
export interface DatabaseItem {
    id: string;
    title: string;
    description: string;
    icon: string;
}

export interface DatabaseGroup {
    id: string;
    title: string;
    description: string;
    items: DatabaseItem[];
}

export const databaseGroups: DatabaseGroup[] = [
    {
        id: "characters",
        title: "角色資料",
        description: "查詢角色能力、技能、天賦與相關資訊",
        items: [
            {
                id: "physical-characters",
                title: "物理角色資料",
                description: "查詢物理角色、技能及天賦",
                icon: "physical-characters.svg",
            },
            {
                id: "magic-characters",
                title: "魔法角色資料",
                description: "查詢魔法角色、技能及天賦",
                icon: "magic-characters.svg",
            },
        ],
    },
    {
        id: "enemies",
        title: "敵人資料",
        description: "整理怪物類型、防禦類型及技能資訊",
        items: [
            {
                id: "monster-database",
                title: "敵人角色資料",
                description: "查詢敵人類型、防禦類型及技能效果",
                icon: "monster-database.svg",
            },
        ],
    },
    {
        id: "others",
        title: "其他遊戲資料",
        description: "收錄其他遊戲內資料與設定",
        items: [],
    },
];
