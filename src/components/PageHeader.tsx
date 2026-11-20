
import type { ReactNode, ElementType } from "react";

interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: ReactNode;
    size?: "large" | "medium" | "small";
    iconVariant?: "boxed" | "plain";
    as?: "h1" | "h2" | "h3";
    className?: string;
}

export default function PageHeader({
    title,
    description,
    icon,
    size = "large",
    iconVariant = "boxed",
    as = "h1",
    className = "",
}: PageHeaderProps) {
    const Heading = as as ElementType;

    return (
        <div className={`page-header page-header-${size} ${className}`.trim()}>
            {icon && (
                <span
                    className={`page-header-icon page-header-icon-${iconVariant}`}
                >
                    <span className="page-header-icon-content">
                        {icon}
                    </span>
                </span>
            )}
            <div className="page-header-text">
                <Heading className="page-header-title">
                    {title}
                </Heading>

                {description && (
                    <p className="page-header-description">
                        {description}
                    </p>
                )}
            </div>
        </div>
    );
}
