export interface InventoryItem {
    id: string; // Unique identifier, e.g., product SKU
    name: string; // Item name for warehouse identification
    description: string;
    category?: string;
    subCategory?: string;
    priorUsage?: { year: number; usage: number }[];
    lowAlertQuantity?: number;
    price?: number;
}

export interface Location {
    id: string; // Unique identifier for the location
    name: string;
    subLocationPrompt?: string;
}

export interface Stock {
    itemId: string;
    locationId: string;
    quantity: number;
    subLocationDetail?: string;
    locationBarcode?: string; // Barcode specific to this item at this location
    source: 'OH' | 'PO';
    poNumber?: string;
    dateReceived?: string;
}

export interface ReportDataItem extends InventoryItem, Omit<Stock, 'itemId' | 'locationId'> {
    locationName: string;
}

export interface PrintableLabel {
    itemId: string;
    description: string;
    locationName: string;
    subLocationDetail?: string;
}

export type InventoryItemUI = InventoryItem & {
    quantityInView: number;
    totalQuantity: number;
    etr: string;
    locationsWithStock: (Stock & { locationName: string })[];
    category: string;
    stockTooltip: string;
    accentColor: string | undefined;
    isLowStock: boolean;
};