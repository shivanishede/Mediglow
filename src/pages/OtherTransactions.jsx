import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, ArrowLeftRight, ArrowRight } from 'lucide-react';
import TransactionForm from '../components/TransactionForm';
import { formatCurrency, formatDate } from '../utils/billPdf';
import { transactionsService } from '../services/firestoreService';
import toast from 'react-hot-toast';

export default function OtherTransactions() {
    const [p2pTransfers, setP2pTransfers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editData, setEditData] = useState(null);
    const [search, setSearch] = useState('');

    const fetchP2P = async () => {
        try {
            setLoading(true);
            const data = await transactionsService.getAll('p2p');
            const mapped = data.map(t => {
                return {
                    id: t.id,
                    invoiceNo: t.invoiceNo || t.invoice_number,
                    fromParty: t.fromParty || t.from_party || 'Unknown',
                    toParty: t.toParty || t.to_party || 'Unknown',
                    notes: t.notes || '',
                    date: t.date,
                    paymentMode: t.paymentMode || t.payment_mode || 'Cash',
                    transferAmount: t.total ?? t.transferAmount ?? t.total_amount ?? 0
                };
            });
            setP2pTransfers(mapped);
            setLoading(false);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load P2P transfers');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchP2P();
    }, []);

    const filtered = p2pTransfers.filter(t =>
        (t.fromParty + t.toParty + t.invoiceNo + (t.notes || '')).toLowerCase().includes(search.toLowerCase())
    );

    const handleSave = async (data) => {
        try {
            const payload = {
                type: 'p2p',
                date: data.date,
                total: data.transferAmount,
                paid: data.transferAmount, // always fully covered balance-wise in p2p
                paymentMode: data.paymentMode,
                notes: data.notes || '',
                fromParty: data.fromParty,
                toParty: data.toParty
            };
            if (editData) {
                // Delete and recreate for transactional safety in P2P
                await transactionsService.delete(editData.id);
                await transactionsService.add(payload);
                toast.success('P2P Transfer updated!');
            } else {
                await transactionsService.add(payload);
                toast.success('P2P Transfer saved!');
            }
            setShowForm(false);
            setEditData(null);
            fetchP2P();
        } catch (err) {
            toast.error('Failed to save P2P transfer');
        }
    };

    const handleEdit = (txn) => {
        setEditData(txn);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this P2P transfer?')) return;
        try {
            await transactionsService.delete(id);
            toast.success('Deleted transfer!');
            fetchP2P();
        } catch (error) {
            toast.error('Failed to delete P2P transfer');
        }
    };

    const total = filtered.reduce((s, t) => s + (t.transferAmount || 0), 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Other Transactions</h1>
                    <p className="page-subtitle">Party-to-Party transfers and adjustments</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditData(null); setShowForm(true); }}>
                    <Plus size={16} /> New P2P Transfer
                </button>
            </div>

            {/* Info card */}
            <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(124,111,255,0.1), rgba(168,156,255,0.05))', borderColor: 'rgba(124,111,255,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(124,111,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowLeftRight size={24} color="var(--accent2)" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Party to Party Transfer (P2P)</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Transfer balances between two parties. Useful for adjusting ledger accounts, advance payments, or group company transfers.
                        </p>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div className="card-sm" style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>TOTAL TRANSFERS</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent2)' }}>{p2pTransfers.length}</div>
                </div>
                <div className="card-sm" style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>TOTAL AMOUNT</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent2)' }}>{formatCurrency(p2pTransfers.reduce((s, t) => s + (t.transferAmount || 0), 0))}</div>
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <div className="search-bar">
                    <Search size={16} color="var(--text-muted)" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transfers..." />
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Ref No.</th>
                                <th>From Party</th>
                                <th></th>
                                <th>To Party</th>
                                <th>Date</th>
                                <th>Payment Mode</th>
                                <th>Notes</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9}>
                                        <div className="empty-state">
                                            <ArrowLeftRight size={40} />
                                            <h3>No P2P transfers yet</h3>
                                            <p>Create your first party-to-party transfer above</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {filtered.map(txn => (
                                <tr key={txn.id}>
                                    <td>
                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>{txn.invoiceNo}</span>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500, color: 'var(--red)' }}>{txn.fromParty}</div>
                                    </td>
                                    <td>
                                        <ArrowRight size={14} color="var(--text-muted)" />
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500, color: 'var(--green)' }}>{txn.toParty}</div>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(txn.date)}</td>
                                    <td>
                                        <span className="badge badge-gray">{txn.paymentMode}</span>
                                    </td>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{txn.notes || '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent2)' }}>
                                        {formatCurrency(txn.transferAmount)}
                                    </td>
                                    <td>
                                        <div className="action-btns" style={{ justifyContent: 'center' }}>
                                            <button className="btn btn-ghost btn-icon btn-sm" title="Edit"
                                                onClick={() => handleEdit(txn)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn btn-danger btn-icon btn-sm" title="Delete"
                                                onClick={() => handleDelete(txn.id)}>
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
                                    <td colSpan={7} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', fontSize: 12, padding: '12px 16px' }}>TOTAL TRANSFERRED</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent2)', fontSize: 15, padding: '12px 16px' }}>{formatCurrency(total)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {showForm && (
                <TransactionForm
                    type="p2p"
                    title="P2P Transfer"
                    editData={editData}
                    onClose={() => {
                        setShowForm(false);
                        setEditData(null);
                    }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}