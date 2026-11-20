
import { useState } from "react";
import "./styles/App.css";
import { navigation } from "./data/navigation";
import { toolGroups } from "./data/toolGroups";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import MobileNav from "./components/MobileNav";
import BackToTop from "./components/BackToTop";
import ToolContent from "./components/ToolContent";
import PageRenderer from "./layouts/PageRenderer";
import useBackToTop from "./hooks/useBackToTop";
import useToolGroupScroll from "./hooks/useToolGroupScroll";
import useAppNavigation from "./hooks/useAppNavigation";

/* ===== 主程式 ===== */

export default function App() {
  const {
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
  } = useAppNavigation();

  const [darkMode, setDarkMode] = useState(false);
  const showBackToTop = useBackToTop();

  useToolGroupScroll({
    activePage,
    selectedTool,
    selectedToolGroupId,
  });

  return (
    <div className={`app-shell ${darkMode ? "dark" : ""}`}>
      <Sidebar
        items={navigation}
        activePage={activePage}
        onNavigate={goToPage}
      />

      <main className="main-area">
        <Topbar
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((previous) => !previous)}
          onNavigate={goToPage}
        />

        <div className="page-content">
          <PageRenderer
            activePage={activePage}
            navigation={navigation}
            toolGroups={toolGroups}
            selectedTool={selectedTool}
            selectedToolGroupId={selectedToolGroupId}
            selectedDatabaseItem={selectedDatabaseItem}
            onNavigate={goToPage}
            onSelectTool={selectTool}
            onBackToTools={backToTools}
            onSelectDatabaseItem={selectDatabaseItem}
            onBackToDatabase={backToDatabase}
          >
            {selectedTool && (
              <ToolContent toolId={selectedTool.id} />
            )}
          </PageRenderer>
        </div>

        <footer className="page-footer">
          <span>夢樂園資料站</span>
          <span>個人遊戲資料整理工具</span>
        </footer>
      </main>

      <MobileNav
        items={navigation}
        activePage={activePage}
        onNavigate={goToPage}
      />

      <BackToTop
        visible={showBackToTop}
        onClick={scrollToTop}
      />
    </div>
  );
}
