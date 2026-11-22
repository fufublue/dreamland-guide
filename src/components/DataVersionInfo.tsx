import { DATA_VERSIONS } from "../data/dataVersions";

type DataVersionItem = {
    label: string;
    version: string;
};

const dataVersionItems: DataVersionItem[] = [
    { label: "角色資料", version: DATA_VERSIONS.characterData },
    { label: "卡池資料", version: DATA_VERSIONS.poolData },
    { label: "強度計算基準", version: DATA_VERSIONS.strengthBaseData },
    { label: "天賦倍率資料", version: DATA_VERSIONS.talentMultiplierData },
    { label: "活動排程", version: DATA_VERSIONS.activityData },
    { label: "怪物與技能資料", version: DATA_VERSIONS.monsterCsv },
];

export default function DataVersionInfo() {
    return (
        <section className="data-version-section" aria-label="資料版本資訊">
            <div className="data-version-heading">
                <h2>資料版本資訊</h2>
                <span>目前網站設定</span>
            </div>

            <div className="data-version-grid">
                {dataVersionItems.map((item) => (
                    <div className="data-version-item" key={item.label}>
                        <span className="data-version-label">{item.label}</span>
                        <strong className="data-version-number">v{item.version}</strong>
                    </div>
                ))}
            </div>

            <p className="data-version-note">
                資料版本更新時，網站會依各資料來源的快取設定重新取得資料。
            </p>
        </section>
    );
}
