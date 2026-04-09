type CacheEntry = { value: string | null; expires: number };

const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

function cacheKey(entityType: string, fieldName: string) {
    return `${entityType.trim()}\0${fieldName.trim()}`;
}

/**
 * Resolves the current UI label for a custom field by stable `field_name`.
 * Uses in-memory deduplication and a short TTL so parallel or repeated calls stay cheap.
 *
 * @param entityType - e.g. "jobs", "organizations"
 * @param fieldName - e.g. "Field_60"
 * @returns field_label or null if not found / error
 */
export async function getCustomFieldLabel(
    entityType: string,
    fieldName: string
): Promise<string | null> {
    const et = entityType?.trim();
    const fn = fieldName?.trim();
    if (!et || !fn) return null;

    const key = cacheKey(et, fn);
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expires > now) {
        return hit.value;
    }

    let pending = inflight.get(key);
    if (!pending) {
        pending = (async () => {
            try {
                const qs = new URLSearchParams({
                    entity_type: et,
                    field_name: fn
                });
                const res = await fetch(`/api/custom-fields/field-label?${qs.toString()}`, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store'
                });

                const data = (await res.json().catch(() => null)) as {
                    success?: boolean;
                    field_label?: string;
                } | null;

                const value =
                    res.ok && data?.success && typeof data.field_label === 'string'
                        ? data.field_label
                        : null;

                cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
                return value;
            } catch {
                cache.set(key, { value: null, expires: Date.now() + CACHE_TTL_MS });
                return null;
            } finally {
                inflight.delete(key);
            }
        })();
        inflight.set(key, pending);
    }

    return pending;
}

/**
 * Resolve multiple field labels in one call-site.
 * Uses the same cache/inflight maps as getCustomFieldLabel.
 */
export async function getCustomFieldLabels(
    entityType: string,
    fieldNames: string[]
): Promise<Record<string, string | null>> {
    const unique = Array.from(
        new Set(
            (fieldNames || [])
                .map((f) => String(f || "").trim())
                .filter(Boolean)
        )
    );
    const entries = await Promise.all(
        unique.map(async (fieldName) => {
            const label = await getCustomFieldLabel(entityType, fieldName);
            return [fieldName, label] as const;
        })
    );
    return Object.fromEntries(entries);
}

/** Drop cached entries (e.g. after admin renames a field in the same session). */
export function clearCustomFieldLabelCache(entityType?: string, fieldName?: string) {
    if (entityType !== undefined && fieldName !== undefined) {
        const key = cacheKey(entityType, fieldName);
        cache.delete(key);
        inflight.delete(key);
        return;
    }
    cache.clear();
    inflight.clear();
}