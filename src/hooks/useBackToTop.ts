
import { useEffect, useState } from "react";

export default function useBackToTop() {
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        function handleScroll() {
            setShowBackToTop(window.scrollY > 300);
        }

        window.addEventListener("scroll", handleScroll);

        handleScroll();

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    return showBackToTop;
}
