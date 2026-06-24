import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, Users, Phone, MapPin, X } from 'lucide-react';
import { partiesService } from '../services/firestoreService';
import { formatCurrency } from '../utils/billPdf';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';

const EMPTY_FORM = { type: 'CUSTOMER', name: '', phone: '', email: '', address: '', gstin: '', balance: 0 };

export default function Customers() {
    const { profile } = useStore();
    const [parties, setParties] = useState([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);

    // Fetch live parties from Firestore
    const fetchParties = async () => {
        try {
            setLoading(true);
            const data = await partiesService.getAll();
            setParties(data);
            setLoading(false);
        } catch (error) {
            console.error("Failed to load parties:", error);
            toast.error("Failed to load parties from database");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchParties();
    }, []);

    const filtered = parties.filter(c =>
        (c.name + (c.phone || '') + (c.email || '') + (c.address || '')).toLowerCase().includes(search.toLowerCase())
    );

    const handleOpen = (cust) => {
        if (cust) {
            setForm({ ...cust });
        } else {
            setForm(EMPTY_FORM);
        }
        setShowForm(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Name is required'); return; }

        try {
            if (form.id) {
                await partiesService.update(form.id, form);
                toast.success('Party updated in Database!');
            } else {
                await partiesService.add(form);
                toast.success('Party saved to Database!');
            }
            setShowForm(false);
            fetchParties(); // Refresh the list from DB
        } catch (err) {
            toast.error('Failed to save party');
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this party permanently from the database?')) return;

        try {
            await partiesService.delete(id);
            toast.success('Party deleted from Database!');
            fetchParties(); // Refresh list
        } catch (err) {
            console.error(err);
            // Show the real Firestore error (e.g. "Missing or insufficient permissions")
            // instead of guessing at the cause.
            toast.error(`Failed to delete party: ${err.message || 'Unknown error'}`);
        }
    };

    // Converts a base64 data URL into a PNG Blob — PNG is the format with the most
    // consistent clipboard support across browsers, regardless of the original upload format.
    const toPngBlob = (dataUrl) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Conversion failed')), 'image/png');
        };
        img.onerror = reject;
        img.src = dataUrl;
    });

    const handleWhatsApp = async (cust) => {
        if (!cust.phone) {
            toast.error('This party has no phone number saved');
            return;
        }
        const digits = cust.phone.replace(/[^0-9]/g, '');
        const fullNumber = digits.length === 10 ? `91${digits}` : digits;
        const message = `Hi ${cust.name}, please scan the attached QR to pay ${profile?.name || 'us'}. Thank you!`;
        const url = `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;

        if (!profile?.paymentQR) {
            window.open(url, '_blank');
            return;
        }

        // --- Mobile: Web Share API attaches the QR file directly into WhatsApp ---
        if (navigator.share && navigator.canShare) {
            try {
                toast.loading('Preparing QR...', { id: 'wa-qr-toast' });
                const blob = await toPngBlob(profile.paymentQR);
                const file = new File([blob], `payment-qr-${cust.name}.png`, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    toast.dismiss('wa-qr-toast');
                    await navigator.share({ files: [file], title: 'Payment QR', text: message });
                    toast.success('QR shared successfully!');
                    return;
                }
                toast.dismiss('wa-qr-toast');
            } catch (err) {
                toast.dismiss('wa-qr-toast');
                if (err.name === 'AbortError') return; // User cancelled
                console.error('Share failed:', err);
                // Fall through to desktop fallback
            }
        }

        // --- Desktop fallback: open WhatsApp then copy QR to clipboard ---
        window.open(url, '_blank');

        let copied = false;
        try {
            if (navigator.clipboard?.write && window.ClipboardItem) {
                const blob = await toPngBlob(profile.paymentQR);
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                copied = true;
            }
        } catch (err) {
            console.error('Clipboard copy failed:', err);
        }

        if (copied) {
            toast.success('QR copied! Press Ctrl+V (Cmd+V on Mac) inside the chat to paste and send it.', { duration: 7000 });
        } else {
            const a = document.createElement('a');
            a.href = profile.paymentQR;
            a.download = `payment-qr-${cust.name}.png`;
            a.click();
            toast('💡 QR downloaded — drag it into the chat that just opened to send it.', { duration: 6000 });
        }
        };

    const totalReceivable = parties.reduce((sum, p) => sum + (p.balance || 0), 0);
    const partiesWithBalance = parties.filter(p => (p.balance || 0) > 0).length;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Parties / Customers</h1>
                    <p className="page-subtitle">Manage your customers and suppliers (Live DB)</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpen(null)}>
                    <Plus size={16} /> Add Party
                </button>
            </div>

            {/* Stats */}
            <div className="grid-3" style={{ marginBottom: 20, gap: 16 }}>
                <div className="stat-card">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>TOTAL PARTIES</div>
                    <div className="stat-value">{parties.length}</div>
                </div>
                <div className="stat-card">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>TOTAL RECEIVABLE</div>
                    <div className="stat-value" style={{ color: 'var(--green)' }}>
                        {formatCurrency(totalReceivable)}
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>WITH BALANCE DUE</div>
                    <div className="stat-value" style={{ color: 'var(--yellow)' }}>
                        {partiesWithBalance}
                    </div>
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <div className="search-bar">
                    <Search size={16} color="var(--text-muted)" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parties by name, phone..." />
                </div>
            </div>

            {/* Customer Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {loading && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20 }}>Loading from Database...</div>}

                {!loading && filtered.length === 0 && (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                        <Users size={40} />
                        <h3>No parties found</h3>
                        <p>Add your first customer or supplier</p>
                    </div>
                )}

                {!loading && filtered.map(cust => {
                    const balance = cust.balance || 0;
                    const initial = cust.name.charAt(0).toUpperCase();
                    return (
                        <div key={cust.id} className="card" style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                                <div className="avatar" style={{ fontSize: 18, background: cust.type === 'SUPPLIER' ? 'rgba(231,76,60,0.15)' : 'rgba(124,111,255,0.15)', color: cust.type === 'SUPPLIER' ? 'var(--red)' : '#7C6FFF' }}>
                                    {initial}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cust.name}</div>
                                    {cust.phone ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Phone size={11} />
                                            {cust.phone}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No Phone Number</div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {cust.phone && (
                                        <button
                                            className="btn btn-ghost btn-icon btn-sm"
                                            title={profile?.paymentQR ? `Send Payment QR on WhatsApp (${cust.phone})` : `Chat on WhatsApp (${cust.phone})`}
                                            onClick={() => handleWhatsApp(cust)}
                                            style={{ color: '#25D366' }}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M16 3C9.373 3 4 8.373 4 15c0 2.385.668 4.61 1.832 6.5L4 29l7.75-1.812A12.93 12.93 0 0 0 16 28c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10a9.953 9.953 0 0 1-5.174-1.453l-.364-.219-4.596 1.074 1.094-4.47-.238-.373A9.953 9.953 0 0 1 6 15c0-5.523 4.477-10 10-10zm-3.38 5c-.213 0-.56.08-.854.398-.294.317-1.122 1.095-1.122 2.67 0 1.576 1.147 3.098 1.307 3.313.16.214 2.235 3.563 5.51 4.853 2.718 1.073 3.274.86 3.865.806.59-.054 1.903-.777 2.171-1.527.268-.75.268-1.393.188-1.527-.08-.134-.294-.214-.615-.374-.321-.16-1.903-.938-2.197-1.045-.294-.107-.508-.16-.722.16-.214.32-.83 1.045-1.017 1.26-.187.214-.374.24-.695.08-.321-.16-1.355-.5-2.581-1.594-.955-.852-1.6-1.903-1.787-2.224-.187-.32-.02-.494.14-.653.144-.143.321-.374.482-.561.16-.187.213-.32.32-.534.107-.213.054-.4-.027-.561-.08-.16-.703-1.742-.976-2.383-.254-.614-.516-.534-.722-.534z"/>
                                            </svg>
                                        </button>
                                    )}
                                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleOpen(cust)}><Edit2 size={13} /></button>
                                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(cust.id)}><Trash2 size={13} /></button>
                                </div>
                            </div>
                            <div className="divider"></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <div>
                                    {cust.address && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', marginBottom: 4 }}>
                                            <MapPin size={10} />
                                            <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust.address}</span>
                                        </div>
                                    )}
                                    <div style={{ color: 'var(--text-muted)', fontSize: 11, background: 'rgba(255,255,255,0.05)', display: 'inline-block', padding: '2px 6px', borderRadius: 4 }}>
                                        {cust.type}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Balance Due</div>
                                    <div style={{ fontWeight: 700, color: balance > 0 ? 'var(--green)' : 'var(--text-muted)', fontSize: 14 }}>
                                        {formatCurrency(balance)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Form */}
            {showForm && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
                    <div className="modal">
                        <div className="modal-header">
                            <h2 className="modal-title">{form.id ? 'Edit Party' : 'Add New Party'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="grid-2" style={{ gap: 14 }}>
                                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                        <label className="form-label">Party Type</label>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <input type="radio" name="partyType" checked={form.type === 'CUSTOMER'} onChange={() => setForm({ ...form, type: 'CUSTOMER' })} />
                                                Customer
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <input type="radio" name="partyType" checked={form.type === 'SUPPLIER'} onChange={() => setForm({ ...form, type: 'SUPPLIER' })} />
                                                Supplier
                                            </label>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                        <label className="form-label">Party Name *</label>
                                        <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter party/customer name" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone Number</label>
                                        <input className="form-control" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile number" type="tel" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email Address / GSTIN</label>
                                        <input className="form-control" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email or tax info" />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                        <label className="form-label">Address</label>
                                        <textarea className="form-control" rows={2} value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address"></textarea>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Opening Balance (₹)</label>
                                        <input className="form-control" value={form.balance || 0} onChange={e => setForm({ ...form, balance: Number(e.target.value) })} type="number" min="0" step="0.01" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    {form.id ? 'Update Party' : 'Save Party'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}