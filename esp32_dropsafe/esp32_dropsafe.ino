// DropSafe ESP32 firmware
// HX711 load cell -> weight, remaining mL, remaining % -> HTTPS gateway -> Firebase RTDB.
// Local monitoring and the buzzer/LED alarm keep working when Wi-Fi or the internet is down.
//
// Libraries (Arduino IDE -> Library Manager):
//   - HX711 by Bogdan Necula
// Board: ESP32 Dev Module (or your ESP32 variant).
// Wiring: HX711 DT -> GPIO 18, HX711 SCK -> GPIO 19.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HX711.h>
#include <time.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include "config.h"

HX711 scale;
WiFiClientSecure secureClient;
HTTPClient http;

enum class LocalStatus { NORMAL, LOW_LEVEL, CRITICAL, FAULT };

struct Sample {
  float weightG;
  float volumeMl;
  float percent;
  bool sensorOk;
  bool alarm;
  int rssi;
  uint32_t uptimeSec;
  unsigned long long recordedAtMs;
  LocalStatus status;
  uint32_t seq;
};

Sample currentSample = {};
LocalStatus currentStatus = LocalStatus::NORMAL;
LocalStatus alarmStatus = LocalStatus::NORMAL;
bool alarmOutputOn = false;

// The offline queue is shared between the sampling loop (producer) and the network
// task (consumer), so every access goes through queueMutex.
Sample queue[OFFLINE_QUEUE_SIZE];
size_t queueHead = 0;
size_t queueCount = 0;
uint32_t nextSeq = 1;
SemaphoreHandle_t queueMutex = nullptr;

unsigned long lastSampleAt = 0;
unsigned long lastPublishAt = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastNtpAttempt = 0;
bool tlsReady = false;

// ── Time ─────────────────────────────────────────────────────────────────────
unsigned long long epochMs() {
  const time_t seconds = time(nullptr);
  // Before NTP sync, send 0; the gateway stamps the reading with server time.
  // Whole seconds keep the timestamp monotonic, so out-of-order samples are not rejected.
  if (seconds < 1700000000) return 0;
  return static_cast<unsigned long long>(seconds) * 1000ULL;
}

void maybeSyncTime() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (time(nullptr) > 1700000000) return;
  if (lastNtpAttempt != 0 && millis() - lastNtpAttempt < NTP_RETRY_MS) return;

  lastNtpAttempt = millis();
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  Serial.println("Requesting NTP time...");
}

// ── Wi-Fi ────────────────────────────────────────────────────────────────────
void startWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWifiAttempt = millis();
}

bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  if (millis() - lastWifiAttempt >= WIFI_RETRY_MS) {
    lastWifiAttempt = millis();
    Serial.println("Wi-Fi reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
  return false;
}

// ── Local alarm (non-blocking) ───────────────────────────────────────────────
const char* statusName(LocalStatus status) {
  switch (status) {
    case LocalStatus::LOW_LEVEL: return "LOW";
    case LocalStatus::CRITICAL: return "CRITICAL";
    case LocalStatus::FAULT: return "SENSOR_FAULT";
    default: return "NORMAL";
  }
}

void updateAlarm(LocalStatus status) {
  if (status != alarmStatus) {
    alarmStatus = status;
    if (BUZZER_ACTIVE) noTone(BUZZER_PIN);
    digitalWrite(STATUS_LED_PIN, LOW);
    alarmOutputOn = false;
  }
  if (status == LocalStatus::NORMAL) return;

  unsigned long period = 0;
  unsigned long onMs = 0;
  switch (status) {
    case LocalStatus::CRITICAL: period = 500; onMs = 250; break;
    case LocalStatus::FAULT: period = 1000; onMs = 100; break;
    default: return; // LOW_LEVEL: LED and buzzer stay off
  }

  const bool shouldBeOn = (millis() % period) < onMs;
  if (shouldBeOn && !alarmOutputOn) {
    if (BUZZER_ACTIVE) tone(BUZZER_PIN, status == LocalStatus::CRITICAL ? 2500 : 1800);
    digitalWrite(STATUS_LED_PIN, HIGH);
    alarmOutputOn = true;
  } else if (!shouldBeOn && alarmOutputOn) {
    if (BUZZER_ACTIVE) noTone(BUZZER_PIN);
    digitalWrite(STATUS_LED_PIN, LOW);
    alarmOutputOn = false;
  }
}

// ── Sensor ───────────────────────────────────────────────────────────────────
void readAndUpdate() {
  bool sensorOk = scale.is_ready();
  float weightG = NAN;

  if (sensorOk) {
    weightG = scale.get_units(3);
    if (!isfinite(weightG) || weightG < 0.0f || weightG > MAX_LOAD_G) {
      sensorOk = false;
    }
  }

  float volumeMl = 0.0f;
  float percent = 0.0f;
  LocalStatus status = LocalStatus::FAULT;

  if (sensorOk) {
    volumeMl = (weightG - EMPTY_BAG_TARE_G) / FLUID_DENSITY_G_PER_ML;
    if (volumeMl < 0.0f) volumeMl = 0.0f;
    percent = (volumeMl / INITIAL_VOLUME_ML) * 100.0f;
    if (percent < 0.0f) percent = 0.0f;
    if (percent > 100.0f) percent = 100.0f;

    if (volumeMl <= CRITICAL_ML) status = LocalStatus::CRITICAL;
    else if (volumeMl <= LOW_ML) status = LocalStatus::LOW_LEVEL;
    else status = LocalStatus::NORMAL;
  }

  currentStatus = status;
  currentSample.weightG = weightG;
  currentSample.volumeMl = volumeMl;
  currentSample.percent = percent;
  currentSample.sensorOk = sensorOk;
  currentSample.alarm = status != LocalStatus::NORMAL;
  currentSample.rssi = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
  currentSample.uptimeSec = millis() / 1000UL;
  currentSample.recordedAtMs = epochMs();
  currentSample.status = status;
}

// ── Offline queue ────────────────────────────────────────────────────────────
void enqueue(Sample sample) {
  if (!queueMutex) return;
  if (xSemaphoreTake(queueMutex, portMAX_DELAY) != pdTRUE) return;

  sample.seq = nextSeq++;
  if (queueCount == OFFLINE_QUEUE_SIZE) {
    queueHead = (queueHead + 1) % OFFLINE_QUEUE_SIZE; // drop the oldest
    queueCount--;
  }
  queue[(queueHead + queueCount) % OFFLINE_QUEUE_SIZE] = sample;
  queueCount++;

  xSemaphoreGive(queueMutex);
}

/** Reads the newest sample without removing it. */
bool peekNewest(Sample& out) {
  if (!queueMutex) return false;
  if (xSemaphoreTake(queueMutex, portMAX_DELAY) != pdTRUE) return false;

  const bool available = queueCount > 0;
  if (available) out = queue[(queueHead + queueCount - 1) % OFFLINE_QUEUE_SIZE];

  xSemaphoreGive(queueMutex);
  return available;
}

/** Drops the sent sample plus anything older, so a reconnect never replays a backlog. */
void popThrough(uint32_t seq) {
  if (!queueMutex) return;
  if (xSemaphoreTake(queueMutex, portMAX_DELAY) != pdTRUE) return;

  while (queueCount > 0 && queue[queueHead].seq != seq) {
    queueHead = (queueHead + 1) % OFFLINE_QUEUE_SIZE;
    queueCount--;
  }
  if (queueCount > 0) {
    queueHead = (queueHead + 1) % OFFLINE_QUEUE_SIZE;
    queueCount--;
  }

  xSemaphoreGive(queueMutex);
}

// ── HTTPS gateway ────────────────────────────────────────────────────────────
String buildPayload(const Sample& sample) {
  char timestamp[24];
  snprintf(timestamp, sizeof(timestamp), "%llu", sample.recordedAtMs);

  String payload = "{";
  payload += "\"deviceId\":\"" DEVICE_ID "\",";
  payload += "\"bagId\":\"" BAG_ID "\",";
  payload += "\"firmware\":\"" FIRMWARE_VERSION "\",";
  payload += "\"sensorOk\":";
  payload += sample.sensorOk ? "true" : "false";
  payload += ",\"weightG\":";
  if (sample.sensorOk) payload += String(sample.weightG, 2); else payload += "null";
  payload += ",\"volumeMl\":";
  if (sample.sensorOk) payload += String(sample.volumeMl, 1); else payload += "null";
  payload += ",\"percent\":";
  if (sample.sensorOk) payload += String(sample.percent, 1); else payload += "0";
  payload += ",\"status\":\"";
  payload += statusName(sample.status);
  payload += "\",\"alarm\":";
  payload += sample.alarm ? "true" : "false";
  payload += ",\"rssi\":";
  payload += String(sample.rssi);
  payload += ",\"uptimeSec\":";
  payload += String(sample.uptimeSec);
  payload += ",\"publishIntervalSec\":";
  payload += String((PUBLISH_INTERVAL_MS + 999) / 1000);
  payload += ",\"recordedAt\":";
  payload += timestamp;
  payload += "}";
  return payload;
}

bool ensureTls() {
  if (tlsReady) return true;
#if TLS_INSECURE
  secureClient.setInsecure();
  Serial.println("WARNING: TLS certificate verification is disabled.");
  tlsReady = true;
#else
  if (strlen(ROOT_CA) == 0) {
    Serial.println("ERROR: ROOT_CA is empty. Add the gateway root CA to secrets.h.");
    return false;
  }
  secureClient.setCACert(ROOT_CA);
  tlsReady = true;
#endif
  return true;
}

struct SendOutcome {
  int code;                    // HTTP status, or 0 when nothing was sent
  unsigned long retryAfterMs;  // gateway hint from HTTP 429
};

SendOutcome sendSample(const Sample& sample) {
  SendOutcome outcome = {0, 0};
  if (WiFi.status() != WL_CONNECTED) return outcome;
  if (!ensureTls()) return outcome;

  if (!http.begin(secureClient, API_URL)) {
    Serial.println("HTTP begin failed (URL?).");
    return outcome;
  }
  // Keep the TLS connection open where the gateway allows it: skips a handshake per publish.
  http.setReuse(true);
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  const String payload = buildPayload(sample);
  const int code = http.POST(payload);
  const String response = http.getString();
  outcome.code = code;
  if (code == 429) {
    const long seconds = http.header("Retry-After").toInt();
    outcome.retryAfterMs = seconds > 0 ? static_cast<unsigned long>(seconds) * 1000UL : 2000UL;
  }
  http.end();

  if (code >= 200 && code < 300) {
    Serial.printf("Published %s %.1f mL (HTTP %d)\n",
      statusName(sample.status), sample.volumeMl, code);
    return outcome;
  }

  Serial.printf("Publish failed (HTTP %d): %s\n", code, response.c_str());
  return outcome;
}

/**
 * Drains the queue in a separate task so a slow or unreachable gateway can never
 * delay sampling or the local buzzer/LED alarm.
 */
void networkTask(void*) {
  unsigned long lastSendAt = millis() - SEND_GAP_MS;

  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    Sample sample;
    if (!peekNewest(sample)) {
      vTaskDelay(pdMS_TO_TICKS(QUEUE_POLL_MS));
      continue;
    }

    // Respect the gateway's rate limit even when catching up after an outage.
    const unsigned long sinceLast = millis() - lastSendAt;
    if (sinceLast < SEND_GAP_MS) {
      vTaskDelay(pdMS_TO_TICKS(SEND_GAP_MS - sinceLast));
      continue;
    }

    lastSendAt = millis();
    const SendOutcome outcome = sendSample(sample);

    if (outcome.code >= 200 && outcome.code < 300) {
      popThrough(sample.seq);
    } else if (outcome.code == 429) {
      vTaskDelay(pdMS_TO_TICKS(outcome.retryAfterMs));
    } else {
      vTaskDelay(pdMS_TO_TICKS(5000)); // gateway unreachable: back off, keep sampling
    }
  }
}

// ── Serial calibration helpers ───────────────────────────────────────────────
// Send these lines at 115200 baud in the Serial Monitor:
//   status            -> current weight/volume/status
//   raw               -> raw HX711 value and current units
//   tare              -> zero the scale (load cell MUST be unloaded)
//   cal <known_grams> -> after tare + placing a known weight, prints a new factor
void handleSerialCommands() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return;

  if (line == "status") {
    Serial.printf("weight=%.2f g volume=%.1f mL percent=%.1f status=%s\n",
      currentSample.weightG, currentSample.volumeMl, currentSample.percent, statusName(currentStatus));
  } else if (line == "raw") {
    Serial.printf("raw=%ld units=%.2f\n", scale.read_average(5), scale.get_units(5));
  } else if (line == "tare") {
    scale.tare();
    Serial.println("Tared. The load cell must have been unloaded.");
  } else if (line.startsWith("cal ")) {
    const float knownGrams = line.substring(4).toFloat();
    if (knownGrams <= 0.0f) {
      Serial.println("Usage: cal 500");
      return;
    }
    scale.set_scale(1.0f);
    const long raw = scale.get_value(10);
    const float factor = static_cast<float>(raw) / knownGrams;
    Serial.printf("raw=%ld known=%.1f g -> set CALIBRATION_FACTOR = %.2f\n", raw, knownGrams, factor);
    scale.set_scale(CALIBRATION_FACTOR);
  } else {
    Serial.println("Commands: status | raw | tare | cal <known_grams>");
  }
}

// ── Arduino lifecycle ────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  scale.begin(HX711_DT_PIN, HX711_SCK_PIN);
  scale.set_scale(CALIBRATION_FACTOR);
  if (TARE_ON_BOOT) {
    delay(500);
    scale.tare();
  }

  startWifi();
  readAndUpdate();

  queueMutex = xSemaphoreCreateMutex();
  if (queueMutex) {
    xTaskCreatePinnedToCore(networkTask, "dropsafe-net", 12288, nullptr, 1, nullptr, 0);
  } else {
    Serial.println("WARNING: could not create the network queue mutex; uploads disabled.");
  }

  Serial.println("DropSafe ESP32 ready. Local monitoring and alarms are active.");
}

void loop() {
  handleSerialCommands();
  ensureWifi();
  maybeSyncTime();

  const unsigned long now = millis();

  if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
    lastSampleAt = now;
    readAndUpdate();
  }

  if (now - lastPublishAt >= PUBLISH_INTERVAL_MS) {
    lastPublishAt = now;
    enqueue(currentSample);
  }

  updateAlarm(currentStatus);
  delay(10);
}
