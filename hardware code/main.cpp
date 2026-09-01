// GUNAKAN KODE DI IDE YANG BIASA ANDA GUNAKAN (ARDUINO IDE, PLATFORMIO, VS CODE, DLL)
// KODE DISIMPAN DISINI AGAR KETIKA HILANG DI LOKAL, MAKA BISA DITARIK KEMBALI DARI GITHUB


#define LED_PWM 6

int bendSensorValue = 0;
int light = 0;

void setup() {
  Serial.begin(9600); // Harus sama dengan baud rate di Web JS (9600)
  pinMode(LED_PWM, OUTPUT);
}

void loop() {
  bendSensorValue = analogRead(A0);

  // Kalibrasi kontrol LED lokal
  light = map(bendSensorValue, 690, 790, 255, 0);
  light = constrain(light, 0, 255);
  analogWrite(LED_PWM, light);

  // KIRIM ANGKA MURNI + NEWLINE BIAR BISA DIBACA WEB SERIAL JS
  Serial.println(bendSensorValue);

  delay(100); // 100ms cukup biar grafik di web responsif dan gak terlalu lag
}