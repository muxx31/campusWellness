// Runs before any test file imports app code (env.js validates process.env on import).
process.env.NODE_ENV = "test";
process.env.MONGO_URI ??= "mongodb://127.0.0.1:27017/campus_wellness_test";
process.env.REDIS_URL ??= "redis://127.0.0.1:6379/1"; // db 1: never touches dev data
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.BCRYPT_ROUNDS = "10";
process.env.SUMMARY_DELAY_MS = "200";
process.env.COUNSELOR_SIGNUP_MODE = "approval";
