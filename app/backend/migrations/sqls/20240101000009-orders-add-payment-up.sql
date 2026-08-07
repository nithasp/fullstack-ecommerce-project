/* Payment tracking columns for Stripe integration.
   payment_status: 'none'   — order not created through the payment flow
                   'pending' — PaymentIntent created, awaiting payment
                   'paid'    — payment confirmed by Stripe
                   'failed'  — last payment attempt failed */

ALTER TABLE orders
    ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'none'
        CHECK (payment_status IN ('none', 'pending', 'paid', 'failed')),
    ADD COLUMN payment_intent_id VARCHAR(255),
    ADD COLUMN total_cents INTEGER,
    ADD COLUMN currency VARCHAR(10);

CREATE UNIQUE INDEX orders_payment_intent_id_unique ON orders (payment_intent_id);
