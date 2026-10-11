import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", isDanger = true }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in overflow-hidden">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh] scale-in-center">
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDanger ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-black text-gray-800 mb-2">{title}</h2>
          <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
        </div>
        
        <div className="p-3 sm:p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100 shrink-0">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm} 
            className={`px-5 py-2 rounded-xl font-bold text-white shadow-md transition-all active:scale-95 ${
              isDanger ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-200'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
