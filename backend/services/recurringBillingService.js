const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

class RecurringBillingService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      console.log('✅ Recurring Billing Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Recurring Billing Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, err => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for recurring billing');
          resolve();
        }
      });
    });
  }

  /**
   * Create or retrieve Stripe customer
   * @param {number} customerId - Customer ID in database
   * @param {object} customerData - Customer data
   */
  async createOrRetrieveStripeCustomer(customerId, customerData) {
    try {
      // Check if customer already has Stripe ID
      const customer = await this.getCustomerById(customerId);

      if (customer && customer.stripe_customer_id) {
        // Retrieve existing Stripe customer
        const stripeCustomer = await stripe.customers.retrieve(customer.stripe_customer_id);
        return { customer: stripeCustomer, isNew: false };
      }

      // Create new Stripe customer
      const stripeCustomer = await stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address
          ? {
              line1: customerData.address.line1,
              line2: customerData.address.line2,
              city: customerData.address.city,
              state: customerData.address.state,
              postal_code: customerData.address.postalCode,
              country: customerData.address.country,
            }
          : undefined,
        metadata: {
          customer_id: customerId.toString(),
        },
      });

      // Update customer record with Stripe ID
      await this.updateCustomerStripeId(customerId, stripeCustomer.id);

      return { customer: stripeCustomer, isNew: true };
    } catch (error) {
      console.error('Error creating/retrieving Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create subscription with Stripe
   * @param {number} customerId - Customer ID
   * @param {number} planId - Plan ID
   * @param {object} subscriptionOptions - Subscription options
   */
  async createSubscription(customerId, planId, subscriptionOptions = {}) {
    try {
      const {
        paymentMethodId,
        trialDays,
        discountCode,
        addOns = [],
        metadata = {},
      } = subscriptionOptions;

      // Get plan details
      const plan = await this.getPlanById(planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Get customer
      const customer = await this.getCustomerById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Create or retrieve Stripe customer
      const stripeCustomer = await this.createOrRetrieveStripeCustomer(customerId, customer);

      // Attach payment method if provided
      if (paymentMethodId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomer.customer.id,
        });

        // Set as default payment method
        await stripe.customers.update(stripeCustomer.customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      // Create Stripe price if not exists
      const stripePrice = await this.createOrUpdateStripePrice(plan);

      // Prepare subscription items
      const subscriptionItems = [
        {
          price: stripePrice.id,
          quantity: 1,
        },
      ];

      // Add add-ons
      for (const addOn of addOns) {
        const addOnPlan = await this.getAddOnById(addOn.id);
        if (addOnPlan) {
          const addOnPrice = await this.createOrUpdateStripePrice(addOnPlan, 'addon');
          subscriptionItems.push({
            price: addOnPrice.id,
            quantity: addOn.quantity || 1,
          });
        }
      }

      // Apply discount if provided
      let couponId = null;
      if (discountCode) {
        couponId = await this.applyDiscountCode(discountCode, customerId);
      }

      // Create Stripe subscription
      const stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomer.customer.id,
        items: subscriptionItems,
        trial_period_days: trialDays || plan.trial_days,
        coupon: couponId,
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          customer_id: customerId.toString(),
          plan_id: planId.toString(),
          ...metadata,
        },
      });

      // Create local subscription record
      const localSubscription = await this.createLocalSubscription({
        customerId,
        planId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.customer.id,
        stripePriceId: stripePrice.id,
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billing_cycle,
        metadata,
      });

      // Create subscription items
      for (const [index, item] of stripeSubscription.items.entries()) {
        if (index > 0) {
          // Skip the main plan item (index 0)
          await this.createSubscriptionItem(localSubscription.id, {
            planId: addOns[index - 1].id,
            stripeSubscriptionItemId: item.id,
            stripePriceId: item.price.id,
            quantity: item.quantity,
            price: addOns[index - 1].price || 0,
          });
        }
      }

      // Log subscription creation
      await this.logSubscriptionEvent(localSubscription.id, 'created', {
        stripeSubscriptionId: stripeSubscription.id,
        planId,
        customerId,
        trialDays,
      });

      return {
        subscription: localSubscription,
        stripeSubscription,
        clientSecret: stripeSubscription.latest_invoice.payment_intent.client_secret,
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Create or update Stripe price
   * @param {object} plan - Plan data
   * @param {string} type - Price type ('plan' or 'addon')
   */
  async createOrUpdateStripePrice(plan, type = 'plan') {
    try {
      const priceData = {
        currency: plan.currency.toLowerCase(),
        unit_amount: Math.round(plan.price * 100), // Convert to cents
        recurring: {
          interval: plan.billing_cycle === 'yearly' ? 'year' : 'month',
        },
        product_data: {
          name: plan.display_name,
          description: plan.description,
          metadata: {
            plan_id: plan.id.toString(),
            type: type,
          },
        },
      };

      // Check if price already exists
      const existingPrices = await stripe.prices.list({
        product: { metadata: { plan_id: plan.id.toString(), type } },
        active: true,
      });

      if (existingPrices.data.length > 0) {
        // Return existing price
        return existingPrices.data[0];
      }

      // Create new price
      const price = await stripe.prices.create(priceData);
      return price;
    } catch (error) {
      console.error('Error creating Stripe price:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {object} updateData - Update data
   */
  async updateSubscription(subscriptionId, updateData) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const { planId, quantity, addOns = [], prorationBehavior = 'create_prorations' } = updateData;

      let stripeSubscription;
      const updateParams = {
        proration_behavior,
        metadata: updateData.metadata,
      };

      if (planId) {
        // Plan change
        const newPlan = await this.getPlanById(planId);
        const newPrice = await this.createOrUpdateStripePrice(newPlan);

        updateParams.items = [
          {
            id: subscription.stripe_subscription_item_id,
            price: newPrice.id,
            quantity: quantity || 1,
          },
        ];

        stripeSubscription = await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          updateParams
        );

        // Update local subscription
        await this.updateLocalSubscription(subscriptionId, {
          planId,
          stripePriceId: newPrice.id,
          price: newPlan.price,
          billingCycle: newPlan.billing_cycle,
        });
      } else if (quantity) {
        // Quantity update
        updateParams.items = [
          {
            id: subscription.stripe_subscription_item_id,
            quantity,
          },
        ];

        stripeSubscription = await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          updateParams
        );
      }

      // Handle add-ons
      if (addOns.length > 0) {
        await this.updateSubscriptionAddOns(subscriptionId, addOns);
      }

      // Log subscription update
      await this.logSubscriptionEvent(subscriptionId, 'updated', updateData);

      return {
        subscription: await this.getSubscriptionById(subscriptionId),
        stripeSubscription,
      };
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {object} cancelOptions - Cancellation options
   */
  async cancelSubscription(subscriptionId, cancelOptions = {}) {
    try {
      const { atPeriodEnd = true, reason = '', immediate = false } = cancelOptions;

      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      let stripeSubscription;

      if (immediate) {
        // Immediate cancellation
        stripeSubscription = await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        await this.updateLocalSubscription(subscriptionId, {
          status: 'canceled',
          canceledAt: new Date(),
          cancellationReason: reason,
        });
      } else {
        // Cancel at period end
        stripeSubscription = await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          {
            cancel_at_period_end: true,
          }
        );

        await this.updateLocalSubscription(subscriptionId, {
          cancelAtPeriodEnd: true,
          cancellationReason: reason,
        });
      }

      // Log subscription cancellation
      await this.logSubscriptionEvent(subscriptionId, 'canceled', {
        atPeriodEnd,
        reason,
        immediate,
      });

      return {
        subscription: await this.getSubscriptionById(subscriptionId),
        stripeSubscription,
      };
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Reactivate subscription
   * @param {number} subscriptionId - Subscription ID
   */
  async reactivateSubscription(subscriptionId) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (!subscription.cancel_at_period_end) {
        throw new Error('Subscription is not scheduled for cancellation');
      }

      // Reactivate in Stripe
      const stripeSubscription = await stripe.subscriptions.update(
        subscription.stripe_subscription_id,
        {
          cancel_at_period_end: false,
        }
      );

      // Update local subscription
      await this.updateLocalSubscription(subscriptionId, {
        cancelAtPeriodEnd: false,
        canceledAt: null,
        cancellationReason: null,
      });

      // Log reactivation
      await this.logSubscriptionEvent(subscriptionId, 'reactivated', {});

      return {
        subscription: await this.getSubscriptionById(subscriptionId),
        stripeSubscription,
      };
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw error;
    }
  }

  /**
   * Process payment for subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {object} paymentData - Payment data
   */
  async processSubscriptionPayment(subscriptionId, paymentData) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Create invoice
      const invoice = await stripe.invoices.create({
        customer: subscription.stripe_customer_id,
        subscription: subscription.stripe_subscription_id,
        metadata: {
          subscription_id: subscriptionId.toString(),
        },
      });

      // Finalize invoice
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

      // Create local invoice record
      const localInvoice = await this.createLocalInvoice({
        subscriptionId,
        customerId: subscription.customer_id,
        stripeInvoiceId: finalizedInvoice.id,
        invoiceNumber: finalizedInvoice.number,
        status: finalizedInvoice.status,
        currency: finalizedInvoice.currency,
        subtotal: finalizedInvoice.subtotal / 100,
        taxAmount: finalizedInvoice.tax / 100,
        totalAmount: finalizedInvoice.total / 100,
        amountDue: finalizedInvoice.amount_due / 100,
        periodStart: new Date(finalizedInvoice.period_start * 1000),
        periodEnd: new Date(finalizedInvoice.period_end * 1000),
        dueDate: new Date(finalizedInvoice.due_date * 1000),
        lineItems: finalizedInvoice.lines.data.map(line => ({
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unit_amount / 100,
          amount: line.amount / 100,
        })),
      });

      // Process payment if invoice is not paid
      let paymentResult = null;
      if (finalizedInvoice.status === 'open') {
        paymentResult = await this.processInvoicePayment(finalizedInvoice.id, paymentData);
      }

      return {
        invoice: localInvoice,
        stripeInvoice: finalizedInvoice,
        paymentResult,
      };
    } catch (error) {
      console.error('Error processing subscription payment:', error);
      throw error;
    }
  }

  /**
   * Process invoice payment
   * @param {string} invoiceId - Stripe invoice ID
   * @param {object} paymentData - Payment data
   */
  async processInvoicePayment(invoiceId, paymentData) {
    try {
      const { paymentMethodId } = paymentData;

      // Retrieve invoice
      const invoice = await stripe.invoices.retrieve(invoiceId);

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: invoice.amount_due,
        currency: invoice.currency,
        customer: invoice.customer,
        payment_method: paymentMethodId,
        confirm: true,
        metadata: {
          invoice_id: invoiceId,
        },
      });

      // Create local payment record
      const localPayment = await this.createLocalPayment({
        invoiceId,
        subscriptionId: invoice.subscription,
        customerId: invoice.customer,
        amount: invoice.amount_due / 100,
        currency: invoice.currency,
        status: paymentIntent.status,
        paymentMethod: 'card',
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: paymentIntent.charges.data[0]?.id,
      });

      return {
        payment: localPayment,
        paymentIntent,
      };
    } catch (error) {
      console.error('Error processing invoice payment:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   * @param {string} invoiceId - Invoice ID
   * @param {object} failureData - Failure data
   */
  async handleFailedPayment(invoiceId, failureData) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      const subscription = await this.getSubscriptionByStripeId(invoice.subscription);

      // Create local payment record
      const localPayment = await this.createLocalPayment({
        invoiceId,
        subscriptionId: subscription.id,
        customerId: invoice.customer,
        amount: invoice.amount_due / 100,
        currency: invoice.currency,
        status: 'failed',
        paymentMethod: failureData.paymentMethod || 'card',
        failureCode: failureData.code,
        failureMessage: failureData.message,
        nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Retry in 24 hours
      });

      // Update subscription status
      await this.updateLocalSubscription(subscription.id, {
        status: 'past_due',
      });

      // Initiate dunning process
      await this.initiateDunning(subscription.id, localPayment.id);

      // Log failed payment
      await this.logSubscriptionEvent(subscription.id, 'payment_failed', {
        invoiceId,
        paymentId: localPayment.id,
        failureCode: failureData.code,
      });

      return {
        payment: localPayment,
        subscription: await this.getSubscriptionById(subscription.id),
      };
    } catch (error) {
      console.error('Error handling failed payment:', error);
      throw error;
    }
  }

  /**
   * Initiate dunning process
   * @param {number} subscriptionId - Subscription ID
   * @param {number} paymentId - Payment ID
   */
  async initiateDunning(subscriptionId, paymentId) {
    try {
      // Get active dunning campaign
      const campaign = await this.getActiveDunningCampaign();

      if (!campaign) {
        console.log('No active dunning campaign found');
        return null;
      }

      // Create dunning instance
      const dunningInstance = await this.createDunningInstance({
        campaignId: campaign.id,
        subscriptionId,
        paymentId,
        status: 'pending',
        startedAt: new Date(),
        nextActionAt: new Date(Date.now() + campaign.delay_hours * 60 * 60 * 1000),
      });

      // Process first dunning step
      await this.processDunningStep(dunningInstance.id);

      return dunningInstance;
    } catch (error) {
      console.error('Error initiating dunning:', error);
      throw error;
    }
  }

  /**
   * Process dunning step
   * @param {number} dunningInstanceId - Dunning instance ID
   */
  async processDunningStep(dunningInstanceId) {
    try {
      const instance = await this.getDunningInstance(dunningInstanceId);
      const campaign = await this.getDunningCampaign(instance.campaign_id);
      const steps = JSON.parse(campaign.steps);

      if (instance.current_step >= steps.length) {
        // Dunning process completed
        await this.updateDunningInstance(dunningInstanceId, {
          status: 'completed',
          completedAt: new Date(),
        });
        return;
      }

      const currentStep = steps[instance.current_step];

      // Execute step action
      await this.executeDunningStepAction(instance, currentStep);

      // Update instance
      const nextStep = instance.current_step + 1;
      const nextActionAt =
        nextStep < steps.length
          ? new Date(Date.now() + steps[nextStep].delay_hours * 60 * 60 * 1000)
          : null;

      await this.updateDunningInstance(dunningInstanceId, {
        currentStep: nextStep,
        nextActionAt,
        status: 'in_progress',
      });
    } catch (error) {
      console.error('Error processing dunning step:', error);
      throw error;
    }
  }

  /**
   * Execute dunning step action
   * @param {object} instance - Dunning instance
   * @param {object} step - Step configuration
   */
  async executeDunningStepAction(instance, step) {
    try {
      const subscription = await this.getSubscriptionById(instance.subscription_id);
      const customer = await this.getCustomerById(subscription.customer_id);

      switch (step.action) {
        case 'email':
          await this.sendDunningEmail(customer, subscription, step.template);
          await this.incrementDunningCommunication(instance.id, 'email');
          break;
        case 'sms':
          await this.sendDunningSMS(customer, subscription, step.template);
          await this.incrementDunningCommunication(instance.id, 'sms');
          break;
        case 'cancel_subscription':
          await this.cancelSubscription(instance.subscription_id, {
            immediate: true,
            reason: 'Failed payment - dunning process',
          });
          await this.updateDunningInstance(instance.id, {
            subscriptionCancelled: true,
            status: 'completed',
          });
          break;
        default:
          console.log(`Unknown dunning action: ${step.action}`);
      }
    } catch (error) {
      console.error('Error executing dunning step action:', error);
      throw error;
    }
  }

  /**
   * Send dunning email
   * @param {object} customer - Customer data
   * @param {object} subscription - Subscription data
   * @param {string} template - Email template
   */
  async sendDunningEmail(customer, subscription, template) {
    // This would integrate with your email service
    console.log(`Sending dunning email to ${customer.email} using template: ${template}`);

    // Example email content
    const emailContent = {
      to: customer.email,
      subject: 'Payment Required - Action Needed',
      template: template,
      data: {
        customerName: customer.name,
        planName: subscription.plan_name,
        amountDue: subscription.price,
        dueDate: subscription.current_period_end,
      },
    };

    // Send email using your email service
    // await emailService.sendTemplate(emailContent);
  }

  /**
   * Send dunning SMS
   * @param {object} customer - Customer data
   * @param {object} subscription - Subscription data
   * @param {string} template - SMS template
   */
  async sendDunningSMS(customer, subscription, template) {
    // This would integrate with your SMS service
    console.log(`Sending dunning SMS to ${customer.phone} using template: ${template}`);

    // Example SMS content
    const smsContent = {
      to: customer.phone,
      template: template,
      data: {
        customerName: customer.name,
        planName: subscription.plan_name,
        amountDue: subscription.price,
      },
    };

    // Send SMS using your SMS service
    // await smsService.sendTemplate(smsContent);
  }

  /**
   * Handle webhook from Stripe
   * @param {string} payload - Webhook payload
   * @param {string} signature - Webhook signature
   */
  async handleWebhook(payload, signature) {
    try {
      // Verify webhook signature
      const event = stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);

      // Process event
      await this.processStripeEvent(event);

      return { received: true };
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Process Stripe event
   * @param {object} event - Stripe event
   */
  async processStripeEvent(event) {
    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.created':
          await this.handleInvoiceCreated(event.data.object);
          break;
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Log event
      await this.logStripeEvent(event);
    } catch (error) {
      console.error('Error processing Stripe event:', error);
      throw error;
    }
  }

  /**
   * Handle invoice payment succeeded event
   * @param {object} invoice - Stripe invoice
   */
  async handleInvoicePaymentSucceeded(invoice) {
    try {
      const subscription = await this.getSubscriptionByStripeId(invoice.subscription);

      if (subscription) {
        // Update local invoice
        await this.updateLocalInvoiceByStripeId(invoice.id, {
          status: 'paid',
          paidAt: new Date(invoice.status_transitions.paid_at * 1000),
          amountPaid: invoice.amount_paid / 100,
        });

        // Update local payment
        await this.updateLocalPaymentByStripeChargeId(invoice.charge, {
          status: 'succeeded',
          completedAt: new Date(),
        });

        // Update subscription status
        await this.updateLocalSubscription(subscription.id, {
          status: 'active',
        });

        // Log successful payment
        await this.logSubscriptionEvent(subscription.id, 'payment_succeeded', {
          invoiceId: invoice.id,
        });
      }
    } catch (error) {
      console.error('Error handling invoice payment succeeded:', error);
    }
  }

  /**
   * Handle invoice payment failed event
   * @param {object} invoice - Stripe invoice
   */
  async handleInvoicePaymentFailed(invoice) {
    try {
      const subscription = await this.getSubscriptionByStripeId(invoice.subscription);

      if (subscription) {
        // Update local invoice
        await this.updateLocalInvoiceByStripeId(invoice.id, {
          status: 'open',
          amountDue: invoice.amount_due / 100,
        });

        // Handle failed payment
        await this.handleFailedPayment(invoice.id, {
          code: invoice.last_finalization_error?.code,
          message: invoice.last_finalization_error?.message,
        });
      }
    } catch (error) {
      console.error('Error handling invoice payment failed:', error);
    }
  }

  /**
   * Handle subscription created event
   * @param {object} stripeSubscription - Stripe subscription
   */
  async handleSubscriptionCreated(stripeSubscription) {
    try {
      const localSubscription = await this.getSubscriptionByStripeId(stripeSubscription.id);

      if (!localSubscription) {
        // Create local subscription if it doesn't exist
        const customerId = await this.getCustomerIdByStripeId(stripeSubscription.customer);
        const planId = await this.getPlanIdByStripePrice(stripeSubscription.items.data[0].price.id);

        if (customerId && planId) {
          await this.createLocalSubscription({
            customerId,
            planId,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId: stripeSubscription.customer,
            stripePriceId: stripeSubscription.items.data[0].price.id,
            status: stripeSubscription.status,
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            trialStart: stripeSubscription.trial_start
              ? new Date(stripeSubscription.trial_start * 1000)
              : null,
            trialEnd: stripeSubscription.trial_end
              ? new Date(stripeSubscription.trial_end * 1000)
              : null,
            price: stripeSubscription.items.data[0].price.unit_amount / 100,
            currency: stripeSubscription.items.data[0].price.currency,
            billingCycle: stripeSubscription.items.data[0].price.recurring.interval,
          });
        }
      }
    } catch (error) {
      console.error('Error handling subscription created:', error);
    }
  }

  /**
   * Handle subscription updated event
   * @param {object} stripeSubscription - Stripe subscription
   */
  async handleSubscriptionUpdated(stripeSubscription) {
    try {
      const localSubscription = await this.getSubscriptionByStripeId(stripeSubscription.id);

      if (localSubscription) {
        await this.updateLocalSubscription(localSubscription.id, {
          status: stripeSubscription.status,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        });
      }
    } catch (error) {
      console.error('Error handling subscription updated:', error);
    }
  }

  /**
   * Handle subscription deleted event
   * @param {object} stripeSubscription - Stripe subscription
   */
  async handleSubscriptionDeleted(stripeSubscription) {
    try {
      const localSubscription = await this.getSubscriptionByStripeId(stripeSubscription.id);

      if (localSubscription) {
        await this.updateLocalSubscription(localSubscription.id, {
          status: 'canceled',
          canceledAt: new Date(),
        });

        await this.logSubscriptionEvent(localSubscription.id, 'deleted', {
          stripeSubscriptionId: stripeSubscription.id,
        });
      }
    } catch (error) {
      console.error('Error handling subscription deleted:', error);
    }
  }

  /**
   * Handle invoice created event
   * @param {object} invoice - Stripe invoice
   */
  async handleInvoiceCreated(invoice) {
    try {
      const subscription = await this.getSubscriptionByStripeId(invoice.subscription);

      if (subscription) {
        await this.createLocalInvoice({
          subscriptionId: subscription.id,
          customerId: subscription.customer_id,
          stripeInvoiceId: invoice.id,
          invoiceNumber: invoice.number,
          status: invoice.status,
          currency: invoice.currency,
          subtotal: invoice.subtotal / 100,
          taxAmount: invoice.tax / 100,
          totalAmount: invoice.total / 100,
          amountDue: invoice.amount_due / 100,
          periodStart: new Date(invoice.period_start * 1000),
          periodEnd: new Date(invoice.period_end * 1000),
          dueDate: new Date(invoice.due_date * 1000),
          lineItems: invoice.lines.data.map(line => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unit_amount / 100,
            amount: line.amount / 100,
          })),
        });
      }
    } catch (error) {
      console.error('Error handling invoice created:', error);
    }
  }

  /**
   * Handle payment intent succeeded event
   * @param {object} paymentIntent - Stripe payment intent
   */
  async handlePaymentIntentSucceeded(paymentIntent) {
    try {
      await this.updateLocalPaymentByStripePaymentIntentId(paymentIntent.id, {
        status: 'succeeded',
        completedAt: new Date(),
        stripeChargeId: paymentIntent.charges.data[0]?.id,
      });
    } catch (error) {
      console.error('Error handling payment intent succeeded:', error);
    }
  }

  /**
   * Handle payment intent failed event
   * @param {object} paymentIntent - Stripe payment intent
   */
  async handlePaymentIntentFailed(paymentIntent) {
    try {
      await this.updateLocalPaymentByStripePaymentIntentId(paymentIntent.id, {
        status: 'failed',
        failureCode: paymentIntent.last_payment_error?.code,
        failureMessage: paymentIntent.last_payment_error?.message,
        nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      console.error('Error handling payment intent failed:', error);
    }
  }

  // Database helper methods
  async getCustomerById(customerId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM customers WHERE id = ?';
      this.db.get(query, [customerId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async updateCustomerStripeId(customerId, stripeCustomerId) {
    return new Promise((resolve, reject) => {
      const query =
        'UPDATE customers SET stripe_customer_id = ?, updated_at = datetime("now") WHERE id = ?';
      this.db.run(query, [stripeCustomerId, customerId], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async getPlanById(planId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM subscription_plans WHERE id = ? AND is_active = true';
      this.db.get(query, [planId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAddOnById(addOnId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM subscription_add_ons WHERE id = ? AND is_active = true';
      this.db.get(query, [addOnId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createLocalSubscription(subscriptionData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscriptions (
          customer_id, plan_id, stripe_subscription_id, stripe_customer_id, stripe_price_id,
          status, current_period_start, current_period_end, trial_start, trial_end,
          price, currency, billing_cycle, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))
      `;

      this.db.run(
        query,
        [
          subscriptionData.customerId,
          subscriptionData.planId,
          subscriptionData.stripeSubscriptionId,
          subscriptionData.stripeCustomerId,
          subscriptionData.stripePriceId,
          subscriptionData.status,
          subscriptionData.currentPeriodStart.toISOString(),
          subscriptionData.currentPeriodEnd.toISOString(),
          subscriptionData.trialStart?.toISOString(),
          subscriptionData.trialEnd?.toISOString(),
          subscriptionData.price,
          subscriptionData.currency,
          subscriptionData.billingCycle,
          JSON.stringify(subscriptionData.metadata),
        ],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...subscriptionData });
        }
      );
    });
  }

  async updateLocalSubscription(subscriptionId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];

      Object.keys(updateData).forEach(key => {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(updateData[key]);
        }
      });

      if (fields.length === 0) {
        resolve(0);
        return;
      }

      fields.push('updated_at = datetime("now")');
      params.push(subscriptionId);

      const query = `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ?`;

      this.db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async getSubscriptionById(subscriptionId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, c.email as customer_email, c.name as customer_name,
               sp.display_name as plan_name, sp.name as plan_name_key
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.id = ?
      `;

      this.db.get(query, [subscriptionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getSubscriptionByStripeId(stripeSubscriptionId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, c.email as customer_email, c.name as customer_name,
               sp.display_name as plan_name, sp.name as plan_name_key
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.stripe_subscription_id = ?
      `;

      this.db.get(query, [stripeSubscriptionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createLocalInvoice(invoiceData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_invoices (
          subscription_id, customer_id, stripe_invoice_id, invoice_number, status,
          currency, subtotal, tax_amount, total_amount, amount_due,
          period_start, period_end, due_date, line_items, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))
      `;

      this.db.run(
        query,
        [
          invoiceData.subscriptionId,
          invoiceData.customerId,
          invoiceData.stripeInvoiceId,
          invoiceData.invoiceNumber,
          invoiceData.status,
          invoiceData.currency,
          invoiceData.subtotal,
          invoiceData.taxAmount,
          invoiceData.totalAmount,
          invoiceData.amountDue,
          invoiceData.periodStart.toISOString(),
          invoiceData.periodEnd.toISOString(),
          invoiceData.dueDate.toISOString(),
          JSON.stringify(invoiceData.lineItems),
        ],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...invoiceData });
        }
      );
    });
  }

  async createLocalPayment(paymentData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_payments (
          invoice_id, subscription_id, customer_id, amount, currency, status,
          payment_method, stripe_payment_intent_id, stripe_charge_id,
          failure_code, failure_message, next_retry_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))
      `;

      this.db.run(
        query,
        [
          paymentData.invoiceId,
          paymentData.subscriptionId,
          paymentData.customerId,
          paymentData.amount,
          paymentData.currency,
          paymentData.status,
          paymentData.paymentMethod,
          paymentData.stripePaymentIntentId,
          paymentData.stripeChargeId,
          paymentData.failureCode,
          paymentData.failureMessage,
          paymentData.nextRetryAt?.toISOString(),
        ],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...paymentData });
        }
      );
    });
  }

  async logSubscriptionEvent(subscriptionId, eventType, eventData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_events (
          subscription_id, event_type, event_source, event_data, created_at
        ) VALUES (?, ?, 'system', ?, datetime("now"))
      `;

      this.db.run(query, [subscriptionId, eventType, JSON.stringify(eventData)], function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async logStripeEvent(event) {
    try {
      // Extract subscription ID from event data if available
      let subscriptionId = null;
      if (event.data.object.subscription) {
        subscriptionId = await this.getSubscriptionIdByStripeId(event.data.object.subscription);
      }

      return new Promise((resolve, reject) => {
        const query = `
          INSERT INTO subscription_events (
            subscription_id, event_type, event_source, event_data, created_at
          ) VALUES (?, ?, 'stripe', ?, datetime("now"))
        `;

        this.db.run(
          query,
          [subscriptionId, event.type, JSON.stringify(event.data.object)],
          function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
    } catch (error) {
      console.error('Error in logStripeEvent:', error);
      throw error;
    }
  }

  // Additional helper methods would go here...
  getCustomerIdByStripeId(stripeCustomerId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id FROM customers WHERE stripe_customer_id = ?';
      this.db.get(query, [stripeCustomerId], (err, row) => {
        if (err) reject(err);
        else resolve(row?.id);
      });
    });
  }

  getSubscriptionIdByStripeId(stripeSubscriptionId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id FROM subscriptions WHERE stripe_subscription_id = ?';
      this.db.get(query, [stripeSubscriptionId], (err, row) => {
        if (err) reject(err);
        else resolve(row?.id);
      });
    });
  }

  getPlanIdByStripePrice(stripePriceId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT sp.id FROM subscription_plans sp
        JOIN stripe_prices ON sp.id = stripe_prices.plan_id
        WHERE stripe_prices.id = ?
      `;
      this.db.get(query, [stripePriceId], (err, row) => {
        if (err) reject(err);
        else resolve(row?.id);
      });
    });
  }

  async getActiveDunningCampaign() {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM dunning_campaigns WHERE is_active = true LIMIT 1';
      this.db.get(query, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createDunningInstance(instanceData) {
    try {
      // Get customer ID if not provided
      let customerId = instanceData.customerId;
      if (!customerId) {
        const subscription = await this.getSubscriptionById(instanceData.subscriptionId);
        customerId = subscription.customer_id;
      }

      return new Promise((resolve, reject) => {
        const query = `
          INSERT INTO dunning_instances (
            campaign_id, subscription_id, payment_id, customer_id, status,
            current_step, total_steps, started_at, next_action_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))
        `;

        this.db.run(
          query,
          [
            instanceData.campaignId,
            instanceData.subscriptionId,
            instanceData.paymentId,
            customerId,
            instanceData.status,
            instanceData.currentStep || 0,
            instanceData.totalSteps || 0,
            instanceData.startedAt.toISOString(),
            instanceData.nextActionAt?.toISOString(),
          ],
          function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, ...instanceData });
          }
        );
      });
    } catch (error) {
      console.error('Error in createDunningInstance:', error);
      throw error;
    }
  }

  async getDunningInstance(instanceId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM dunning_instances WHERE id = ?';
      this.db.get(query, [instanceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async updateDunningInstance(instanceId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];

      Object.keys(updateData).forEach(key => {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(updateData[key]);
        }
      });

      fields.push('updated_at = datetime("now")');
      params.push(instanceId);

      const query = `UPDATE dunning_instances SET ${fields.join(', ')} WHERE id = ?`;

      this.db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async incrementDunningCommunication(instanceId, type) {
    return new Promise((resolve, reject) => {
      const field = type === 'email' ? 'emails_sent' : 'sms_sent';
      const query = `UPDATE dunning_instances SET ${field} = ${field} + 1 WHERE id = ?`;

      this.db.run(query, [instanceId], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async getDunningCampaign(campaignId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM dunning_campaigns WHERE id = ?';
      this.db.get(query, [campaignId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async applyDiscountCode(discountCode, customerId) {
    // This would validate and apply the discount code
    // For now, return null (no discount)
    return null;
  }

  async createSubscriptionItem(subscriptionId, itemData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_items (
          subscription_id, plan_id, stripe_subscription_item_id, stripe_price_id,
          quantity, price, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))
      `;

      this.db.run(
        query,
        [
          subscriptionId,
          itemData.planId,
          itemData.stripeSubscriptionItemId,
          itemData.stripePriceId,
          itemData.quantity,
          itemData.price,
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async updateSubscriptionAddOns(subscriptionId, addOns) {
    // Implementation for updating subscription add-ons
    console.log(`Updating add-ons for subscription ${subscriptionId}:`, addOns);
  }

  async updateLocalInvoiceByStripeId(stripeInvoiceId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];

      Object.keys(updateData).forEach(key => {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(updateData[key]);
        }
      });

      fields.push('updated_at = datetime("now")');
      params.push(stripeInvoiceId);

      const query = `UPDATE subscription_invoices SET ${fields.join(', ')} WHERE stripe_invoice_id = ?`;

      this.db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async updateLocalPaymentByStripeChargeId(stripeChargeId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];

      Object.keys(updateData).forEach(key => {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(updateData[key]);
        }
      });

      fields.push('updated_at = datetime("now")');
      params.push(stripeChargeId);

      const query = `UPDATE subscription_payments SET ${fields.join(', ')} WHERE stripe_charge_id = ?`;

      this.db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async updateLocalPaymentByStripePaymentIntentId(stripePaymentIntentId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];

      Object.keys(updateData).forEach(key => {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(updateData[key]);
        }
      });

      fields.push('updated_at = datetime("now")');
      params.push(stripePaymentIntentId);

      const query = `UPDATE subscription_payments SET ${fields.join(', ')} WHERE stripe_payment_intent_id = ?`;

      this.db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }
}

module.exports = new RecurringBillingService();
