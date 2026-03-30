interface PaymentRecord {
  id: number;
  patient_id: string;
  payment_amount: number;
  payment_date: string;
  payment_method: string;
  payment_status: string;
  transaction_id?: string;
  description?: string;
  currency?: string;
  insurance_provider?: string;
  policy_number?: string;
}

export class csvGenerator {
  static generatePaymentCSV(payments: PaymentRecord[]): string {
    // UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    
    // CSV headers
    const headers = [
      'Date',
      'Transaction ID',
      'Amount',
      'Currency',
      'Status',
      'Description',
      'Payment Method',
      'Insurance Provider',
      'Policy Number'
    ];
    
    // Convert payments to CSV rows
    const rows = payments.map(payment => [
      this.formatDate(payment.payment_date),
      payment.transaction_id || '',
      this.formatAmount(payment.payment_amount),
      payment.currency || 'USD',
      this.formatStatus(payment.payment_status),
      payment.description || '',
      this.formatPaymentMethod(payment.payment_method),
      payment.insurance_provider || '',
      payment.policy_number || ''
    ]);
    
    // Build CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => this.escapeCSVField(cell)).join(','))
    ].join('\n');
    
    return BOM + csvContent;
  }
  
  private static formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
  
  private static formatAmount(amount: number): string {
    return amount.toFixed(2);
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
  
  private static escapeCSVField(field: string): string {
    // Escape fields that contain commas, quotes, or newlines
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
  
  static generateSummaryCSV(payments: PaymentRecord[]): string {
    const BOM = '\uFEFF';
    
    // Calculate summary statistics
    const totalAmount = payments.reduce((sum, p) => sum + p.payment_amount, 0);
    const completedPayments = payments.filter(p => p.payment_status === 'completed').length;
    const pendingPayments = payments.filter(p => p.payment_status === 'pending').length;
    const failedPayments = payments.filter(p => p.payment_status === 'failed').length;
    
    // Method breakdown
    const methodCounts = payments.reduce((acc, p) => {
      acc[p.payment_method] = (acc[p.payment_method] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Payments', payments.length.toString()],
      ['Total Amount', `$${totalAmount.toFixed(2)}`],
      ['Completed Payments', completedPayments.toString()],
      ['Pending Payments', pendingPayments.toString()],
      ['Failed Payments', failedPayments.toString()],
      ['Average Amount', payments.length > 0 ? `$${(totalAmount / payments.length).toFixed(2)}` : '$0.00'],
      ['', ''],
      ['Payment Method Breakdown', ''],
      ...Object.entries(methodCounts).map(([method, count]) => [
        this.formatPaymentMethod(method),
        count.toString()
      ])
    ];
    
    const csvContent = summaryData.map(row => 
      row.map(cell => this.escapeCSVField(cell)).join(',')
    ).join('\n');
    
    return BOM + csvContent;
  }
}
