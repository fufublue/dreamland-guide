
import { type ReactNode } from "react";

import type {
    NavigationItem,
    PageId,
    ToolGroup,
    ToolGroupId,
    ToolItem,
    DatabaseItemId,
} from "../types";

import type { DatabaseItem } from "../data/databaseGroups";
import { databaseGroups } from "../data/databaseGroups";

import Home from "../pages/Home";
import ToolsPage from "../pages/ToolsPage";
import ActivityCenter from "../pages/ActivityCenter";
import PlaceholderPage from "../pages/PlaceholderPage";
import DatabasePage from "../pages/DatabasePage";

import CharacterBrowserPage from "../characters/CharacterBrowserPage";
import MonsterDatabasePage from "../enemies/MonsterDatabasePage";

interface PageRendererProps {
    activePage: PageId;
    navigation: NavigationItem[];
    toolGroups: ToolGroup[];
    selectedTool: ToolItem | null;
    selectedToolGroupId: ToolGroupId | null;
    selectedDatabaseItem: DatabaseItemId | null;
    onNavigate: (pageId: PageId) => void;
    onSelectTool: (tool: ToolItem, groupId: ToolGroupId) => void;
    onBackToTools: () => void;
    onSelectDatabaseItem: (itemId: DatabaseItemId) => void;
    onBackToDatabase: () => void;
    children?: ReactNode;
}

export default function PageRenderer({
    activePage,
    navigation,
    toolGroups,
    selectedTool,
    selectedToolGroupId,
    selectedDatabaseItem,
    onNavigate,
    onSelectTool,
    onBackToTools,
    onSelectDatabaseItem,
    onBackToDatabase,
    children,
}: PageRendererProps) {
    

    const handleDatabaseItemSelect = (item: DatabaseItem) => {
        if (
            item.id === "physical-characters" ||
            item.id === "magic-characters" ||
            item.id === "monster-database"
        ) {
            onSelectDatabaseItem(item.id as DatabaseItemId);
        }
    };

    const handleBackToDatabase = () => {
        onBackToDatabase();
    };

    // ==================================================
    // 怪物資料庫頁面
    // ==================================================

    if (
        activePage === "database" &&
        selectedDatabaseItem === "monster-database"
    ) {
        return (
            <div className="tools-page monster-database-page-wrapper">
                <div className="tool-detail-header">
                    <button
                        type="button"
                        className="back-button"
                        onClick={handleBackToDatabase}
                    >
                        ← 返回遊戲資料庫
                    </button>
                </div>

                <div className="tool-detail-content">
                    <MonsterDatabasePage />
                </div>
            </div>
        );
    }
    // ==================================================
    // 角色資料頁面
    // ==================================================

    if (
        activePage === "database" &&
        (
            selectedDatabaseItem === "physical-characters" ||
            selectedDatabaseItem === "magic-characters"
        )
    ) {
        const isPhysical =
            selectedDatabaseItem === "physical-characters";

        return (
            <div className="tools-page character-browser-page">
                <div className="tool-detail-header">
                    <button
                        type="button"
                        className="back-button"
                        onClick={handleBackToDatabase}
                    >
                        ← 返回遊戲資料庫
                    </button>
                </div>

                <div className="tool-detail-content">
                    <CharacterBrowserPage
                        key={selectedDatabaseItem}
                        attackType={isPhysical ? "physical" : "magic"}
                    />
                </div>
            </div>
        );
    }

    // ==================================================
    // 一般頁面
    // ==================================================

    switch (activePage) {
        case "home":
            return (
                <Home
                    navigation={navigation}
                    onNavigate={onNavigate}
                />
            );

        case "events":
            return (
                <ActivityCenter
                    icon={
                        navigation.find(
                            (item) => item.id === "events"
                        )?.icon ?? ""
                    }
                />
            );

        case "tools":
            return (
                <ToolsPage
                    icon={
                        navigation.find(
                            (item) => item.id === "tools"
                        )?.icon ?? ""
                    }
                    groups={toolGroups}
                    selectedTool={selectedTool}
                    selectedToolGroupId={selectedToolGroupId}
                    onSelectTool={onSelectTool}
                    onBack={onBackToTools}
                >
                    {children}
                </ToolsPage>
            );

        case "database":
            return (
                <DatabasePage
                    icon={
                        navigation.find(
                            (item) => item.id === "database"
                        )?.icon ?? ""
                    }
                    groups={databaseGroups}
                    onSelectItem={handleDatabaseItemSelect}
                />
            );

        case "personal":
            return (
                <PlaceholderPage
                    icon="personal.svg"
                    title="個人中心"
                    description="未來可在這裡管理收藏、隊伍與個人設定。"
                />
            );

        default:
            return null;
    }
}
