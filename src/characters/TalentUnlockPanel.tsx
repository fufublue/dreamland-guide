/*
天賦解鎖控制元件
這個元件只負責控制解鎖狀態，不會自行修改角色資料；實際效果會交給 applyTalents() 處理。
*/
import type { TalentUnlockState } from '../engine'

interface TalentUnlockPanelProps {
    value: TalentUnlockState
    onChange: (value: TalentUnlockState) => void
}

const talentNodes = [
    { key: 'node6', label: '天賦 6', description: '普通攻擊倍率增加' },
    { key: 'node9', label: '天賦 9', description: '第一技能天賦' },
    { key: 'node12', label: '天賦 12', description: '第二技能天賦' },
    { key: 'node15', label: '天賦 15', description: '必殺技天賦' },
] as const

export default function TalentUnlockPanel({
    value,
    onChange,
}: TalentUnlockPanelProps) {
    function toggleNode(key: keyof TalentUnlockState) {
        onChange({
            ...value,
            [key]: !value[key],
        })
    }

    return (
        <section className="talent-unlock-panel">
            <div className="talent-unlock-header">
                <h3>天賦解鎖</h3>
                <p>勾選已解鎖的天賦，查看技能數值變化。</p>
            </div>

            <div className="talent-unlock-options">
                {talentNodes.map(node => (
                    <label
                        key={node.key}
                        className="talent-unlock-option"
                    >
                        <input
                            type="checkbox"
                            checked={value[node.key]}
                            onChange={() => toggleNode(node.key)}
                        />

                        <span className="talent-unlock-option-text">
                            <strong>{node.label}</strong>
                            <small>{node.description}</small>
                        </span>
                    </label>
                ))}
            </div>
        </section>
    )
}
