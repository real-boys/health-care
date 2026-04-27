const Stripe = require('stripe');

/**
 * Stripe Payment Service
 * Handles Stripe integration for fiat onboarding/offboarding
 */
class StripePaymentService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_default');
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent({ amount, currency = 'usd', metadata = {}, customer }) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          ...metadata,
          integration_check: 'accept_a_payment'
        },
        automatic_payment_methods: {
          enabled: true
        },
        customer
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        status: paymentIntent.status
      };
    } catch (error) {
      throw new Error(`Stripe payment intent creation failed: ${error.message}`);
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        success: paymentIntent.status === 'succeeded',
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        charges: paymentIntent.charges.data.map(charge => ({
          id: charge.id,
          amount: charge.amount / 100,
          status: charge.status,
          paymentMethod: charge.payment_method_details?.type
        }))
      };
    } catch (error) {
      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  /**
   * Process a refund
   */
  async processRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refundParams = {
        payment_intent: paymentIntentId,
        reason
      };

      if (amount) {
        refundParams.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        reason: refund.reason,
        createdAt: new Date(refund.created * 1000).toISOString()
      };
    } catch (error) {
      throw new Error(`Refund processing failed: ${error.message}`);
    }
  }

  /**
   * Create or retrieve a customer
   */
  async createOrRetrieveCustomer(email, metadata = {}) {
    try {
      // Check if customer exists
      const existingCustomers = await this.stripe.customers.list({ email, limit: 1 });
      
      if (existingCustomers.data.length > 0) {
        return {
          success: true,
          customerId: existingCustomers.data[0].id,
          email: existingCustomers.data[0].email,
          isNew: false
        };
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email,
        metadata
      });

      return {
        success: true,
        customerId: customer.id,
        email: customer.email,
        isNew: true
      };
    } catch (error) {
      throw new Error(`Customer management failed: ${error.message}`);
    }
  }

  /**
   * Setup payment method for future use
   */
  async setupPaymentMethod(customerId, paymentMethodId) {
    try {
      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      // Set as default payment method
      await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      return {
        success: true,
        paymentMethodId,
        customerId
      };
    } catch (error) {
      throw new Error(`Payment method setup failed: ${error.message}`);
    }
  }

  /**
   * Create subscription for recurring payments
   */
  async createSubscription(customerId, priceId, trialDays = 0) {
    try {
      const subscriptionParams = {
        customer: customerId,
        items: [{ price: priceId }]
      };

      if (trialDays > 0) {
        subscriptionParams.trial_period_days = trialDays;
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      return {
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
      };
    } catch (error) {
      throw new Error(`Subscription creation failed: ${error.message}`);
    }
  }

  /**
   * Get payment method details
   */
  async getPaymentMethod(paymentMethodId) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      
      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding,
          country: paymentMethod.card.country
        } : null,
        billingDetails: paymentMethod.billing_details
      };
    } catch (error) {
      throw new Error(`Payment method retrieval failed: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
      return { success: true, event };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get balance information
   */
  async getBalance() {
    try {
      const balance = await this.stripe.balance.retrieve();
      
      return {
        available: balance.available.map(b => ({
          amount: b.amount / 100,
          currency: b.currency
        })),
        pending: balance.pending.map(b => ({
          amount: b.amount / 100,
          currency: b.currency
        }))
      };
    } catch (error) {
      throw new Error(`Balance retrieval failed: ${error.message}`);
    }
  }

  /**
   * List charges for a customer or payment intent
   */
  async listCharges(params = {}) {
    try {
      const charges = await this.stripe.charges.list(params);
      
      return {
        charges: charges.data.map(charge => ({
          id: charge.id,
          amount: charge.amount / 100,
          currency: charge.currency,
          status: charge.status,
          description: charge.description,
          createdAt: new Date(charge.created * 1000).toISOString(),
          paid: charge.paid,
          refunded: charge.refunded,
          receiptUrl: charge.receipt_url
        })),
        hasMore: charges.has_more
      };
    } catch (error) {
      throw new Error(`Charge listing failed: ${error.message}`);
    }
  }
}

module.exports = { StripePaymentService };
