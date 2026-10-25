const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { from: copyFrom } = require("pg-copy-streams");
require("dotenv").config();

const pool = require("./config/db");

const FILE_PATH = path.join(__dirname, "../data/students_20_lakh.sql");

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

// Parses a single SQL tuple without splitting commas inside strings.
function parseTuple(line) {
  let text = line.trim();

  if (!text.startsWith("(")) return null;

  // Remove the trailing comma or semicolon after the tuple.
  if (text.endsWith(",")) {
    text = text.slice(0, -1);
  } else if (text.endsWith(";")) {
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

    if (!wasQuoted && /^NULL$/i.test(trimmed)) {
      values.push(null);
    } else {
      values.push(wasQuoted ? value : trimmed);
    }

    value = "";
    wasQuoted = false;
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === "\\") {
        // Decode common MySQL string escapes.
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
      `Expected ${COLUMNS.length} values, received ${values.length}`,
    );
  }

  return values;
}

// CSV-escape each value for PostgreSQL COPY FORMAT csv.
function toCsvField(value) {
  if (value === null) return "";

  return `"${String(value).replace(/"/g, '""')}"`;
}

async function* readStudentRows() {
  const input = fs.createReadStream(FILE_PATH, {
    encoding: "utf8",
  });

  const reader = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  let processed = 0;

  try {
    for await (const line of reader) {
      const trimmed = line.trimStart();

      // Skip comments, CREATE TABLE, INSERT headers, and settings.
      if (!trimmed.startsWith("(")) continue;

      const values = parseTuple(trimmed);

      if (!values) continue;

      processed++;

      if (processed % 10000 === 0) {
        console.log(`Parsed ${processed.toLocaleString()} records`);
      }

      yield values.map(toCsvField).join(",") + "\n";
    }
  } finally {
    reader.close();
    input.destroy();
  }

  console.log(`Finished parsing ${processed.toLocaleString()} records`);
}

async function importStudents() {
  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`SQL file not found: ${FILE_PATH}`);
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    console.log("Starting student import...");
    await client.query("BEGIN");
    transactionStarted = true;

    const copySql = `
      COPY students (${COLUMNS.join(", ")})
      FROM STDIN WITH (FORMAT csv)
    `;

    const copyStream = client.query(copyFrom(copySql));

    await pipeline(Readable.from(readStudentRows()), copyStream);

    await client.query("COMMIT");
    transactionStarted = false;

    const result = await client.query(
      "SELECT COUNT(*)::bigint AS total FROM students",
    );

    console.log("Import completed successfully.");
    console.log("Total students in database:", result.rows[0].total);
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Import failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importStudents().catch(() => {
  process.exitCode = 1;
});
