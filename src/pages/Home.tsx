
import type { NavigationItem, PageId } from "../types";
import PageHeader from "../components/PageHeader";
import Icon from "../components/Icon";
import DataVersionInfo from "../components/DataVersionInfo";

interface HomeProps {
    navigation: NavigationItem[];
    onNavigate: (page: PageId) => void;
}

export default function Home({
    navigation,
    onNavigate,
}: HomeProps) {
    const categories = navigation.filter(
        (item) => item.id !== "home"
    );

    return (
        <div className="home-page">
            <section className="welcome-section">
                <div className="welcome-content">
                    <span className="welcome-label">
                        DREAMLAND GUIDE
                    </span>

                    <h1>歡迎來到夢樂園資料站</h1>

                    <p>
                        整理遊戲資訊、活動資料與實用工具。
                    </p>
                </div>
            </section>

            <section className="section-block">
                <div className="section-heading">
                    <PageHeader
                        title="功能分類"
                        description="選擇想使用的功能，開始探索夢樂園。"
                        size="medium"
                        as="h2"
                        iconVariant="plain"
                    />
                </div>

                <div className="category-grid">
                    {categories.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className="category-card"
                            onClick={() => onNavigate(item.id)}
                        >
                            <span className="category-icon">
                                <Icon name={item.icon} />
                            </span>

                            <span className="category-text">
                                <span className="category-title">
                                    {item.label}
                                </span>

                                <span className="category-description">
                                    {item.description}
                                </span>
                            </span>

                            <span className="category-arrow">
                                →
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            <DataVersionInfo />
        </div>
    );
}
