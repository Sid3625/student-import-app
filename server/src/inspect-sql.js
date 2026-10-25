const fs = require("fs");
const readline = require("readline");
const path = require("path");

const filePath = path.join(__dirname, "../data/students_20_lakh.sql");

async function inspectSqlFile() {
  const input = fs.createReadStream(filePath, {
    encoding: "utf8",
  });

  const reader = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let insertCount = 0;
  let firstInsertFound = false;

  for await (const line of reader) {
    lineNumber++;

    if (/^\s*INSERT\s+INTO\s+students\b/i.test(line)) {
      insertCount++;

      if (!firstInsertFound) {
        firstInsertFound = true;

        console.log("First INSERT found on line:", lineNumber);
        console.log("First INSERT line length:", line.length);
        console.log("Beginning:", line.slice(0, 300));
        console.log("Ending:", line.slice(-150));
      }
    }
  }

  console.log("Total physical lines:", lineNumber);
  console.log("INSERT statements starting a line:", insertCount);
}

inspectSqlFile().catch((error) => {
  console.error("Inspection failed:", error.message);
  process.exitCode = 1;
});
