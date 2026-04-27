const paypal = require('paypal-rest-sdk');
const axios = require('axios');

/**
 * PayPal Payment Service
 * Handles PayPal integration for fiat onboarding/offboarding
 */
class PayPalPaymentService {
  constructor() {
    this.paypalConfig = {
      mode: process.env.PAYPAL_MODE || 'sandbox',
      client_id: process.env.PAYPAL_CLIENT_ID,
      client_secret: process.env.PAYPAL_CLIENT_SECRET
    };

    paypal.configure(this.paypalConfig);
    
    // PayPal API endpoints
    this.apiBase = this.paypalConfig.mode === 'live' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';
  }

  /**
   * Create a PayPal payment
   */
  async createPayment({ amount, currency = 'USD', description, returnUrl, cancelUrl }) {
    return new Promise((resolve, reject) => {
      const createPaymentJson = {
        intent: 'sale',
        payer: {
          payment_method: 'paypal'
        },
        redirect_urls: {
          return_url: returnUrl,
          cancel_url: cancelUrl
        },
        transactions: [{
          item_list: {
            items: [{
              name: description || 'Payment',
              price: amount.toFixed(2),
              currency: currency,
              quantity: 1
            }]
          },
          amount: {
            currency: currency,
            total: amount.toFixed(2)
          },
          description: description || 'Payment'
        }]
      };

      paypal.payment.create(createPaymentJson, (error, payment) => {
        if (error) {
          reject(new Error(`PayPal payment creation failed: ${error.message}`));
        } else {
          const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
          
          resolve({
            success: true,
            paymentId: payment.id,
            approvalUrl: approvalUrl?.href,
            status: payment.state,
            createdAt: payment.create_time
          });
        }
      });
    });
  }

  /**
   * Execute a PayPal payment after approval
   */
  async executePayment(paymentId, payerId) {
    return new Promise((resolve, reject) => {
      const executePaymentJson = {
        payer_id: payerId
      };

      paypal.payment.execute(paymentId, executePaymentJson, (error, payment) => {
        if (error) {
          reject(new Error(`PayPal payment execution failed: ${error.message}`));
        } else {
          const transaction = payment.transactions[0];
          
          resolve({
            success: payment.state === 'approved',
            paymentId: payment.id,
            status: payment.state,
            amount: parseFloat(transaction.amount.total),
            currency: transaction.amount.currency,
            payerId: payment.payer.payer_info.payer_id,
            payerEmail: payment.payer.payer_info.email,
            payerName: `${payment.payer.payer_info.first_name} ${payment.payer.payer_info.last_name}`,
            createdAt: payment.create_time,
            updatedAt: payment.update_time
          });
        }
      });
    });
  }

  /**
   * Get payment details
   */
  async getPaymentDetails(paymentId) {
    return new Promise((resolve, reject) => {
      paypal.payment.get(paymentId, (error, payment) => {
        if (error) {
          reject(new Error(`PayPal payment retrieval failed: ${error.message}`));
        } else {
          const transaction = payment.transactions[0];
          
          resolve({
            id: payment.id,
            status: payment.state,
            amount: parseFloat(transaction.amount.total),
            currency: transaction.amount.currency,
            description: transaction.description,
            payer: payment.payer?.payer_info,
            transactions: transaction,
            links: payment.links,
            createdAt: payment.create_time,
            updatedAt: payment.update_time
          });
        }
      });
    });
  }

  /**
   * Process a refund
   */
  async processRefund(saleId, amount = null, currency = 'USD') {
    return new Promise((resolve, reject) => {
      const refundData = {
        amount: {
          total: amount ? amount.toFixed(2) : '0.00',
          currency
        }
      };

      paypal.sale.refund(saleId, refundData, (error, refund) => {
        if (error) {
          reject(new Error(`PayPal refund failed: ${error.message}`));
        } else {
          resolve({
            success: true,
            refundId: refund.id,
            status: refund.state,
            amount: parseFloat(refund.amount.total),
            currency: refund.amount.currency,
            saleId,
            createdAt: refund.create_time,
            reason: refund.reason || 'requested_by_customer'
          });
        }
      });
    });
  }

  /**
   * Create a billing agreement (subscription)
   */
  async createBillingAgreement({ name, description, amount, currency = 'USD', interval, returnUrl, cancelUrl }) {
    return new Promise((resolve, reject) => {
      const agreementDetails = {
        name,
        description,
        start_date: new Date(Date.now() + 86400000).toISOString(), // Start tomorrow
        plan: {
          payment_definitions: [{
            type: 'REGULAR',
            name: 'Regular payment',
            frequency: interval.frequency || 'Month',
            frequency_interval: interval.interval || '1',
            amount: {
              currency,
              value: amount.toFixed(2)
            },
            cycles: interval.cycles || '0', // 0 = infinite
            charge_models: [{
              type: 'TAX',
              amount: {
                currency,
                value: '0.00'
              }
            }]
          }],
          merchant_preferences: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            auto_bill_amount: 'YES',
            initial_fail_amount_action: 'CANCEL',
            max_fail_attempts: '3'
          }
        }
      };

      paypal.billingAgreement.create(agreementDetails, (error, agreement) => {
        if (error) {
          reject(new Error(`Billing agreement creation failed: ${error.message}`));
        } else {
          const approvalUrl = agreement.links.find(link => link.rel === 'approval_url');
          
          resolve({
            success: true,
            agreementId: agreement.id,
            approvalUrl: approvalUrl?.href,
            status: agreement.state
          });
        }
      });
    });
  }

  /**
   * Execute billing agreement after approval
   */
  async executeBillingAgreement(token, payerId) {
    return new Promise((resolve, reject) => {
      const agreementDetails = {
        payer_id: payerId
      };

      paypal.billingAgreement.execute(token, agreementDetails, (error, agreement) => {
        if (error) {
          reject(new Error(`Billing agreement execution failed: ${error.message}`));
        } else {
          resolve({
            success: true,
            agreementId: agreement.id,
            status: agreement.state,
            description: agreement.description,
            startDate: agreement.start_date,
            agreementDetails: agreement.agreement_details
          });
        }
      });
    });
  }

  /**
   * Cancel a billing agreement
   */
  async cancelBillingAgreement(agreementId, note = 'Cancelled by user request') {
    return new Promise((resolve, reject) => {
      const cancelNote = {
        note
      };

      paypal.billingAgreement.cancel(agreementId, cancelNote, (error) => {
        if (error) {
          reject(new Error(`Billing agreement cancellation failed: ${error.message}`));
        } else {
          resolve({
            success: true,
            agreementId,
            message: 'Billing agreement cancelled successfully'
          });
        }
      });
    });
  }

  /**
   * Get billing agreement details
   */
  async getBillingAgreementDetails(agreementId) {
    return new Promise((resolve, reject) => {
      paypal.billingAgreement.get(agreementId, (error, agreement) => {
        if (error) {
          reject(new Error(`Billing agreement retrieval failed: ${error.message}`));
        } else {
          resolve({
            id: agreement.id,
            status: agreement.state,
            description: agreement.description,
            startDate: agreement.start_date,
            agreementDetails: agreement.agreement_details,
            payer: agreement.payer
          });
        }
      });
    });
  }

  /**
   * Generate access token for REST API calls
   */
  async getAccessToken() {
    try {
      const response = await axios.post(
        `${this.apiBase}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: {
            username: this.paypalConfig.client_id,
            password: this.paypalConfig.client_secret
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        scope: response.data.scope
      };
    } catch (error) {
      throw new Error(`Access token generation failed: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature (for PayPal notifications)
   */
  async verifyWebhook(webhookEvent, transmissionId, transmissionTime, certUrl, actualSignature) {
    try {
      const accessToken = await this.getAccessToken();
      
      const verificationData = {
        auth_algo: 'SHA256withRSA',
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: actualSignature,
        transmission_time: transmissionTime,
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: webhookEvent
      };

      const response = await axios.post(
        `${this.apiBase}/v1/notifications/verify-webhook-signature`,
        verificationData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken.accessToken}`
          }
        }
      );

      return {
        success: response.data.verification_status === 'SUCCESS',
        status: response.data.verification_status
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List payments with filtering
   */
  async listPayments(params = {}) {
    try {
      const accessToken = await this.getAccessToken();
      
      const queryParams = new URLSearchParams({
        page_size: params.pageSize || '10',
        page: params.page || '1',
        ...(params.startDate && { start_date: params.startDate }),
        ...(params.endDate && { end_date: params.endDate }),
        ...(params.sortBy && { sort_by: params.sortBy }),
        ...(params.sortOrder && { sort_order: params.sortOrder })
      });

      const response = await axios.get(
        `${this.apiBase}/v1/payments/payment?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken.accessToken}`
          }
        }
      );

      return {
        success: true,
        payments: response.data.payments.map(payment => ({
          id: payment.id,
          status: payment.state,
          amount: parseFloat(payment.transactions[0]?.amount.total || 0),
          currency: payment.transactions[0]?.amount.currency,
          createdAt: payment.create_time,
          updatedAt: payment.update_time
        })),
        count: response.data.count,
        nextId: response.data.next_id
      };
    } catch (error) {
      throw new Error(`Payment listing failed: ${error.message}`);
    }
  }
}

module.exports = { PayPalPaymentService };
