
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import Icon from "../components/Icon";
import "./MonsterDatabasePage.css";

import {
    fetchMonsterData,
    getCachedMonsterData,
} from "./monsterCsv";
import type {
    MonsterData,
    MonsterField,
    MonsterSkill,
    MonsterType,
    DefenseType,
} from "./monsterTypes";

type MonsterTypeFilter = "all" | MonsterType;
type DefenseFilter = "all" | DefenseType;

const confidenceLabels = {
    tested: "實測確認",
    derived: "推導定案",
    unconfirmed: "待確認",
};

function getFieldValue<T>(field: MonsterField<T>) {
    if (
        field.value === "" ||
        field.value === null ||
        field.value === undefined
    ) {
        return "尚無資料";
    }

    return String(field.value);
}

function getTextValue(value: string) {
    return value.trim() === "" ? "尚無資料" : value;
}

function MonsterFieldDisplay({
    label,
    field,
    fullWidth = false,
}: {
    label: string;
    field: MonsterField<string>;
    fullWidth?: boolean;
}) {
    return (
        <div
            className={`monster-skill-field ${fullWidth ? "monster-skill-field-full" : ""
                }`}
        >
            <span className="monster-skill-field-label">
                {label}
                <span
                    className={`monster-confidence ${field.confidence}`}
                >
                    {confidenceLabels[field.confidence]}
                </span>
            </span>

            <div className="monster-skill-field-value">
                {getFieldValue(field)}
            </div>
        </div>
    );
}

function MonsterSkillDisplay({
    skill,
}: {
    skill: MonsterSkill;
}) {
    return (
        <article className="monster-skill-item">
            <h4 className="monster-skill-name">
                {getTextValue(skill.name)}
            </h4>

            <div className="monster-skill-fields">
                <div className="monster-skill-field">
                    <span className="monster-skill-field-label">
                        技能類型
                    </span>
                    <div className="monster-skill-field-value">
                        {getTextValue(skill.type)}
                    </div>
                </div>

                <MonsterFieldDisplay
                    label="傷害"
                    field={skill.damage}
                />

                <div className="monster-skill-field">
                    <span className="monster-skill-field-label">
                        技能範圍
                    </span>
                    <div className="monster-skill-field-value">
                        {getTextValue(skill.range)}
                    </div>
                </div>

                <div className="monster-skill-field">
                    <span className="monster-skill-field-label">
                        效果
                    </span>
                    <div className="monster-skill-field-value">
                        {getTextValue(skill.effect)}
                    </div>
                </div>

                <MonsterFieldDisplay
                    label="效果範圍"
                    field={skill.effectRange}
                />

                <MonsterFieldDisplay
                    label="持續時間"
                    field={skill.duration}
                />

                <div className="monster-skill-field monster-skill-field-full">
                    <span className="monster-skill-field-label">
                        技能描述
                    </span>
                    <div className="monster-skill-field-value">
                        {getTextValue(skill.description)}
                    </div>
                </div>

                <div className="monster-skill-field monster-skill-field-full">
                    <span className="monster-skill-field-label">
                        技能備註
                    </span>
                    <div className="monster-skill-field-value">
                        {getTextValue(skill.notes)}
                    </div>
                </div>
            </div>
        </article>
    );
}


function MonsterDetail({
    monster,
}: {
    monster: MonsterData;
}) {
    return (
        <div className="monster-detail-content">
            {/* 敵人基本資料 */}
            <div className="monster-detail-header">
                <div className="monster-detail-title-row">
                    <h2 className="monster-detail-title">
                        {getTextValue(monster.name)}
                    </h2>

                    <div className="monster-detail-meta">
                        <span className="monster-info-tag monster-type-tag">
                            {getTextValue(monster.monsterType)}
                        </span>

                        <span className="monster-info-tag monster-defense-tag">
                            {getFieldValue(monster.defenseType)}
                            {" · "}
                            {confidenceLabels[monster.defenseType.confidence]}
                        </span>
                    </div>
                </div>

                {/* 敵人備註 */}
                <div className="monster-notes">
                    <div className="monster-skill-field monster-skill-field-full">
                        <span className="monster-skill-field-label">
                            敵人備註
                        </span>
                        <div className="monster-skill-field-value">
                            {getTextValue(monster.notes)}
                        </div>
                    </div>
                </div>
            </div>

            {/* 技能資料 */}
            <div className="monster-skills-section">
                <h3 className="monster-skills-heading">
                    技能資料（{monster.skills.length}）
                </h3>

                {monster.skills.length > 0 ? (
                    <div className="monster-skill-list">
                        {monster.skills.map((skill) => (
                            <MonsterSkillDisplay
                                key={skill.id}
                                skill={skill}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="monster-placeholder">
                        目前沒有技能資料
                    </div>
                )}
            </div>
        </div>
    );
}


export default function MonsterDatabasePage() {

    const [searchText, setSearchText] = useState("");

    const [typeFilter, setTypeFilter] =
        useState<MonsterTypeFilter>("all");

    const [defenseFilter, setDefenseFilter] =
        useState<DefenseFilter>("all");

    const [selectedMonsterId, setSelectedMonsterId] =
        useState<string | null>(null);


    // 進入頁面時，先讀取本機快取
    const [initialCache] = useState(() => getCachedMonsterData());

    const [monsterData, setMonsterData] = useState<MonsterData[]>(
        initialCache ?? []
    );

    // 有快取就不顯示初始讀取畫面
    const [isLoading, setIsLoading] = useState(
        initialCache === null
    );

    const [loadError, setLoadError] = useState("");

    // 從 Google 試算表讀取最新資料
    useEffect(() => {
        let isActive = true;

        async function loadData() {
            try {
                const data = await fetchMonsterData();

                if (isActive) {
                    setMonsterData(data);
                    setLoadError("");
                }
            } catch (error) {
                console.error("敵人資料讀取失敗：", error);

                // 沒有舊快取時，才顯示錯誤
                if (isActive && initialCache === null) {
                    setLoadError(
                        "無法讀取敵人資料，請確認網路連線或稍後再試。"
                    );
                }
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        }

        loadData();

        return () => {
            isActive = false;
        };
    }, [initialCache]);

    const filteredMonsters = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        return monsterData.filter((monster) => {
            const matchesName = monster.name
                .toLowerCase()
                .includes(keyword);

            const matchesType =
                typeFilter === "all" ||
                monster.monsterType === typeFilter;

            const matchesDefense =
                defenseFilter === "all" ||
                monster.defenseType.value === defenseFilter;

            return matchesName && matchesType && matchesDefense;
        });
    }, [monsterData, searchText, typeFilter, defenseFilter]);

    const selectedMonster =
        filteredMonsters.find(
            (monster) => monster.id === selectedMonsterId
        ) ?? filteredMonsters[0] ?? null;

    return (
        <div className="monster-database-page">
            <PageHeader
                icon={<Icon name="monster-database.svg" />}
                title="敵人角色資料"
                description="查詢敵人類型、防禦類型及技能效果。"
                size="large"
                as="h1"
            />

            {isLoading ? (
                <div className="monster-empty-state">
                    正在讀取敵人資料……
                </div>
            ) : loadError ? (
                <div className="monster-empty-state">
                    {loadError}
                </div>
            ) : (
                <>

                    <div className="monster-database-toolbar">
                        {/* 搜尋框 */}
                        <div className="monster-search-section">
                            <input
                                type="text"
                                className="monster-search"
                                placeholder="搜尋敵人名稱..."
                                value={searchText}
                                onChange={(event) =>
                                    setSearchText(event.target.value)
                                }
                            />
                        </div>

                        {/* 敵人類型 */}
                        <div className="monster-filter-section">
                            <h3 className="monster-filter-title">
                                敵人類型
                            </h3>

                            <div className="monster-filter-group">
                                {(
                                    [
                                        "all",
                                        "BOSS",
                                        "BOSS小怪",
                                        "小怪",
                                    ] as const
                                ).map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        className={`monster-filter-button ${typeFilter === type ? "active" : ""
                                            }`}
                                        onClick={() => setTypeFilter(type)}
                                    >
                                        {type === "all" ? "全部" : type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 防禦類型 */}
                        <div className="monster-filter-section">
                            <h3 className="monster-filter-title">
                                防禦類型
                            </h3>

                            <div className="monster-filter-group">
                                {(
                                    [
                                        "all",
                                        "弱物",
                                        "弱魔",
                                        "物魔雙弱",
                                        "物魔雙高",
                                        "無弱點",
                                    ] as const
                                ).map((defense) => (
                                    <button
                                        key={defense}
                                        type="button"
                                        className={`monster-filter-button ${defenseFilter === defense ? "active" : ""
                                            }`}
                                        onClick={() => setDefenseFilter(defense)}
                                    >
                                        {defense === "all"
                                            ? "全部"
                                            : defense}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>


                    <div className="monster-database-layout">
                        <section className="monster-list-section">
                            <div className="monster-section-heading">
                                <h2>敵人列表</h2>
                                <span className="monster-count">
                                    {filteredMonsters.length} 隻
                                </span>
                            </div>

                            {filteredMonsters.length > 0 ? (
                                <div className="monster-list">
                                    {filteredMonsters.map((monster) => (
                                        <button
                                            key={monster.id}
                                            type="button"
                                            className={`monster-list-item ${selectedMonster?.id === monster.id
                                                ? "active"
                                                : ""
                                                }`}
                                            onClick={() =>
                                                setSelectedMonsterId(monster.id)
                                            }
                                        >
                                            <span className="monster-list-item-name">
                                                {getTextValue(monster.name)}
                                            </span>

                                            <span className="monster-list-item-meta">
                                                {getTextValue(
                                                    monster.monsterType
                                                )}
                                                {" · "}
                                                {getFieldValue(
                                                    monster.defenseType
                                                )}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="monster-empty-state">
                                    {monsterData.length === 0
                                        ? "目前尚未收錄敵人資料"
                                        : "找不到符合條件的敵人"}
                                </div>
                            )}
                        </section>

                        <section className="monster-detail-section">
                            {selectedMonster ? (
                                <MonsterDetail
                                    monster={selectedMonster}
                                />
                            ) : (
                                <div className="monster-empty-state">
                                    請先選擇敵人，或調整搜尋與篩選條件
                                </div>
                            )}
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}
