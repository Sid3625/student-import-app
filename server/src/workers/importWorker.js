
const { Worker } = require("bullmq");
const path = require("path");
const fs = require("fs");

const pool = require("../config/db");
const redisConnection = require("../config/redis");
const { importStudents } = require("../services/studentImportService");

const worker = new Worker(
  "student-imports",
  async (job) => {
    const { importJobId, filePath } = job.data;

    console.log(`Starting import job ${importJobId}`);

    await pool.query(
      `UPDATE import_jobs
       SET status = 'processing',
           started_at = NOW(),
           error_message = NULL
       WHERE id = $1`,
      [importJobId]
    );

    try {
      const result = await importStudents({
        filePath,
        jobId: importJobId,
      });

      await pool.query(
        `UPDATE import_jobs
         SET status = 'completed',
             completed_at = NOW()
         WHERE id = $1`,
        [importJobId]
      );

      console.log(`Import job ${importJobId} completed`, result);

      // Remove the uploaded file after a successful import.
      // Keep failed files for investigation or retry.
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return result;
    } catch (error) {
      await pool.query(
        `UPDATE import_jobs
         SET status = 'failed',
             error_message = $2
         WHERE id = $1`,
        [importJobId, error.message]
      );

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Queue job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Queue job ${job?.id} failed:`, error.message);
});

worker.on("error", (error) => {
  console.error("Worker error:", error.message);
});

console.log("Student import worker is running...");

// Gracefully close shared resources when stopping the worker.
async function shutdown() {
  console.log("Shutting down worker...");
  await worker.close();
  await redisConnection.quit();
  await pool.end();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
