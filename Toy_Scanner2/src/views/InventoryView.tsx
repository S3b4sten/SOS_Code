import React, { useState } from 'react';
import { Package, Trash2 } from 'lucide-react';
import { listItems, updateQuantity, removeItem, type InventoryItem } from '../store/inventoryStore';

interface InventoryViewProps {
  onMutate: () => void;
}

const MS_14 = 14 * 86_400_000;
const MS_30 = 30 * 86_400_000;

function rotationBadge(lastMovementAt: number): { label: string; color: string } {
  const age = Date.now() - lastMovementAt;
  if (age < MS_14) return { label: 'Actif',   color: 'bg-emerald-100 text-emerald-700' };
  if (age < MS_30) return { label: 'Lent',    color: 'bg-amber-100 text-amber-700' };
  return              { label: 'Dormant', color: 'bg-red-100 text-red-700' };
}

export default function InventoryView({ onMutate }: InventoryViewProps) {
  const [items, setItems] = useState<InventoryItem[]>(() =>
    [...listItems()].sort((a, b) => b.addedAt - a.addedAt)
  );
  const [activeCategory, setActiveCategory] = useState<string>('Toutes');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const categories = ['Toutes', ...Array.from(new Set(items.map(i => i.category))).sort()];
  const filtered = activeCategory === 'Toutes'
    ? items
    : items.filter(i => i.category === activeCategory);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  function handleQuantityChange(id: string, delta: number) {
    updateQuantity(id, delta);
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, quantity: Math.max(0, item.quantity + delta), lastMovementAt: Date.now() }
          : item
      )
    );
    onMutate();
  }

  function handleDeleteRequest(id: string) {
    setConfirmDeleteId(id);
  }

  function handleDeleteConfirm(id: string) {
    removeItem(id);
    setItems(prev => prev.filter(item => item.id !== id));
    setConfirmDeleteId(null);
    onMutate();
  }

  function handleDeleteCancel() {
    setConfirmDeleteId(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
      {/* Stats */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">Articles en stock</p>
          <p className="text-2xl font-bold text-slate-900">{totalItems}</p>
        </div>
      </div>

      {/* Category chips */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Package size={48} className="text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">
            {items.length === 0 ? 'Aucun item en stock' : 'Aucun article dans cette catégorie'}
          </h3>
          <p className="text-sm text-slate-500">
            {items.length === 0
              ? 'Aucun item en stock — scannez votre premier article'
              : `Aucun article dans la catégorie « ${activeCategory} ».`}
          </p>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-3">
        {filtered.map(item => {
          const rotation = rotationBadge(item.lastMovementAt);
          const isConfirming = confirmDeleteId === item.id;
          const isOtherConfirming = confirmDeleteId !== null && confirmDeleteId !== item.id;

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4"
            >
              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900 truncate">{item.name}</h3>
                  {item.quantity === 0 && (
                    <span className="shrink-0 text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                      Épuisé
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-slate-500">{item.category}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rotation.color}`}>
                    {rotation.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
              </div>

              {/* Quantity controls */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleQuantityChange(item.id, -1)}
                  disabled={item.quantity === 0}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Retirer un"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-slate-900">{item.quantity}</span>
                <button
                  onClick={() => handleQuantityChange(item.id, +1)}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                  aria-label="Ajouter un"
                >
                  +
                </button>
              </div>

              {/* Delete / confirm */}
              <div className="shrink-0">
                {!isConfirming ? (
                  <button
                    onClick={() => handleDeleteRequest(item.id)}
                    disabled={isOtherConfirming}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium whitespace-nowrap">Supprimer ?</span>
                    <button
                      onClick={() => handleDeleteConfirm(item.id)}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Oui
                    </button>
                    <button
                      onClick={handleDeleteCancel}
                      className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Non
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
