#include <ESP8266WiFi.h>
#include <WiFiUdp.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_NeoPixel.h>
#ifdef __AVR__
#include <avr/power.h>
#endif
#define PIN 2
int num_leds = 24; //single ring 24, 3x ring 148, matrix 256
byte brightness = 50;
Adafruit_NeoPixel* strip = NULL;
const int buildNo = 121;
const char* ssid = "*****";
const char* pass = "*****";
const String remoteURL = "http://192.168.******:8088/register?";
const int uPort = 81;
const int hPort = 80;
boolean activeLED = false;
int lastMillisHR = 0;
byte packetBuffer[256*3+16];
StaticJsonDocument<1024> json;
WiFiClient client;
HTTPClient httpClientLED;
ESP8266WebServer httpServer(hPort);
WiFiUDP Udp;

void reStartNeopixel(){
  if (strip != NULL) {
    delete strip;
  }
  strip = new Adafruit_NeoPixel(num_leds, PIN, NEO_GRB + NEO_KHZ800);
  strip->setBrightness(brightness);
  strip->begin();
}

void handleRoot() {
  String message = "<h1>ESP Zauberlicht Debug</h1>";
  message += "Anzahl LEDs: " + String(num_leds) + "<br>";
  message += "Heilligkeit: " + String(brightness) + "<br>";
  if (activeLED)
    message += "LEDs aktiv<br>";
  else 
    message += "LED inaktiv<br>";
  message += "MAC: " + WiFi.macAddress() + "<br>";
  message += "IP: " + WiFi.localIP().toString() + "<br>";
  httpServer.send(200, "text/html", message);
}

void enableWLAN() {
  WiFi.begin(ssid, pass);
  while ( WiFi.status() != WL_CONNECTED ) {
    delay ( 100 );
  }
  String mac = WiFi.macAddress();
}
void setup() {
  Serial.begin(115200);
  enableWLAN();
  registerUDP();
  httpServer.on("/", handleRoot);
  httpServer.begin();
  Udp.begin(uPort);
}

void registerUDP() {
  httpClientLED.begin(client, remoteURL
                      +  "%7B%22mac%22%3A%22" + WiFi.macAddress()
                      +  "%22%2C%22ip%22%3A%22" + WiFi.localIP().toString()
                      +  "%22%2C%22leds%22%3A%22" + String(num_leds)
                      + "%22%2C%22fw%22%3A" + String(buildNo) + "%7D");
  if (httpClientLED.GET() > 0) {
    String s = httpClientLED.getString();
    DeserializationError error = deserializeJson(json, s);
    if (!error) {
      num_leds = int(json["num_led"]);
      brightness = int(json["brightness"]);
      activeLED = int(json["activeLED"]);
    } else {
      num_leds = 16;
      brightness = 20;
      activeLED = 1;
    }
     reStartNeopixel();      
  }
  httpClientLED.end();
}

void listenUDP() {
  if (strip == NULL) return;
  int packetSize = Udp.parsePacket();
  if (packetSize) {
    int len = Udp.read(packetBuffer, 256*3+5);
    if (len > 1) {
      byte crtl = packetBuffer[0];
      if ((crtl == 76 ) && activeLED && (len > (num_leds * 3))) { //L
        for (uint16_t i = 0; i < num_leds; i++)
          strip->setPixelColor(i, strip->Color(packetBuffer[i * 3 + 1], packetBuffer[i * 3 + 2], packetBuffer[i * 3 + 3]));
        strip->show();
      } else if (crtl == 66) { //B
        brightness = packetBuffer[1];
        strip->setBrightness(brightness);
      } else if (crtl == 78 && len > 2) { //N
        num_leds = (int)packetBuffer[1]+256*(int)packetBuffer[2];        
        reStartNeopixel();
      } else if (crtl == 80) { //P
        activeLED = packetBuffer[1];
        if (!activeLED) {
          for (uint16_t i = 0; i < num_leds; i++)
            strip->setPixelColor(i, strip->Color(200, 0, 0));
          strip->show();
        }
      }
    }    
  } 
}
void loop() {
  httpServer.handleClient();
  listenUDP();
  if (lastMillisHR + 3600000 <= millis()) {
    lastMillisHR = millis();
    registerUDP();
  }
}
