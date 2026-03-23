import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingBag,
  Settings,
  Bell,
  Search,
  Banknote,
  ClipboardList,
  BarChart3,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  LogOut,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  Loader2,
  Trash2,
  AlertTriangle,
  LayoutGrid,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabase';

// --- Types matching Supabase schema ---
interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  add_ons: string | null;
  quantity: number;
  unit_price: number;
  item_total: number;
  created_at: string;
  isDone?: boolean;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  notes: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'completed';
  created_at: string;
  order_items?: OrderItem[];
}

// Status options
const STATUS_OPTIONS: Array<Order['status']> = ['pending', 'processing', 'completed'];

// --- Utility ---
function formatCurrency(val: number) {
  return `₹${val.toFixed(2)}`;
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ─────────────────────────────────────────────
//  App
// ─────────────────────────────────────────────
const App: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [isLive, setIsLive]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [doneItems, setDoneItems]           = useState<Record<string, boolean>>({});
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearingAll, setClearingAll]       = useState(false);
  const [currentView, setCurrentView]       = useState<'orders' | 'menu'>('orders');
  const [products, setProducts]             = useState<any[]>([]);

  // ── Fetch full orders (with items) ──────────
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setOrders(data as Order[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load orders';
      setError(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // ── Menu Management ──────────────────────────
  const fetchProducts = useCallback(async () => {
    try {
      const { data, error: err } = await supabase.from('products').select('*').order('category', { ascending: true }).order('id', { ascending: true });
      if (err) throw err;
      setProducts(data || []);
    } catch (e: any) {
      console.error('Failed to fetch products', e);
    }
  }, []);

  const toggleProductAvailability = async (productId: string, currentAvail: boolean) => {
    const newStatus = !currentAvail;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_available: newStatus } : p));
    try {
      const { error: err } = await supabase.from('products').update({ is_available: newStatus }).eq('id', productId);
      if (err) throw err;
    } catch (e: any) {
      alert(`Failed to update product availability: ${e.message}`);
      fetchProducts();
    }
  };

  // ── Real-time subscription ───────────────────
  useEffect(() => {
    fetchOrders();
    fetchProducts();

    const channel = supabase
      .channel('db-orders-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        fetchOrders(true);
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, fetchProducts]);

  // ── Update order status ──────────────────────
  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    // 1. Optimistic local update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    
    setUpdatingStatus(prev => ({ ...prev, [orderId]: true }));
    try {
      const { error: err } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (err) throw err;
    } catch (e: any) {
      alert(`Failed to update status: ${e.message}`);
      // 2. Rollback/Refetch on error
      fetchOrders();
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // ── Derived stats ────────────────────────────
  const stats = useMemo(() => {
    const total = orders.reduce((s, o) => s + Number(o.total_amount), 0);
    const avg   = orders.length > 0 ? total / orders.length : 0;
    return {
      revenue: total,
      count: orders.length,
      avg,
      pending:    orders.filter(o => o.status === 'pending').length,
      processing: orders.filter(o => o.status === 'processing').length,
      completed:  orders.filter(o => o.status === 'completed').length,
    };
  }, [orders]);

  // ── Filtered orders ──────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch =
        o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.phone.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const toggleExpand = (id: string) =>
    setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleItemDone = (itemId: string) =>
    setDoneItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));

  // ── Export to CSV ────────────────────────────
  const exportToCSV = () => {
    const rows: string[][] = [
      // Header row — human-friendly column names
      [
        'Order Number',
        'Customer Name',
        'Phone',
        'Order Date',
        'Product Name',
        'Add-Ons',
        'Qty',
        'Unit Price (₹)',
        'Item Total (₹)',
        'Subtotal (₹)',
        'Tax (₹)',
        'Discount (₹)',
        'Order Total (₹)',
        'Status',
        'Notes',
      ],
    ];

    orders.forEach(order => {
      const items = order.order_items ?? [];
      if (items.length === 0) {
        // Include order even if no items recorded
        rows.push([
          order.order_number,
          order.customer_name,
          order.phone,
          formatTime(order.created_at),
          '',
          '',
          '',
          '',
          '',
          String(Number(order.subtotal).toFixed(2)),
          String(Number(order.tax).toFixed(2)),
          String(Number(order.discount).toFixed(2)),
          String(Number(order.total_amount).toFixed(2)),
          order.status.charAt(0).toUpperCase() + order.status.slice(1),
          order.notes ?? '',
        ]);
      } else {
        items.forEach((item, idx) => {
          rows.push([
            order.order_number,
            order.customer_name,
            order.phone,
            formatTime(order.created_at),
            item.product_name,
            item.add_ons ?? '',
            String(item.quantity),
            String(Number(item.unit_price).toFixed(2)),
            String(Number(item.item_total).toFixed(2)),
            // Only show order-level totals on the first item row to avoid confusion
            idx === 0 ? String(Number(order.subtotal).toFixed(2)) : '',
            idx === 0 ? String(Number(order.tax).toFixed(2)) : '',
            idx === 0 ? String(Number(order.discount).toFixed(2)) : '',
            idx === 0 ? String(Number(order.total_amount).toFixed(2)) : '',
            idx === 0 ? (order.status.charAt(0).toUpperCase() + order.status.slice(1)) : '',
            idx === 0 ? (order.notes ?? '') : '',
          ]);
        });
      }
    });

    // Convert to CSV string with proper quoting
    const csvContent = rows
      .map(row =>
        row.map(cell => {
          const safe = String(cell).replace(/"/g, '""');
          return safe.includes(',') || safe.includes('\n') || safe.includes('"')
            ? `"${safe}"`
            : safe;
        }).join(',')
      )
      .join('\n');

    // BOM prefix ensures Excel opens UTF-8 characters (₹ symbol) correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `kiosk-orders-${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Clear all orders ───────────────────────────
  const clearAllOrders = async () => {
    setClearingAll(true);
    try {
      // Must delete order_items first due to foreign key constraint
      const { error: itemsErr } = await supabase
        .from('order_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // deletes all rows

      if (itemsErr) throw itemsErr;

      const { error: ordersErr } = await supabase
        .from('orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // deletes all rows

      if (ordersErr) throw ordersErr;

      // Clear local state
      setOrders([]);
      setExpandedOrders({});
      setDoneItems({});
      setShowClearModal(false);
    } catch (e: any) {
      alert(`Failed to clear orders: ${e.message}`);
    } finally {
      setClearingAll(false);
    }
  };

  // ── Render ───────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)' }}>

      {/* ── Clear All Confirmation Modal ── */}
      {showClearModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: '16px',
            padding: '32px', maxWidth: '460px', width: '90%',
            border: '1px solid rgba(255,69,58,0.4)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}>
            {/* Warning icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{
                background: 'rgba(255,69,58,0.15)', borderRadius: '50%',
                width: '64px', height: '64px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={32} color="#ff453a" />
              </div>
            </div>

            <h3 style={{ textAlign: 'center', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
              Clear All Orders?
            </h3>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              This will permanently delete <strong style={{ color: 'var(--text-primary)' }}>all orders and order items</strong> from Supabase.
              This action <strong style={{ color: '#ff453a' }}>cannot be undone</strong>.
            </p>

            {/* Export reminder */}
            <div style={{
              background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.4)',
              borderRadius: '10px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: '12px',
              marginBottom: '24px',
            }}>
              <Download size={18} color="#ff9500" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#ff9500', marginBottom: '2px' }}>Export your data first!</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Download a backup before clearing the database.</p>
              </div>
              <button
                onClick={() => { exportToCSV(); }}
                style={{
                  marginLeft: 'auto', background: '#ff9500', color: '#000',
                  border: 'none', borderRadius: '8px', padding: '8px 14px',
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}
              >
                Export CSV
              </button>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowClearModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={clearAllOrders}
                disabled={clearingAll}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  background: '#ff453a', border: 'none',
                  color: '#fff', fontSize: '14px', fontWeight: 700, cursor: clearingAll ? 'not-allowed' : 'pointer',
                  opacity: clearingAll ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {clearingAll
                  ? <><Loader2 size={14} className="spin" /> Clearing…</>
                  : <><Trash2 size={14} /> Clear All Orders</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Sidebar ── */}
      <aside style={{
        width: '240px', flexShrink: 0, background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', padding: '24px 0',
      }}>
        <div style={{ padding: '0 24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              KIOSK ORDER SYSTEM
            </span>
          </div>
        </div>

        <div style={{ padding: '0 24px', marginBottom: '12px' }}>
          <p style={{ fontSize: '16px', fontWeight: 700 }}>Order Management</p>
          <p className="text-label" style={{ marginTop: '2px', fontSize: '10px' }}>MANAGEMENT SUITE</p>
        </div>

        <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { id: 'orders', icon: ShoppingBag, label: 'Orders' },
            { id: 'menu', icon: LayoutGrid, label: 'Menu' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map((item) => {
            const isActive = currentView === item.id || (item.id === 'orders' && currentView === 'orders');
            return (
            <button
              key={item.id}
              onClick={() => { if(item.id === 'orders' || item.id === 'menu') setCurrentView(item.id as any); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: 'none',
                padding: '11px 16px', borderRadius: 'var(--radius-md)', width: '100%',
                background: isActive ? 'var(--bg-secondary)' : 'transparent', textAlign: 'left',
                color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}>
              <item.icon size={18} />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.label}</span>
            </button>
            );
          })}
        </nav>

        {/* Live indicator */}
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLive
            ? <><Wifi size={14} color="var(--status-completed)" /><span style={{ fontSize: '12px', color: 'var(--status-completed)' }}>Live</span></>
            : <><WifiOff size={14} color="var(--text-muted)" /><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Connecting…</span></>}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="btn-primary" style={{ width: '100%' }} onClick={() => { fetchOrders(); fetchProducts(); }}>
            <RefreshCw size={14} style={{ marginRight: 6 }} />Refresh
          </button>
          <button className="btn-ghost" style={{ justifyContent: 'flex-start', gap: '12px', color: '#ff453a' }}>
            <LogOut size={18} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top nav */}
        <header style={{
          height: '64px', padding: '0 32px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Dashboard', 'Help'].map((t, i) => (
              <span key={i} style={{
                fontWeight: 600, fontSize: '14px', paddingBottom: '4px',
                color: i === 0 ? 'var(--accent-blue)' : 'var(--text-secondary)',
                borderBottom: i === 0 ? '2px solid var(--accent-blue)' : 'none',
              }}>{t}</span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search orders, customers…"
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  padding: '9px 18px 9px 38px', borderRadius: '99px', color: 'white',
                  width: '320px', outline: 'none', fontSize: '13px',
                }}
              />
            </div>
            <Bell size={20} color="var(--text-secondary)" style={{ cursor: 'pointer' }} />
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--accent-blue)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: '#fff',
            }}>A</div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>

          {currentView === 'menu' && (
            <div className="menu-management">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Menu Management</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Toggle item availability on the Kiosk</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {products.map(product => (
                  <div key={product.id} className="ops-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', opacity: product.is_available ? 1 : 0.6 }}>
                    <img src={'http://127.0.0.1:8080/' + product.image} alt={product.name} style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }} onError={(e) => { e.currentTarget.src = `https://placehold.co/100x100?text=${encodeURIComponent(product.name)}`; }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0' }}>{product.name}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>{product.category}</p>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                         <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent-blue)' }}>{formatCurrency(Number(product.price))}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                       <span style={{ fontSize: '11px', fontWeight: 800, color: product.is_available ? 'var(--status-completed)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                         {product.is_available ? 'AVAILABLE' : 'SOLD OUT'}
                       </span>
                       <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                          <input type="checkbox" checked={product.is_available} onChange={() => toggleProductAvailability(product.id, product.is_available)} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span className="slider" style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: product.is_available ? '#34c759' : '#e2e8f0', transition: '.4s', borderRadius: '24px' }}>
                             <span style={{ position: 'absolute', content: '""', height: '18px', width: '18px', left: product.is_available ? '22px' : '3px', bottom: '3px', background: 'white', transition: '.4s', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}></span>
                          </span>
                       </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentView === 'orders' && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
            <div className="ops-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Revenue</p>
                <div style={{ background: 'rgba(27,104,255,.12)', padding: '8px', borderRadius: '8px' }}>
                  <Banknote size={18} color="var(--accent-blue)" />
                </div>
              </div>
              <p style={{ fontSize: '28px', fontWeight: 800 }}>{formatCurrency(stats.revenue)}</p>
              <p style={{ fontSize: '12px', color: 'var(--status-completed)', fontWeight: 600 }}>
                {stats.completed} orders completed
              </p>
            </div>
            <div className="ops-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Orders</p>
                <div style={{ background: 'rgba(52,199,89,.12)', padding: '8px', borderRadius: '8px' }}>
                  <ClipboardList size={18} color="var(--status-completed)" />
                </div>
              </div>
              <p style={{ fontSize: '28px', fontWeight: 800 }}>{stats.count}</p>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
                <span style={{ color: 'var(--status-pending)' }}>{stats.pending} pending</span>
                <span style={{ color: 'var(--status-processing)' }}>{stats.processing} processing</span>
              </div>
            </div>
            <div className="ops-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Avg Order Value</p>
                <div style={{ background: 'rgba(255,255,255,.05)', padding: '8px', borderRadius: '8px' }}>
                  <BarChart3 size={18} color="var(--text-muted)" />
                </div>
              </div>
              <p style={{ fontSize: '28px', fontWeight: 800 }}>{formatCurrency(stats.avg)}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>— Across all orders</p>
            </div>
          </div>

          {/* Orders header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Recent Orders</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Live updates from Supabase</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Clear All button */}
              <button
                onClick={() => setShowClearModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.4)',
                  color: '#ff453a', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Trash2 size={14} /> Clear All Orders
              </button>
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                  fontSize: '13px', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
              </select>
              <button className="btn-outline"><Filter size={14} /> Filter</button>
              <button className="btn-outline" onClick={exportToCSV}><Download size={14} /> Export</button>
            </div>
          </div>

          {/* Loading / error states */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', gap: '12px', color: 'var(--text-muted)' }}>
              <Loader2 size={22} className="spin" /> Loading orders…
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ff453a', padding: '20px', background: 'rgba(255,69,58,.1)', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <div className="table-container">
              {/* Header */}
              <div className="table-header" style={{ gridTemplateColumns: '3fr 2fr 1.5fr 1fr 1.5fr 48px' }}>
                <div className="text-label" style={{ paddingLeft: '24px' }}>ORDER / ITEMS</div>
                <div className="text-label">CUSTOMER</div>
                <div className="text-label">PHONE</div>
                <div className="text-label">QTY</div>
                <div className="text-label">TOTAL &amp; STATUS</div>
                <div></div>
              </div>

              {filteredOrders.length === 0 && (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No orders found.
                </div>
              )}

              {filteredOrders.map(order => {
                const items   = order.order_items ?? [];
                const totalQ  = items.reduce((s, i) => s + i.quantity, 0);
                const isExpanded = expandedOrders[order.id];
                const isUpdating = updatingStatus[order.id];

                return (
                  <div key={order.id} className="order-row">
                    {/* Order header row */}
                    <div className="order-row-header" style={{ gridTemplateColumns: '3fr 2fr 1.5fr 1fr 1.5fr 48px' }} onClick={() => toggleExpand(order.id)}>

                      {/* Order number + time */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '24px' }}>
                        <div style={{
                          background: 'var(--bg-primary)', borderRadius: 6, padding: '4px 8px',
                          fontSize: '12px', fontWeight: 700, color: 'var(--accent-blue)',
                          border: '1px solid rgba(27,104,255,.3)',
                        }}>
                          {order.order_number}
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '14px' }}>
                            {items.length} item{items.length !== 1 ? 's' : ''}
                          </p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {formatTime(order.created_at)}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                      </div>

                      <div style={{ fontWeight: 500, fontSize: '14px' }}>{order.customer_name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{order.phone}</div>
                      <div style={{ fontWeight: 600 }}>{totalQ}</div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontWeight: 700 }}>{formatCurrency(Number(order.total_amount))}</div>
                        {/* Status dropdown */}
                        <div onClick={e => e.stopPropagation()}>
                          {isUpdating ? (
                            <Loader2 size={16} className="spin" color="var(--text-muted)" />
                          ) : (
                            <select
                              value={order.status}
                              onChange={e => updateOrderStatus(order.id, e.target.value as Order['status'])}
                              className={`badge-status status-${order.status}`}
                              style={{
                                border: '1px solid var(--border-color)', outline: 'none',
                                cursor: 'pointer', fontWeight: 600, fontSize: '12px',
                                background: 'var(--bg-secondary)', textTransform: 'capitalize',
                                padding: '4px 24px 4px 8px', borderRadius: '4px',
                              }}
                            >
                              {STATUS_OPTIONS.map(s => (
                                <option key={s} value={s} style={{ background: '#1a1b20', color: '#fff' }}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      <div></div>
                    </div>

                    {/* Expanded product list */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                        >
                          {items.map(item => {
                            const addOns = item.add_ons
                              ? item.add_ons.split(',').map(s => s.trim()).filter(Boolean)
                              : [];
                            const itemKey = item.id;
                            const done = doneItems[itemKey] ?? false;

                            return (
                              <div key={itemKey} className="product-row" style={{ gridTemplateColumns: '3fr 2fr 1.5fr 1fr 1.5fr 48px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingLeft: '24px' }}>
                                  {/* Icon placeholder */}
                                  <div style={{
                                    width: 44, height: 44, borderRadius: 8,
                                    background: 'var(--bg-hover)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    fontSize: '18px',
                                  }}>
                                    🍽️
                                  </div>
                                  <div>
                                    <p style={{
                                      fontWeight: 600, fontSize: '14px',
                                      textDecoration: done ? 'line-through' : 'none',
                                      color: done ? 'var(--text-muted)' : 'var(--text-primary)',
                                    }}>
                                      {item.product_name}
                                    </p>
                                    {addOns.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '5px' }}>
                                        {addOns.map((a, ai) => (
                                          <span key={ai} className="badge">{a}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div></div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>×{item.quantity}</div>
                                <div>
                                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                    {formatCurrency(Number(item.unit_price))}
                                  </p>
                                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    = {formatCurrency(Number(item.item_total))}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                  <span className="text-label" style={{ fontSize: '10px' }}>DONE</span>
                                  <input
                                    type="checkbox"
                                    className="custom-checkbox"
                                    checked={done}
                                    onChange={() => toggleItemDone(itemKey)}
                                  />
                                </div>
                              </div>
                            );
                          })}

                          {/* Order subtotal footer */}
                          <div style={{
                            padding: '12px 24px 12px 64px', background: 'rgba(0,0,0,.3)',
                            borderTop: '1px solid var(--border-color)',
                            display: 'flex', gap: '24px', fontSize: '12px', color: 'var(--text-muted)',
                          }}>
                            <span>Subtotal: {formatCurrency(Number(order.subtotal))}</span>
                            <span>Tax: {formatCurrency(Number(order.tax))}</span>
                            {Number(order.discount) > 0 && <span style={{ color: 'var(--status-completed)' }}>Discount: -{formatCurrency(Number(order.discount))}</span>}
                            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                              Total: {formatCurrency(Number(order.total_amount))}
                            </span>
                            {order.notes && <span>Notes: {order.notes}</span>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Pagination footer */}
              <div style={{
                padding: '14px 24px', borderTop: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Showing {filteredOrders.length} of {orders.length} orders
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-outline" style={{ opacity: .5 }}>Previous</button>
                  <button className="btn-outline">Next</button>
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
