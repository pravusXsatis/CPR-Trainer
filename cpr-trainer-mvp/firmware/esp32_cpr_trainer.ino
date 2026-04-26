#include <WiFi.h>
#include <WebServer.h>

// Wi-Fi network made by ESP32
const char* ssid = "CPR_Trainer";
const char* password = "12345678";

// Web server on port 80
WebServer server(80);

// ADXL335 accelerometer pins
const int accelXPin = 34;
const int accelYPin = 35;
const int accelZPin = 32;

// FSR force sensor pin
const int forcePin = 33;

// Calibration values
int forceRestBaseline = 0;
int forceTarget = 1000;

int accelXBaseline = 0;
int accelYBaseline = 0;
int accelZBaseline = 0;

bool restCalibrated = false;
bool targetCalibrated = false;

// CPR detection variables
int compressionCount = 0;
bool inCompression = false;
unsigned long lastCompressionTime = 0;
float compressionRate = 0;

// Default threshold before target calibration
const int defaultForceThreshold = 300;

void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

int averageAnalogRead(int pin, int samples = 200, int delayMs = 5) {
  long sum = 0;

  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(delayMs);
  }

  return sum / samples;
}

void resetCompressionStats() {
  compressionCount = 0;
  inCompression = false;
  lastCompressionTime = 0;
  compressionRate = 0;
}

int getForceThreshold() {
  if (targetCalibrated) {
    return max(100, (int)(forceTarget * 0.60));
  }

  return defaultForceThreshold;
}

int getReleaseThreshold() {
  if (targetCalibrated) {
    return max(50, (int)(forceTarget * 0.20));
  }

  return defaultForceThreshold / 2;
}

void updateCompressionStats(int forceCorrected) {
  unsigned long now = millis();

  int forceThreshold = getForceThreshold();
  int releaseThreshold = getReleaseThreshold();

  if (!inCompression && forceCorrected > forceThreshold) {
    inCompression = true;
    compressionCount++;

    if (lastCompressionTime > 0) {
      unsigned long interval = now - lastCompressionTime;

      if (interval > 0) {
        compressionRate = 60000.0 / interval;
      }
    }

    lastCompressionTime = now;
  }

  if (inCompression && forceCorrected < releaseThreshold) {
    inCompression = false;
  }
}

String getRateFeedback() {
  if (compressionRate <= 0) {
    return "Start compressions";
  }

  if (compressionRate < 100) {
    return "Too slow";
  }

  if (compressionRate <= 120) {
    return "Good rate";
  }

  return "Too fast";
}

String getForceFeedback(int forceCorrected) {
  if (!targetCalibrated) {
    return "Calibrate target";
  }

  float ratio = (float)forceCorrected / (float)forceTarget;

  if (ratio < 0.60) {
    return "Push harder";
  }

  if (ratio <= 1.30) {
    return "Good compression";
  }

  return "Too hard";
}

void handleRoot() {
  addCorsHeaders();

  String html = "";
  html += "<!DOCTYPE html><html><head><title>CPR Trainer ESP32</title></head>";
  html += "<body style='font-family:Arial;text-align:center;padding:30px;'>";
  html += "<h1>CPR Trainer ESP32</h1>";
  html += "<p>ESP32 is running.</p>";
  html += "<p><a href='/data'>/data</a></p>";
  html += "<p><a href='/calibrate/rest'>/calibrate/rest</a></p>";
  html += "<p><a href='/calibrate/target'>/calibrate/target</a></p>";
  html += "</body></html>";

  server.send(200, "text/html", html);
}

void handleData() {
  int forceRaw = analogRead(forcePin);

  int accelXRaw = analogRead(accelXPin);
  int accelYRaw = analogRead(accelYPin);
  int accelZRaw = analogRead(accelZPin);

  int forceCorrected = forceRaw - forceRestBaseline;
  int accelXCorrected = accelXRaw - accelXBaseline;
  int accelYCorrected = accelYRaw - accelYBaseline;
  int accelZCorrected = accelZRaw - accelZBaseline;

  float forceVoltage = forceRaw * (3.3 / 4095.0);
  float accelXVoltage = accelXRaw * (3.3 / 4095.0);
  float accelYVoltage = accelYRaw * (3.3 / 4095.0);
  float accelZVoltage = accelZRaw * (3.3 / 4095.0);

  int motionMagnitude = abs(accelXCorrected) + abs(accelYCorrected) + abs(accelZCorrected);

  updateCompressionStats(forceCorrected);

  String rateFeedback = getRateFeedback();
  String forceFeedback = getForceFeedback(forceCorrected);

  String json = "{";
  json += "\"time\":" + String(millis()) + ",";

  json += "\"forceRaw\":" + String(forceRaw) + ",";
  json += "\"forceCorrected\":" + String(forceCorrected) + ",";
  json += "\"forceVoltage\":" + String(forceVoltage, 3) + ",";
  json += "\"forceRestBaseline\":" + String(forceRestBaseline) + ",";
  json += "\"forceTarget\":" + String(forceTarget) + ",";

  json += "\"accelXRaw\":" + String(accelXRaw) + ",";
  json += "\"accelYRaw\":" + String(accelYRaw) + ",";
  json += "\"accelZRaw\":" + String(accelZRaw) + ",";

  json += "\"accelXCorrected\":" + String(accelXCorrected) + ",";
  json += "\"accelYCorrected\":" + String(accelYCorrected) + ",";
  json += "\"accelZCorrected\":" + String(accelZCorrected) + ",";

  json += "\"accelXVoltage\":" + String(accelXVoltage, 3) + ",";
  json += "\"accelYVoltage\":" + String(accelYVoltage, 3) + ",";
  json += "\"accelZVoltage\":" + String(accelZVoltage, 3) + ",";

  json += "\"motionMagnitude\":" + String(motionMagnitude) + ",";

  json += "\"compressionCount\":" + String(compressionCount) + ",";
  json += "\"compressionRate\":" + String(compressionRate, 1) + ",";

  json += "\"rateFeedback\":\"" + rateFeedback + "\",";
  json += "\"forceFeedback\":\"" + forceFeedback + "\",";

  json += "\"restCalibrated\":" + String(restCalibrated ? "true" : "false") + ",";
  json += "\"targetCalibrated\":" + String(targetCalibrated ? "true" : "false");

  json += "}";

  addCorsHeaders();
  server.send(200, "application/json", json);
}

void handleCalibrateRest() {
  forceRestBaseline = averageAnalogRead(forcePin);

  accelXBaseline = averageAnalogRead(accelXPin);
  accelYBaseline = averageAnalogRead(accelYPin);
  accelZBaseline = averageAnalogRead(accelZPin);

  restCalibrated = true;
  targetCalibrated = false;

  resetCompressionStats();

  addCorsHeaders();

  String json = "{";
  json += "\"status\":\"rest_calibrated\",";
  json += "\"forceRestBaseline\":" + String(forceRestBaseline) + ",";
  json += "\"accelXBaseline\":" + String(accelXBaseline) + ",";
  json += "\"accelYBaseline\":" + String(accelYBaseline) + ",";
  json += "\"accelZBaseline\":" + String(accelZBaseline);
  json += "}";

  server.send(200, "application/json", json);
}

void handleCalibrateTarget() {
  int targetReading = averageAnalogRead(forcePin);

  forceTarget = targetReading - forceRestBaseline;

  if (forceTarget < 100) {
    forceTarget = 100;
  }

  targetCalibrated = true;

  resetCompressionStats();

  addCorsHeaders();

  String json = "{";
  json += "\"status\":\"target_calibrated\",";
  json += "\"forceTarget\":" + String(forceTarget);
  json += "}";

  server.send(200, "application/json", json);
}

void handleCalibrateLegacy() {
  handleCalibrateRest();
}

void handleOptions() {
  addCorsHeaders();
  server.send(204);
}

void setup() {
  Serial.begin(115200);

  analogReadResolution(12);

  WiFi.softAP(ssid, password);

  Serial.println();
  Serial.println("ESP32 Wi-Fi started.");
  Serial.print("Wi-Fi name: ");
  Serial.println(ssid);
  Serial.print("Password: ");
  Serial.println(password);
  Serial.print("Open this IP: ");
  Serial.println(WiFi.softAPIP());

  server.on("/", HTTP_GET, handleRoot);

  server.on("/data", HTTP_GET, handleData);
  server.on("/data", HTTP_OPTIONS, handleOptions);

  server.on("/calibrate", HTTP_GET, handleCalibrateLegacy);
  server.on("/calibrate", HTTP_OPTIONS, handleOptions);

  server.on("/calibrate/rest", HTTP_GET, handleCalibrateRest);
  server.on("/calibrate/rest", HTTP_OPTIONS, handleOptions);

  server.on("/calibrate/target", HTTP_GET, handleCalibrateTarget);
  server.on("/calibrate/target", HTTP_OPTIONS, handleOptions);

  server.begin();

  Serial.println("Web server started.");
}

void loop() {
  server.handleClient();
}