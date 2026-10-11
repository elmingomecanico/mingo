import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, ChevronDown, User, Sparkles, Building, Wrench } from 'lucide-react';

export default function TokenizedSearchSelect({
  options = [],
  value = null, // Puede ser el id (string) o el objeto { value / id, label }
  onChange = () => {},
  placeholder = 'Escribe para buscar...',
  icon: IconComponent = Search,
  defaultOption = null, // e.g. { id: 'MOSTRADOR', label: 'CLIENTE DE MOSTRADOR' }
  emptyMessage = 'No se encontraron resultados',
  disabled = false,
  className = '',
  buttonRight = null // Botón extra a la derecha (ej. botón "+" para agregar nuevo)
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Normalizar valor seleccionado
  const selectedId = typeof value === 'object' && value !== null 
    ? (value.value || value.id) 
    : value;

  const selectedOption = options.find(opt => (opt.id || opt.value) === selectedId) || 
    (defaultOption && (defaultOption.id === selectedId || defaultOption.value === selectedId) ? defaultOption : null);

  // Cerrar al hacer click afuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Enfocar input al abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filtrado Tokenizado Inteligente
  const searchTokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

  const filteredOptions = options.filter(opt => {
    if (searchTokens.length === 0) return true;

    // Campos a concatenar para búsqueda profunda
    const fields = [
      opt.label || '',
      opt.name || '',
      opt.nombre || '',
      opt.sublabel || '',
      opt.telefono || '',
      opt.telefono1 || '',
      opt.cedula || '',
      opt.ruc || '',
      opt.direccion || '',
      opt.contacto || '',
      opt.codigo || '',
      ...(Array.isArray(opt.searchFields) ? opt.searchFields : [])
    ].map(f => String(f).toLowerCase());

    const fullSearchText = fields.join(' ');

    // Criterio tokenizado: CADA palabra escrita debe estar en algún lugar del texto del ítem
    return searchTokens.every(token => fullSearchText.includes(token));
  });

  // Ajustar highlightedIndex si se sale de rango
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % (filteredOptions.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % (filteredOptions.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 max-w-full ${className}`}>
      
      {/* CAJA PRINCIPAL VISIBLE */}
      {!isOpen ? (
        <div 
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
            }
          }}
          className={`w-full min-w-0 max-w-full min-h-[42px] px-3 py-1.5 border rounded-xl bg-white flex items-center justify-between gap-2 cursor-pointer transition-all shadow-sm overflow-hidden ${
            disabled 
              ? 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-400' 
              : 'hover:border-blue-400 border-gray-200 focus-within:ring-2 focus-within:ring-blue-500'
          }`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            <div className="text-blue-600 shrink-0">
              <IconComponent size={18} />
            </div>

            {selectedOption ? (
              <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                <span className="font-bold text-gray-800 text-sm truncate shrink min-w-0">
                  {selectedOption.label || selectedOption.nombre || selectedOption.name}
                </span>

                {selectedOption.badge && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                    selectedOption.badgeColor === 'amber'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : selectedOption.badgeColor === 'purple'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {selectedOption.badge}
                  </span>
                )}

                {/* Subetiquetas discretas con límite estricto de ancho */}
                {selectedOption.sublabel && (
                  <span className="text-[11px] text-gray-400 truncate hidden xl:inline max-w-[120px] shrink">
                    {selectedOption.sublabel}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-400 font-medium truncate">
                {placeholder}
              </span>
            )}
          </div>

          <div className="flex items-center shrink-0 text-gray-400">
            <ChevronDown size={16} className="text-gray-400 transition-transform" />
          </div>
        </div>
      ) : (
        /* CAJA ACTIVA DE BÚSQUEDA DIRECTA */
        <div className="w-full min-w-0 max-w-full min-h-[42px] px-3 py-1.5 border-2 border-blue-500 rounded-xl bg-white flex items-center gap-2 shadow-lg ring-2 ring-blue-100 transition-all overflow-hidden">
          <div className="text-blue-600 shrink-0">
            <Search size={18} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent border-none outline-none text-sm font-semibold text-gray-800 placeholder:text-gray-400"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 font-bold px-1"
            >
              Cerrar
            </button>
          )}
        </div>
      )}

      {/* DROPDOWN FLOTANTE CON RESULTADOS */}
      {isOpen && (
        <div 
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-72 animate-in fade-in slide-in-from-top-2"
        >
          {/* Cabecera informativa de tokens */}
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-semibold">
            <span>
              {filteredOptions.length} resultado{filteredOptions.length === 1 ? '' : 's'} 
              {query.trim() && <span className="text-blue-600"> para "{query}"</span>}
            </span>
            <span className="text-[10px] text-gray-400">Usa ↑ ↓ Enter para navegar</span>
          </div>

          <div className="overflow-y-auto divide-y divide-gray-50 flex-1">
            {filteredOptions.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400 space-y-1">
                <Search size={24} className="mx-auto text-gray-300 mb-1" />
                <p className="font-semibold text-gray-600">{emptyMessage}</p>
                <p className="text-xs text-gray-400">Intenta buscar con otras palabras o por teléfono/cédula.</p>
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const optId = opt.id || opt.value;
                const isSelected = optId === selectedId;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={optId || index}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`p-3 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                      isHighlighted 
                        ? 'bg-blue-50/70 text-blue-900' 
                        : isSelected 
                        ? 'bg-blue-50/30' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold truncate ${isSelected ? 'text-blue-700 font-black' : 'text-gray-800'}`}>
                          {opt.label || opt.nombre || opt.name}
                        </span>

                        {opt.badge && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                            opt.badgeColor === 'amber'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : opt.badgeColor === 'purple'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {opt.badge}
                          </span>
                        )}
                      </div>

                      {opt.sublabel && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {opt.sublabel}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}
