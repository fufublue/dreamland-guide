import { fetchPoolData } from "../../../poolData";
import { DATA_VERSIONS } from "../../../data/dataVersions";
import { fetchWithVersionCache } from "../../../versionCache";

const ACTIVITY_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUhkNXcmlY_9hVmBx6uQPcrQpJJUdgOaMVFOIuVDW3na0ir98e6DqzFh8WvkMJUgbNVNKmaB6wZxW1/pub?gid=1900196781&single=true&output=csv";

type ActivityRow = {
  name: string;
  type: string;
  rerun: string;
  startDate: string;
};

export type TaiwanCharacterFilterData = {
  characterNames: Set<string>;
  frontierActivity: string;
  frontierDate: string;
  unmatchedCharacterCount: number;
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  text = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index++;
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

function normalizeText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toDateKey(value: string): string | null {
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function getTodayDateKey(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function getCharacterBaseName(characterName: string): string {
  return characterName.split("[")[0].trim();
}

function getSpecialTimeCharacterName(activityName: string): string {
  return normalizeText(activityName).replace(/^專屬時刻\s*/, "").trim();
}

async function fetchActivityRows(): Promise<ActivityRow[]> {
  const csvText = await fetchWithVersionCache(
    "strength-taiwan-release-activity-data",
    DATA_VERSIONS.activityData,
    async () => {
      const response = await fetch(ACTIVITY_CSV_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`活動排程讀取失敗（HTTP ${response.status}）。`);
      }
      return response.text();
    },
  );

  const rows = parseCSV(csvText);
  if (rows.length < 3) {
    throw new Error("活動排程資料格式不正確。");
  }

  const headers = rows[1].map((value) => value.trim());
  const getColumn = (name: string) => headers.indexOf(name);
  const requiredColumns = ["台服時間線", "復刻情況", "活動", "活動類型"];
  if (requiredColumns.some((name) => getColumn(name) < 0)) {
    throw new Error("活動排程缺少判斷台服推出角色所需的欄位。");
  }

  const dateColumn = getColumn("台服時間線");
  const rerunColumn = getColumn("復刻情況");
  const nameColumn = getColumn("活動");
  const typeColumn = getColumn("活動類型");

  return rows.slice(2).flatMap((row) => {
    const dateText = row[dateColumn]?.trim() ?? "";
    const name = row[nameColumn]?.trim() ?? "";
    const type = row[typeColumn]?.trim() ?? "";
    const rerun = row[rerunColumn]?.trim() ?? "";
    const startDate = toDateKey(dateText.split("~")[0]);

    if (!startDate || !name || !type) return [];

    return [{ name, type, rerun, startDate }];
  });
}

/**
 * 依「活動排程」中目前已開始的最新非復刻活動，
 * 對照「各期混池範圍」資料，整理台服已推出的角色名稱。
 */
export async function loadTaiwanReleasedCharacterNames(): Promise<TaiwanCharacterFilterData> {
  const [poolData, activityRows] = await Promise.all([
    fetchPoolData(),
    fetchActivityRows(),
  ]);

  const todayDateKey = getTodayDateKey();
  const frontier = activityRows
    .filter(
      (activity) =>
        activity.rerun === "非復刻" && activity.startDate <= todayDateKey,
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  if (!frontier) {
    throw new Error("找不到今天以前已開始的非復刻活動，暫時無法判斷台服角色。");
  }

  // 角色的首次推出活動日期。復刻場次不會覆蓋首次推出日期；
  // 「不復刻」的主線／常駐內容仍可作為角色首次推出活動。
  const firstReleaseDateByActivity = new Map<string, string>();
  const firstSpecialTimeDateByCharacter = new Map<string, string>();
  const firstSpecialTimeDateByBaseName = new Map<string, string>();

  const saveEarliestDate = (map: Map<string, string>, key: string, date: string) => {
    const normalizedKey = normalizeText(key);
    if (!normalizedKey) return;

    const previous = map.get(normalizedKey);
    if (!previous || date < previous) {
      map.set(normalizedKey, date);
    }
  };

  for (const activity of activityRows) {
    if (activity.rerun === "復刻") continue;

    saveEarliestDate(
      firstReleaseDateByActivity,
      activity.name,
      activity.startDate,
    );

    if (activity.type.includes("專屬時刻")) {
      const specialCharacterName = getSpecialTimeCharacterName(activity.name);
      if (specialCharacterName) {
        saveEarliestDate(
          firstSpecialTimeDateByCharacter,
          specialCharacterName,
          activity.startDate,
        );
        saveEarliestDate(
          firstSpecialTimeDateByBaseName,
          getCharacterBaseName(specialCharacterName),
          activity.startDate,
        );
      }
    }
  }

  // 開服常駐角色以「公測開服」作為推出時間。
  const openingDate = firstReleaseDateByActivity.get("公測開服");
  if (openingDate) {
    firstReleaseDateByActivity.set("開服常駐", openingDate);
  }

  const characterNames = new Set<string>();
  let unmatchedCharacterCount = 0;

  for (const character of poolData.characters) {
    if (character.isPrediction) continue;

    const activityName = normalizeText(character.activity ?? "");
    const exactCharacterName = normalizeText(character.character);
    const baseCharacterName = getCharacterBaseName(exactCharacterName);

    let releaseDate = activityName
      ? firstReleaseDateByActivity.get(activityName)
      : undefined;

    // 混池表的專屬時刻欄以「專屬時刻」作為共用活動名稱，
    // 因此改以角色造型名稱配對活動排程中的專屬時刻項目。
    if (!releaseDate && activityName.includes("專屬時刻")) {
      releaseDate =
        firstSpecialTimeDateByCharacter.get(exactCharacterName) ??
        firstSpecialTimeDateByBaseName.get(baseCharacterName);
    }

    // 某些專屬時刻資料的活動欄可能為空，仍以角色名稱配對。
    if (!releaseDate && character.type === "專屬時刻(限定)") {
      releaseDate =
        firstSpecialTimeDateByCharacter.get(exactCharacterName) ??
        firstSpecialTimeDateByBaseName.get(baseCharacterName);
    }

    if (!releaseDate) {
      unmatchedCharacterCount++;
      continue;
    }

    if (releaseDate <= frontier.startDate) {
      characterNames.add(character.character.trim());
    }
  }

  if (characterNames.size === 0) {
    throw new Error(
      `已找到最新非復刻活動「${frontier.name}」，但無法從混池範圍對應任何已推出角色。`,
    );
  }

  return {
    characterNames,
    frontierActivity: normalizeText(frontier.name),
    frontierDate: frontier.startDate,
    unmatchedCharacterCount,
  };
}
