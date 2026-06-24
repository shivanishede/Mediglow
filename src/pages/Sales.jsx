import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
    Plus, Search, Filter, Printer, Trash2, Edit2, Download,
    ShoppingCart, FileText, RotateCcw, Truck, ClipboardList, CreditCard, ChevronDown, Loader, CheckCircle
} from 'lucide-react';
import useStore from '../store/useStore';
import TransactionForm from '../components/TransactionForm';
import { formatCurrency, formatDate, downloadBillPDF } from '../utils/billPdf';
import { transactionsService } from '../services/firestoreService';
import toast from 'react-hot-toast';

const TAB_CONFIG = [
    { key: 'sale', label: 'Sale Invoice', icon: ShoppingCart, color: '#7C6FFF' },
    { key: 'payment_in', label: 'Payment In', icon: CreditCard, color: '#2ECC71' },
    { key: 'sale_return', label: 'Sale Return', icon: RotateCcw, color: '#E74C3C' },
    { key: 'delivery_challan', label: 'Delivery Challan', icon: Truck, color: '#3498DB' },
    { key: 'estimate', label: 'Estimate/Quotation', icon: FileText, color: '#F39C12' },
    { key: 'sale_order', label: 'Sale Order', icon: ClipboardList, color: '#9B59B6' },
];

const TYPE_LABELS = {
    sale: 'Sale Invoice', payment_in: 'Payment In', sale_return: 'Sale Return',
    delivery_challan: 'Delivery Challan', estimate: 'Estimate', sale_order: 'Sale Order',
};

export default function Sales() {
    return (
        <Routes>
            <Route path="/" element={<SalesList />} />
            <Route path="*" element={<SalesList />} />
        </Routes>
    );
}

function SalesList() {
    const { profile } = useStore();
    const [activeTab, setActiveTab] = useState('sale');
    const [showForm, setShowForm] = useState(false);
    const [editData, setEditData] = useState(null);
    const [search, setSearch] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const data = await transactionsService.getAll(activeTab);
            // Map Firestore fields to our UI fields
            const mapped = data.map(t => ({
                ...t,
                invoiceNo: t.invoice_number || t.invoiceNo,
                customerName: t.customerName || t.party_name || t.fromParty || '—',
                total: t.total || t.total_amount || t.amount || 0,
                paid: t.paid || t.amount_paid || 0,
                balance: t.balance || t.balance_due || 0,
            }));
            setTransactions(mapped);
            setLoading(false);
        } catch (error) {
            console.error("Fetch Error:", error);
            toast.error('Failed to load transactions');
            setLoading(false);
        }
    };

    // Load data when tab changes
    useEffect(() => {
        fetchTransactions();
    }, [activeTab]);

    const getList = () => {
        return transactions.filter(t =>
            (t.customerName || t.notes || t.invoiceNo || '').toLowerCase().includes(search.toLowerCase())
        );
    };

    const handleSave = async (data) => {
        try {
            data.type = activeTab;
            if (editData?.id) {
                // UPDATE: merge form data on top of the original Firestore fields
                // This preserves invoice_number, created_at, type (uppercase), etc.
                const updateFields = {
                    customerName: data.customerName,
                    customerId: data.customerId,
                    date: data.date,
                    items: data.items,
                    subtotal: data.subtotal,
                    discount: data.discount,
                    tax: data.tax,
                    total: data.total,
                    paid: data.paid,
                    balance: data.balance,
                    notes: data.notes,
                    paymentMode: data.paymentMode,
                    status: data.status,
                };
                // Remove undefined keys so we don't wipe existing fields
                Object.keys(updateFields).forEach(k => updateFields[k] === undefined && delete updateFields[k]);
                await transactionsService.update(editData.id, updateFields);
                toast.success(`${TYPE_LABELS[activeTab]} updated successfully!`);
            } else {
                // ADD new transaction
                await transactionsService.add(data);
                toast.success(`${TYPE_LABELS[activeTab]} saved successfully!`);
            }
            setShowForm(false);
            setEditData(null);
            fetchTransactions();
        } catch (error) {
            console.error(error);
            toast.error('Failed to save transaction');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to permanently delete this transaction?')) return;
        try {
            console.log("Attempting to delete ID:", id);
            await transactionsService.delete(id);
            toast.success('Deleted successfully!');
            fetchTransactions(); // Refresh the list
        } catch (error) {
            console.error("Delete Error:", error);
            toast.error('Failed to delete transaction. check permissions.');
        }
    };

    const handleMarkPaid = async (txn) => {
        if (!confirm('Mark this invoice as fully paid?')) return;
        try {
            await transactionsService.update(txn.id, {
                paid: txn.total || 0,
                balance: 0,
                status: 'completed',
                payment_status: 'PAID',
            });
            toast.success('Invoice marked as paid!');
            fetchTransactions();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update payment status');
        }
    };

    const handleEdit = (txn) => {
        setEditData(txn);
        setShowForm(true);
    };

    const handlePrint = (txn) => {
        downloadBillPDF(txn, profile, TYPE_LABELS[txn.type || activeTab]);
        toast.success('Bill downloaded!');
    };

    const list = getList();
    const totalAmount = list.reduce((s, t) => s + (t.total || t.paid || t.transferAmount || t.amount || 0), 0);
    const totalBalance = list.reduce((s, t) => s + (t.balance || 0), 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sale Transactions</h1>
                    <p className="page-subtitle">Manage all your sale-related records</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditData(null); setShowForm(true); }}>
                    <Plus size={16} /> New {TYPE_LABELS[activeTab]}
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', overflowX: 'auto', paddingBottom: 4 }}>
                {TAB_CONFIG.map(tab => (
                    <button key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="btn"
                        style={{
                            background: activeTab === tab.key ? tab.color + '22' : 'var(--bg-card)',
                            color: activeTab === tab.key ? tab.color : 'var(--text-secondary)',
                            border: `1px solid ${activeTab === tab.key ? tab.color + '55' : 'var(--border)'}`,
                            fontWeight: activeTab === tab.key ? 700 : 500,
                            fontSize: 12,
                            padding: '8px 14px',
                        }}>
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Summary bar */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div className="card-sm" style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>NO. OF TXNS</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{list.length}</div>
                </div>
                <div className="card-sm" style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>TOTAL {activeTab === 'payment_in' ? 'RECEIVED' : 'SALE'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent2)' }}>{formatCurrency(totalAmount)}</div>
                </div>
                {activeTab === 'sale' && (
                    <div className="card-sm" style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>BALANCE DUE</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(totalBalance)}</div>
                    </div>
                )}
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <div className="search-bar">
                    <Search size={16} color="var(--text-muted)" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={`Search ${TYPE_LABELS[activeTab].toLowerCase()}s...`} />
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice No.</th>
                                <th>Party / Customer</th>
                                <th>Date</th>
                                {activeTab === 'expense' ? <th>Category</th> : <th>Type</th>}
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                {activeTab === 'sale' && <th style={{ textAlign: 'right' }}>Balance</th>}
                                {activeTab === 'sale' && <th>Status</th>}
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.length === 0 && (
                                <tr>
                                    <td colSpan={8}>
                                        <div className="empty-state">
                                            <ShoppingCart size={40} />
                                            <h3>No {TYPE_LABELS[activeTab]}s yet</h3>
                                            <p>Click "New {TYPE_LABELS[activeTab]}" to create your first entry</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {list.map(txn => (
                                <tr key={txn.id}>
                                    <td>
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>
                                            {txn.invoiceNo}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{txn.customerName || txn.fromParty || '—'}</div>
                                        {txn.items?.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{txn.items.length} item(s)</div>}
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(txn.date)}</td>
                                    <td>
                                        <span className="badge badge-sale">{TYPE_LABELS[txn.type] || TYPE_LABELS[activeTab]}</span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {formatCurrency(txn.total || txn.paid || txn.amount || 0)}
                                    </td>
                                    {activeTab === 'sale' && (
                                        <td style={{ textAlign: 'right', fontWeight: 600, color: (txn.balance || 0) > 0 ? 'var(--red)' : 'var(--green)' }}>
                                            {formatCurrency(txn.balance || 0)}
                                        </td>
                                    )}
                                    {activeTab === 'sale' && (
                                        <td>
                                            <span className={`badge ${txn.balance > 0 ? 'badge-yellow' : 'badge-green'}`}>
                                                {txn.balance > 0 ? 'Pending' : 'Paid'}
                                            </span>
                                        </td>
                                    )}
                                    <td>
                                        <div className="action-btns" style={{ justifyContent: 'center' }}>
                                            <button className="btn btn-ghost btn-icon btn-sm" title="Edit"
                                                style={{ color: 'var(--accent2)' }}
                                                onClick={() => handleEdit(txn)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn btn-ghost btn-icon btn-sm" title="Download Bill"
                                                onClick={() => handlePrint(txn)}>
                                                <Download size={14} />
                                            </button>
                                            {activeTab === 'sale' && (txn.balance || 0) > 0 && (
                                                <button className="btn btn-ghost btn-icon btn-sm" title="Mark as Paid"
                                                    style={{ color: 'var(--green)' }}
                                                    onClick={() => handleMarkPaid(txn)}>
                                                    <CheckCircle size={14} />
                                                </button>
                                            )}
                                            {activeTab === 'sale' && (
                                                <button className="btn btn-danger btn-icon btn-sm" title="Delete"
                                                    onClick={() => handleDelete(txn.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showForm && (
                <TransactionForm
                    type={activeTab}
                    title={TYPE_LABELS[activeTab]}
                    editData={editData}
                    onClose={() => { setShowForm(false); setEditData(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}