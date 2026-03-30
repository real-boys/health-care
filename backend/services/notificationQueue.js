const redis = require('redis');
const { v4: uuidv4 } = require('uuid');

class NotificationQueue {
  constructor() {
    this.client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    });
    
    this.queues = {
      email: 'notifications:email',
      sms: 'notifications:sms',
      push: 'notifications:push',
      in_app: 'notifications:in_app'
    };

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Connected to Redis for notification queue');
    });
  }

  async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async addToQueue(notificationData, priority = 'normal') {
    const notification = {
      id: uuidv4(),
      ...notificationData,
      createdAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: 3
    };

    const queueName = this.queues[notificationData.type] || this.queues.in_app;
    const priorityScore = this.getPriorityScore(priority);
    
    try {
      await this.client.zAdd(queueName, [
        { score: priorityScore, value: JSON.stringify(notification) }
      ]);
      
      console.log(`Added notification ${notification.id} to ${queueName} queue`);
      return notification.id;
    } catch (error) {
      console.error('Failed to add notification to queue:', error);
      throw error;
    }
  }

  getPriorityScore(priority) {
    const now = Date.now();
    const priorities = {
      urgent: now - 1000000,
      high: now - 100000,
      normal: now,
      low: now + 100000
    };
    return priorities[priority] || priorities.normal;
  }

  async getNextFromQueue(queueName) {
    try {
      const result = await this.client.zRange(queueName, 0, 0);
      if (result.length === 0) {
        return null;
      }

      const notification = JSON.parse(result[0]);
      await this.client.zRem(queueName, result[0]);
      return notification;
    } catch (error) {
      console.error('Failed to get notification from queue:', error);
      return null;
    }
  }

  async requeueFailedNotification(notification, delay = 60000) {
    if (notification.attempts >= notification.maxAttempts) {
      console.error(`Notification ${notification.id} exceeded max attempts, moving to dead letter queue`);
      await this.moveToDeadLetterQueue(notification);
      return false;
    }

    notification.attempts += 1;
    notification.nextRetryAt = new Date(Date.now() + delay).toISOString();
    
    const queueName = this.queues[notification.type] || this.queues.in_app;
    const retryScore = Date.now() + delay;
    
    try {
      await this.client.zAdd(queueName, [
        { score: retryScore, value: JSON.stringify(notification) }
      ]);
      console.log(`Requeued notification ${notification.id} for retry ${notification.attempts}/${notification.maxAttempts}`);
      return true;
    } catch (error) {
      console.error('Failed to requeue notification:', error);
      return false;
    }
  }

  async moveToDeadLetterQueue(notification) {
    try {
      await this.client.lPush('notifications:dead_letter', JSON.stringify(notification));
      console.log(`Moved notification ${notification.id} to dead letter queue`);
    } catch (error) {
      console.error('Failed to move notification to dead letter queue:', error);
    }
  }

  async getQueueStats() {
    const stats = {};
    
    for (const [key, queueName] of Object.entries(this.queues)) {
      try {
        const count = await this.client.zCard(queueName);
        stats[key] = count;
      } catch (error) {
        stats[key] = 0;
      }
    }

    try {
      const deadLetterCount = await this.client.lLen('notifications:dead_letter');
      stats.dead_letter = deadLetterCount;
    } catch (error) {
      stats.dead_letter = 0;
    }

    return stats;
  }

  async clearQueue(queueName) {
    try {
      await this.client.del(queueName);
      console.log(`Cleared queue: ${queueName}`);
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  }

  async disconnect() {
    try {
      await this.client.quit();
      console.log('Disconnected from Redis');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
  }
}

module.exports = NotificationQueue;
