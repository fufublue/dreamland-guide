
import type { ToolId } from "../types";

import GachaCalculator from "../tools/GachaCalculator";
import PoolSearch from "../tools/PoolSearch";
import ChallengeTicketConverter from "../tools/ChallengeTicketConverter";
import FunctionSearch from "../tools/FunctionSearch";
import CharacterSearch from "../tools/CharacterSearch";
import StrengthCalculatorV2 from "../tools/strength-v2/StrengthCalculatorV2";

interface ToolContentProps {
    toolId: ToolId;
}

export default function ToolContent({
    toolId,
}: ToolContentProps) {
    switch (toolId) {
        case "gacha-calculator":
            return <GachaCalculator />;

        case "pool-search":
            return <PoolSearch />;

        case "seventy-converter":
            return <ChallengeTicketConverter />;

        case "function-search":
            return <FunctionSearch />;

        case "physical-characters":
            return <CharacterSearch element="physical" />;

        case "magic-characters":
            return <CharacterSearch element="magic" />;

        case "strength-calculator":
            return <StrengthCalculatorV2 />;

        default:
            return (
                <div className="activity-empty">
                    找不到這項工具。
                </div>
            );
    }
}
