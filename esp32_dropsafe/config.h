#pragma once

// Wi-Fi, endpoint and device token live in secrets.h (git-ignored).
// Copy secrets.example.h to secrets.h before compiling.
#include "secrets.h"

// Identity must match server/.env and the dashboard VITE_ values.
#define DEVICE_ID "dropsafe-01"
#define BAG_ID "IV-01"
#define FIRMWARE_VERSION "1.0.0"

// ── HX711 wiring ─────────────────────────────────────────────────────────────
#define HX711_DT_PIN 18
#define HX711_SCK_PIN 19

// Calibrated on this rig: empty hanging assembly -> 0 mL, full bag (490-495 mL) -> ~492 mL.
constexpr float CALIBRATION_FACTOR = 187.9f;

// Only tare at boot when the load cell is UNLOADED. The dashboard subtracts
// EMPTY_BAG_TARE_G from the gross weight, so taring with the bag attached would
// double-count the bag.
constexpr bool TARE_ON_BOOT = true;

// ── Fluid model (keep aligned with src/lib/calculations.ts and server/.env) ──
// Zero offset fitted together with CALIBRATION_FACTOR so that the emptied bag
// reads 0 mL and the full bag reads its true volume. It is not the physical bag
// mass: changing the factor requires refitting this value (see README).
constexpr float EMPTY_BAG_TARE_G = 95.6f;
constexpr float FLUID_DENSITY_G_PER_ML = 1.005f;
constexpr float INITIAL_VOLUME_ML = 500.0f;
constexpr float MAX_LOAD_G = 5000.0f;
constexpr float LOW_ML = 100.0f;
constexpr float CRITICAL_ML = 25.0f;

// ── Timing ───────────────────────────────────────────────────────────────────
constexpr uint32_t SAMPLE_INTERVAL_MS = 1000;
constexpr uint32_t PUBLISH_INTERVAL_MS = 5000;
constexpr uint32_t HTTP_TIMEOUT_MS = 8000;
constexpr uint32_t WIFI_RETRY_MS = 10000;
constexpr uint32_t NTP_RETRY_MS = 60000;
constexpr uint32_t FLUSH_INTERVAL_MS = 1000;

// Readings kept in RAM while offline. Oldest are dropped when the queue is full.
constexpr size_t OFFLINE_QUEUE_SIZE = 24;

// ── Local alarm ──────────────────────────────────────────────────────────────
#define BUZZER_PIN 4
#define STATUS_LED_PIN 2
constexpr bool BUZZER_ACTIVE = true;

// NEVER enable this in production. It disables HTTPS certificate verification
// and is only for local development with a self-signed gateway.
#define TLS_INSECURE 1
