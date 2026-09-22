# node-utimensat

Provides synchronous `utimensat(path, atime, utime)` and
`lutimensat(path, atime, utime)` functions that call the system's `utimensat`
through Node-API to set **atime and mtime** independently (`utime` specifies mtime).
`utimensat` follows symbolic links; `lutimensat` uses `AT_SYMLINK_NOFOLLOW` to
update the link itself and also works with regular files and directories.
Both functions accept the same timestamp formats.

```js
const utimensat = require('utimensat');

utimensat('./example.txt', [1700000000, 123456789], 1700000001.5);
// Preserve atime and update only mtime
utimensat('./example.txt', null, [1700000002, 42]);
// Dates are supported by both functions
utimensat('./example.txt', null, new Date('2023-11-14T22:13:20.123Z'));
// Preserve both timestamps
utimensat('./example.txt');

// Named exports are also available
const { lutimensat } = require('utimensat');
lutimensat('./link', null, [1700000002, 42]);
```

- `path`: A string path to a file or directory. Relative paths are resolved against
  the current working directory. `lutimensat` does not follow a symbolic link in
  the final path component (links in intermediate directories are still resolved)
  and supports dangling symbolic links.
- `atime` / `utime`: Each accepts any of the following formats, which can be mixed:
  - `[tv_sec, tv_nsec]`: Seconds must be a JavaScript safe integer within the
    platform's `time_t` range. Nanoseconds must be an integer from `0` to `999999999`.
  - `Number`: Unix seconds, including fractional values, rounded to the nearest
    nanosecond. NaN, Infinity, and seconds outside the safe integer range are
    rejected. Negative values are also interpreted as Unix seconds; for example,
    `-0.25` corresponds to `[-1, 750000000]`.
  - `Date`: Uses the date's Unix millisecond timestamp, preserving millisecond
    precision when converting to seconds and nanoseconds. Invalid Dates throw
    a `RangeError`.
  - `undefined` / `null` (or an omitted argument): Preserves the corresponding
    timestamp using the system's `UTIME_OMIT`, without reading file attributes first.
- Returns `undefined` on success. Throws on invalid arguments or system call
  failures. System errors include `code`, `errno` (negative), `syscall`, and `path`.

Array timestamps pass seconds and nanoseconds separately, without converting to
milliseconds. Number timestamps are subject to floating-point precision limits.
The actual stored precision and supported time range depend on the operating
system and filesystem. There is no interface for setting ctime or creation time.

## Build and test

Requires Node.js 18+, Python, make, a C compiler, and a POSIX system with
`utimensat` support. Windows is not supported. macOS requires version 10.13 or
later; Linux is the platform tested so far. npm invokes node-gyp to compile the
addon during installation. There are no runtime npm dependencies.

```sh
npm install
npm test
```

The build script automatically checks `include/node` under the running Node.js
installation prefix (including the resolved executable path). If the headers
match the running Node.js version exactly, it uses them without downloading.
Otherwise, node-gyp uses its normal header cache or downloads the required version.

Explicit node-gyp settings take precedence. To select headers manually, use
`npm_package_config_node_gyp_nodedir=/path/to/node npm install`, or
`npm run build -- --nodedir=/path/to/node`.

Implemented using [Node-API](https://nodejs.org/api/n-api.html).
