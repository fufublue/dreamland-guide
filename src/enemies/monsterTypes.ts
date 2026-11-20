
/** 資料可信度 */
export type DataConfidence =
    | "tested"
    | "derived"
    | "unconfirmed";

/** 有可信度標記的欄位 */
export interface MonsterField<T> {
    value: T;
    confidence: DataConfidence;
}

/** 敵人類型 */
export type MonsterType =
    | "BOSS"
    | "BOSS小怪"
    | "小怪";

/** 防禦類型 */
export type DefenseType =
    | "弱物"
    | "弱魔"
    | "物魔雙弱"
    | "物魔雙高"
    | "無弱點";

/** 技能類型 */
export type SkillType =
    | "物理傷害"
    | "魔法傷害"
    | "其他";

/** 技能範圍 */
export type SkillRange =
    | "單體"
    | "全體"
    | "自身";

/** 技能資料 */
export interface MonsterSkill {
    id: string;
    name: string;
    type: SkillType | "";
    damage: MonsterField<string>;
    range: SkillRange | "";
    effect: string;
    effectRange: MonsterField<string>;
    duration: MonsterField<string>;
    description: string;
    notes: string;
}

/** 敵人資料 */
export interface MonsterData {
    id: string;
    name: string;
    monsterType: MonsterType | "";
    defenseType: MonsterField<DefenseType | "">;
    notes: string;
    skills: MonsterSkill[];
}
