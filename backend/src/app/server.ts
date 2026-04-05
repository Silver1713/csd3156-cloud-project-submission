/**
 * Composes the Express server, static public docs, API routes, and startup
 * health checks for the backend process.
 */
import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "../db/client.js";
import { router } from "../routes/index.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS ?
  process.env.CORS_ALLOWED_ORIGINS.split(",").map(origin => origin.trim()) :
  [];
  
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const publicDirectory = path.resolve(currentDirectory, "../../public");

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());
app.use(express.static(publicDirectory));
app.use("/api", router);

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDirectory, "index.html"));
});


app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      message: "Backend is running",
      database: "connected",
    });
  } catch (error) {
    res.status(500).json({
      message: "Backend is running but database is unavailable",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Starts the HTTP server only after verifying the database connection.
 */
async function startServer(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL successfully.");

    app.listen(port, () => {
      console.log(`Backend server listening on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to connect to PostgreSQL.", error);
    process.exit(1);
  }
}

await startServer();
