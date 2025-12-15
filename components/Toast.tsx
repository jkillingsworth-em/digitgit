import React, { useEffect } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckIcon } from './icons/CheckIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

interface ToastProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const bgColor = type === 'success' ? 'bg-green-50' : 'bg-red-50';
    const borderColor = type === 'success' ? 'border-green-200' : 'border-red-200';
    const textColor = type === 'success' ? 'text-green-800' : 'text-red-800';
    const iconColor = type === 'success' ? 'text-green-500' : 'text-red-500';

    return (
        <div className={`fixed top-4 right-4 z-[70] flex items-start p-4 rounded-lg border shadow-lg animate-fade-in-down ${bgColor} ${borderColor} max-w-sm transition-all duration-300`}>
             <div className={`shrink-0 mr-3 ${iconColor}`}>
                {type === 'success' ? <CheckIcon className="w-5 h-5" /> : <ExclamationTriangleIcon className="w-5 h-5" />}
            </div>
            <div className={`text-sm font-bold ${textColor} mr-8 pt-0.5`}>
                {message}
            </div>
            <button onClick={onClose} className={`absolute top-4 right-4 ${textColor} hover:opacity-70`}>
                <XMarkIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

export default Toast;