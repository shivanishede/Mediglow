import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const generateId = () => Math.random().toString(36).substr(2, 9).toUpperCase();
const getDate = () => new Date().toISOString().split('T')[0];

const useStore = create(
  persist(
    (set, get) => ({
      // Business Profile
      profile: {
        name: 'Shree Samarth Agency',
        owner: 'Owner Name',
        phone: '9876543210',
        email: 'info@shreesam.com',
        address: 'Pune, Maharashtra',
        gstin: '27AAAAA0000A1Z5',
        logo: null,
        paymentQR: null, // base64 image of the business's UPI/payment scanner QR code
        themeColor: '#7C6FFF',
      },
      updateProfile: (data) => set((s) => ({ profile: { ...s.profile, ...data } })),

      // Customers / Parties
      customers: [
        { id: 'C001', name: 'Dronagiri Medicine (Madhavnagar)', phone: '9800000001', email: '', address: 'Madhavnagar, Pune', gstin: '', openingBalance: 0, type: 'customer' },
        { id: 'C002', name: 'Mauli Medical (Dhayari)', phone: '9800000002', email: '', address: 'Dhayari, Pune', gstin: '', openingBalance: 0, type: 'customer' },
        { id: 'C003', name: 'Aapna Medicine (Narhe)', phone: '9800000003', email: '', address: 'Narhe, Pune', gstin: '', openingBalance: 0, type: 'customer' },
        { id: 'C004', name: 'K. K. Medical (Vadgoan)', phone: '9800000004', email: '', address: 'Vadgoan, Pune', gstin: '', openingBalance: 0, type: 'customer' },
        { id: 'C005', name: 'Medlife Medical (Ambegaon BK)', phone: '9800000005', email: '', address: 'Ambegaon BK, Pune', gstin: '', openingBalance: 0, type: 'customer' },
      ],
      addCustomer: (data) => set((s) => ({ customers: [...s.customers, { id: 'C' + generateId(), ...data }] })),
      updateCustomer: (id, data) => set((s) => ({ customers: s.customers.map(c => c.id === id ? { ...c, ...data } : c) })),
      deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter(c => c.id !== id) })),

      // Products / Items
      products: [
        { id: 'P001', name: '1 Line Medicine Box M90', category: 'Medicine Box', salePrice: 50, purchasePrice: 35, stock: 1, unit: 'Pcs', hsn: '3004', gst: 12 },
        { id: 'P002', name: '2 Line Medicine Box M150', category: 'Medicine Box', salePrice: 65, purchasePrice: 38, stock: 2, unit: 'Pcs', hsn: '3004', gst: 12 },
        { id: 'P003', name: '3 Line Medicine Box M160', category: 'Medicine Box', salePrice: 80, purchasePrice: 57, stock: 0, unit: 'Pcs', hsn: '3004', gst: 12 },
        { id: 'P004', name: '3 Ply Disp. Black Mask', category: 'Mask', salePrice: 85, purchasePrice: 62, stock: 38, unit: 'Pcs', hsn: '6307', gst: 5 },
        { id: 'P005', name: 'Hand Sanitizer 500ml', category: 'Sanitizer', salePrice: 120, purchasePrice: 85, stock: 15, unit: 'Bottle', hsn: '3808', gst: 12 },
      ],
      addProduct: (data) => set((s) => ({ products: [...s.products, { id: 'P' + generateId(), ...data }] })),
      updateProduct: (id, data) => set((s) => ({ products: s.products.map(p => p.id === id ? { ...p, ...data } : p) })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter(p => p.id !== id) })),
      updateStock: (id, qty) => set((s) => ({ products: s.products.map(p => p.id === id ? { ...p, stock: p.stock + qty } : p) })),

      // Transaction counters
      counters: { sale: 7490, purchase: 1001, expense: 501, payment_in: 201, payment_out: 101, sale_return: 51, purchase_return: 31, delivery_challan: 21, estimate: 11, sale_order: 5, purchase_order: 3, p2p: 1 },
      nextCounter: (type) => {
        const c = get().counters[type] + 1;
        set((s) => ({ counters: { ...s.counters, [type]: c } }));
        return c;
      },

      // Sale Transactions
      sales: [
        { id: 'SAL001', invoiceNo: 'SALE 7490', type: 'sale', customerId: 'C001', customerName: 'Dronagiri Medicine (Madhavnagar)', date: '2026-03-02', items: [{ productId: 'P001', name: '1 Line Medicine Box M90', qty: 10, price: 50, discount: 0, gst: 12, amount: 500 }, { productId: 'P005', name: 'Hand Sanitizer 500ml', qty: 3, price: 120, discount: 0, gst: 12, amount: 360 }], subtotal: 860, tax: 4, discount: 0, total: 864, paid: 864, balance: 0, notes: '', status: 'completed' },
        { id: 'SAL002', invoiceNo: 'SALE 7489', type: 'sale', customerId: 'C002', customerName: 'Mauli Medical (Dhayari)', date: '2026-03-02', items: [{ productId: 'P002', name: '2 Line Medicine Box M150', qty: 10, price: 65, discount: 0, gst: 12, amount: 650 }, { productId: 'P004', name: '3 Ply Disp. Black Mask', qty: 6, price: 85, discount: 0, gst: 5, amount: 510 }], subtotal: 1160, tax: 10, discount: 0, total: 1170, paid: 0, balance: 1170, notes: '', status: 'pending' },
        { id: 'SAL003', invoiceNo: 'SALE 7488', type: 'sale', customerId: 'C003', customerName: 'Aapna Medicine (Narhe)', date: '2026-03-02', items: [{ productId: 'P003', name: '3 Line Medicine Box M160', qty: 5, price: 80, discount: 0, gst: 12, amount: 400 }, { productId: 'P005', name: 'Hand Sanitizer 500ml', qty: 1, price: 120, discount: 0, gst: 12, amount: 120 }], subtotal: 590, tax: 5, discount: 0, total: 595, paid: 595, balance: 0, notes: '', status: 'completed' },
      ],
      addSale: (data) => {
        const inv = 'SALE ' + get().nextCounter('sale');
        const sale = { id: 'SAL' + generateId(), invoiceNo: inv, type: 'sale', date: getDate(), ...data };
        set((s) => ({ sales: [sale, ...s.sales] }));
        data.items.forEach(item => get().updateStock(item.productId, -item.qty));
        return sale;
      },
      updateSale: (id, data) => set((s) => ({ sales: s.sales.map(t => t.id === id ? { ...t, ...data } : t) })),
      deleteSale: (id) => set((s) => ({ sales: s.sales.filter(t => t.id !== id) })),

      // Purchase Transactions
      purchases: [
        { id: 'PUR001', invoiceNo: 'PUR 1001', type: 'purchase', customerId: 'C001', customerName: 'Dronagiri Medicine (Madhavnagar)', date: '2026-03-01', items: [{ productId: 'P001', name: '1 Line Medicine Box M90', qty: 50, price: 35, discount: 0, gst: 12, amount: 1750 }], subtotal: 1750, tax: 210, discount: 0, total: 1960, paid: 1960, balance: 0, notes: '', status: 'completed' },
      ],
      addPurchase: (data) => {
        const inv = 'PUR ' + get().nextCounter('purchase');
        const pur = { id: 'PUR' + generateId(), invoiceNo: inv, type: 'purchase', date: getDate(), ...data };
        set((s) => ({ purchases: [pur, ...s.purchases] }));
        data.items.forEach(item => get().updateStock(item.productId, item.qty));
        return pur;
      },
      updatePurchase: (id, data) => set((s) => ({ purchases: s.purchases.map(t => t.id === id ? { ...t, ...data } : t) })),
      deletePurchase: (id) => set((s) => ({ purchases: s.purchases.filter(t => t.id !== id) })),

      // Payment In
      paymentsIn: [],
      addPaymentIn: (data) => {
        const inv = 'PAYIN ' + get().nextCounter('payment_in');
        set((s) => ({ paymentsIn: [{ id: 'PIN' + generateId(), invoiceNo: inv, type: 'payment_in', date: getDate(), ...data }, ...s.paymentsIn] }));
      },

      // Payment Out
      paymentsOut: [],
      addPaymentOut: (data) => {
        const inv = 'PAYOUT ' + get().nextCounter('payment_out');
        set((s) => ({ paymentsOut: [{ id: 'POT' + generateId(), invoiceNo: inv, type: 'payment_out', date: getDate(), ...data }, ...s.paymentsOut] }));
      },

      // Sale Returns
      saleReturns: [],
      addSaleReturn: (data) => {
        const inv = 'SR ' + get().nextCounter('sale_return');
        const sr = { id: 'SR' + generateId(), invoiceNo: inv, type: 'sale_return', date: getDate(), ...data };
        set((s) => ({ saleReturns: [sr, ...s.saleReturns] }));
        data.items?.forEach(item => get().updateStock(item.productId, item.qty));
        return sr;
      },

      // Purchase Returns
      purchaseReturns: [],
      addPurchaseReturn: (data) => {
        const inv = 'PR ' + get().nextCounter('purchase_return');
        const pr = { id: 'PR' + generateId(), invoiceNo: inv, type: 'purchase_return', date: getDate(), ...data };
        set((s) => ({ purchaseReturns: [pr, ...s.purchaseReturns] }));
        data.items?.forEach(item => get().updateStock(item.productId, -item.qty));
        return pr;
      },

      // Delivery Challans
      deliveryChallans: [],
      addDeliveryChallan: (data) => {
        const inv = 'DC ' + get().nextCounter('delivery_challan');
        set((s) => ({ deliveryChallans: [{ id: 'DC' + generateId(), invoiceNo: inv, type: 'delivery_challan', date: getDate(), ...data }, ...s.deliveryChallans] }));
      },

      // Estimates / Quotations
      estimates: [],
      addEstimate: (data) => {
        const inv = 'EST ' + get().nextCounter('estimate');
        set((s) => ({ estimates: [{ id: 'EST' + generateId(), invoiceNo: inv, type: 'estimate', date: getDate(), ...data }, ...s.estimates] }));
      },

      // Sale Orders
      saleOrders: [],
      addSaleOrder: (data) => {
        const inv = 'SO ' + get().nextCounter('sale_order');
        set((s) => ({ saleOrders: [{ id: 'SO' + generateId(), invoiceNo: inv, type: 'sale_order', date: getDate(), ...data }, ...s.saleOrders] }));
      },

      // Purchase Orders
      purchaseOrders: [],
      addPurchaseOrder: (data) => {
        const inv = 'PO ' + get().nextCounter('purchase_order');
        set((s) => ({ purchaseOrders: [{ id: 'PO' + generateId(), invoiceNo: inv, type: 'purchase_order', date: getDate(), ...data }, ...s.purchaseOrders] }));
      },

      // Expenses
      expenses: [
        { id: 'EXP001', invoiceNo: 'EXP 501', type: 'expense', category: 'Rent', date: '2026-03-01', amount: 5000, paid: 5000, notes: 'March Office Rent', paymentMode: 'Cash' },
      ],
      addExpense: (data) => {
        const inv = 'EXP ' + get().nextCounter('expense');
        set((s) => ({ expenses: [{ id: 'EXP' + generateId(), invoiceNo: inv, type: 'expense', date: getDate(), ...data }, ...s.expenses] }));
      },
      updateExpense: (id, data) => set((s) => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...data } : e) })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter(e => e.id !== id) })),

      // P2P Transfers
      p2pTransfers: [],
      addP2PTransfer: (data) => {
        const inv = 'P2P ' + get().nextCounter('p2p');
        set((s) => ({ p2pTransfers: [{ id: 'P2P' + generateId(), invoiceNo: inv, type: 'p2p', date: getDate(), ...data }, ...s.p2pTransfers] }));
      },
    }),
    { name: 'mediglow-store', version: 1 }
  )
);

export default useStore;