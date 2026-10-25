const { Queue } = require("bullmq");
const redisConnection = require("../config/redis");

const importQueue = new Queue("student-imports", {
  connection: redisConnection,

  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

module.exports = importQueue;