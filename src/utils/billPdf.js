import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/swami.jpg';

export function numberToWords(n) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (n === 0) return 'Zero';
    const num = Math.floor(n);
    const fn = (x) => {
        if (x < 20) return ones[x];
        if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
        if (x < 1000) return ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' and ' + fn(x % 100) : '');
        if (x < 100000) return fn(Math.floor(x / 1000)) + ' Thousand' + (x % 1000 ? ' ' + fn(x % 1000) : '');
        if (x < 10000000) return fn(Math.floor(x / 100000)) + ' Lakh' + (x % 100000 ? ' ' + fn(x % 100000) : '');
        return fn(Math.floor(x / 10000000)) + ' Crore' + (x % 10000000 ? ' ' + fn(x % 10000000) : '');
    };
    return fn(num) + ' Rupees only';
}

export function formatCurrency(amount, withSymbol = true) {
    const symbol = withSymbol ? 'Rs. ' : '';
    return symbol + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    } catch (e) {
        return dateStr;
    }
}

// ---- Helper: convert an image URL (Vite asset) to base64 data URL ----
async function getBase64FromUrl(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Generates a plain, table-based estimate/invoice PDF.
 * NOTE: This function is now async because it fetches the logo asset.
 * Make sure to await it wherever you call it:
 *   await downloadBillPDF(txn, profile, 'Estimate');
 */
export async function downloadBillPDF(txn, profile, type = 'Estimate') {
    try {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const ml = 12, mr = 198;
        const pageWidth = mr - ml;
        let y = 14;

        const dark = [0, 0, 0];
        const grey = [60, 60, 60];
        const lineGrey = [128, 128, 128];
        const thickLine = [90, 90, 90];

        // ---- Load logo from Vite asset URL → base64 ----
        let logoBase64 = null;
        try {
            logoBase64 = await getBase64FromUrl(logo);
        } catch (e) {
            console.error('Could not load logo image:', e);
            // Continues without logo gracefully
        }

        // ---- Title ----
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...dark);
        doc.text(type, ml + pageWidth / 2, y, { align: 'center' });
        y += 6;

        // ---- Company / Estimate info row ----
        const infoTop = y;
        const infoHeight = 18;
        const colSplit1 = ml + pageWidth * 0.62;
        const colSplit2 = ml + pageWidth * 0.81;

        doc.setDrawColor(...lineGrey);
        doc.setLineWidth(0.2);
        doc.rect(ml, infoTop, pageWidth, infoHeight);
        doc.line(colSplit1, infoTop, colSplit1, infoTop + infoHeight);
        doc.line(colSplit2, infoTop, colSplit2, infoTop + infoHeight);

        const logoSize = 12;
        const logoX = ml + 2;
        const logoY = infoTop + (infoHeight - logoSize) / 2;
        let textX = ml + 3;

        // ---- Add logo (from asset, now as base64) ----
        if (logoBase64) {
            try {
                // Detect format from data URL prefix
                const format = logoBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                doc.addImage(logoBase64, format, logoX, logoY, logoSize, logoSize);
                textX = logoX + logoSize + 3;
            } catch (imgErr) {
                console.error('Logo render error:', imgErr);
                // Fall back to no-logo layout
            }
        } else if (profile?.logo) {
            // Fallback: if profile provides its own base64 logo
            try {
                const format = profile.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                const base64Data = profile.logo.includes('base64,')
                    ? profile.logo.split('base64,')[1]
                    : profile.logo;
                doc.addImage(base64Data, format, logoX, logoY, logoSize, logoSize);
                textX = logoX + logoSize + 3;
            } catch (imgErr) {
                console.error('Profile logo render error:', imgErr);
            }
        }

        // Company block
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...dark);
        doc.text(profile?.name || 'Shree Samarth Agency', textX, infoTop + 7.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...grey);
        const compParts = [];
        if (profile?.phone) compParts.push(`Phone no.: ${profile.phone}`);
        if (profile?.address) compParts.push(profile.address);
        if (profile?.gstin) compParts.push(`GSTIN: ${profile.gstin}`);
        if (compParts.length) {
            doc.text(compParts[0], textX, infoTop + 12.5);
        }

        // Estimate No. block
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...dark);
        doc.text(`${type} No.`, colSplit1 + 3, infoTop + 6);
        doc.setFont('helvetica', 'bold');
        doc.text(txn.invoiceNo || 'Draft', colSplit1 + 3, infoTop + 11);

        // Date block
        doc.setFont('helvetica', 'normal');
        doc.text('Date', colSplit2 + 3, infoTop + 6);
        doc.setFont('helvetica', 'bold');
        doc.text(formatDate(txn.date), colSplit2 + 3, infoTop + 11);

        y = infoTop + infoHeight;

        // ---- Estimate For block ----
        const billTop = y;
        const lineH = 5;
        const billLines = [txn.customerName || 'Cash Customer'];
        if (txn.customerAddress) billLines.push(txn.customerAddress);
        if (txn.customerPhone) billLines.push(`Contact No.: ${txn.customerPhone}`);
        const billHeight = 6 + billLines.length * lineH + 2;

        doc.setDrawColor(...lineGrey);
        doc.rect(ml, billTop, pageWidth, billHeight);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...dark);
        doc.text(`${type} For`, ml + 3, billTop + 5);

        let blY = billTop + 5 + lineH;
        billLines.forEach((line, idx) => {
            doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
            doc.setFontSize(idx === 0 ? 9.5 : 8.5);
            doc.text(line, ml + 3, blY);
            blY += lineH;
        });

        y = billTop + billHeight;

        // ---- Items table ----
        const items = txn.items || [];
        let totalQty = 0;
        let totalAmount = 0;

        const body = items.map((item, idx) => {
            const qty = Number(item.qty || item.quantity || 0);
            const price = Number(item.price || item.price_per_unit || item.rate || 0);
            const amount = Number(item.amount || (price * qty) || 0);
            totalQty += qty;
            totalAmount += amount;
            return [
                String(idx + 1),
                item.name || item.item_name || 'Item',
                qty.toString(),
                item.unit || '-',
                formatCurrency(price),
                formatCurrency(amount),
            ];
        });

        autoTable(doc, {
            startY: y,
            margin: { left: ml, right: 210 - mr },
            tableWidth: pageWidth,
            head: [['#', 'Item name', 'Quantity', 'Unit', 'Price/ unit', 'Amount']],
            body,
            foot: [['', 'Total', String(totalQty), '', '', formatCurrency(totalAmount)]],
            theme: 'grid',
            styles: {
                fontSize: 8.5,
                textColor: dark,
                lineColor: lineGrey,
                lineWidth: 0.2,
                cellPadding: 1.6,
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: dark,
                fontStyle: 'bold',
                lineColor: lineGrey,
                lineWidth: 0.2,
            },
            bodyStyles: {
                fillColor: [255, 255, 255],
            },
            footStyles: {
                fillColor: [255, 255, 255],
                textColor: dark,
                fontStyle: 'bold',
                lineColor: lineGrey,
                lineWidth: 0.2,
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'left' },
                1: { cellWidth: pageWidth - 8 - 22 - 18 - 30 - 30, fontStyle: 'bold' },
                2: { cellWidth: 22, halign: 'right' },
                3: { cellWidth: 18, halign: 'right' },
                4: { cellWidth: 30, halign: 'right' },
                5: { cellWidth: 30, halign: 'right' },
            },
        });

        y = doc.lastAutoTable.finalY;

        // ---- Amount in words + Totals box ----
        const subTotal = totalAmount;
        const rounded = Math.round(subTotal);
        const roundOff = rounded - subTotal;
        const grandTotal = Number(txn.total_amount || txn.total || rounded);

        const wordsBoxWidth = pageWidth * 0.62;
        const amtBoxWidth = pageWidth - wordsBoxWidth;
        const wordsBoxX = ml;
        const amtBoxX = ml + wordsBoxWidth;
        const amtRowH = 5.5;
        const amtBoxHeight = 5.5 + amtRowH * 3 + 2;

        doc.setDrawColor(...lineGrey);
        doc.rect(wordsBoxX, y, wordsBoxWidth, amtBoxHeight);
        doc.rect(amtBoxX, y, amtBoxWidth, amtBoxHeight);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...dark);
        doc.text(`${type} Amount In Words`, wordsBoxX + 3, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        const wordsText = numberToWords(grandTotal);
        const wrapped = doc.splitTextToSize(wordsText, wordsBoxWidth - 6);
        doc.text(wrapped, wordsBoxX + 3, y + 10.5);

        let ay = y + 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...dark);
        doc.text('Amounts', amtBoxX + 3, ay);
        ay += amtRowH;
        doc.text('Sub Total', amtBoxX + 3, ay);
        doc.text(formatCurrency(subTotal), amtBoxX + amtBoxWidth - 3, ay, { align: 'right' });
        ay += amtRowH;
        doc.text('Round off', amtBoxX + 3, ay);
        doc.text((roundOff >= 0 ? '+ ' : '- ') + formatCurrency(Math.abs(roundOff)), amtBoxX + amtBoxWidth - 3, ay, { align: 'right' });
        ay += amtRowH;
        doc.setDrawColor(...thickLine);
        doc.setLineWidth(0.35);
        doc.line(amtBoxX, ay - 4, amtBoxX + amtBoxWidth, ay - 4);
        doc.setLineWidth(0.2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text('Total', amtBoxX + 3, ay);
        doc.text(formatCurrency(grandTotal), amtBoxX + amtBoxWidth - 3, ay, { align: 'right' });

        y += amtBoxHeight;

        // ---- Terms and conditions / Signatory ----
        const footHeight = 26;
        doc.setDrawColor(...lineGrey);
        doc.setLineWidth(0.2);
        doc.rect(ml, y, pageWidth, footHeight);
        doc.line(wordsBoxX + wordsBoxWidth, y, wordsBoxX + wordsBoxWidth, y + footHeight);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...dark);
        doc.text('Terms and conditions', ml + 3, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(txn.notes || 'Thank you for doing business with us.', ml + 3, y + 10.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`For: ${profile?.name || 'Shree Samarth Agency'}`, amtBoxX + amtBoxWidth / 2, y + 5, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text('Authorized Signatory', amtBoxX + amtBoxWidth / 2, y + footHeight - 4, { align: 'center' });

        // Download
        const filename = `${type.replace(/\s+/g, '_')}_${txn.invoiceNo || 'Draft'}.pdf`;
        doc.save(filename);
    } catch (error) {
        console.error('PDF Generation Error:', error);
        alert('Could not generate PDF. Please check the console for errors.');
    }
}