const CACHE_PREFIX = 'dreamland-guide'

// 避免同一個頁面同時對同一份資料發出重複請求
const pendingRequests = new Map<string, Promise<unknown>>()

type CacheRecord<T> = {
    version: string
    data: T
}

/**
 * 依照資料自己的版本號保存快取。
 * 版本相同：直接使用本機快取，不向資料來源發送請求。
 * 版本不同或沒有快取：重新下載並覆蓋舊快取。
 */
export async function fetchWithVersionCache<T>(
    cacheName: string,
    dataVersion: string,
    fetcher: () => Promise<T>
): Promise<T> {
    const cacheKey = `${CACHE_PREFIX}:${cacheName}`

    try {
        const saved = localStorage.getItem(cacheKey)

        if (saved) {
            const parsed = JSON.parse(saved) as CacheRecord<T>

            if (
                parsed &&
                parsed.version === dataVersion &&
                Object.prototype.hasOwnProperty.call(parsed, 'data')
            ) {
                return parsed.data
            }
        }
    } catch (error) {
        console.warn(`讀取${cacheName}快取失敗，將重新取得資料：`, error)
    }

    const existingRequest = pendingRequests.get(cacheKey)
    if (existingRequest) {
        return existingRequest as Promise<T>
    }

    const request = (async () => {
        const data = await fetcher()

        try {
            const record: CacheRecord<T> = {
                version: dataVersion,
                data,
            }
            localStorage.setItem(cacheKey, JSON.stringify(record))
        } catch (error) {
            console.warn(`儲存${cacheName}快取失敗：`, error)
        }

        return data
    })().finally(() => {
        pendingRequests.delete(cacheKey)
    })

    pendingRequests.set(cacheKey, request)
    return request
}
