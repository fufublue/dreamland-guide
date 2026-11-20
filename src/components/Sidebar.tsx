
import type { NavigationItem, PageId } from "../types";
import Icon from "./Icon";

interface SidebarProps {
    items: NavigationItem[];
    activePage: PageId;
    onNavigate: (page: PageId) => void;
}

export default function Sidebar({
    items,
    activePage,
    onNavigate,
}: SidebarProps) {
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="brand-icon">夢</div>

                <div>
                    <div className="brand-name">夢樂園資料站</div>
                    <div className="brand-subtitle">
                        DREAMLAND GUIDE
                    </div>
                </div>
            </div>

            <div className="nav-label">MAIN MENU</div>

            <nav className="side-nav">
                {items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`nav-item ${activePage === item.id ? "active" : ""
                            }`}
                        onClick={() => onNavigate(item.id)}
                        title={item.description}
                    >
                        <span className="nav-icon"><Icon name={item.icon} /></span>
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <span>夢樂園資料站</span>
                <span>個人遊戲資料整理工具</span>
            </div>
        </aside>
    );
}
