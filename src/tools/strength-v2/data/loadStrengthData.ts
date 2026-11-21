
import { loadCharacterDataset } from '../../../engine'
import { fetchStrengthBaseData } from '../../../strengthBaseData'
import { fetchMonsterData } from '../../../enemies/monsterCsv'

import {
    adaptMonsterData,
    type AdaptedMonsterData,
} from './monsterAdapter'

import {
    adaptStrengthBaseData,
    type StrengthBaseDataV2,
} from './strengthBaseAdapter'

import type {
    StrengthDataStatus,
    StrengthDataWarning,
} from '../types'


// ======================================================
// 從既有資料載入函式取得回傳型別
// ======================================================

export type LoadedCharacterData =
    Awaited<ReturnType<typeof loadCharacterDataset>>

export type LoadedStrengthBaseData =
    Awaited<ReturnType<typeof fetchStrengthBaseData>>


// ======================================================
// 新版強度計算器的完整資料
// ======================================================

export type StrengthDataBundle = {
    characterData: LoadedCharacterData
    strengthBaseData: StrengthBaseDataV2
    monsterData: AdaptedMonsterData[]
    status: StrengthDataStatus
}


// ======================================================
// 載入強度計算所需資料
// ======================================================

export async function loadStrengthData(): Promise<StrengthDataBundle> {
  // 同時載入角色資料、強度基準資料與敵人資料
  const [characterData, rawStrengthBaseData, rawMonsterData] =
    await Promise.all([
      loadCharacterDataset(),
      fetchStrengthBaseData(),
      fetchMonsterData(),
    ]);

  // 將舊版基準資料轉接成新版型別
  const adapted = adaptStrengthBaseData(rawStrengthBaseData);

  // 將原始敵人資料轉換成計算器使用的格式
  const monsterData = adaptMonsterData(rawMonsterData);

  const warnings: StrengthDataWarning[] = [];

  // 整理原始強度基準資料的警告
  for (const warning of rawStrengthBaseData.warnings ?? []) {
    warnings.push({
      source: "強度基準資料",
      message: warning,
    });
  }

  // 整理轉接過程發現的警告
  for (const warning of adapted.warnings) {
    warnings.push({
      source: "強度基準資料轉接",
      message: warning,
    });
  }

  // 整理 GAS 回傳的角色資料檢查明細
  for (const warning of characterData.warningDetails) {
    warnings.push({
      source: `角色資料｜${warning.characterName}`,
      characterId: warning.characterId,
      message: [`工作表列數：第 ${warning.row} 列`, ...warning.issues].join(
        "；",
      ),
    });
  }
 

  return {
    characterData,
    strengthBaseData: adapted.data,
    monsterData,

    status: {
      loading: false,
      error: null,
      warnings,
    },
  };
}
