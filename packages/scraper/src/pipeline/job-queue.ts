import { EventEmitter } from "node:events";

interface QueuedJob {
  jobId: string;
  fn: () => Promise<void>;
}

/**
 * In-process sequential job queue.
 *
 * Only one job runs at a time. Jobs are processed in FIFO order.
 * Emits events: job-start, job-complete, job-error.
 */
export class JobQueue extends EventEmitter {
  private queue: QueuedJob[] = [];
  private runningJobId: string | null = null;
  private cancelledIds = new Set<string>();
  private processing = false;

  /**
   * Add a job to the queue. If no job is currently running, it starts immediately.
   */
  async enqueue(jobId: string, fn: () => Promise<void>): Promise<void> {
    this.queue.push({ jobId, fn });
    this.processNext();
  }

  /**
   * Check if a specific job is currently running.
   */
  isRunning(jobId: string): boolean {
    return this.runningJobId === jobId;
  }

  /**
   * Mark a job as cancelled. If it is currently running, the pipeline
   * should check for cancellation and stop gracefully.
   * If it is queued, it will be skipped when its turn comes.
   */
  cancel(jobId: string): void {
    this.cancelledIds.add(jobId);

    // Remove from queue if not yet started
    this.queue = this.queue.filter((j) => j.jobId !== jobId);

    console.log(`[job-queue] Cancelled job ${jobId}`);
    this.emit("job-cancelled", jobId);
  }

  /**
   * Check if a job has been cancelled.
   */
  isCancelled(jobId: string): boolean {
    return this.cancelledIds.has(jobId);
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    const job = this.queue.shift()!;

    // Skip cancelled jobs
    if (this.cancelledIds.has(job.jobId)) {
      this.cancelledIds.delete(job.jobId);
      this.processing = false;
      this.processNext();
      return;
    }

    this.runningJobId = job.jobId;
    this.emit("job-start", job.jobId);

    console.log(`[job-queue] Starting job ${job.jobId}`);

    try {
      await job.fn();
      this.emit("job-complete", job.jobId);
      console.log(`[job-queue] Completed job ${job.jobId}`);
    } catch (error) {
      this.emit("job-error", job.jobId, error);
      console.error(
        `[job-queue] Job ${job.jobId} failed:`,
        error instanceof Error ? error.message : error
      );
    } finally {
      this.runningJobId = null;
      this.cancelledIds.delete(job.jobId);
      this.processing = false;
      this.processNext();
    }
  }
}

/** Singleton job queue for the scraper service */
export const jobQueue = new JobQueue();
