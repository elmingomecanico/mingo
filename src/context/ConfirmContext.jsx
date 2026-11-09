import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, AlertCircle, HelpCircle, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    isDanger: true,
    type: 'danger' // 'danger' | 'warning' | 'info'
  });

  const resolverRef = useRef(null);

  const confirm = useCallback(({
    title = '¿Estás seguro?',
    message = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDanger = true,
    type = isDanger ? 'danger' : 'warning'
  } = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        isDanger,
        type
      });
    });
  }, []);

  const handleConfirm = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {modalState.isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleCancel}
        >
          <div 
            className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header & Body */}
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                  modalState.isDanger 
                    ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                    : modalState.type === 'warning'
                    ? 'bg-amber-50 text-amber-600 border border-amber-100'
                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}>
                  {modalState.isDanger ? (
                    <AlertTriangle size={22} />
                  ) : modalState.type === 'warning' ? (
                    <AlertCircle size={22} />
                  ) : (
                    <HelpCircle size={22} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-base sm:text-lg font-black text-gray-900 leading-snug">
                    {modalState.title}
                  </h3>
                  <div className="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                    {modalState.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 sm:p-4 bg-gray-50/90 border-t border-gray-100 flex justify-end gap-2.5 shrink-0">
              <button 
                type="button"
                onClick={handleCancel} 
                className="px-4 py-2 rounded-xl text-gray-700 font-bold hover:bg-gray-200 text-xs sm:text-sm transition-colors cursor-pointer"
              >
                {modalState.cancelText}
              </button>
              <button 
                type="button"
                onClick={handleConfirm} 
                autoFocus
                className={`px-5 py-2 rounded-xl font-bold text-white text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer ${
                  modalState.isDanger 
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                }`}
              >
                {modalState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm debe ser utilizado dentro de un ConfirmProvider');
  }
  return context;
}
