const STORAGE_KEY = "sos_inventory"

// ── Types ────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  name: string
  category: string
  description: string
  quantity: number
  addedAt: number
  lastMovementAt: number
  imageThumb?: string
}

// ── Helpers privés ───────────────────────────────────────────────────────────

function load(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as InventoryItem[]) : []
  } catch {
    return []
  }
}

function save(items: InventoryItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

// ── API publique ─────────────────────────────────────────────────────────────

export function addItem(
  item: Omit<InventoryItem, "id" | "addedAt" | "lastMovementAt">
): InventoryItem {
  const now = Date.now()
  const newItem: InventoryItem = {
    ...item,
    id: crypto.randomUUID(),
    addedAt: now,
    lastMovementAt: now,
  }
  save([...load(), newItem])
  return newItem
}

export function updateQuantity(id: string, delta: number): void {
  const now = Date.now()
  save(
    load().map(item =>
      item.id === id
        ? { ...item, quantity: Math.max(0, item.quantity + delta), lastMovementAt: now }
        : item
    )
  )
}

export function removeItem(id: string): void {
  save(load().filter(item => item.id !== id))
}

export function listItems(): InventoryItem[] {
  return load()
}

export function getStats(): {
  totalItems: number
  lowStock: InventoryItem[]
  dormant: InventoryItem[]
} {
  const items = load()
  const dormantThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000
  return {
    totalItems: items.reduce((acc, i) => acc + i.quantity, 0),
    lowStock: items.filter(i => i.quantity <= 2),
    dormant: items.filter(i => i.lastMovementAt < dormantThreshold),
  }
}
