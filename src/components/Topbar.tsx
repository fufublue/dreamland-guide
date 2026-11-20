
import type { PageId } from "../types";

interface TopbarProps {
    darkMode: boolean;
    onToggleTheme: () => void;
    onNavigate: (page: PageId) => void;
}

export default function Topbar({
    darkMode,
    onToggleTheme,
    onNavigate,
}: TopbarProps) {
    return (
        <header className="topbar">
            <div className="mobile-brand">
                夢樂園資料站
            </div>

            <div className="topbar-actions">
                <button
                    type="button"
                    className="theme-button"
                    onClick={onToggleTheme}
                    aria-label={darkMode ? "切換日間模式" : "切換夜間模式"}
                >
                    <span>{darkMode ? "☀" : "☾"}</span>
                    <span>{darkMode ? "日間模式" : "夜間模式"}</span>
                </button>

                <button
                    type="button"
                    className="login-button"
                    onClick={() => onNavigate("personal")}
                >
                    登入
                </button>
            </div>
        </header>
    );
}
