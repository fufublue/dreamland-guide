
import type { ReactNode } from "react";
import type {
    ToolGroup,
    ToolGroupId,
    ToolItem,
} from "../types";
import PageHeader from "../components/PageHeader";
import Icon from "../components/Icon";


interface ToolsPageProps {
    icon: string;
    groups: ToolGroup[];
    selectedTool: ToolItem | null;
    selectedToolGroupId: ToolGroupId | null;
    onSelectTool: (tool: ToolItem, groupId: ToolGroupId) => void;
    onBack: () => void;
    children?: ReactNode;
}

export default function ToolsPage({
    icon,
    groups,
    selectedTool,
    onSelectTool,
    onBack,
    children,
}: ToolsPageProps) {
    if (selectedTool) {
        return (
            <div className="tools-page">
                <div
                    className={`tool-detail-header ${selectedTool.title === "混池範圍查詢"
                            ? "pool-search-detail-header"
                            : ""
                        }`}
                >
                    <button
                        type="button"
                        className="back-button"
                        onClick={onBack}
                    >
                        ← 返回工具列表
                    </button>

                    <PageHeader
                        icon={<Icon name={selectedTool.icon} />}
                        title={selectedTool.title}
                        description={selectedTool.description}
                        size="large"
                        as="h1"
                    />
                </div>

                <div
                    className="tool-detail-content"
                    id="tool-detail-interaction"
                >
                    {children}
                </div>
            </div>
        );
    }

    return (
        <div className="center-page">
            <PageHeader
                icon={<Icon name={icon} />}
                title="工具中心"
                description={"內含資源計算、資料查詢到角色分析等實用工具。"}
                size="large"
                as="h1"
            />

            <div className="tool-groups" id="tools-main-interaction">
                {groups.map((group) => (
                    <section
                        key={group.id}
                        className="tool-group"
                        id={`tool-group-${group.id}`}
                    >
                        <div className="tool-group-heading">
                            <h2>{group.title}</h2>
                            <p>{group.description}</p>
                        </div>

                        <div className="tool-grid">
                            {group.tools.map((tool) => (
                                <button
                                    key={tool.id}
                                    type="button"
                                    className="tool-card"
                                    onClick={() => onSelectTool(tool, group.id)}
                                >
                                    <span className="tool-card-icon">
                                        <span className="tool-card-icon-content">
                                            <Icon name={tool.icon} />
                                        </span>
                                    </span>

                                    <span className="tool-card-content">
                                        <span className="tool-card-title">
                                            {tool.title}
                                        </span>

                                        <span className="tool-card-description">
                                            {tool.description}
                                        </span>
                                    </span>

                                    <span className="tool-card-arrow">
                                        →
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
