import express from "express";
import cors from "cors";
import { z } from "zod";
import { config } from "./config.js";
import { supabase } from "./supabase.js";
import { jobQueue } from "./pipeline/job-queue.js";
import { runPipeline } from "./pipeline/orchestrator.js";
import type { JobStartPayload, ScrapeMode } from "./types.js";

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://lead-prospector.netlify.app',
    'https://lead-prospector.esison.dev'
  ],
}));
app.use(express.json());

// ─── Request Logging ──────────────────────────────────────────────────

app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[scraper] ${ts}  ${req.method} ${req.path}`);
  next();
});

// ─── Health Check ──────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "scraper",
    timestamp: new Date().toISOString(),
  });
});

// ─── Start Job ─────────────────────────────────────────────────────────

const jobStartSchema = z.object({
  jobId: z.string().uuid(),
  userId: z.string().uuid(),
  campaign: z.enum(["local", "remote"]),
  mode: z.enum(["api", "scrape"]) as z.ZodType<ScrapeMode>,
  searchLocation: z.string().default("Austin, TX"),
  searchLat: z.coerce.number().default(config.DEFAULT_LAT),
  searchLng: z.coerce.number().default(config.DEFAULT_LNG),
  searchQueries: z
    .array(
      z.string()
        .trim()
        .min(2, "Query must be at least 2 characters")
        .max(100, "Query must be at most 100 characters")
    )
    .min(1, "At least one search query is required")
    .max(5, "At most 5 search queries allowed")
    ,
});

app.post("/api/jobs/start", async (req, res) => {
  const parsed = jobStartSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues,
    });
    return;
  }

  const payload: JobStartPayload = parsed.data;

  // Check if job is already running
  if (jobQueue.isRunning(payload.jobId)) {
    res.status(409).json({ error: "Job is already running" });
    return;
  }

  console.log(
    `[scraper] Job received — id: ${payload.jobId}, campaign: ${payload.campaign}, mode: ${payload.mode}, location: ${payload.searchLocation} (${payload.searchLat}, ${payload.searchLng}), queries: [${payload.searchQueries.join(", ")}]`
  );

  try {
    await jobQueue.enqueue(payload.jobId, () => runPipeline(payload));

    res.json({
      message: "Job enqueued",
      jobId: payload.jobId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[scraper] Failed to enqueue job ${payload.jobId}: ${message}`);
    res.status(500).json({ error: message });
  }
});

// ─── Job Status ────────────────────────────────────────────────────────

app.get("/api/jobs/:id/status", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(data);
});

// ─── Cancel Job ────────────────────────────────────────────────────────

app.post("/api/jobs/:id/cancel", async (req, res) => {
  const { id } = req.params;

  jobQueue.cancel(id);

  // Update job status in Supabase
  await supabase
    .from("scrape_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  res.json({ message: "Job cancelled", jobId: id });
});

// ─── Start Server ──────────────────────────────────────────────────────

app.listen(config.SCRAPER_PORT, async () => {
  console.log("");
  console.log("┌──────────────────────────────────────────────┐");
  console.log("│          Lead Prospector — Scraper            │");
  console.log("└──────────────────────────────────────────────┘");
  console.log("");
  console.log(`  URL:            http://localhost:${config.SCRAPER_PORT}`);
  console.log(`  Search center:  ${config.DEFAULT_LAT}, ${config.DEFAULT_LNG}`);
  console.log("");
  console.log("  API keys:");
  console.log(`    Google Places: ${config.GOOGLE_PLACES_API_KEY ? "✓ configured" : "✗ not set (will use scraping fallback)"}`);
  console.log(`    Yelp:          ${config.YELP_API_KEY ? "✓ configured" : "✗ not set (Yelp enrichment disabled)"}`);
  console.log("");
  console.log("  Endpoints:");
  console.log("    GET  /api/health          Health check");
  console.log("    POST /api/jobs/start       Start a scraping job");
  console.log("    GET  /api/jobs/:id/status  Poll job status");
  console.log("    POST /api/jobs/:id/cancel  Cancel a running job");
  console.log("");

  // Verify Supabase connectivity
  try {
    const { count, error } = await supabase
      .from("scrape_jobs")
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  Supabase:  ✗ connection failed — ${error.message}`);
    } else {
      console.log(`  Supabase:  ✓ connected (${count ?? 0} existing jobs)`);
    }
  } catch (err) {
    console.log(`  Supabase:  ✗ unreachable — ${err instanceof Error ? err.message : err}`);
  }

  console.log("");
  console.log("  Waiting for job requests...");
  console.log("");
});
