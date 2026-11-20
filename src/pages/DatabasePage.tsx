
import type { DatabaseGroup, DatabaseItem } from "../data/databaseGroups";
import PageHeader from "../components/PageHeader";
import Icon from "../components/Icon";

interface DatabasePageProps {
    icon: string;
    groups: DatabaseGroup[];
    onSelectItem: (item: DatabaseItem) => void;
}

export default function DatabasePage({
    icon,
    groups,
    onSelectItem,
}: DatabasePageProps) {
    return (
        <div className="center-page">
            <PageHeader
                icon={<Icon name={icon} />}
                title="遊戲資料庫"
                description="集中整理角色、敵人與各項遊戲資料。"
                size="large"
                as="h1"
            />

            <div className="tool-groups">
                {groups.map((group) => (
                    <section
                        key={group.id}
                        className="tool-group"
                        id={`database-group-${group.id}`}
                    >
                        <div className="tool-group-heading">
                            <h2>{group.title}</h2>
                            <p>{group.description}</p>
                        </div>

                        <div className="tool-grid">
                            {group.items.length > 0 ? (
                                group.items.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="tool-card"
                                        onClick={() => onSelectItem(item)}
                                    >
                                        <span className="tool-card-icon">
                                            <span className="tool-card-icon-content">
                                                <Icon name={item.icon} />
                                            </span>
                                        </span>

                                        <span className="tool-card-content">
                                            <span className="tool-card-title">
                                                {item.title}
                                            </span>

                                            <span className="tool-card-description">
                                                {item.description}
                                            </span>
                                        </span>

                                        <span className="tool-card-arrow">
                                            →
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="database-coming-soon">
                                    <span>更多資料整理中</span>
                                </div>
                            )}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
