/**
 * Monitoring and error tracking module
 * Integrates with services like Sentry, DataDog, or custom logging
 */

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error" | "critical";
  service: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface MetricEntry {
  timestamp: string;
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

class Logger {
  private serviceName: string;
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory
  private sentryDSN?: string;

  constructor(serviceName: string, sentryDSN?: string) {
    this.serviceName = serviceName;
    this.sentryDSN = sentryDSN;
  }

  private formatLog(
    level: LogEntry["level"],
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    userId?: string,
    requestId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      context,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            code: (error as any).code,
          }
        : undefined,
      userId,
      requestId,
    };
  }

  private async sendToSentry(entry: LogEntry): Promise<void> {
    // Only send errors and critical logs to Sentry
    if (!this.sentryDSN || !["error", "critical"].includes(entry.level)) {
      return;
    }

    try {
      await fetch(this.sentryDSN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: entry.message,
          level: entry.level,
          timestamp: entry.timestamp,
          tags: {
            service: entry.service,
            userId: entry.userId,
          },
          contexts: {
            app: entry.context,
          },
          exception: entry.error
            ? {
                values: [
                  {
                    type: entry.error.code || "Error",
                    value: entry.error.message,
                    stacktrace: {
                      frames: parseStackTrace(entry.error.stack),
                    },
                  },
                ],
              }
            : undefined,
        }),
      });
    } catch (err) {
      console.error("Failed to send log to Sentry:", err);
    }
  }

  debug(
    message: string,
    context?: Record<string, unknown>,
    requestId?: string
  ): void {
    const entry = this.formatLog("debug", message, context, undefined, undefined, requestId);
    this.storeLog(entry);
    console.log(`[DEBUG] ${message}`, context);
  }

  info(
    message: string,
    context?: Record<string, unknown>,
    requestId?: string
  ): void {
    const entry = this.formatLog("info", message, context, undefined, undefined, requestId);
    this.storeLog(entry);
    console.log(`[INFO] ${message}`, context);
  }

  warn(
    message: string,
    context?: Record<string, unknown>,
    requestId?: string
  ): void {
    const entry = this.formatLog("warn", message, context, undefined, undefined, requestId);
    this.storeLog(entry);
    console.warn(`[WARN] ${message}`, context);
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
    userId?: string,
    requestId?: string
  ): void {
    const entry = this.formatLog(
      "error",
      message,
      context,
      error,
      userId,
      requestId
    );
    this.storeLog(entry);
    this.sendToSentry(entry).catch(() => {});
    console.error(`[ERROR] ${message}`, error, context);
  }

  critical(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
    userId?: string,
    requestId?: string
  ): void {
    const entry = this.formatLog(
      "critical",
      message,
      context,
      error,
      userId,
      requestId
    );
    this.storeLog(entry);
    this.sendToSentry(entry).catch(() => {});
    console.error(`[CRITICAL] ${message}`, error, context);
  }

  private storeLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }
  }

  getLogs(
    level?: LogEntry["level"],
    limit: number = 100
  ): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = filtered.filter((log) => log.level === level);
    }
    return filtered.slice(-limit);
  }

  clearLogs(): void {
    this.logs = [];
  }
}

class MetricsCollector {
  private metrics: MetricEntry[] = [];
  private maxMetrics = 10000;
  private datadog?: {
    apiKey: string;
    site: string;
  };

  constructor(datadogApiKey?: string) {
    if (datadogApiKey) {
      this.datadog = {
        apiKey: datadogApiKey,
        site: "datadoghq.com",
      };
    }
  }

  recordMetric(
    name: string,
    value: number,
    unit: string = "count",
    tags?: Record<string, string>
  ): void {
    const entry: MetricEntry = {
      timestamp: new Date().toISOString(),
      name,
      value,
      unit,
      tags,
    };

    this.metrics.push(entry);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    this.sendToDatadog(entry).catch(() => {});
  }

  recordHistogram(
    name: string,
    value: number,
    unit: string = "ms"
  ): void {
    this.recordMetric(`${name}.histogram`, value, unit);
  }

  recordCounter(name: string, increment: number = 1): void {
    this.recordMetric(`${name}.counter`, increment, "count");
  }

  recordGauge(name: string, value: number): void {
    this.recordMetric(`${name}.gauge`, value, "value");
  }

  private async sendToDatadog(entry: MetricEntry): Promise<void> {
    if (!this.datadog) return;

    try {
      const timestamp = Math.floor(
        new Date(entry.timestamp).getTime() / 1000
      );
      await fetch(`https://api.${this.datadog.site}/api/v1/series`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": this.datadog.apiKey,
        },
        body: JSON.stringify({
          series: [
            {
              metric: `app.${entry.name}`,
              points: [[timestamp, entry.value]],
              type: "gauge",
              tags: Object.entries(entry.tags || {}).map(
                ([k, v]) => `${k}:${v}`
              ),
            },
          ],
        }),
      });
    } catch (err) {
      console.error("Failed to send metrics to DataDog:", err);
    }
  }

  getMetrics(
    name?: string,
    limit: number = 100
  ): MetricEntry[] {
    let filtered = this.metrics;
    if (name) {
      filtered = filtered.filter((m) => m.name === name);
    }
    return filtered.slice(-limit);
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

function parseStackTrace(
  stack?: string
): Array<{
  filename: string;
  function: string;
  lineno: number;
}> {
  if (!stack) return [];

  const lines = stack.split("\n").slice(1);
  return lines
    .map((line) => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+)/);
      if (!match) return null;

      return {
        function: match[1] || "unknown",
        filename: match[2],
        lineno: parseInt(match[3], 10),
      };
    })
    .filter((f) => f !== null) as Array<{
    filename: string;
    function: string;
    lineno: number;
  }>;
}

// Export singleton instances
export const logger = new Logger(
  "quiz-maker",
  Deno.env.get("SENTRY_DSN")
);
export const metrics = new MetricsCollector(
  Deno.env.get("DATADOG_API_KEY")
);

// Convenience function for measuring execution time
export const measureAsync = async <T extends unknown>(
  name: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    metrics.recordHistogram(name, duration, "ms");
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    metrics.recordHistogram(`${name}.error`, duration, "ms");
    throw error;
  }
};
