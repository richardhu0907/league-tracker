import winston from 'winston';
import path from 'path';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) =>
      `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    // print to terminal
    new winston.transports.Console(),
    // write to file — new file each day, keeps last 14 days
    new winston.transports.File({
      filename: path.join('logs', 'server.log'),
      maxsize: 5 * 1024 * 1024, // 5MB per file
      maxFiles: 14,
    }),
  ],
});

export default logger;
