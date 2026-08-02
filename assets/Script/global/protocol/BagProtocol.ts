/**
 * bag_get / bag_items 统一解析（纯数据模块，无 Cocos 依赖）
 *
 * 业务层只读 BagItemSnapshot.items，禁止自行判断 response 层级。
 */

export type BagItemEntry = {
    item_id: number;
    quantity: number;
    category: number;
};

export type BagItemsResponse = {
    type?: string;
    success?: boolean;
    message?: string;
    code?: number;
    request_id?: string;
    bag_version?: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
    total_count?: number;
    category?: number | null;
    items?: unknown;
    data?: {
        items?: unknown;
        slots?: unknown;
        bag_version?: number;
        page?: number;
        page_size?: number;
        total_pages?: number;
        total_count?: number;
        category?: number | null;
        message?: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

export type BagItemSnapshot = {
    success: boolean;
    items: BagItemEntry[];
    message: string;
    request_id?: string;
    bag_version: number;
    page: number;
    page_size: number;
    total_pages: number;
    total_count: number;
    category: number | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
}

function pickNumber(v: unknown, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * 兼容根级 items、data.items、遗留 data.slots（slots 用 count 作 quantity）
 */
function extractRawItemList(response: BagItemsResponse): unknown[] {
    if (Array.isArray(response.items)) return response.items;
    const data = asRecord(response.data);
    if (data) {
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data.slots)) return data.slots;
    }
    return [];
}

function normalizeEntry(raw: unknown): BagItemEntry | null {
    const row = asRecord(raw);
    if (!row) return null;
    const itemId = pickNumber(row.item_id ?? row.itemId, 0);
    const quantity = pickNumber(row.quantity ?? row.count ?? row.num, 0);
    const category = pickNumber(row.category, 1);
    if (!(itemId > 0)) return null;
    return {
        item_id: itemId,
        quantity: Math.max(0, quantity),
        category: category > 0 ? category : 1,
    };
}

/**
 * 将任意 bag_items / bag_get 响应规范为统一快照。
 * success=false 时 items 恒为 []。
 */
export function normalizeBagItemsResponse(response: unknown): BagItemSnapshot {
    const resp = asRecord(response) as BagItemsResponse | null;
    if (!resp) {
        return {
            success: false,
            items: [],
            message: 'invalid bag response',
            bag_version: 0,
            page: 1,
            page_size: 0,
            total_pages: 1,
            total_count: 0,
            category: null,
        };
    }

    const data = asRecord(resp.data) || {};
    const success = resp.success === true;
    const message = String(resp.message ?? data.message ?? (success ? '' : 'bag_get failed'));
    const requestId =
        resp.request_id !== undefined && resp.request_id !== null
            ? String(resp.request_id)
            : data.request_id !== undefined && data.request_id !== null
              ? String(data.request_id)
              : undefined;

    const rawList = success ? extractRawItemList(resp) : [];
    const items: BagItemEntry[] = [];
    for (const raw of rawList) {
        const entry = normalizeEntry(raw);
        if (entry) items.push(entry);
    }

    const bagVersion = pickNumber(resp.bag_version ?? data.bag_version, 0);
    const page = Math.max(1, pickNumber(resp.page ?? data.page, 1));
    const pageSize = Math.max(0, pickNumber(resp.page_size ?? data.page_size, items.length));
    const totalCount = Math.max(
        0,
        pickNumber(resp.total_count ?? data.total_count, items.length),
    );
    const totalPages = Math.max(
        1,
        pickNumber(
            resp.total_pages ?? data.total_pages,
            pageSize > 0 ? Math.ceil(totalCount / pageSize) || 1 : 1,
        ),
    );
    const categoryRaw = resp.category !== undefined ? resp.category : data.category;
    const category =
        categoryRaw === null || categoryRaw === undefined || categoryRaw === ''
            ? null
            : pickNumber(categoryRaw, 0) || null;

    return {
        success,
        items,
        message,
        request_id: requestId,
        bag_version: bagVersion,
        page,
        page_size: pageSize,
        total_pages: totalPages,
        total_count: totalCount,
        category,
    };
}

/** 从快照提取拥有数量 > 0 的物品 ID 集合（剧情 requirement 用） */
export function ownedItemIdsFromSnapshot(snapshot: BagItemSnapshot): Set<number> {
    const ids = new Set<number>();
    if (!snapshot.success) return ids;
    for (const it of snapshot.items) {
        if (it.item_id > 0 && it.quantity > 0) ids.add(it.item_id);
    }
    return ids;
}
