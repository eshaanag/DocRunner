export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: boolean | number | string | null | undefined;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

/**
 * Creates a structured logger that writes JSON lines to process streams.
 * @param minimumLevel Lowest log level that should be emitted.
 * @returns Logger with debug, info, warn, and error methods.
 */
export function createLogger(minimumLevel: LogLevel = "info"): Logger {
  const levels: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  /**
   * Writes one structured log line when its level meets the configured threshold.
   * @param level Severity assigned to this log entry.
   * @param message Human-readable event description.
   * @param fields Structured context for the event.
   * @returns Nothing.
   */
  function write(
    level: LogLevel,
    message: string,
    fields: LogFields = {},
  ): void {
    if (levels[level] < levels[minimumLevel]) {
      return;
    }

    const line = `${JSON.stringify({ level, message, ...fields })}\n`;
    const stream = level === "error" ? process.stderr : process.stdout;
    stream.write(line);
  }

  /** Writes a debug event. */
  function debug(message: string, fields?: LogFields): void {
    write("debug", message, fields);
  }

  /** Writes an informational event. */
  function info(message: string, fields?: LogFields): void {
    write("info", message, fields);
  }

  /** Writes a warning event. */
  function warn(message: string, fields?: LogFields): void {
    write("warn", message, fields);
  }

  /** Writes an error event. */
  function error(message: string, fields?: LogFields): void {
    write("error", message, fields);
  }

  return {
    debug,
    info,
    warn,
    error,
  };
}

export const logger = createLogger();
