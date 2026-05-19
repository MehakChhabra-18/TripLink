/**
 * Payment Service Unit Tests
 * Covers: createOrder, verifyPayment, handleWebhook, getPaymentStatus
 */
require("../setup");

const crypto = require("crypto");
const paymentService = require("../../services/payment.service");
const paymentRepo    = require("../../repositories/payment.repository");
const rideRepo       = require("../../repositories/ride.repository");
const razorpay       = require("../../config/razorpay");

jest.mock("../../repositories/payment.repository");
jest.mock("../../repositories/ride.repository");

// ─── Shared test data ──────────────────────────────────────────────────────────

const mockRideId   = "ride-uuid-pay-001";
const mockOrderId  = "order_test123";
const mockPaymentId= "pay_test456";

const completedRide = {
  id:     mockRideId,
  status: "COMPLETED",
  rider:  { user: { id: "rider-uuid-001" } },
};

// ─────────────────────────────────────────────────────────────────────────────

describe("Payment Service", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RAZORPAY_KEY_SECRET  = "test_secret_xxx";
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_secret_xxx";
  });

  // ─── createOrder ──────────────────────────────────────────────────────────

  describe("createOrder()", () => {
    it("should create a Razorpay order for a completed ride", async () => {
      rideRepo.findRideById.mockResolvedValue(completedRide);
      paymentRepo.findPaymentByRideId.mockResolvedValue(null);
      paymentRepo.upsertPayment.mockResolvedValue({});

      const result = await paymentService.createOrder(mockRideId, 200, "rider-uuid-001");

      expect(result.orderId).toBe(mockOrderId);
      expect(result.currency).toBe("INR");
      expect(result.key).toBe("rzp_test_xxx");
      expect(razorpay.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 20000, currency: "INR" }) // 200 * 100 paise
      );
    });

    it("should throw 404 if ride not found", async () => {
      rideRepo.findRideById.mockResolvedValue(null);

      await expect(paymentService.createOrder(mockRideId, 200, "any"))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it("should throw 400 if ride is not COMPLETED", async () => {
      rideRepo.findRideById.mockResolvedValue({ ...completedRide, status: "STARTED" });

      await expect(paymentService.createOrder(mockRideId, 200, "any"))
        .rejects.toMatchObject({ statusCode: 400, code: "RIDE_NOT_COMPLETED" });
    });

    it("should throw 409 if ride has already been paid", async () => {
      rideRepo.findRideById.mockResolvedValue(completedRide);
      paymentRepo.findPaymentByRideId.mockResolvedValue({ status: "PAID" });

      await expect(paymentService.createOrder(mockRideId, 200, "any"))
        .rejects.toMatchObject({ statusCode: 409, code: "ALREADY_PAID" });
    });
  });

  // ─── verifyPayment ────────────────────────────────────────────────────────

  describe("verifyPayment()", () => {
    it("should verify valid signature and mark payment as paid", async () => {
      const keySecret = "test_secret_xxx";
      const validSig  = crypto
        .createHmac("sha256", keySecret)
        .update(`${mockOrderId}|${mockPaymentId}`)
        .digest("hex");

      paymentRepo.markPaymentPaid.mockResolvedValue({
        id: "payment-1", status: "PAID",
      });

      const result = await paymentService.verifyPayment({
        rideId:              mockRideId,
        razorpay_order_id:   mockOrderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature:  validSig,
      });

      expect(result.status).toBe("PAID");
    });

    it("should throw 400 for invalid signature", async () => {
      paymentRepo.markPaymentFailed.mockResolvedValue({});

      await expect(paymentService.verifyPayment({
        rideId:              mockRideId,
        razorpay_order_id:   mockOrderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature:  "invalid-signature",
      })).rejects.toMatchObject({ statusCode: 400, code: "PAYMENT_INVALID_SIGNATURE" });

      expect(paymentRepo.markPaymentFailed).toHaveBeenCalledWith(mockRideId, "Signature mismatch");
    });
  });

  // ─── handleWebhook ────────────────────────────────────────────────────────

  describe("handleWebhook()", () => {
    it("should process payment.captured event", async () => {
      const webhookSecret = "webhook_secret_xxx";
      const payload = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: mockPaymentId, notes: { rideId: mockRideId } } } },
      });
      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      paymentRepo.markPaymentPaid.mockResolvedValue({});

      const result = await paymentService.handleWebhook(payload, signature);

      expect(result.received).toBe(true);
      expect(paymentRepo.markPaymentPaid).toHaveBeenCalledWith(mockRideId, expect.any(Object));
    });

    it("should process payment.failed event", async () => {
      const webhookSecret = "webhook_secret_xxx";
      const payload = JSON.stringify({
        event: "payment.failed",
        payload: { payment: { entity: {
          id: mockPaymentId,
          notes: { rideId: mockRideId },
          error_description: "Insufficient funds",
        }}},
      });
      const signature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      paymentRepo.markPaymentFailed.mockResolvedValue({});

      const result = await paymentService.handleWebhook(payload, signature);

      expect(result.received).toBe(true);
      expect(paymentRepo.markPaymentFailed).toHaveBeenCalledWith(mockRideId, "Insufficient funds");
    });

    it("should throw 401 for invalid webhook signature", async () => {
      await expect(
        paymentService.handleWebhook(JSON.stringify({ event: "test" }), "wrong-sig")
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // ─── getPaymentStatus ─────────────────────────────────────────────────────

  describe("getPaymentStatus()", () => {
    it("should return payment record", async () => {
      paymentRepo.findPaymentByRideId.mockResolvedValue({ id: "pay-1", status: "PAID" });

      const result = await paymentService.getPaymentStatus(mockRideId);

      expect(result.status).toBe("PAID");
    });

    it("should throw 404 if payment not found", async () => {
      paymentRepo.findPaymentByRideId.mockResolvedValue(null);

      await expect(paymentService.getPaymentStatus(mockRideId))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

});
