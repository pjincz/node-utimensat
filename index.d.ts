/** Synchronously set atime and mtime, following symbolic links.
 * Numbers are Unix seconds (fractions rounded to nanoseconds).
 * Dates use their Unix millisecond timestamp; invalid Dates are rejected.
 * null/undefined preserve the corresponding timestamp using UTIME_OMIT.
 */
declare function utimensat(
  path: string,
  atime?: utimensat.Time,
  utime?: utimensat.Time
): void;
declare namespace utimensat {
  /** Unix seconds, a Date, an exact [seconds, nanoseconds] pair, or UTIME_OMIT. */
  type Time = number | Date | readonly [number, number] | null | undefined;
  /** Set the target's timestamps, following symbolic links. */
  function utimensat(path: string, atime?: Time, utime?: Time): void;
  /** Set the symbolic link's own timestamps. Uses the same time formats. */
  function lutimensat(path: string, atime?: Time, utime?: Time): void;
}
export = utimensat;
