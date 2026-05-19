/**
 * Payment Zod validation schemas
 */
const { z } = require("zod");

const createOrderSchema = z.object({
  rideId: z.string().uuid(),
  amount: z.number().min(1, "Amount must be at least ₹1"),
});

const verifyPaymentSchema = z.object({
  rideId:              z.string().uuid(),
  razorpay_order_id:   z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature:  z.string().min(1),
});

const webhookSchema = z.object({
  event:   z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id:       z.string(),
        order_id: z.string(),
        status:   z.string(),
      }),
    }).optional(),
    refund: z.object({
      entity: z.object({
        id:         z.string(),
        payment_id: z.string(),
        amount:     z.number(),
      }),
    }).optional(),
  }),
});

module.exports = { createOrderSchema, verifyPaymentSchema, webhookSchema };
