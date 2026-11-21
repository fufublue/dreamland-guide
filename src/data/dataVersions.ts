/**
 * 各資料來源的獨立版本號。
 * 當你更新對應資料來源後，只要把該項版本號往上調整，
 * 使用者下次讀取該資料時就會重新下載；其他資料不受影響。

 * 更新的資料				要修改的版本
 * 物理角色、魔法角色		characterData
 * 角色天賦倍率				talentMultiplierData
 * 卡池資料					poolData
 * 強度計算基準				strengthBaseData
 * 活動排程 JSON			activityData
 * 怪物資料、怪物技能 CSV		monsterCsv
 */
export const DATA_VERSIONS = {
  // GAS：角色資料（物理與魔法共用同一個版本）
  characterData: "1",

  // GAS：卡池資料
  poolData: "2",

  // GAS：強度計算基準資料
  strengthBaseData: "1",

  // GAS：角色天賦倍率資料
  talentMultiplierData: "1",

  // Google 試算表發布的活動 CSV（圖片由舊 JSON 依活動名稱與開始日期配對）
  activityData: "5",

  // Google 試算表發布的敵人與技能 CSV
  monsterCsv: "1",
} as const;
