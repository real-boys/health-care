const { Queue, Worker } = require('bullmq');
const Redis = require('redis');

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

// Create Redis connection
const connection = new Redis(redisConfig);

// Queue storage
const queues = new Map();
const workers = new Map();

/**
 * Create a new queue
 * @param {string} name - Queue name
 * @param {object} options - Queue options
 * @returns {Queue} Bull queue instance
 */
function createQueue(name, options = {}) {
  if (queues.has(name)) {
    return queues.get(name);
  }

  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      ...options
    }
  });

  queues.set(name, queue);
  
  // Add event listeners
  queue.on('error', (err) => {
    console.error(`Queue ${name} error:`, err);
  });

  queue.on('waiting', (job) => {
    console.log(`Job ${job.id} in queue ${name} is waiting`);
  });

  queue.on('active', (job) => {
    console.log(`Job ${job.id} in queue ${name} is now active`);
  });

  queue.on('completed', (job) => {
    console.log(`Job ${job.id} in queue ${name} completed`);
  });

  queue.on('failed', (job, err) => {
    console.error(`Job ${job.id} in queue ${name} failed:`, err);
  });

  queue.on('stalled', (job) => {
    console.warn(`Job ${job.id} in queue ${name} is stalled`);
  });

  return queue;
}

/**
 * Process jobs from a queue
 * @param {Queue} queue - Bull queue instance
 * @param {function} processor - Job processor function
 * @param {object} options - Worker options
 */
function processQueue(queue, processor, options = {}) {
  if (workers.has(queue.name)) {
    console.warn(`Worker for queue ${queue.name} already exists`);
    return workers.get(queue.name);
  }

  const worker = new Worker(queue.name, processor, {
    connection,
    concurrency: options.concurrency || 5,
    ...options
  });

  workers.set(queue.name, worker);

  // Add worker event listeners
  worker.on('error', (err) => {
    console.error(`Worker for queue ${queue.name} error:`, err);
  });

  worker.on('completed', (job) => {
    console.log(`Worker completed job ${job.id} in queue ${queue.name}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Worker failed job ${job.id} in queue ${queue.name}:`, err);
  });

  worker.on('stalled', (job) => {
    console.warn(`Worker stalled job ${job.id} in queue ${queue.name}`);
  });

  return worker;
}

/**
 * Get queue by name
 * @param {string} name - Queue name
 * @returns {Queue|null} Bull queue instance or null
 */
function getQueue(name) {
  return queues.get(name) || null;
}

/**
 * Get worker by queue name
 * @param {string} name - Queue name
 * @returns {Worker|null} Bull worker instance or null
 */
function getWorker(name) {
  return workers.get(name) || null;
}

/**
 * Get all queues
 * @returns {Map} All queues
 */
function getAllQueues() {
  return queues;
}

/**
 * Get all workers
 * @returns {Map} All workers
 */
function getAllWorkers() {
  return workers;
}

/**
 * Close specific queue
 * @param {string} name - Queue name
 */
async function closeQueue(name) {
  const queue = queues.get(name);
  const worker = workers.get(name);

  if (worker) {
    await worker.close();
    workers.delete(name);
  }

  if (queue) {
    await queue.close();
    queues.delete(name);
  }
}

/**
 * Close all queues and workers
 */
async function closeAll() {
  console.log('Closing all queues and workers...');

  // Close all workers first
  for (const [name, worker] of workers) {
    try {
      await worker.close();
      console.log(`Worker for queue ${name} closed`);
    } catch (err) {
      console.error(`Error closing worker for queue ${name}:`, err);
    }
  }
  workers.clear();

  // Close all queues
  for (const [name, queue] of queues) {
    try {
      await queue.close();
      console.log(`Queue ${name} closed`);
    } catch (err) {
      console.error(`Error closing queue ${name}:`, err);
    }
  }
  queues.clear();

  // Close Redis connection
  if (connection) {
    await connection.quit();
  }

  console.log('All queues and workers closed');
}

/**
 * Get queue statistics
 * @param {string} name - Queue name
 * @returns {object} Queue statistics
 */
async function getQueueStats(name) {
  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Queue ${name} not found`);
  }

  const waiting = await queue.getWaiting();
  const active = await queue.getActive();
  const completed = await queue.getCompleted();
  const failed = await queue.getFailed();
  const delayed = await queue.getDelayed();
  const paused = await queue.getPaused();

  return {
    name,
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    paused: paused.length,
    total: waiting.length + active.length + completed.length + failed.length + delayed.length + paused.length
  };
}

/**
 * Get all queue statistics
 * @returns {object} All queue statistics
 */
async function getAllQueueStats() {
  const stats = {};

  for (const [name] of queues) {
    try {
      stats[name] = await getQueueStats(name);
    } catch (err) {
      console.error(`Error getting stats for queue ${name}:`, err);
      stats[name] = { error: err.message };
    }
  }

  return stats;
}

/**
 * Retry failed jobs in a queue
 * @param {string} name - Queue name
 * @param {number} limit - Maximum number of jobs to retry
 */
async function retryFailedJobs(name, limit = 10) {
  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Queue ${name} not found`);
  }

  const failed = await queue.getFailed();
  const jobsToRetry = failed.slice(0, limit);

  for (const job of jobsToRetry) {
    try {
      await job.retry();
      console.log(`Retried job ${job.id} in queue ${name}`);
    } catch (err) {
      console.error(`Error retrying job ${job.id} in queue ${name}:`, err);
    }
  }

  return jobsToRetry.length;
}

/**
 * Clean completed jobs in a queue
 * @param {string} name - Queue name
 * @param {number} keep - Number of jobs to keep
 */
async function cleanCompletedJobs(name, keep = 100) {
  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Queue ${name} not found`);
  }

  const completed = await queue.getCompleted();
  const jobsToRemove = completed.slice(keep);

  for (const job of jobsToRemove) {
    try {
      await job.remove();
      console.log(`Removed completed job ${job.id} from queue ${name}`);
    } catch (err) {
      console.error(`Error removing completed job ${job.id} from queue ${name}:`, err);
    }
  }

  return jobsToRemove.length;
}

/**
 * Pause a queue
 * @param {string} name - Queue name
 */
async function pauseQueue(name) {
  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Queue ${name} not found`);
  }

  await queue.pause();
  console.log(`Queue ${name} paused`);
}

/**
 * Resume a queue
 * @param {string} name - Queue name
 */
async function resumeQueue(name) {
  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Queue ${name} not found`);
  }

  await queue.resume();
  console.log(`Queue ${name} resumed`);
}

/**
 * Drain a queue (remove all jobs)
 * @param {string} name - Queue name
 */
async function drainQueue(name) {
  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Queue ${name} not found`);
  }

  await queue.drain();
  console.log(`Queue ${name} drained`);
}

module.exports = {
  createQueue,
  processQueue,
  getQueue,
  getWorker,
  getAllQueues,
  getAllWorkers,
  closeQueue,
  closeAll,
  getQueueStats,
  getAllQueueStats,
  retryFailedJobs,
  cleanCompletedJobs,
  pauseQueue,
  resumeQueue,
  drainQueue
};
