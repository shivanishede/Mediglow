import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit,
    serverTimestamp,
    increment,
    runTransaction,
    getDoc,
    setDoc
} from "firebase/firestore";
import { db } from "../config/firebase";

// === PARTIES (CUSTOMERS & SUPPLIERS) ===
export const partiesService = {
    async getAll() {
        const q = query(collection(db, "parties"), orderBy("created_at", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })); // id last: real Firestore ID always wins over any stray "id" field in stored data
    },
    async add(partyData) {
        const { id, ...cleanData } = partyData; // never persist a fake "id" field
        return await addDoc(collection(db, "parties"), {
            ...cleanData,
            balance: partyData.balance || 0,
            created_at: serverTimestamp()
        });
    },
    async update(id, partyData) {
        const { id: _ignore, ...cleanData } = partyData; // never persist a fake "id" field
        const docRef = doc(db, "parties", id);
        return await updateDoc(docRef, cleanData);
    },
    async delete(id) {
        return await deleteDoc(doc(db, "parties", id));
    }
};

// === ITEMS (INVENTORY) ===
export const itemsService = {
    async getAll() {
        const q = query(collection(db, "items"), orderBy("created_at", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })); // id last: real Firestore ID always wins over any stray "id" field in stored data
    },
    async add(itemData) {
        const { id, ...cleanData } = itemData; // never persist a fake "id" field
        return await addDoc(collection(db, "items"), {
            ...cleanData,
            stock: Number(itemData.stock) || 0,
            selling_price: Number(itemData.selling_price) || 0,
            purchase_price: Number(itemData.purchase_price) || 0,
            created_at: serverTimestamp()
        });
    },
    async update(id, itemData) {
        const { id: _ignore, ...cleanData } = itemData; // never persist a fake "id" field
        const docRef = doc(db, "items", id);
        return await updateDoc(docRef, {
            ...cleanData,
            stock: Number(itemData.stock),
            selling_price: Number(itemData.selling_price),
            purchase_price: Number(itemData.purchase_price)
        });
    },
    async delete(id) {
        return await deleteDoc(doc(db, "items", id));
    }
};

// === TRANSACTIONS (SALES, PURCHASES, EXPENSES) ===
export const transactionsService = {
    async getAll(type = null) {
        let q;
        if (type) {
            q = query(
                collection(db, "transactions"), 
                where("type", "==", type.toUpperCase()), 
                orderBy("date", "desc")
            );
        } else {
            q = query(collection(db, "transactions"), orderBy("date", "desc"));
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })); // id last: real Firestore ID always wins over any stray "id" field in stored data
    },

    async add(transactionData) {
        // We use a Transaction to ensure Atomicity: 
        // Either the transaction is saved AND stock is updated, or nothing happens.
        return await runTransaction(db, async (transaction) => {
            const { items, type, id, ...tData } = transactionData; // never persist a fake "id" field

            // 1. Generate a guaranteed-unique, sequential Invoice Number
            // We keep a per-type counter document in a "counters" collection.
            // e.g. counters/SALE  → { seq: 42 }
            //      counters/PURC  → { seq: 17 }
            const prefix = type.toUpperCase().substring(0, 4); // e.g. "SALE", "PURC"
            const counterRef = doc(db, "counters", prefix);
            const counterSnap = await transaction.get(counterRef);

            // If no counter doc exists yet, start at 1; otherwise increment
            const nextSeq = counterSnap.exists() ? counterSnap.data().seq + 1 : 1;

            // Zero-pad to 5 digits: SALE-00001, PURC-00042, etc.
            const invoiceNo = `${prefix}-${String(nextSeq).padStart(5, '0')}`;
            
            // 2. ALL READS MUST HAPPEN FIRST
            // Fetch all item documents before doing any writes
            const itemDocs = [];
            if (items && items.length > 0) {
                for (const item of items) {
                    const itemRef = doc(db, "items", item.productId);
                    const itemDoc = await transaction.get(itemRef);
                    if (itemDoc.exists()) {
                        itemDocs.push({ 
                            ref: itemRef, 
                            data: itemDoc.data(),
                            qty: Number(item.qty)
                        });
                    }
                }
            }

            // 3. NOW PERFORM ALL WRITES

            // 3a. Upsert the counter (increment or create)
            transaction.set(counterRef, { seq: nextSeq }, { merge: true });

            // 3b. Save the transaction document
            const newTransactionRef = doc(collection(db, "transactions"));
            transaction.set(newTransactionRef, {
                ...tData,
                type: type.toUpperCase(),
                invoice_number: invoiceNo,
                created_at: serverTimestamp(),
                items: items || [] // Nested items for performance!
            });

            // Update individual item stocks
            for (const itemObj of itemDocs) {
                let stockChange = 0;
                if (type === 'sale') stockChange = -itemObj.qty;
                else if (type === 'purchase' || type === 'sale_return') stockChange = itemObj.qty;

                transaction.update(itemObj.ref, {
                    stock: increment(stockChange)
                });
            }

            return { id: newTransactionRef.id, invoiceNo };
        });
    },

    async update(id, data) {
        const { id: _ignore, ...cleanData } = data; // never persist a fake "id" field
        const docRef = doc(db, "transactions", id);
        return await updateDoc(docRef, cleanData);
    },

    async delete(id) {
        // In professional apps, we should also revert stock on delete
        // For simplicity now, we just delete
        return await deleteDoc(doc(db, "transactions", id));
    }
};

// === DASHBOARD STATS ===
export const dashboardService = {
    async getStats() {
        // 1. Get date for 6 months ago to calculate trend
        const today = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(today.getMonth() - 5);
        sixMonthsAgo.setDate(1); // Start of month
        
        const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];
        const currentMonthStr = today.toISOString().slice(0, 7);

        // 2. Fetch all transactions from last 6 months
        const q = query(
            collection(db, "transactions"), 
            where("date", ">=", sixMonthsAgoStr),
            orderBy("date", "asc")
        );
        const snapshot = await getDocs(q);
        
        const stats = {
            totalSales: 0,
            totalPurchases: 0,
            totalExpenses: 0,
            youllGet: 0,
            youllGive: 0,
            totalParties: 0,
            totalItems: 0,
            pendingSales: 0,
            // Monthly trend aggregation
            trend: {
                sales: {}, // { "2024-03": 500 }
                purchases: {}
            }
        };

        snapshot.forEach(doc => {
            const data = doc.data();
            const total = Number(data.total) || 0;
            const paid = Number(data.paid) || 0;
            const balance = Number(data.balance) || 0;
            const monthKey = data.date ? data.date.slice(0, 7) : currentMonthStr;

            if (data.type === 'SALE') {
                if (monthKey === currentMonthStr) {
                    stats.totalSales += total;
                    stats.youllGet += balance;
                    if (balance > 0) stats.pendingSales++;
                }
                stats.trend.sales[monthKey] = (stats.trend.sales[monthKey] || 0) + total;
            } else if (data.type === 'PURCHASE') {
                if (monthKey === currentMonthStr) {
                    stats.totalPurchases += total;
                    stats.youllGive += balance;
                }
                stats.trend.purchases[monthKey] = (stats.trend.purchases[monthKey] || 0) + total;
            } else if (data.type === 'EXPENSE') {
                if (monthKey === currentMonthStr) {
                    stats.totalExpenses += total;
                }
            }
        });

        // Get total counts independently of date filter
        const partiesSnap = await getDocs(collection(db, "parties"));
        const itemsSnap = await getDocs(collection(db, "items"));
        
        stats.totalParties = partiesSnap.size;
        stats.totalItems = itemsSnap.size;
        stats.netProfit = stats.totalSales - stats.totalPurchases - stats.totalExpenses;

        return stats;
    },

    async syncData(storeData) {
        // 1. Sync Parties
        for (const p of storeData.customers || []) {
            try {
                await partiesService.add({
                    name: p.name,
                    phone: p.phone,
                    email: p.email,
                    address: p.address,
                    gstin: p.gstin,
                    type: p.type || 'customer'
                });
            } catch (e) { console.error("Sync Party Error:", e); }
        }

        // 2. Sync Items
        for (const i of storeData.products || []) {
            try {
                await itemsService.add({
                    item_name: i.name,
                    category: i.category,
                    selling_price: i.salePrice,
                    purchase_price: i.purchasePrice,
                    stock: i.stock,
                    unit: i.unit,
                    gst: i.gst
                });
            } catch (e) { console.error("Sync Item Error:", e); }
        }

        // 3. Sync Sales
        for (const s of storeData.sales || []) {
            try {
                // Simplified add for sync (don't update stock on sync if stock is already correct)
                await addDoc(collection(db, "transactions"), {
                    ...s,
                    type: 'SALE',
                    created_at: serverTimestamp()
                });
            } catch (e) { console.error("Sync Sale Error:", e); }
        }

        // 4. Sync Purchases
        for (const pu of storeData.purchases || []) {
            try {
                await addDoc(collection(db, "transactions"), {
                    ...pu,
                    type: 'PURCHASE',
                    created_at: serverTimestamp()
                });
            } catch (e) { console.error("Sync Purchase Error:", e); }
        }

        return true;
    }
};