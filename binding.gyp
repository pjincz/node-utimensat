{
  "targets": [{
    "target_name": "utimensat",
    "sources": ["src/utimensat.c"],
    "defines": ["_POSIX_C_SOURCE=200809L", "NAPI_VERSION=8"],
    "cflags": ["-std=c11", "-Wall", "-Wextra"]
  }]
}
