import type { ImgHTMLAttributes } from "react";

interface IconProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
    name: string;
}

export default function Icon({ name, className = "", ...props }: IconProps) {
    return (
        <img
            src={`${import.meta.env.BASE_URL}icons/${name}`}
            alt=""
            aria-hidden="true"
            className={`site-icon ${className}`.trim()}
            {...props}
        />
    );
}
