/* Multi-gateway support: record which provider handles an order's payment.
   payment_provider: 'stripe' — card payments (payment_intent_id = Stripe PaymentIntent id)
                     'omise'  — Thai local payment methods (payment_intent_id = Omise charge id)
   payment_method:   provider-specific method label, e.g. 'card', 'truemoney',
                     'rabbit_linepay', 'shopeepay', 'banking', 'installment' */

ALTER TABLE orders
    ADD COLUMN payment_provider VARCHAR(20),
    ADD COLUMN payment_method VARCHAR(40);

UPDATE orders SET payment_provider = 'stripe', payment_method = 'card'
    WHERE payment_intent_id IS NOT NULL;
