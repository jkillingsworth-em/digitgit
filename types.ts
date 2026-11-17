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

    /** Optional color from EM Digit Inventory sheet */
    color?: string;
    /** Rolling / 3-year average usage from the sheet */
    threeYearAvg?: number;
    /** Latest SAGE on-hand snapshot */
    sageQty?: number;
    /** ISO date (YYYY-MM-DD) or free-text as-of for sageQty */
    sageAsOf?: string;
    /** Latest SAGE quantity on purchase order */
    sageOnPO?: number;
    /** SAGE bin codes for this part, e.g. J-LOFT-2 (Sage has no quantity per bin) */
    sageBins?: string[];
}

/** settings/sageImport: what the last Sage upload contained and how its bins map to app locations. */
export interface SageImportSettings {
    /** Sage bin prefix (J, C3, R2, …) → app location id, or '' to leave those bins out. */
    prefixMap?: Record<string, string>;
    lastImport?: {
        fileName: string;
        importedAt: string;
        asOf: string;
        partCount: number;
        /** Parts in the Sage file that the app doesn't have yet (first 500). */
        notInApp: { itemId: string; description: string; qtyOnHand: number }[];
    };
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

export interface PurchaseOrderRecord {
    poNumber: string;
    vendor?: string;
    notes?: string;
    arrivalDates: string[];
    itemIds?: string[];
    createdDate?: string;
    updatedDate?: string;
    docId?: string;
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

/** One line in a posted cycle count session */
export interface CycleCountLine {
    itemId: string;
    bookQty: number;
    countedQty: number;
    variance: number;
    subLocationDetail?: string;
}

/** Firestore `cycleCounts` session document */
export interface CycleCountSession {
    id: string;
    locationId: string;
    startedAt: string;
    completedAt: string;
    countedBy: string;
    blindMode: boolean;
    note: string;
    lines: CycleCountLine[];
    posted: boolean;
    status?: 'pending' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: string;
}
