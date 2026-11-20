
import type { NavigationItem, PageId } from "../types";
import Icon from "./Icon";

interface MobileNavProps {
    items: NavigationItem[];
    activePage: PageId;
    onNavigate: (page: PageId) => void;
}

export default function MobileNav({
    items,
    activePage,
    onNavigate,
}: MobileNavProps) {
    return (
        <nav className="mobile-nav">
            {items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    className={`mobile-nav-item ${activePage === item.id ? "active" : ""
                        }`}
                    onClick={() => onNavigate(item.id)}
                    aria-label={item.label}
                    title={item.description}
                >
                    <span className="mobile-nav-icon"><Icon name={item.icon} /></span>
                    <small>{item.label}</small>
                </button>
            ))}
        </nav>
    );
}
