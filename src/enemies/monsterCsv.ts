
import type {
    DataConfidence,
    MonsterData,
    MonsterSkill,
    MonsterType,
    DefenseType,
    SkillType,
    SkillRange,
} from "./monsterTypes";
import { DATA_VERSIONS } from "../data/dataVersions";

// 敵人資料 CSV
const MONSTER_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUhkNXcmlY_9hVmBx6uQPcrQpJJUdgOaMVFOIuVDW3na0ir98e6DqzFh8WvkMJUgbNVNKmaB6wZxW1/pub?gid=701622795&single=true&output=csv";

// 敵人技能 CSV
const SKILL_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUhkNXcmlY_9hVmBx6uQPcrQpJJUdgOaMVFOIuVDW3na0ir98e6DqzFh8WvkMJUgbNVNKmaB6wZxW1/pub?gid=580634506&single=true&output=csv";


// ===== 敵人資料快取 =====

const MONSTER_CACHE_KEY = "dreamland-monster-data-cache-v1";
const MONSTER_DATA_VERSION = DATA_VERSIONS.monsterCsv;

// 記憶體快取
let memoryCache: MonsterData[] | null = null;
let memoryCacheVersion: string | null = null;

// 避免同時重複發送下載請求
let fetchPromise: Promise<MonsterData[]> | null = null;

/** 讀取上次保存的敵人資料。即使版本較舊，也可先顯示舊資料作為備援。 */
export function getCachedMonsterData(): MonsterData[] | null {
    if (memoryCache !== null) {
        return memoryCache;
    }

    try {
        const saved = localStorage.getItem(MONSTER_CACHE_KEY);

        if (!saved) {
            return null;
        }

        const parsed = JSON.parse(saved);

        if (!parsed || !Array.isArray(parsed.data)) {
            return null;
        }

        memoryCache = parsed.data as MonsterData[];
        memoryCacheVersion =
            typeof parsed.version === "string" ? parsed.version : null;
        return memoryCache;
    } catch {
        return null;
    }
}

/** 解析 CSV，支援逗號、引號及換行 */
function parseCSV(csv: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let value = "";
    let insideQuotes = false;

    const text = csv.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (insideQuotes && next === '"') {
                value += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === "," && !insideQuotes) {
            row.push(value);
            value = "";
        } else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {
            if (char === "\r" && next === "\n") {
                i++;
            }

            row.push(value);

            if (row.some((cell) => cell.trim() !== "")) {
                rows.push(row);
            }

            row = [];
            value = "";
        } else {
            value += char;
        }
    }

    row.push(value);

    if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
    }

    return rows;
}

/** 將 CSV 轉換成依照標題索引的資料 */
function parseCSVObjects(csv: string): Record<string, string>[] {
    const rows = parseCSV(csv);

    if (rows.length < 2) {
        return [];
    }

    const headers = rows[0].map((header) => header.trim());

    return rows.slice(1).map((row) => {
        const result: Record<string, string> = {};

        headers.forEach((header, index) => {
            result[header] = (row[index] ?? "").trim();
        });

        return result;
    });
}

/** 將試算表可信度轉換成程式使用的代碼 */
function parseConfidence(value: string): DataConfidence {
    switch (value.trim()) {
        case "實測確認":
            return "tested";

        case "推導定案":
            return "derived";

        case "待確認":
            return "unconfirmed";

        default:
            return "unconfirmed";
    }
}

/** 建立有可信度的欄位 */
function createField(value: string, confidence: string) {
    return {
        value,
        confidence: parseConfidence(confidence),
    };
}

/** 從 Google 試算表讀取敵人資料 */

export async function fetchMonsterData(): Promise<MonsterData[]> {
    const cachedData = getCachedMonsterData();

    // 版本相同就直接使用快取；版本不同才重新下載 CSV
    if (
        cachedData !== null &&
        memoryCacheVersion === MONSTER_DATA_VERSION
    ) {
        return cachedData;
    }

    // 已經有下載請求進行中，就共用同一個請求
    if (fetchPromise) {
        return fetchPromise;
    }

    fetchPromise = (async () => {
        const [monsterResponse, skillResponse] = await Promise.all([
            fetch(MONSTER_CSV_URL),
            fetch(SKILL_CSV_URL),
        ]);

        if (!monsterResponse.ok || !skillResponse.ok) {
            throw new Error("無法讀取 Google 試算表資料");
        }

        const [monsterCSV, skillCSV] = await Promise.all([
            monsterResponse.text(),
            skillResponse.text(),
        ]);

        const monsterRows = parseCSVObjects(monsterCSV);
        const skillRows = parseCSVObjects(skillCSV);

        // 整理技能，依照敵人名稱分類
        const skillsByMonster = new Map<string, MonsterSkill[]>();

        for (const row of skillRows) {
            const monsterName = row["敵人名稱"];

            if (!monsterName) continue;

            const skill: MonsterSkill = {
                id: row["技能ID"],
                name: row["技能名稱"],
                type: (row["技能類型"] || "") as SkillType | "",
                damage: createField(
                    row["傷害"],
                    row["傷害可信度"]
                ),
                range: (row["技能範圍"] || "") as SkillRange | "",
                effect: row["效果"],
                effectRange: createField(
                    row["效果範圍"],
                    row["效果範圍可信度"]
                ),
                duration: createField(
                    row["持續時間"],
                    row["持續時間可信度"]
                ),
                description: row["技能描述"],
                notes: row["技能備註"],
            };

            const existingSkills =
                skillsByMonster.get(monsterName) ?? [];

            existingSkills.push(skill);
            skillsByMonster.set(monsterName, existingSkills);
        }

        // 整理敵人資料，配對對應技能
        const monsters: MonsterData[] = monsterRows.map((row) => {
            const name = row["敵人名稱"];

            return {
                id: row["敵人ID"],
                name,
                monsterType: (row["敵人類型"] || "") as MonsterType | "",
                defenseType: createField(
                    row["防禦類型"],
                    row["防禦可信度"]
                ) as MonsterData["defenseType"],
                notes: row["敵人備註"],
                skills: skillsByMonster.get(name) ?? [],
            };
        });

        // 更新記憶體快取
        memoryCache = monsters;
        memoryCacheVersion = MONSTER_DATA_VERSION;

        // 保存到瀏覽器本機
        try {
            localStorage.setItem(
                MONSTER_CACHE_KEY,
                JSON.stringify({
                    version: MONSTER_DATA_VERSION,
                    data: monsters,
                })
            );
        } catch (error) {
            console.warn("敵人資料本機快取保存失敗：", error);
        }

        return monsters;
    })();

    try {
        return await fetchPromise;
    } finally {
        fetchPromise = null;
    }
}

