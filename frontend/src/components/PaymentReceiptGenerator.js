import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, CheckCircle, AlertCircle, 
  RefreshCw, Calendar, DollarSign, User, Mail,
  Phone, MapPin, CreditCard, Clock, Filter,
  Search, ChevronDown, X, Info, Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PaymentReceiptGenerator = ({ paymentId, onClose, onReceiptGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);

  useEffect(() => {
    if (paymentId) {
      fetchPaymentDetails();
    }
  }, [paymentId]);

  const fetchPaymentDetails = async () => {
    try {
      const response = await fetch(`/api/payments/${paymentId}`);
      const data = await response.json();
      
      if (data.success) {
        setPaymentDetails(data.payment);
      } else {
        setError('Payment not found');
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
      setError('Failed to fetch payment details');
    }
  };

  const generateReceipt = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/receipts/generate/${paymentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'current-user' // Would come from auth context
        }),
      });

      const data = await response.json();

      if (data.success) {
        setReceiptData(data.receipt);
        onReceiptGenerated && onReceiptGenerated(data.receipt);
      } else {
        setError(data.error || 'Failed to generate receipt');
      }
    } catch (error) {
      console.error('Error generating receipt:', error);
      setError('Failed to generate receipt');
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async () => {
    if (!receiptData) return;

    try {
      const response = await fetch(receiptData.downloadUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = receiptData.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      setError('Failed to download receipt');
    }
  };

  const previewReceipt = () => {
    setShowPreview(true);
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{error}</span>
        </div>
        <button
          onClick={() => setError(null)}
          className="mt-3 text-sm text-red-600 hover:text-red-800"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Payment Receipt</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Payment Details */}
      {paymentDetails && (
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Amount:</span>
                <span className="font-semibold text-gray-900">
                  ${parseFloat(paymentDetails.payment_amount).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Date:</span>
                <span className="text-gray-900">
                  {new Date(paymentDetails.payment_date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Method:</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  {paymentDetails.payment_method}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">Transaction ID:</span>
                <span className="text-gray-900 font-mono text-xs">
                  {paymentDetails.transaction_id}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">Status:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {paymentDetails.payment_status}
                </span>
              </div>
              {paymentDetails.memo && (
                <div className="flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">Memo:</span>
                  <span className="text-gray-900">{paymentDetails.memo}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-6">
        {!receiptData ? (
          <div className="text-center">
            <button
              onClick={generateReceipt}
              disabled={loading || !paymentDetails?.payment_status === 'completed'}
              className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating Receipt...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Generate Receipt
                </>
              )}
            </button>
            {paymentDetails?.payment_status !== 'completed' && (
              <p className="mt-3 text-sm text-gray-500">
                Receipts can only be generated for completed payments
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="text-green-800 font-medium">Receipt Generated Successfully</p>
                <p className="text-green-600 text-sm">
                  Receipt ID: {receiptData.receiptId}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadReceipt}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Download className="w-4 h-4" />
                Download Receipt
              </button>
              <button
                onClick={previewReceipt}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                <FileText className="w-4 h-4" />
                Preview
              </button>
            </div>

            <div className="text-sm text-gray-500">
              <p>Generated: {new Date(receiptData.generatedAt).toLocaleString()}</p>
              <p>File: {receiptData.fileName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Receipt Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto">
                <div className="bg-gray-50 rounded-lg p-8">
                  {/* Receipt Preview Content */}
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-blue-600 mb-2">
                      Healthcare Provider Portal
                    </h2>
                    <div className="text-sm text-gray-600">
                      123 Healthcare Avenue, Medical City, MC 12345
                    </div>
                  </div>
                  
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-bold uppercase">Payment Receipt</h3>
                    <div className="text-sm text-gray-600 mt-2">
                      Receipt #: {receiptData?.receiptId || 'N/A'}
                    </div>
                  </div>

                  {paymentDetails && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-600">Transaction ID:</div>
                          <div className="font-medium">{paymentDetails.transaction_id}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Payment Date:</div>
                          <div className="font-medium">
                            {new Date(paymentDetails.payment_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Amount:</div>
                          <div className="font-medium text-lg text-blue-600">
                            ${parseFloat(paymentDetails.payment_amount).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Method:</div>
                          <div className="font-medium">{paymentDetails.payment_method}</div>
                        </div>
                      </div>

                      {paymentDetails.memo && (
                        <div className="bg-yellow-50 p-3 rounded-lg">
                          <div className="text-sm font-medium text-yellow-800">Memo:</div>
                          <div className="text-yellow-700">{paymentDetails.memo}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
                    <p>This is an automatically generated receipt for your records.</p>
                    <p>Generated on {new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Close
                </button>
                <button
                  onClick={downloadReceipt}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Download className="w-4 h-4 inline mr-2" />
                  Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PaymentReceiptGenerator;
