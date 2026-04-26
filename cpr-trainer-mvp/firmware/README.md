Board: ESP32 Dev Module
Upload baud: 115200 or 921600
Serial Monitor baud: 115200

Wiring:
ADXL335 XOUT → GPIO34
ADXL335 YOUT → GPIO35
ADXL335 ZOUT → GPIO32
FSR middle node → GPIO33
ADXL335 VCC → 3.3V
ADXL335 GND → GND
FSR voltage divider: 3.3V → FSR → GPIO33 → 10kΩ → GND

Endpoints:
GET /data
GET /calibrate/rest
GET /calibrate/target