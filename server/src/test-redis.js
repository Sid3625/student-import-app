const redis = require("./config/redis");

async function testRedis() {
  try {
    await redis.set("student-import:test", "connected");

    const value = await redis.get("student-import:test");

    console.log("Redis connected successfully:", value);
  } catch (error) {
    console.error("Redis test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await redis.quit();
  }
}

testRedis();
