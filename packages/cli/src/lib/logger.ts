export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  level: LogLevel;
  message: string;
  context?: Record<string, string | number | boolean | null>;
}

/**
 * Writes a structured log event to stderr.
 * @param event Event payload with level, message, and optional context.
 * @returns Nothing.
 */
export function log(event: LogEvent): void {
  const payload = JSON.stringify({
    level: event.level,
    message: event.message,
    context: event.context ?? {},
    timestamp: new Date().toISOString(),
  });

  process.stderr.write(`${payload}\n`);
}
