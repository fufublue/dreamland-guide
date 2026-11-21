export type BreakthroughTraitEffect = {
  type:
    | "elementalDamage"
    | "physicalDamage"
    | "magicDamage"
    | "healing"
    | "ultimateGauge";
  element?: string;
  value: number;
};

export function parseBreakthroughTrait(
  trait: string,
): BreakthroughTraitEffect[] {
  const results: BreakthroughTraitEffect[] = [];
  const parts = trait.split(/[&＆]/);

  for (const part of parts) {
    const text = part.trim();

    // 必殺槽上升
    const gaugeMatch = text.match(/必殺槽上升\s*\+?(\d+(?:\.\d+)?)%/);

    if (gaugeMatch) {
      results.push({
        type: "ultimateGauge",
        value: Number(gaugeMatch[1]),
      });
      continue;
    }

    // 傷害與治癒特性
    const match = text.match(
      /(水|火|風|地|雷|光|暗)?(傷|治癒)\+(\d+(?:\.\d+)?)%/,
    );

    if (!match) continue;

    const element = match[1];
    const category = match[2];
    const value = Number(match[3]);

    if (category === "治癒") {
      results.push({ type: "healing", value });
    } else if (element) {
      results.push({
        type: "elementalDamage",
        element,
        value,
      });
    } else if (text.startsWith("物傷")) {
      results.push({ type: "physicalDamage", value });
    } else if (text.startsWith("法傷")) {
      results.push({ type: "magicDamage", value });
    }
  }

  return results;
}

//必殺槽倍率
export function getBreakthroughUltimateGaugeMultiplier(
  trait: string | null | undefined,
): number {
  if (!trait?.trim()) return 1;

  const effect = parseBreakthroughTrait(trait).find(
    (item) => item.type === "ultimateGauge",
  );

  if (!effect) return 1;

  return 1 + effect.value / 100;
}


export function calculateBreakthroughTraitDamageBonus(
  trait: string | null | undefined,
  element: string,
  attackType: string,
): number {
  if (!trait?.trim()) return 0;

  return parseBreakthroughTrait(trait).reduce((total, effect) => {
    if (effect.type === "elementalDamage" && effect.element === element) {
      return total + effect.value;
    }

    if (effect.type === "physicalDamage" && attackType === "physical") {
      return total + effect.value;
    }

    if (effect.type === "magicDamage" && attackType === "magic") {
      return total + effect.value;
    }

    return total;
  }, 0);
}

export function calculateBreakthroughTraitHealingBonus(
  trait: string | null | undefined,
): number {
  if (!trait?.trim()) return 0;

  return parseBreakthroughTrait(trait).reduce((total, effect) => {
    if (effect.type === "healing") {
      return total + effect.value;
    }

    return total;
  }, 0);
}
