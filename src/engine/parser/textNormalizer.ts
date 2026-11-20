//統一處理全形半形、空白與常見文字格式，避免同一種效果因為文字格式不同而解析失敗。

export function normalizeText(text: string): string {
    return text
        .normalize('NFKC')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/　/g, ' ')
        .trim()
}

export function splitEffectText(text: string): string[] {
    const normalized = normalizeText(text)

    if (!normalized) {
        return []
    }

    return normalized
        .split(/\n|；|;|。|並且|以及|此外/g)
        .map(part => part.trim())
        .filter(Boolean)
}

export function extractPercentage(text: string): string {
    const match = text.match(/\d+(?:\.\d+)?%/)
    return match?.[0] ?? ''
}

export function extractDuration(text: string): string {
    const match = text.match(/\d+(?:\.\d+)?秒/)
    return match?.[0] ?? ''
}