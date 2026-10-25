const fs = require("fs");
const path = require("path");
const readline = require("readline");

const filePath = path.join(__dirname, "../data/students_20_lakh.sql");

async function main() {
  const input = fs.createReadStream(filePath, {
    encoding: "utf8",
  });

  const reader = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let printed = 0;

  for await (const line of reader) {
    lineNumber++;

    if (lineNumber >= 32 && lineNumber <= 38) {
      console.log(`Line ${lineNumber}: ${line.slice(0, 500)}`);
      printed++;
    }

    if (printed === 7) break;
  }
}

main().catch(console.error);
