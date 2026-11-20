
import Icon from "../components/Icon";

interface PlaceholderPageProps {
    icon: string;
    title: string;
    description: string;
}

export default function PlaceholderPage({
    icon,
    title,
    description,
}: PlaceholderPageProps) {
    return (
        <div className="subpage">
            <div className="coming-soon">
                <div className="coming-soon-icon">
                    <Icon name={icon} />
                </div>

                <h1>{title}</h1>

                <p>{description}</p>

                <span className="coming-soon-label">
                    功能規劃中
                </span>
            </div>
        </div>
    );
}
