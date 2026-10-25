require("dotenv").config();

const express = require("express");
const cors = require("cors");
const importRoutes = require("./routes/importRoutes");
const studentRoutes = require("./routes/studentRoutes");
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/imports", importRoutes);

app.use("/api/students", studentRoutes);

app.use((error, _req, res, _next) => {
  console.error(error.message);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File exceeds the 1 GB limit." });
  }

  if (error.message === "Only .sql files are allowed.") {
    return res.status(400).json({ message: error.message });
  }

  res.status(500).json({ message: "Internal server error." });
});

const port = Number(process.env.PORT || 5000);

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
