
const fs = require("fs");
const readline = require("readline");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { from: copyFrom } = require("pg-copy-streams");
const pool = require("../config/db");

const COLUMNS = [
  "id",
  "student_code",
  "first_name",
  "last_name",
  "email",
  "phone",
  "date_of_birth",
  "gender",
  "course",
  "department",
  "admission_year",
  "college_name",
  "college_city",
  "college_state",
  "college_country",
  "college_type",
  "college_category",
  "college_website",
  "college_address",
];

function parseTuple(line) {
  let text = line.trim();

  if (!text.startsWith("(")) return null;

  if (text.endsWith(",") || text.endsWith(";")) {
    text = text.slice(0, -1);
  }

  if (!text.endsWith(")")) {
    throw new Error("Malformed tuple: missing closing parenthesis");
  }

  text = text.slice(1, -1);

  const values = [];
  let value = "";
  let inQuotes = false;
  let wasQuoted = false;

  function pushValue() {
    const trimmed = value.trim();

    values.push(
      !wasQuoted && /^NULL$/i.test(trimmed)
        ? null
        : wasQuoted
          ? value
          : trimmed
    );

    value = "";
    wasQuoted = false;
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === "\\") {
        if (i + 1 < text.length) {
          const next = text[++i];
          const escapes = {
            0: "\0",
            b: "\b",
            n: "\n",
            r: "\r",
            t: "\t",
            Z: "\x1a",
          };

          value += Object.prototype.hasOwnProperty.call(escapes, next)
            ? escapes[next]
            : next;
        } else {
          value += char;
        }
      } else if (char === "'") {
        if (text[i + 1] === "'") {
          value += "'";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
    } else if (char === "'") {
      inQuotes = true;
      wasQuoted = true;
    } else if (char === ",") {
      pushValue();
    } else {
      value += char;
    }
  }

  if (inQuotes) {
    throw new Error("Malformed tuple: unterminated quoted string");
  }

  pushValue();

  if (values.length !== COLUMNS.length) {
    throw new Error(
      `Expected ${COLUMNS.length} values, received ${values.length}`
    );
  }

  return values;
}

function toCsvField(value) {
  if (value === null) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

// First pass: count records so progress has a known denominator.
async function countStudentRows(filePath) {
  let total = 0;

  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const reader = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of reader) {
      if (line.trimStart().startsWith("(")) {
        total++;
      }
    }
  } finally {
    reader.close();
    input.destroy();
  }

  return total;
}

// Second pass: stream tuples directly into PostgreSQL COPY.
async function* readStudentRows(filePath, jobId, totalRecords) {
  const input = fs.createReadStream(filePath, { encoding: "utf8" });
  const reader = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  let processed = 0;

  try {
    for await (const line of reader) {
      if (!line.trimStart().startsWith("(")) continue;

      const values = parseTuple(line);

      if (!values) continue;

      processed++;

      // Update progress periodically without issuing a query per row.
      if (processed % 5000 === 0 || processed === totalRecords) {
        await pool.query(
          `UPDATE import_jobs
           SET processed_records = $1
           WHERE id = $2`,
          [processed, jobId]
        );
      }

      yield values.map(toCsvField).join(",") + "\n";
    }
  } finally {
    reader.close();
    input.destroy();
  }

  if (processed !== totalRecords) {
    throw new Error(
      `Record count changed: expected ${totalRecords}, read ${processed}`
    );
  }
}

async function importStudents({ filePath, jobId }) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }

  const totalRecords = await countStudentRows(filePath);

  if (totalRecords === 0) {
    throw new Error("The SQL file contains no student records.");
  }

  await pool.query(
    `UPDATE import_jobs
     SET total_records = $1, processed_records = 0
     WHERE id = $2`,
    [totalRecords, jobId]
  );

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Temporary staging table has no copied indexes or unique constraints.
    // It exists only for this database connection and transaction.
    await client.query(`
      CREATE TEMP TABLE student_import_stage
      (LIKE students INCLUDING DEFAULTS)
      ON COMMIT DROP
    `);

    const copySql = `
      COPY student_import_stage (${COLUMNS.join(", ")})
      FROM STDIN WITH (FORMAT csv)
    `;

    await pipeline(
      Readable.from(readStudentRows(filePath, jobId, totalRecords)),
      client.query(copyFrom(copySql))
    );

    // Ignore existing IDs and student_code conflicts.
    // Reprocessing a file will not insert those records a second time.
    const insertResult = await client.query(`
      INSERT INTO students (${COLUMNS.join(", ")})
      SELECT ${COLUMNS.join(", ")}
      FROM student_import_stage
      ON CONFLICT DO NOTHING
    `);

    const inserted = insertResult.rowCount;
    const skipped = totalRecords - inserted;

    await client.query("COMMIT");
    transactionStarted = false;

    await pool.query(
      `UPDATE import_jobs
       SET total_records = $1,
           processed_records = $1,
           inserted_records = $2,
           skipped_records = $3,
           failed_records = 0
       WHERE id = $4`,
      [totalRecords, inserted, skipped, jobId]
    );

    return { totalRecords, inserted, skipped };
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    throw error;
  } finally {
    client.release();

    // Do NOT call pool.end() here.
    // The API and worker share this connection pool.
  }
}

module.exports = { importStudents };
