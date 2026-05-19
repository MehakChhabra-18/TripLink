/**
 * Ride Service Unit Tests
 * Covers: bookRide, acceptRide, rejectRide, verifyRideOTP,
 *         completeRide, cancelRide, getPendingRides
 */
require("../setup");

const rideService = require("../../services/ride.service");
const rideRepo    = require("../../repositories/ride.repository");
const authRepo    = require("../../repositories/auth.repository");
const prisma      = require("../../config/prisma");
const AppError    = require("../../utils/AppError");
const { estimateRideFare } = require("../../utils/fare");
const { generateOTP }      = require("../../utils/otp");

// Mock all deps
jest.mock("../../repositories/ride.repository");
jest.mock("../../repositories/auth.repository");
jest.mock("../../utils/fare");
jest.mock("../../utils/otp");

// ─── Shared test data ──────────────────────────────────────────────────────────

const mockRideId  = "ride-uuid-001";
const mockRiderId = "rider-uuid-001";
const mockDriverId= "driver-uuid-001";

const basePendingRide = {
  id:                 mockRideId,
  status:             "PENDING",
  rideOTP:            "1234",
  offeredFare:        200,
  estimatedFare:      180,
  driverId:           null,
  rider: { user: { id: mockRiderId } },
};

const baseAcceptedRide = {
  ...basePendingRide,
  status:   "ACCEPTED",
  driverId: mockDriverId,
  driver:   { user: { id: mockDriverId } },
};

const baseStartedRide = {
  ...baseAcceptedRide,
  status: "STARTED",
};

// ─── Mocked io ────────────────────────────────────────────────────────────────

const mockIo = {
  emit:  jest.fn(),
  to:    jest.fn().mockReturnThis(),
};

// ─────────────────────────────────────────────────────────────────────────────

describe("Ride Service", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── bookRide ──────────────────────────────────────────────────────────────

  describe("bookRide()", () => {
    it("should book a ride and emit newRide event", async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: "rider-profile-1" });
      estimateRideFare.mockReturnValue({ distanceKm: 5, estimatedFare: 150 });
      generateOTP.mockReturnValue("4321");

      const createdRide = { id: mockRideId, pickupAddress: "A", destinationAddress: "B",
        distanceKm: 5, estimatedFare: 150, offeredFare: 160, rideOTP: "4321" };
      rideRepo.createRide.mockResolvedValue(createdRide);
      authRepo.findUserById.mockResolvedValue({ name: "Rider One" });

      const result = await rideService.bookRide(mockRiderId, {
        pickupAddress: "A", pickupLat: 28.1, pickupLng: 77.1,
        destinationAddress: "B", destinationLat: 28.5, destinationLng: 77.5,
        offeredFare: 160,
      }, mockIo);

      expect(result.id).toBe(mockRideId);
      expect(mockIo.emit).toHaveBeenCalledWith("newRide", expect.objectContaining({ id: mockRideId }));
    });

    it("should throw 404 if rider profile not found", async () => {
      prisma.rider.findUnique.mockResolvedValue(null);

      await expect(
        rideService.bookRide(mockRiderId, {
          pickupAddress: "A", pickupLat: 0, pickupLng: 0,
          destinationAddress: "B", destinationLat: 0, destinationLng: 0,
        }, null)
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── acceptRide ───────────────────────────────────────────────────────────

  describe("acceptRide()", () => {
    it("should accept a PENDING ride and notify rider", async () => {
      rideRepo.findRideById.mockResolvedValue(basePendingRide);
      prisma.driver.findUnique.mockResolvedValue({
        id: "driver-profile-1",
        vehicles: [{ id: "vehicle-1", isActive: true }],
      });
      rideRepo.assignDriver.mockResolvedValue({
        ...baseAcceptedRide,
        rider: { user: { id: mockRiderId } },
      });
      authRepo.findUserById.mockResolvedValue({ name: "Driver One" });

      const result = await rideService.acceptRide(mockDriverId, mockRideId, mockIo);

      expect(result.status).toBe("ACCEPTED");
      expect(mockIo.to).toHaveBeenCalledWith(mockRiderId);
      expect(mockIo.emit).toHaveBeenCalledWith("rideGone", { rideId: mockRideId });
    });

    it("should throw 404 if ride not found", async () => {
      rideRepo.findRideById.mockResolvedValue(null);

      await expect(rideService.acceptRide(mockDriverId, mockRideId, null))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it("should throw 400 if ride is not PENDING", async () => {
      rideRepo.findRideById.mockResolvedValue({ ...basePendingRide, status: "ACCEPTED" });

      await expect(rideService.acceptRide(mockDriverId, mockRideId, null))
        .rejects.toMatchObject({ statusCode: 400, code: "RIDE_NOT_AVAILABLE" });
    });

    it("should throw 404 if driver profile not found", async () => {
      rideRepo.findRideById.mockResolvedValue(basePendingRide);
      prisma.driver.findUnique.mockResolvedValue(null);

      await expect(rideService.acceptRide(mockDriverId, mockRideId, null))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── rejectRide ───────────────────────────────────────────────────────────

  describe("rejectRide()", () => {
    it("should reject a ride and notify rider", async () => {
      rideRepo.findRideById.mockResolvedValue(basePendingRide);
      rideRepo.updateRideStatus.mockResolvedValue({
        ...basePendingRide,
        status: "REJECTED",
        rider: { user: { id: mockRiderId } },
      });

      const result = await rideService.rejectRide(mockDriverId, mockRideId, mockIo);

      expect(result.status).toBe("REJECTED");
      expect(mockIo.to).toHaveBeenCalledWith(mockRiderId);
      expect(mockIo.emit).toHaveBeenCalledWith("rideGone", { rideId: mockRideId });
    });

    it("should throw 404 if ride not found", async () => {
      rideRepo.findRideById.mockResolvedValue(null);

      await expect(rideService.rejectRide(mockDriverId, mockRideId, null))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── verifyRideOTP ────────────────────────────────────────────────────────

  describe("verifyRideOTP()", () => {
    it("should verify OTP and start the ride", async () => {
      rideRepo.findRideById.mockResolvedValue(baseAcceptedRide);
      rideRepo.verifyOTPAndStartRide.mockResolvedValue({ ...baseAcceptedRide, status: "STARTED" });

      const result = await rideService.verifyRideOTP(mockDriverId, mockRideId, "1234", mockIo);

      expect(result.status).toBe("STARTED");
      expect(mockIo.to).toHaveBeenCalledWith(mockRiderId);
    });

    it("should throw 400 for wrong OTP", async () => {
      rideRepo.findRideById.mockResolvedValue(baseAcceptedRide);

      await expect(rideService.verifyRideOTP(mockDriverId, mockRideId, "9999", null))
        .rejects.toMatchObject({ statusCode: 400, code: "OTP_INVALID" });
    });

    it("should throw 400 if ride not in ACCEPTED status", async () => {
      rideRepo.findRideById.mockResolvedValue({ ...baseAcceptedRide, status: "PENDING" });

      await expect(rideService.verifyRideOTP(mockDriverId, mockRideId, "1234", null))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it("should throw 404 if ride not found", async () => {
      rideRepo.findRideById.mockResolvedValue(null);

      await expect(rideService.verifyRideOTP(mockDriverId, mockRideId, "1234", null))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── completeRide ─────────────────────────────────────────────────────────

  describe("completeRide()", () => {
    it("should complete a STARTED ride and update driver stats", async () => {
      rideRepo.findRideById.mockResolvedValue(baseStartedRide);
      rideRepo.updateRideStatus.mockResolvedValue({
        ...baseStartedRide,
        status: "COMPLETED",
        rider: { user: { id: mockRiderId } },
      });
      prisma.driver.update.mockResolvedValue({});

      const result = await rideService.completeRide(mockDriverId, mockRideId, mockIo);

      expect(result.status).toBe("COMPLETED");
      expect(prisma.driver.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockDriverId } })
      );
      expect(mockIo.to).toHaveBeenCalledWith(mockRiderId);
    });

    it("should throw 400 if ride is not STARTED", async () => {
      rideRepo.findRideById.mockResolvedValue(baseAcceptedRide); // ACCEPTED, not STARTED

      await expect(rideService.completeRide(mockDriverId, mockRideId, null))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it("should throw 404 if ride not found", async () => {
      rideRepo.findRideById.mockResolvedValue(null);

      await expect(rideService.completeRide(mockDriverId, mockRideId, null))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── cancelRide ───────────────────────────────────────────────────────────

  describe("cancelRide()", () => {
    it("should cancel a PENDING ride", async () => {
      rideRepo.findRideById.mockResolvedValue(basePendingRide);
      rideRepo.updateRideStatus.mockResolvedValue({
        ...basePendingRide,
        status: "CANCELLED",
        rider: { user: { id: mockRiderId } },
      });

      const result = await rideService.cancelRide(mockRiderId, mockRideId, mockIo);

      expect(result.status).toBe("CANCELLED");
    });

    it("should cancel an ACCEPTED ride and notify both parties", async () => {
      rideRepo.findRideById.mockResolvedValue(baseAcceptedRide);
      rideRepo.updateRideStatus.mockResolvedValue({
        ...baseAcceptedRide,
        status: "CANCELLED",
        rider:  { user: { id: mockRiderId } },
        driver: { user: { id: mockDriverId } },
      });

      await rideService.cancelRide(mockRiderId, mockRideId, mockIo);

      // io.to called for rider and driver
      expect(mockIo.to).toHaveBeenCalledTimes(2);
    });

    it("should throw 400 if ride is STARTED (cannot cancel)", async () => {
      rideRepo.findRideById.mockResolvedValue(baseStartedRide);

      await expect(rideService.cancelRide(mockRiderId, mockRideId, null))
        .rejects.toMatchObject({ statusCode: 400, code: "CANNOT_CANCEL" });
    });

    it("should throw 404 if ride not found", async () => {
      rideRepo.findRideById.mockResolvedValue(null);

      await expect(rideService.cancelRide(mockRiderId, mockRideId, null))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── getPendingRides ──────────────────────────────────────────────────────

  describe("getPendingRides()", () => {
    it("should return list of pending rides", async () => {
      rideRepo.findPendingRides.mockResolvedValue([basePendingRide]);

      const result = await rideService.getPendingRides();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("PENDING");
    });
  });

});
