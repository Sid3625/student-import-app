const importQueue = require("./jobs/importQueue");

async function testQueue() {
  try {
    const job = await importQueue.add("test-import", {
      message: "BullMQ is working",
    });

    console.log("BullMQ queue connected successfully.");
    console.log("Test job ID:", job.id);
  } catch (error) {
    console.error("Queue test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await importQueue.close();
    await require("./config/redis").quit();
  }
}

testQueue();