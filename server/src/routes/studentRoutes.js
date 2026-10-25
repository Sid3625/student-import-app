const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const search = String(req.query.search ?? "").trim();

    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    const offset = (page - 1) * limit;

    if (!Number.isSafeInteger(offset)) {
      return res.status(400).json({ message: "Page number is too large." });
    }

    const searchPattern = `%${search}%`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM students
       WHERE $1 = ''
          OR student_code ILIKE $2
          OR first_name ILIKE $2
          OR last_name ILIKE $2
          OR email ILIKE $2
          OR college_city ILIKE $2`,
      [search, searchPattern],
    );

    const studentsResult = await pool.query(
      `SELECT id, student_code, first_name, last_name, email,
              phone, course, department, admission_year,
              college_name, college_city, college_state, college_country
       FROM students
       WHERE $1 = ''
          OR student_code ILIKE $2
          OR first_name ILIKE $2
          OR last_name ILIKE $2
          OR email ILIKE $2
          OR college_city ILIKE $2
       ORDER BY id
       LIMIT $3 OFFSET $4`,
      [search, searchPattern, limit, offset],
    );

    const total = Number(countResult.rows[0].total);

    res.json({
      data: studentsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
