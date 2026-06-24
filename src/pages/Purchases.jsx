import React, { useState } from 'react';
import {
    Plus, Search, Download, Trash2, Package, CreditCard,
    RotateCcw, ClipboardList, CheckCircle, Edit2
} from 'lucide-react';
import useStore from '../store/useStore';
import TransactionForm from '../components/TransactionForm';
import { formatCurrency, formatDate, downloadBillPDF, generateBillPDFBlob } from '../utils/billPdf';
import { transactionsService } from '../services/firestoreService';
import toast from 'react-hot-toast';

const TAB_CONFIG = [
    { key: 'purchase', label: 'Purchase', icon: Package, color: '#F39C12' },
    { key: 'payment_out', label: 'Payment Out', icon: CreditCard, color: '#E74C3C' },
    { key: 'purchase_return', label: 'Purchase Return', icon: RotateCcw, color: '#3498DB' },
    { key: 'purchase_order', label: 'Purchase Order', icon: ClipboardList, color: '#9B59B6' },
];

const TYPE_LABELS = {
    purchase: 'Purchase', payment_out: 'Payment Out',
    purchase_return: 'Purchase Return', purchase_order: 'Purchase Order',
};

export default function Purchases() {
    const { profile } = useStore();
    const [activeTab, setActiveTab] = useState('purchase');
    const [showForm, setShowForm] = useState(false);
    const [editData, setEditData] = useState(null);
    const [search, setSearch] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const data = await transactionsService.getAll(activeTab);
            // Map Firestore fields to our UI fields (supports both naming conventions,
            // falling back instead of overwriting good data with undefined)
            const mapped = data.map(t => ({
                ...t,
                invoiceNo: t.invoiceNo || t.invoice_number,
                customerName: t.customerName || t.party_name || '—',
                total: t.total ?? t.total_amount ?? t.amount ?? 0,
                paid: t.paid ?? t.amount_paid ?? 0,
                balance: t.balance ?? t.balance_due ?? 0,
            }));
            setTransactions(mapped);
            setLoading(false);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load transactions');
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchTransactions();
    }, [activeTab]);

    const getList = () => {
        return transactions.filter(t =>
            (t.customerName || t.notes || t.invoiceNo || '').toLowerCase().includes(search.toLowerCase())
        );
    };

    const handleSave = async (data) => {
        try {
            data.type = activeTab; // Tell the service what category this is (e.g. 'purchase')
            if (editData?.id) {
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
                Object.keys(updateFields).forEach(k => updateFields[k] === undefined && delete updateFields[k]);
                await transactionsService.update(editData.id, updateFields);
                toast.success(`${TYPE_LABELS[activeTab]} updated successfully!`);
            } else {
                await transactionsService.add(data);
                toast.success(`${TYPE_LABELS[activeTab]} saved successfully!`);
            }
            setShowForm(false);
            setEditData(null);
            fetchTransactions(); // Refresh the list
        } catch (error) {
            console.error(error);
            toast.error('Failed to save transaction');
        }
    };

    const handleEdit = (txn) => {
        setEditData(txn);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to permanently delete this transaction?')) return;
        try {
            await transactionsService.delete(id);
            toast.success('Deleted from database!');
            fetchTransactions();
        } catch (error) {
            toast.error('Failed to delete transaction');
        }
    };

    const handlePrint = (txn) => {
        downloadBillPDF(txn, profile, TYPE_LABELS[txn.type || activeTab]);
        toast.success('Bill downloaded!');
    };

    const handleWhatsApp = async (txn) => {
        const type = TYPE_LABELS[txn.type || activeTab];
        const invoiceNo = txn.invoiceNo || txn.invoice_number || "";
        const supplier = txn.customerName || "Supplier";
        const total = Number(txn.total || txn.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
        const balance = Number(txn.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
        const supplierPhone = txn.customerPhone ? txn.customerPhone.replace(/[^0-9]/g, "") : "";

        const lines = [];
        lines.push("*" + (profile?.name || "Shree Samarth Agency") + "*");
        if (profile?.phone) lines.push("Ph: " + profile.phone);
        lines.push("");
        lines.push("*" + type + "* | " + invoiceNo);
        lines.push("Supplier: " + supplier);
        lines.push("Total: Rs. " + total);
        if (Number(txn.balance || 0) > 0) {
            lines.push("Balance Due: Rs. " + balance);
        } else {
            lines.push("Status: Fully Paid");
        }
        lines.push("");
        lines.push("Please find the attached bill. Thank you!");
        const message = lines.join("\n");

        // Try Web Share API first (mobile — shares the actual PDF to WhatsApp)
        if (navigator.share && navigator.canShare) {
            try {
                toast.loading("Preparing PDF...", { id: "wa-toast" });
                const { blob, filename } = await generateBillPDFBlob(txn, profile, type);
                const file = new File([blob], filename, { type: "application/pdf" });
                if (navigator.canShare({ files: [file] })) {
                    toast.dismiss("wa-toast");
                    await navigator.share({ files: [file], title: filename, text: message });
                    toast.success("Shared successfully!");
                    return;
                }
            } catch (err) {
                toast.dismiss("wa-toast");
                if (err.name !== "AbortError") {
                    console.error("Share failed:", err);
                }
            }
        }

        // Fallback for desktop: open WhatsApp with a text message
        const encoded = encodeURIComponent(message);
        const url = supplierPhone
            ? "https://wa.me/91" + supplierPhone + "?text=" + encoded
            : "https://wa.me/?text=" + encoded;
        window.open(url, "_blank");
        toast("💡 On desktop: download the bill first, then attach it in WhatsApp.", { duration: 5000 });
    };

    const list = getList();
    const totalAmount = list.reduce((s, t) => s + (t.total || t.paid || t.amount || 0), 0);
    const totalBalance = list.reduce((s, t) => s + (t.balance || 0), 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Purchase Transactions</h1>
                    <p className="page-subtitle">Manage all your purchase-related records</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditData(null); setShowForm(true); }}>
                    <Plus size={16} /> New {TYPE_LABELS[activeTab]}
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                {TAB_CONFIG.map(tab => (
                    <button key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className="btn"
                        style={{
                            background: activeTab === tab.key ? tab.color + '22' : 'var(--bg-card)',
                            color: activeTab === tab.key ? tab.color : 'var(--text-secondary)',
                            border: `1px solid ${activeTab === tab.key ? tab.color + '66' : 'var(--border)'}`,
                            fontWeight: activeTab === tab.key ? 700 : 500,
                            fontSize: 12, padding: '8px 14px',
                        }}>
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div className="card-sm" style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>NO. OF TXNS</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{list.length}</div>
                </div>
                <div className="card-sm" style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>TOTAL {activeTab === 'payment_out' ? 'PAID' : 'PURCHASE'}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#F39C12' }}>{formatCurrency(totalAmount)}</div>
                </div>
                {activeTab === 'purchase' && (
                    <div className="card-sm" style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>BALANCE DUE</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)' }}>{formatCurrency(totalBalance)}</div>
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
                                <th>Party / Supplier</th>
                                <th>Date</th>
                                <th>Type</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                {activeTab === 'purchase' && <th style={{ textAlign: 'right' }}>Balance</th>}
                                {activeTab === 'purchase' && <th>Status</th>}
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.length === 0 && (
                                <tr>
                                    <td colSpan={8}>
                                        <div className="empty-state">
                                            <Package size={40} />
                                            <h3>No {TYPE_LABELS[activeTab]}s yet</h3>
                                            <p>Click "New {TYPE_LABELS[activeTab]}" to get started</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {list.map(txn => (
                                <tr key={txn.id}>
                                    <td>
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#F39C12', fontWeight: 600 }}>
                                            {txn.invoiceNo}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{txn.customerName || '—'}</div>
                                        {txn.items?.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{txn.items.length} item(s)</div>}
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(txn.date)}</td>
                                    <td>
                                        <span className="badge badge-purchase">{TYPE_LABELS[txn.type] || TYPE_LABELS[activeTab]}</span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                        {formatCurrency(txn.total || txn.paid || txn.amount || 0)}
                                    </td>
                                    {activeTab === 'purchase' && (
                                        <td style={{ textAlign: 'right', fontWeight: 600, color: (txn.balance || 0) > 0 ? 'var(--red)' : 'var(--green)' }}>
                                            {formatCurrency(txn.balance || 0)}
                                        </td>
                                    )}
                                    {activeTab === 'purchase' && (
                                        <td>
                                            <span className={`badge ${txn.balance > 0 ? 'badge-red' : 'badge-green'}`}>
                                                {txn.balance > 0 ? 'Unpaid' : 'Paid'}
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
                                            <button
                                                title="Send via WhatsApp"
                                                onClick={() => handleWhatsApp(txn)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '4px 6px',
                                                    borderRadius: 6,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#25D366',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#25D36622'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.668 4.61 1.832 6.5L4 29l7.75-1.812A12.93 12.93 0 0 0 16 28c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10a9.953 9.953 0 0 1-5.174-1.453l-.364-.219-4.596 1.074 1.094-4.47-.238-.373A9.953 9.953 0 0 1 6 15c0-5.523 4.477-10 10-10zm-3.38 5c-.213 0-.56.08-.854.398-.294.317-1.122 1.095-1.122 2.67 0 1.576 1.147 3.098 1.307 3.313.16.214 2.235 3.563 5.51 4.853 2.718 1.073 3.274.86 3.865.806.59-.054 1.903-.777 2.171-1.527.268-.75.268-1.393.188-1.527-.08-.134-.294-.214-.615-.374-.321-.16-1.903-.938-2.197-1.045-.294-.107-.508-.16-.722.16-.214.32-.83 1.045-1.017 1.26-.187.214-.374.24-.695.08-.321-.16-1.355-.5-2.581-1.594-.955-.852-1.6-1.903-1.787-2.224-.187-.32-.02-.494.14-.653.144-.143.321-.374.482-.561.16-.187.213-.32.32-.534.107-.213.054-.4-.027-.561-.08-.16-.703-1.742-.976-2.383-.254-.614-.516-.534-.722-.534z"/>
                                                </svg>
                                            </button>
                                            {activeTab === 'purchase' && (
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