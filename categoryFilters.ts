import { InventoryItem } from './types';

type CategoryFilterableItem = Pick<InventoryItem, 'category' | 'subCategory' | 'subCategory1' | 'subCategory2' | 'subCategory3'>;

interface CategoryFilterGroup {
    subValues: Set<string>;
}

const addToken = (tokens: Set<string>, value?: string | null) => {
    const cleaned = (value || '').trim();
    if (cleaned) tokens.add(cleaned);
};

const getCategoryFilterParts = (filterValue: string): { main: string; subValue: string | null } => {
    const cleaned = (filterValue || '').trim();
    const separatorIndex = cleaned.indexOf('|');

    if (separatorIndex === -1) {
        return { main: cleaned, subValue: null };
    }

    return {
        main: cleaned.slice(0, separatorIndex).trim(),
        subValue: cleaned.slice(separatorIndex + 1).trim() || null,
    };
};

export const collectItemCategoryTokens = (item: CategoryFilterableItem): Set<string> => {
    const tokens = new Set<string>();

    addToken(tokens, item.subCategory);
    addToken(tokens, item.subCategory3);
    if (Array.isArray(item.subCategory1)) item.subCategory1.forEach(value => addToken(tokens, value));
    if (Array.isArray(item.subCategory2)) item.subCategory2.forEach(value => addToken(tokens, value));

    return tokens;
};

export const matchesCategoryFilters = (item: CategoryFilterableItem, selectedFilters: Iterable<string>): boolean => {
    const groupedFilters = new Map<string, CategoryFilterGroup>();

    for (const rawFilterValue of selectedFilters) {
        const { main, subValue } = getCategoryFilterParts(rawFilterValue);
        if (!main) continue;

        if (!groupedFilters.has(main)) {
            groupedFilters.set(main, { subValues: new Set<string>() });
        }

        if (subValue) {
            groupedFilters.get(main)?.subValues.add(subValue);
        }
    }

    if (groupedFilters.size === 0) return true;

    const normalizedCategory = (item.category || 'UNCATEGORIZED').trim() || 'UNCATEGORIZED';
    const activeGroup = groupedFilters.get(normalizedCategory);
    if (!activeGroup) return false;

    if (activeGroup.subValues.size === 0) return true;

    const itemTokens = collectItemCategoryTokens(item);
    for (const subValue of activeGroup.subValues) {
        if (!itemTokens.has(subValue)) {
            return false;
        }
    }

    return true;
};