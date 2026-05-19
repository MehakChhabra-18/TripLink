/**
 * Test Setup
 * Global mocks and test database configuration
 */

// Mock Prisma for unit tests
jest.mock("../config/prisma", () => ({
  user: {
    create:     jest.fn(),
    findUnique: jest.fn(),
    findMany:   jest.fn(),
    update:     jest.fn(),
    count:      jest.fn(),
  },
  rider: {
    create:     jest.fn(),
    findUnique: jest.fn(),
  },
  driver: {
    findUnique: jest.fn(),
    update:     jest.fn(),
  },
  ride: {
    create:     jest.fn(),
    findUnique: jest.fn(),
    findFirst:  jest.fn(),
    findMany:   jest.fn(),
    update:     jest.fn(),
    count:      jest.fn(),
    aggregate:  jest.fn(),
    groupBy:    jest.fn(),
  },
  payment: {
    upsert:     jest.fn(),
    findUnique: jest.fn(),
    findFirst:  jest.fn(),
    update:     jest.fn(),
    findMany:   jest.fn(),
    count:      jest.fn(),
    groupBy:    jest.fn(),
  },
  oTP: {
    create:     jest.fn(),
    findFirst:  jest.fn(),
    update:     jest.fn(),
    deleteMany: jest.fn(),
  },
  refreshToken: {
    create:     jest.fn(),
    findFirst:  jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn({
    user:   { create: jest.fn(), findUnique: jest.fn() },
    rider:  { create: jest.fn() },
    driver: { create: jest.fn() },
    ride:   { findMany: jest.fn(), count: jest.fn() },
    payment:{ findMany: jest.fn(), count: jest.fn() },
  })),
  $connect:    jest.fn(),
  $disconnect: jest.fn(),
}));

// Mock Razorpay
jest.mock("../config/razorpay", () => ({
  orders: {
    create: jest.fn().mockResolvedValue({
      id:       "order_test123",
      amount:   10000,
      currency: "INR",
    }),
  },
}));

// Mock mailer
jest.mock("../config/mailer", () => ({
  transporter: { sendMail: jest.fn().mockResolvedValue({ messageId: "test-id" }) },
  verifyMailer: jest.fn(),
}));

// Suppress console output in tests
global.console = {
  ...console,
  log:   jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
};

// Set test env vars
process.env.JWT_SECRET         = "test-jwt-secret-super-long-value";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-super-long-value";
process.env.RAZORPAY_KEY_ID     = "rzp_test_xxx";
process.env.RAZORPAY_KEY_SECRET = "test_secret_xxx";
process.env.DATABASE_URL        = "postgresql://test:test@localhost:5432/triplink_test";
