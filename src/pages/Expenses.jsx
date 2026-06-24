import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, Wallet, TrendingDown } from 'lucide-react';
import useStore from '../store/useStore';
import TransactionForm from '../components/TransactionForm';
import { formatCurrency, formatDate } from '../utils/billPdf';
import { transactionsService } from '../services/firestoreService';
import toast from 'react-hot-toast';

const CATEGORY_COLORS = {
    Rent: '#E74C3C', Salary: '#3498DB', Electricity: '#F39C12', Transport: '#2ECC71',
    Maintenance: '#9B59B6', Marketing: '#1ABC9C', Miscellaneous: '#95A5A6',
    Stationery: '#E67E22', Telephone: '#16A085', Insurance: '#2980B9',
};

export default function Expenses() {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editData, setEditData] = useState(null);
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState('All');

    const CATS = ['All', 'Rent', 'Salary', 'Electricity', 'Transport', 'Maintenance', 'Marketing', 'Miscellaneous', 'Stationery', 'Telephone', 'Insurance'];

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const data = await transactionsService.getAll('expense');
            // Form uses amount and category instead of total and notes logic slightly differently
            const mapped = data.map(t => ({
                id: t.id,
                invoiceNo: t.invoiceNo || t.invoice_number,
                category: t.notes?.split('|')[0] || t.type || 'Miscellaneous',
                notes: t.notes?.split('|')[1] || t.notes || '',
                date: t.date,
                paymentMode: t.paymentMode || t.payment_mode || 'Cash',
                amount: t.total ?? t.amount ?? t.total_amount ?? 0,
                paid: t.paid ?? t.amount_paid ?? 0
            }));
            setExpenses(mapped);
            setLoading(false);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load expenses');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, []);

    const filtered = expenses.filter(e => {
        const matchSearch = (e.category + (e.notes || '') + (e.invoiceNo || '')).toLowerCase().includes(search.toLowerCase());
        const matchCat = filterCat === 'All' || e.category === filterCat;
        return matchSearch && matchCat;
    });

    const total = filtered.reduce((s, e) => s + (e.amount || 0), 0);

    // Category breakdown
    const catBreakdown = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
        return acc;
    }, {});

    const handleSave = async (data) => {
        try {
            // Expenses maps to transactions with 'expense' type
            const payload = {
                type: 'expense',
                date: data.date,
                total: data.amount,
                paid: data.amount,
                paymentMode: data.paymentMode,
                // store category inside notes in DB if no category column exists
                notes: `${data.category}|${data.notes}` 
            };

            if (editData) {
                // Delete and recreate for transactional safety or update if possible
                await transactionsService.delete(editData.id);
                await transactionsService.add(payload);
                toast.success('Expense updated!');
            } else {
                await transactionsService.add(payload);
                toast.success('Expense added!');
            }
            setShowForm(false);
            setEditData(null);
            fetchExpenses();
        } catch (err) {
            toast.error('Failed to save expense');
        }
    };

    const handleEdit = (exp) => {
        setEditData(exp);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this expense?')) return;
        try {
            await transactionsService.delete(id);
            toast.success('Deleted from database!');
            fetchExpenses();
        } catch (error) {
            toast.error('Failed to delete expense');
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Expenses</h1>
                    <p className="page-subtitle">Track all your business expenses</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditData(null); setShowForm(true); }}>
                    <Plus size={16} /> Add Expense
                </button>
            </div>

            {/* Summary cards */}
            <div className="grid-3" style={{ marginBottom: 20, gap: 16 }}>
                <div className="stat-card" style={{ borderColor: 'rgba(231,76,60,0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 36, height: 36, background: 'rgba(231,76,60,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Wallet size={18} color="var(--red)" />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL EXPENSES</span>
                    </div>
                    <div className="stat-value" style={{ color: 'var(--red)' }}>{formatCurrency(expenses.reduce((s, e) => s + (e.amount || 0), 0))}</div>
                    <div className="stat-label">{expenses.length} records total</div>
                </div>

                <div className="stat-card">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>THIS MONTH</div>
                    <div className="stat-value">{formatCurrency(
                        expenses.filter(e => { const d = new Date(e.date); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, e) => s + (e.amount || 0), 0)
                    )}</div>
                    <div className="stat-label">Current month spending</div>
                </div>

                <div className="stat-card">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>TOP CATEGORY</div>
                    {Object.keys(catBreakdown).length > 0 ? (
                        <>
                            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                                {Object.entries(catBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0]}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                {formatCurrency(Object.entries(catBreakdown).sort((a, b) => b[1] - a[1])[0]?.[1])}
                            </div>
                        </>
                    ) : (
                        <div className="stat-label">No data yet</div>
                    )}
                </div>
            </div>

            {/* Category breakdown mini chart */}
            {Object.keys(catBreakdown).length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Expense Breakdown by Category</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                            const pct = (amt / expenses.reduce((s, e) => s + (e.amount || 0), 0)) * 100;
                            const color = CATEGORY_COLORS[cat] || '#7C6FFF';
                            return (
                                <div key={cat}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{cat}</span>
                                        <span style={{ color, fontWeight: 600 }}>{formatCurrency(amt)} ({pct.toFixed(1)}%)</span>
                                    </div>
                                    <div style={{ height: 6, background: 'var(--bg-card3)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
                    <Search size={16} color="var(--text-muted)" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." />
                </div>
                <select className="form-control" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 180 }}>
                    {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Ref No.</th>
                                <th>Category</th>
                                <th>Notes</th>
                                <th>Date</th>
                                <th>Payment Mode</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="empty-state">
                                            <Wallet size={40} />
                                            <h3>No expenses found</h3>
                                            <p>Add your first expense to start tracking</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {filtered.map(exp => (
                                <tr key={exp.id}>
                                    <td>
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{exp.invoiceNo}</span>
                                    </td>
                                    <td>
                                        <span className="badge" style={{ background: (CATEGORY_COLORS[exp.category] || '#7C6FFF') + '22', color: CATEGORY_COLORS[exp.category] || '#7C6FFF' }}>
                                            {exp.category}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{exp.notes || '—'}</td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(exp.date)}</td>
                                    <td>
                                        <span className="badge badge-gray">{exp.paymentMode}</span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>
                                        {formatCurrency(exp.amount)}
                                    </td>
                                    <td>
                                        <div className="action-btns" style={{ justifyContent: 'center' }}>
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEdit(exp)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(exp.id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {filtered.length > 0 && (
                            <tfoot>
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 12, padding: '12px 16px' }}>TOTAL</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)', fontSize: 15, padding: '12px 16px' }}>{formatCurrency(total)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {showForm && (
                <TransactionForm
                    type="expense"
                    title="Expense"
                    editData={editData}
                    onClose={() => { setShowForm(false); setEditData(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}