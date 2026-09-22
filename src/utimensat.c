#include <node_api.h>
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>

#define NAPI_CHECK(call) do { \
  if ((call) != napi_ok) { \
    napi_throw_error(env, NULL, "Node-API operation failed"); \
    return NULL; \
  } \
} while (0)

static napi_value parse_time(napi_env env, napi_value value, struct timespec *out) {
  napi_valuetype type;
  NAPI_CHECK(napi_typeof(env, value, &type));
  if (type == napi_null || type == napi_undefined) {
    out->tv_sec = 0;
    out->tv_nsec = UTIME_OMIT;
    return value;
  }
  bool is_array;
  uint32_t length;
  NAPI_CHECK(napi_is_array(env, value, &is_array));
  if (!is_array) {
    napi_throw_type_error(env, NULL, "Expected timestamp array or null");
    return NULL;
  }
  NAPI_CHECK(napi_get_array_length(env, value, &length));
  if (length != 2) {
    napi_throw_type_error(env, NULL, "Expected [tv_sec, tv_nsec]");
    return NULL;
  }
  napi_value sec_value, nsec_value;
  double seconds, nanoseconds;
  NAPI_CHECK(napi_get_element(env, value, 0, &sec_value));
  NAPI_CHECK(napi_get_element(env, value, 1, &nsec_value));
  NAPI_CHECK(napi_get_value_double(env, sec_value, &seconds));
  NAPI_CHECK(napi_get_value_double(env, nsec_value, &nanoseconds));
  // Check before casting, including when the native module is loaded directly.
  if (!(seconds >= -9007199254740991.0 && seconds <= 9007199254740991.0) ||
      seconds != (double)(int64_t)seconds ||
      !(nanoseconds >= 0 && nanoseconds <= 999999999) ||
      nanoseconds != (double)(long)nanoseconds) {
    napi_throw_range_error(env, NULL, "Invalid timestamp");
    return NULL;
  }
  int64_t sec = (int64_t)seconds;
  time_t native_sec = (time_t)sec;
  if ((int64_t)native_sec != sec || ((time_t)-1 > 0 && sec < 0)) {
    napi_throw_range_error(env, NULL, "tv_sec is outside the platform time_t range");
    return NULL;
  }

  out->tv_sec = native_sec;
  out->tv_nsec = (long)nanoseconds;
  return value;
}

static napi_value call_utimensat(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value argv[4];
  NAPI_CHECK(napi_get_cb_info(env, info, &argc, argv, NULL, NULL));
  if (argc != 4) {
    napi_throw_type_error(env, NULL, "Expected path, atime, utime, nofollow");
    return NULL;
  }
  bool nofollow;
  NAPI_CHECK(napi_get_value_bool(env, argv[3], &nofollow));
  size_t length;
  NAPI_CHECK(napi_get_value_string_utf8(env, argv[0], NULL, 0, &length));
  struct timespec times[2];
  if (parse_time(env, argv[1], &times[0]) == NULL ||
      parse_time(env, argv[2], &times[1]) == NULL) return NULL;

  char *path = malloc(length + 1);
  if (path == NULL) {
    napi_throw_error(env, NULL, "Unable to allocate path");
    return NULL;
  }
  napi_status status = napi_get_value_string_utf8(env, argv[0], path, length + 1, &length);
  if (status != napi_ok || memchr(path, '\0', length) != NULL) {
    free(path);
    napi_throw_type_error(env, NULL, "Invalid path");
    return NULL;
  }

  int result = utimensat(AT_FDCWD, path, times, nofollow ? AT_SYMLINK_NOFOLLOW : 0);
  int saved_errno = result == 0 ? 0 : errno;
  free(path);

  napi_value value;
  NAPI_CHECK(napi_create_int32(env, saved_errno, &value));
  return value;
}

static napi_value init(napi_env env, napi_value exports) {
  (void)exports;
  napi_value function;
  NAPI_CHECK(napi_create_function(env, "utimensat", NAPI_AUTO_LENGTH,
                                  call_utimensat, NULL, &function));
  return function;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
