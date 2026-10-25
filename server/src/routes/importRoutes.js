
const express = require("express");
const fs = require("fs/promises");
const pool = require("../config/db");
const importQueue = require("../jobs/importQueue");
const { upload } = require("../middleware/upload");

const router = express.Router();

// Upload a SQL file and queue its import.
router.post("/", upload.single("file"), async (req, res, next) => {
  let filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a SQL file using the 'file' field.",
      });
    }

    const result = await pool.query(
      `INSERT INTO import_jobs (original_filename, file_path, status)
       VALUES ($1, $2, 'queued')
       RETURNING id, status, created_at`,
      [req.file.originalname, filePath]
    );

    const importJob = result.rows[0];

    try {
      const queueJob = await importQueue.add("import-students", {
        importJobId: importJob.id,
        filePath,
      });

      await pool.query(
        `UPDATE import_jobs
         SET queue_job_id = $1
         WHERE id = $2`,
        [String(queueJob.id), importJob.id]
      );

      return res.status(202).json({
        message: "File uploaded. Import queued.",
        import: {
          id: importJob.id,
          status: importJob.status,
          createdAt: importJob.created_at,
        },
      });
    } catch (queueError) {
      await pool.query(
        `UPDATE import_jobs
         SET status = 'failed', error_message = $2
         WHERE id = $1`,
        [importJob.id, `Could not queue import: ${queueError.message}`]
      );

      throw queueError;
    }
  } catch (error) {
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }

    next(error);
  }
});

// Read progress for one import.
router.get("/:id", async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid import ID." });
    }

    const result = await pool.query(
      `SELECT id, original_filename, status, total_records,
              processed_records, inserted_records, skipped_records,
              failed_records, error_message, created_at, started_at,
              completed_at
       FROM import_jobs
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Import job not found." });
    }

    const job = result.rows[0];
    const total = Number(job.total_records);
    const processed = Number(job.processed_records);

    res.json({
      ...job,
      progress: total > 0
        ? Math.min(100, Math.round((processed / total) * 100))
        : 0,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
