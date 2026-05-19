/**
 * Auth Service Unit Tests
 */
require("../setup");

const authService = require("../../services/auth.service");
const authRepo    = require("../../repositories/auth.repository");
const bcrypt      = require("bcrypt");
const { generateAccessToken } = require("../../utils/jwt");

// Mock the repository
jest.mock("../../repositories/auth.repository");
jest.mock("bcrypt");

describe("Auth Service", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe("register()", () => {
    it("should register a new user and return tokens", async () => {
      authRepo.findUserByEmail.mockResolvedValue(null);
      authRepo.findUserByPhone.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashed-password");

      authRepo.createUser.mockResolvedValue({
        id: "user-uuid-123", name: "Test Rider",
        email: "test@example.com", role: "RIDER",
      });

      authRepo.deleteUserOTPs.mockResolvedValue(undefined);
      authRepo.createOTP.mockResolvedValue({});
      authRepo.saveRefreshToken.mockResolvedValue({});

      const result = await authService.register({
        name: "Test Rider", email: "test@example.com",
        password: "Pass@1234", role: "RIDER",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.requiresVerification).toBe(true);
    });

    it("should throw CONFLICT if email already exists", async () => {
      authRepo.findUserByEmail.mockResolvedValue({ id: "existing-user" });

      await expect(
        authService.register({
          name: "User", email: "existing@example.com",
          password: "Pass@1234", role: "RIDER",
        })
      ).rejects.toMatchObject({ statusCode: 409, code: "EMAIL_TAKEN" });
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe("login()", () => {
    it("should login with correct credentials", async () => {
      authRepo.findUserByEmail.mockResolvedValue({
        id: "user-1", email: "user@example.com",
        password: "hashed", role: "RIDER", isActive: true, isVerified: true,
      });

      bcrypt.compare.mockResolvedValue(true);
      authRepo.saveRefreshToken.mockResolvedValue({});

      const result = await authService.login({
        email: "user@example.com", password: "Pass@1234",
      });

      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe("user@example.com");
    });

    it("should throw UNAUTHORIZED for wrong password", async () => {
      authRepo.findUserByEmail.mockResolvedValue({
        id: "user-1", password: "hashed", isActive: true,
      });
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        authService.login({ email: "user@example.com", password: "wrong" })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("should throw UNAUTHORIZED for unknown email", async () => {
      authRepo.findUserByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: "unknown@example.com", password: "pass" })
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });

});
