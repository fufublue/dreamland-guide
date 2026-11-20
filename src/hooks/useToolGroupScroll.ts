
import { useEffect } from "react";

import type {
    PageId,
    ToolGroupId,
    ToolItem,
} from "../types";

interface UseToolGroupScrollProps {
    activePage: PageId;
    selectedTool: ToolItem | null;
    selectedToolGroupId: ToolGroupId | null;
}

export default function useToolGroupScroll({
    activePage,
    selectedTool,
    selectedToolGroupId,
}: UseToolGroupScrollProps) {
    useEffect(() => {
        if (
            activePage !== "tools" ||
            selectedTool ||
            !selectedToolGroupId
        ) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            const heading = document.querySelector(
                `#tool-group-${selectedToolGroupId} .tool-group-heading`
            );

            if (!heading) return;

            const top =
                heading.getBoundingClientRect().top +
                window.scrollY -
                90;

            window.scrollTo({
                top,
                behavior: "smooth",
            });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [activePage, selectedTool, selectedToolGroupId]);
}
