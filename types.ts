export interface InventoryItem {
    id: string; // Unique identifier, e.g., product SKU
    name: string; // Item name for warehouse identification
    description: string;
    
    // Level 0: Main Category (Single Selection)
    category: string; 
    
    // Level 1: Sub1 Category (Multiple Allowed)
    subCategory1?: string[]; 
    
    // Level 2: Sub2 Category (Multiple Allowed)
    subCategory2?: string[]; 
    
    // Level 3: Sub3 Category (Single Selection)
    subCategory3?: string; 
    
    // Deprecated: Kept for type safety during migration of old data
    subCategory?: string; 

    priorUsage?: { year: number; usage: number }[];
    lowAlertQuantity?: number;
    price?: number;
}

export interface Location {
    id: string; // Unique identifier for the location
    name: string;
    subLocationPrompt?: string;
    subLocations?: string[];
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
    docId?: string; // Optional: Helper for updates
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
    category: string; // Ensure category is always present for UI logic
    stockTooltip: string;
    accentColor: string | undefined;
    isLowStock: boolean;
};
