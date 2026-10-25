const { Queue } = require("bullmq");
const redis = require("./config/redis");

async function cleanup() {
  const queue = new Queue("student-imports", {
    connection: redis,
  });

  try {
    const jobs = await queue.getJobs([
      "waiting",
      "delayed",
      "failed",
      "completed",
    ]);

    for (const job of jobs) {
      if (job.name === "test-import") {
        await job.remove();
        console.log("Removed old test job:", job.id);
      }
    }
  } finally {
    await queue.close();
    await redis.quit();
  }
}

cleanup().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});