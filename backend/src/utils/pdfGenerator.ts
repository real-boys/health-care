import PDFDocument from 'pdfkit';
import { PaymentRecord } from './csvGenerator';

interface PDFOptions {
  title?: string;
  author?: string;
  subject?: string;
}

export class pdfGenerator {
  static generatePaymentPDF(
    payments: PaymentRecord[], 
    userId: string, 
    startDate?: string, 
    endDate?: string,
    options: PDFOptions = {}
  ): Buffer {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    
    const buffers: Buffer[] = [];
    
    doc.on('data', (chunk) => buffers.push(chunk));
    
    // Set document metadata
    doc.info.Title = options.title || 'Payment History Report';
    doc.info.Author = options.author || 'Healthcare System';
    doc.info.Subject = options.subject || `Payment History for User ${userId}`;
    
    // Add header
    this.addHeader(doc, userId, startDate, endDate);
    
    // Add summary section
    this.addSummary(doc, payments);
    
    // Add payment details table
    this.addPaymentTable(doc, payments);
    
    // Add footer
    this.addFooter(doc);
    
    // Finalize the PDF
    doc.end();
    
    return Buffer.concat(buffers);
  }
  
  private static addHeader(doc: PDFKit.PDFDocument, userId: string, startDate?: string, endDate?: string): void {
    // Company header (placeholder for logo)
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('Healthcare Payment System', { align: 'center' })
       .moveDown(0.5);
    
    // Report title
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('Payment History Report', { align: 'center' })
       .moveDown(0.5);
    
    // Patient information
    doc.fontSize(12)
       .font('Helvetica')
       .text(`Patient ID: ${userId}`, { align: 'left' })
       .text(`Report Generated: ${new Date().toLocaleDateString()}`, { align: 'left' });
    
    // Date range
    if (startDate && endDate) {
      doc.text(`Date Range: ${startDate} to ${endDate}`, { align: 'left' });
    } else if (startDate) {
      doc.text(`From: ${startDate}`, { align: 'left' });
    } else if (endDate) {
      doc.text(`Until: ${endDate}`, { align: 'left' });
    }
    
    doc.moveDown(1.5);
  }
  
  private static addSummary(doc: PDFKit.PDFDocument, payments: PaymentRecord[]): void {
    // Calculate summary statistics
    const totalAmount = payments.reduce((sum, p) => sum + p.payment_amount, 0);
    const completedPayments = payments.filter(p => p.payment_status === 'completed').length;
    const pendingPayments = payments.filter(p => p.payment_status === 'pending').length;
    const failedPayments = payments.filter(p => p.payment_status === 'failed').length;
    const refundedPayments = payments.filter(p => p.payment_status === 'refunded').length;
    
    // Summary box
    doc.rect(50, doc.y, 500, 80).stroke();
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Summary', 60, doc.y + 5);
    
    doc.fontSize(11)
       .font('Helvetica')
       .text(`Total Payments: ${payments.length}`, 60, doc.y + 25)
       .text(`Total Amount: $${totalAmount.toFixed(2)}`, 200, doc.y + 25)
       .text(`Completed: ${completedPayments}`, 60, doc.y + 45)
       .text(`Pending: ${pendingPayments}`, 200, doc.y + 45)
       .text(`Failed: ${failedPayments}`, 320, doc.y + 45)
       .text(`Refunded: ${refundedPayments}`, 60, doc.y + 65)
       .text(`Average: $${payments.length > 0 ? (totalAmount / payments.length).toFixed(2) : '0.00'}`, 200, doc.y + 65);
    
    doc.y += 100;
    doc.moveDown(0.5);
  }
  
  private static addPaymentTable(doc: PDFKit.PDFDocument, payments: PaymentRecord[]): void {
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Payment Details', { align: 'center' })
       .moveDown(0.5);
    
    // Table headers
    const headers = ['Date', 'Transaction ID', 'Amount', 'Status', 'Method'];
    const columnWidths = [80, 120, 80, 80, 100];
    let startX = 50;
    let startY = doc.y;
    
    // Draw header row
    doc.font('Helvetica-Bold')
       .fontSize(10);
    
    headers.forEach((header, i) => {
      doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, {
        width: columnWidths[i],
        align: 'left'
      });
    });
    
    // Draw line under headers
    doc.moveTo(startX, startY + 15)
       .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), startY + 15)
       .stroke();
    
    startY += 25;
    
    // Draw payment rows
    doc.font('Helvetica')
       .fontSize(9);
    
    payments.forEach((payment, index) => {
      // Check if we need a new page
      if (startY > 700) {
        doc.addPage();
        startY = 50;
      }
      
      const row = [
        this.formatDate(payment.payment_date),
        payment.transaction_id || 'N/A',
        `$${payment.payment_amount.toFixed(2)}`,
        this.formatStatus(payment.payment_status),
        this.formatPaymentMethod(payment.payment_method)
      ];
      
      row.forEach((cell, i) => {
        doc.text(cell, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, {
          width: columnWidths[i],
          align: 'left'
        });
      });
      
      startY += 20;
      
      // Add subtle row separator
      if (index < payments.length - 1) {
        doc.moveTo(startX, startY - 5)
           .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), startY - 5)
           .lineWidth(0.5)
           .opacity(0.3)
           .stroke()
           .opacity(1)
           .lineWidth(1);
      }
    });
  }
  
  private static addFooter(doc: PDFKit.PDFDocument): void {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Footer line
      doc.moveTo(50, 800)
         .lineTo(550, 800)
         .stroke();
      
      // Footer text
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('gray')
         .text('Generated by Healthcare Payment System', 50, 810, { align: 'left' })
         .text(`Page ${i + 1} of ${pageCount}`, 50, 810, { align: 'center' })
         .text(`Confidential - Patient Information`, 50, 810, { align: 'right' })
         .fillColor('black');
    }
  }
  
  private static formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }
  
  private static formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
  
  private static formatPaymentMethod(method: string): string {
    const methodMap: { [key: string]: string } = {
      'stripe': 'Credit/Debit Card',
      'paypal': 'PayPal',
      'crypto': 'Cryptocurrency',
      'bank-transfer': 'Bank Transfer'
    };
    return methodMap[method] || method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  }
}
