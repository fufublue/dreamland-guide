
import { useEffect, useState } from "react";

import type {
    PageId,
    ToolGroupId,
    ToolItem,
    DatabaseItemId,
} from "../types";

import { toolGroups } from "../data/toolGroups";

type NavigationState = {
    activePage: PageId;
    selectedTool: ToolItem | null;
    selectedToolGroupId: ToolGroupId | null;
    selectedDatabaseItem: DatabaseItemId | null;
};

// 從網址讀取目前頁面
function readNavigationFromUrl(): NavigationState {
    const params = new URLSearchParams(window.location.search);

    const validPages: PageId[] = [
        "home",
        "events",
        "tools",
        "database",
        "personal",
    ];

    const pageParam = params.get("page");

    const activePage: PageId =
        validPages.includes(pageParam as PageId)
            ? (pageParam as PageId)
            : "home";

    // 讀取工具分類
    const groupParam = params.get("group");

    const foundGroup = toolGroups.find(
        (group) => group.id === groupParam
    );

    const selectedToolGroupId =
        activePage === "tools" && foundGroup
            ? foundGroup.id
            : null;

    // 讀取選取的工具
    const toolParam = params.get("tool");

    const foundTool = foundGroup?.tools.find(
        (tool) => tool.id === toolParam
    );

    const selectedTool =
        activePage === "tools" && foundTool
            ? foundTool
            : null;

    // 讀取資料庫子頁面
    const databaseParam = params.get("database");

    const validDatabaseItems: DatabaseItemId[] = [
        "physical-characters",
        "magic-characters",
        "monster-database",
    ];

    const selectedDatabaseItem: DatabaseItemId | null =
        activePage === "database" &&
            validDatabaseItems.includes(
                databaseParam as DatabaseItemId
            )
            ? (databaseParam as DatabaseItemId)
            : null;

    return {
        activePage,
        selectedTool,
        selectedToolGroupId,
        selectedDatabaseItem,
    };
}

// 將目前頁面寫入網址
function updateNavigationUrl(state: NavigationState) {
    const url = new URL(window.location.href);

    url.searchParams.set("page", state.activePage);

    url.searchParams.delete("group");
    url.searchParams.delete("tool");
    url.searchParams.delete("database");

    if (state.selectedToolGroupId) {
        url.searchParams.set(
            "group",
            state.selectedToolGroupId
        );
    }

    if (state.selectedTool) {
        url.searchParams.set(
            "tool",
            state.selectedTool.id
        );
    }

    if (state.selectedDatabaseItem) {
        url.searchParams.set(
            "database",
            state.selectedDatabaseItem
        );
    }

    window.history.pushState({}, "", url);
}

export default function useAppNavigation() {
    const [navigationState, setNavigationState] =
        useState<NavigationState>(readNavigationFromUrl);

    const {
        activePage,
        selectedTool,
        selectedToolGroupId,
        selectedDatabaseItem,
    } = navigationState;

    // 支援瀏覽器上一頁、下一頁
    useEffect(() => {
        function handlePopState() {
            setNavigationState(readNavigationFromUrl());
        }

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener(
                "popstate",
                handlePopState
            );
        };
    }, []);

    function navigate(nextState: NavigationState) {
        setNavigationState(nextState);
        updateNavigationUrl(nextState);
    }

    function goToPage(pageId: PageId) {
        navigate({
            activePage: pageId,
            selectedTool: null,
            selectedToolGroupId: null,
            selectedDatabaseItem: null,
        });

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    function selectTool(
        tool: ToolItem,
        groupId: ToolGroupId
    ) {
        navigate({
            ...navigationState,
            selectedTool: tool,
            selectedToolGroupId: groupId,
            selectedDatabaseItem: null,
        });

        requestAnimationFrame(() => {
            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        });
    }

    function backToTools() {
        navigate({
            ...navigationState,
            selectedTool: null,
        });
    }

    function selectDatabaseItem(
        itemId: DatabaseItemId
    ) {
        navigate({
            ...navigationState,
            selectedDatabaseItem: itemId,
        });

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    function backToDatabase() {
        navigate({
            ...navigationState,
            selectedDatabaseItem: null,
        });

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    return {
        activePage,
        selectedTool,
        selectedToolGroupId,
        selectedDatabaseItem,
        goToPage,
        selectTool,
        backToTools,
        selectDatabaseItem,
        backToDatabase,
        scrollToTop,
    };
}
