
interface BackToTopProps {
    visible: boolean;
    onClick: () => void;
}

export default function BackToTop({
    visible,
    onClick,
}: BackToTopProps) {
    if (!visible) {
        return null;
    }

    const isMobile = window.innerWidth <= 600;


    function handleClick() {
        // 依照目前頁面尋找主要互動區
        const target =
            document.querySelector<HTMLElement>(".activity-toolbar") ||
            document.querySelector<HTMLElement>("#tool-detail-interaction") ||
            document.querySelector<HTMLElement>("#tools-main-interaction");

        if (target) {
            const targetPosition =
                target.getBoundingClientRect().top + window.scrollY - 100;

            window.scrollTo({
                top: Math.max(0, targetPosition),
                behavior: "smooth",
            });
        } else {
            // 其他尚未設定定位區的頁面：回到最頂端
            onClick();
        }
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="返回頂端"
        title="返回頂端"
        style={{
          position: "fixed",
          right: isMobile ? "16px" : "24px",
          bottom: isMobile
            ? "calc(90px + env(safe-area-inset-bottom))"
            : "30px",
          zIndex: 999999,

          width: isMobile ? "36px" : "40px",
          height: isMobile ? "36px" : "40px",

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          padding: 0,
          border: "1px solid #D8CDEB",
          borderRadius: "50%",

          background: "#FFFFFF",
          color: "#8565B5",

          boxShadow: "0 3px 10px rgba(0,0,0,0.15)",

          fontSize: isMobile ? "19px" : "21px",
          fontWeight: 500,
          lineHeight: 1,

          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            transform: "translateY(-1px)",
          }}
        >
          ↑
        </span>
      </button>
    );
}
