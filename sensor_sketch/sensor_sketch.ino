const int trigPin = 12;
const int echoPin = 13;
const int lightSensorPin = A0;

void setup() {
  Serial.begin(9600);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
}

void loop() {
  // Measure distance
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH);
  float distance = duration * 0.0343 / 2;

  // Read light level
  int lightLevel = analogRead(lightSensorPin);

  // Send both values, comma-separated
  Serial.print(distance);
  Serial.print(",");
  Serial.println(lightLevel);

  delay(500);
}
