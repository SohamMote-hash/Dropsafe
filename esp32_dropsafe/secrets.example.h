#pragma once

// Copy this file to secrets.h and fill in the values. secrets.h is git-ignored.
// Generate the token/hash pair with: npm run device-token

#define WIFI_SSID "YOUR_WIFI_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// HTTPS URL of the write gateway, not the Firebase database URL.
#define API_URL "https://your-gateway.example.com/api/telemetry"

// The raw token from `npm run device-token`. Only its SHA-256 hash goes in .env.
#define DEVICE_TOKEN "PASTE_THE_64_CHARACTER_DEVICE_TOKEN_HERE"

// Root CA of the gateway's TLS certificate. Paste the full PEM chain here.
// For Let's Encrypt this is usually ISRG Root X1; you can download it from
// https://letsencrypt.org/certs/isrgrootx1.pem and paste it between the markers.
// If you use Cloudflare Tunnel / a cloud host, use that provider's root CA.
static const char ROOT_CA[] = R"PEM(
-----BEGIN CERTIFICATE-----
PASTE_THE_ROOT_CA_PEM_HERE
-----END CERTIFICATE-----
)PEM";
