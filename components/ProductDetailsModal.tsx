
import React from 'react';
import { InventoryItemUI, PrintableLabel } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';

interface ProductDetailsModalProps {
    item: InventoryItemUI;
    onClose: () => void;
    onPrintSpecificLabel: (label: PrintableLabel) => void;
    onSetFilterCategory: (cat: string) => void;
    onEdit: () => void;
    onMove: () => void;
}

const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ item, onClose, onPrintSpecificLabel, onSetFilterCategory, onEdit, onMove }) => {
    
    const usageList = item.priorUsage?.map(u => ({ year: u.year, value: u.usage })) || [];
    
    // Conditional Rendering Logic
    const hasHistory = usageList.length > 0;
    const hasETR = item.etr && item.etr !== 'N/A';
    const showMetrics = hasHistory || hasETR;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-0 md:p-4 animate-fade-in-down" onClick={onClose}>
            <div 
                className="bg-gray-50 w-full h-full md:h-auto md:max-h-[90vh] md:rounded-2xl shadow-2xl md:max-w-6xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Sticky Header Action Bar */}
                <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-gray-200 shrink-0 z-20 sticky top-0">
                    <div className="text-xl md:text-2xl font-black text-em-red uppercase tracking-tight flex items-center gap-2 min-w-0 flex-1 mr-4">
                        <span className="truncate">{item.description}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={onEdit} className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors border border-yellow-200">
                             <PencilSquareIcon className="w-4 h-4" />
                             <span className="hidden sm:inline">EDIT</span>
                        </button>
                        <button onClick={onMove} className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200">
                             <ArrowRightLeftIcon className="w-4 h-4" />
                             <span className="hidden sm:inline">MOVE</span>
                        </button>
                         <button onClick={onClose} className="flex items-center gap-1 px-3 py-1.5 text-sm font-bold text-white bg-em-red hover:bg-red-700 rounded-lg transition-colors border border-red-800 shadow-sm">
                            <XMarkIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">CLOSE</span>
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-4 md:p-8 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
                        
                        {/* LEFT COLUMN (Sidebar info) */}
                        <div className="md:col-span-4 flex flex-col gap-4 md:sticky md:top-0 self-start">
                            
                            {/* Header Info */}
                            <div className="md:pr-4">
                                <h1 className="text-xl md:text-3xl font-black text-slate-900 leading-tight uppercase mb-3">
                                    {item.id}
                                </h1>
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    {/* Promoted Quantity Display (Since cards might be hidden) */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">QTY:</span>
                                        <span className={`text-base font-black ${item.isLowStock ? 'text-em-red' : 'text-slate-900'}`}>
                                            {item.totalQuantity}
                                        </span>
                                    </div>
                                    <span className="text-gray-700">|</span>
                                    <button 
                                        onClick={() => { 
                                            onSetFilterCategory(item.subCategory ? `${item.category}|${item.subCategory}` : item.category);
                                            onClose();
                                        }}
                                        className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded hover:bg-slate-700 transition-colors uppercase tracking-wide"
                                    >
                                        {item.category} {item.subCategory && ` / ${item.subCategory}`}
                                    </button>
                                </div>
                            </div>

                            {/* Metrics Grid - Conditional Rendering */}
                            {showMetrics && (
                                <div className={`grid gap-3 ${hasHistory && hasETR ? 'grid-cols-2 md:grid-cols-1' : 'grid-cols-1'}`}>
                                    
                                    {/* Historical Usage Card */}
                                    {hasHistory && (
                                        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm h-full">
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">History</div>
                                            <div className="space-y-1">
                                                {usageList.map((u, i) => (
                                                    <div key={i} className="flex justify-between items-center text-sm font-bold text-slate-700 border-b border-gray-100 last:border-0 pb-1 last:pb-0">
                                                        <span>{u.year}</span>
                                                        <span>{u.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ETR Card */}
                                    {hasETR && (
                                        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex flex-col justify-center h-full">
                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Est. Remaining</div>
                                            <div className="text-2xl font-black text-slate-900">
                                                {item.etr.split(' ')[0]}
                                                <span className="text-xs font-bold text-gray-700 ml-1 align-middle">
                                                    {item.etr.includes('MONTH') ? 'MONTHS' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN (Stock Locations) */}
                        <div className="md:col-span-8">
                             {item.isLowStock && (
                                <div className="mb-4 bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-3 animate-pulse">
                                    <div className="p-1 bg-red-100 rounded-full text-red-600 shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-red-800 uppercase">Low Stock Alert</h4>
                                        <p className="text-xs text-red-600 font-medium">
                                            Current quantity ({item.totalQuantity}) is at or below the alert threshold ({item.lowAlertQuantity}).
                                        </p>
                                    </div>
                                </div>
                            )}

                            <h3 className={`text-sm font-black text-slate-500 uppercase tracking-widest mb-3 ${!showMetrics ? 'mt-4 md:mt-0' : ''}`}>
                                Stock Locations
                            </h3>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {item.locationsWithStock.length === 0 ? (
                                    <div className="col-span-full p-8 bg-white rounded-xl border border-dashed border-gray-300 text-center">
                                        <p className="text-gray-700 font-bold">NO STOCK RECORDED</p>
                                    </div>
                                ) : (
                                    item.locationsWithStock.map((locStock, index) => (
                                        <div 
                                            key={index} 
                                            className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full group border-l-4 hover:border-l-em-red"
                                            style={{ borderLeftColor: index % 2 === 0 ? undefined : 'transparent' }} // Alternating or just cleaner default
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="text-xl font-black text-slate-900 uppercase leading-none">{locStock.locationName}</div>
                                                    {locStock.subLocationDetail && (
                                                        <div className="text-xs font-bold text-black mt-1 uppercase bg-gray-100 inline-block px-1.5 py-0.5 rounded">
                                                            {locStock.subLocationDetail}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`text-2xl font-black ${item.isLowStock ? 'text-em-red' : 'text-slate-800'}`}>
                                                    {locStock.quantity}
                                                </div>
                                            </div>
                                            
                                            <div className="pt-3 border-t border-gray-50 flex justify-between items-end mt-2">
                                                <div className="text-sm font-black text-black uppercase">
                                                    SRC: {locStock.source}
                                                </div>
                                                <button 
                                                    onClick={() => onPrintSpecificLabel({ 
                                                        itemId: item.id, 
                                                        description: item.description, 
                                                        locationName: locStock.locationName, 
                                                        subLocationDetail: locStock.subLocationDetail 
                                                    })} 
                                                    className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-black hover:text-gray-900 px-2 py-1.5 rounded text-base font-black uppercase transition-colors"
                                                    title="Print Label"
                                                >
                                                    <BarcodeIcon className="w-6 h-6" /> 
                                                    <span>LABEL</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Spacer for bottom scrolling */}
                    <div className="h-8 md:h-0"></div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetailsModal;
