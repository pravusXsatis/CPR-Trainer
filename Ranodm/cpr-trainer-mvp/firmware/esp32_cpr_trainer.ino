#include <Arduino.h>
#include <Wire.h>

// Optional IMU support. If an MPU6050 is not connected, the sketch still runs.
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

static const int FORCE_PIN = 34;
static const uint32_t SAMPLE_INTERVAL_MS = 20; // 50 Hz

Adafruit_MPU6050 mpu;
bool imuAvailable = false;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // ESP32 ADC: 0-4095

  Wire.begin();
  imuAvailable = mpu.begin();
  if (imuAvailable) {
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  }
}

void loop() {
  static uint32_t lastSampleMs = 0;
  const uint32_t now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) {
    return;
  }
  lastSampleMs = now;

  const int forceValue = analogRead(FORCE_PIN);

  float ax = NAN;
  float ay = NAN;
  float az = NAN;
  if (imuAvailable) {
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temp;
    mpu.getEvent(&accel, &gyro, &temp);
    ax = accel.acceleration.x;
    ay = accel.acceleration.y;
    az = accel.acceleration.z;
  }

  // Emit a compact JSON line for easy parsing in Python.
  Serial.print("{\"t\":");
  Serial.print(now);
  Serial.print(",\"force\":");
  Serial.print(forceValue);

  if (imuAvailable) {
    Serial.print(",\"ax\":");
    Serial.print(ax, 3);
    Serial.print(",\"ay\":");
    Serial.print(ay, 3);
    Serial.print(",\"az\":");
    Serial.print(az, 3);
  }

  Serial.println("}");
}
