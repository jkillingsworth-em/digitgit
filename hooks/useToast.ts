import { useCallback, useState } from 'react';

export type ToastType = 'success' | 'error';
export interface ToastState {
  message: string;
  type: ToastType;
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((message: string, type: ToastType) => setToast({ message, type }), []);
  const clearToast = useCallback(() => setToast(null), []);
  return { toast, showToast, clearToast };
};
