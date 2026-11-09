import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", isDanger = true }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${isDanger ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
              <AlertTriangle size={22} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h2 className="text-base sm:text-lg font-black text-gray-900 leading-snug">{title}</h2>
              <div className="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed whitespace-pre-line">{message}</div>
            </div>
            <button 
              type="button" 
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="p-3 sm:p-4 bg-gray-50/90 border-t border-gray-100 flex justify-end gap-2.5 shrink-0">
          <button 
            type="button"
            onClick={onCancel} 
            className="px-4 py-2 rounded-xl text-gray-700 font-bold hover:bg-gray-200 text-xs sm:text-sm transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button 
            type="button"
            onClick={onConfirm} 
            autoFocus
            className={`px-5 py-2 rounded-xl font-bold text-white text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer ${
              isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
