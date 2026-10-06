/*
 * ============================================================
 * AI 听觉康复助手 — ESP32 康复训练站固件
 * ============================================================
 *
 * 硬件配置:
 *   - ESP32-WROOM-32 开发板
 *   - 3 个物理按钮 (GPIO 12/13/14) — 确认/取消/下一题
 *   - WS2812 RGB LED x3 (GPIO 5) — 状态指示
 *   - 有源蜂鸣器 (GPIO 18) — 音频反馈
 *   - 噪声传感器模块 (GPIO 34 ADC) — 环境噪声
 *   - INMP441 I2S 麦克风 (GPIO 26/33/25) — 高质量音频输入 (可选)
 *
 * 通信: WiFi + WebSocket (JSON 协议)
 *
 * 依赖库:
 *   - ArduinoJson (库管理器搜索 "ArduinoJson")
 *   - FastLED (库管理器搜索 "FastLED")
 *   - WebSockets (库管理器搜索 "WebSockets" by Markus Sattler)
 *
 * 接线说明:
 *   按钮: 一端接 GPIO，另一端接 GND（使用内部上拉电阻）
 *   LED:  DIN → GPIO 5, VCC → 3.3V, GND → GND
 *   蜂鸣器: 正极 → GPIO 18, 负极 → GND
 *   噪声传感器: AO → GPIO 34, VCC → 3.3V, GND → GND
 *   INMP441: SCK→33, WS→25, SD→26, VDD→3.3V, GND→GND, L/R→GND
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <FastLED.h>

// ============================================================
// 配置项 — 根据实际环境修改
// ============================================================

// WiFi 配置
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// WebSocket 服务器配置
const char* WS_HOST = "192.168.1.100";  // 后端服务器 IP
const int   WS_PORT = 8001;
const char* WS_PATH = "/ws/device";

// 设备标识
const char* DEVICE_ID = "esp32-rehab-001";

// ============================================================
// 引脚定义
// ============================================================

// 按钮引脚（内部上拉，按下为 LOW）
#define PIN_BTN_CONFIRM  12
#define PIN_BTN_CANCEL   13
#define PIN_BTN_NEXT     14

// WS2812 LED
#define PIN_LED_DATA     5
#define NUM_LEDS         3

// 蜂鸣器
#define PIN_BUZZER       18

// 噪声传感器（模拟输入）
#define PIN_NOISE_SENSOR 34

// ============================================================
// 全局变量
// ============================================================

WebSocketsClient webSocket;
CRGB leds[NUM_LEDS];

// 设备状态
bool wsConnected = false;
unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;
unsigned long lastReconnect = 0;
int reconnectAttempts = 0;

// 按钮状态
struct ButtonState {
    bool pressed;
    bool lastRaw;
    unsigned long pressTime;
    unsigned long debounceTime;
    String id;
};

ButtonState buttons[3] = {
    {false, false, 0, 0, "btn_confirm"},
    {false, false, 0, 0, "btn_cancel"},
    {false, false, 0, 0, "btn_next"},
};

const int BTN_PINS[3] = {PIN_BTN_CONFIRM, PIN_BTN_CANCEL, PIN_BTN_NEXT};

// LED 动画
struct LEDAnimation {
    CRGB color;
    String pattern;
    unsigned long startTime;
    unsigned long duration;
    bool active;
};

LEDAnimation ledAnims[NUM_LEDS];

// 蜂鸣器状态
bool buzzerActive = false;
unsigned long buzzerEndTime = 0;

// 噪声传感器
float noiseLevel = 0.0;
const int NOISE_SAMPLES = 50;  // 采样次数

// 去抖时间
const unsigned long DEBOUNCE_MS = 50;

// 心跳间隔
const unsigned long HEARTBEAT_INTERVAL = 5000;

// 传感器上报间隔
const unsigned long SENSOR_INTERVAL = 100;  // 100ms = 10Hz

// ============================================================
// 初始化
// ============================================================

void setup() {
    Serial.begin(115200);
    Serial.println("\n========================================");
    Serial.println("AI 听觉康复助手 - ESP32 康复训练站");
    Serial.println("========================================");

    // 初始化按钮引脚（内部上拉）
    for (int i = 0; i < 3; i++) {
        pinMode(BTN_PINS[i], INPUT_PULLUP);
    }

    // 初始化蜂鸣器
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);

    // 初始化 LED
    FastLED.addLeds<WS2812, PIN_LED_DATA, GRB>(leds, NUM_LEDS);
    FastLED.setBrightness(50);
    fill_solid(leds, NUM_LEDS, CRGB::Blue);
    FastLED.show();

    // 初始化 LED 动画
    for (int i = 0; i < NUM_LEDS; i++) {
        ledAnims[i].active = false;
        ledAnims[i].pattern = "off";
    }

    // 连接 WiFi
    connectWiFi();

    // 连接 WebSocket
    connectWebSocket();

    Serial.println("初始化完成！");
}

// ============================================================
// 主循环
// ============================================================

void loop() {
    unsigned long now = millis();

    // WebSocket 事件处理
    webSocket.loop();

    // 读取按钮
    readButtons(now);

    // 读取噪声传感器
    if (now - lastSensorRead >= SENSOR_INTERVAL) {
        lastSensorRead = now;
        readNoiseSensor();
    }

    // 发送心跳
    if (wsConnected && (now - lastHeartbeat >= HEARTBEAT_INTERVAL)) {
        lastHeartbeat = now;
        sendHeartbeat();
    }

    // 更新 LED 动画
    updateLEDAnimations(now);

    // 更新蜂鸣器
    updateBuzzer(now);

    // WiFi 断线重连
    if (WiFi.status() != WL_CONNECTED) {
        if (now - lastReconnect >= 5000) {
            lastReconnect = now;
            Serial.println("WiFi 断开，尝试重连...");
            WiFi.reconnect();
        }
    }

    // WebSocket 断线重连
    if (!wsConnected && WiFi.status() == WL_CONNECTED) {
        if (now - lastReconnect >= 3000) {
            lastReconnect = now;
            reconnectAttempts++;
            if (reconnectAttempts <= 10) {
                Serial.printf("WebSocket 断开，第 %d 次重连...\n", reconnectAttempts);
                connectWebSocket();
            } else {
                Serial.println("重连次数耗尽，等待手动重启");
            }
        }
    }
}

// ============================================================
// WiFi 连接
// ============================================================

void connectWiFi() {
    Serial.printf("连接 WiFi: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\nWiFi 已连接! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\nWiFi 连接失败！");
    }
}

// ============================================================
// WebSocket 连接
// ============================================================

void connectWebSocket() {
    Serial.printf("连接 WebSocket: %s:%d%s\n", WS_HOST, WS_PORT, WS_PATH);

    webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    webSocket.enableHeartbeat(15000, 3000, 2);
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            wsConnected = false;
            Serial.println("[WS] 已断开");
            fill_solid(leds, NUM_LEDS, CRGB::Red);
            FastLED.show();
            break;

        case WStype_CONNECTED:
            wsConnected = true;
            reconnectAttempts = 0;
            Serial.printf("[WS] 已连接: %s\n", payload);
            fill_solid(leds, NUM_LEDS, CRGB::Green);
            FastLED.show();
            // 发送注册消息
            sendRegister();
            break;

        case WStype_TEXT:
            handleServerMessage((char*)payload);
            break;

        case WStype_ERROR:
            Serial.printf("[WS] 错误: %s\n", payload);
            break;

        default:
            break;
    }
}

// ============================================================
// 消息发送
// ============================================================

void sendRegister() {
    StaticJsonDocument<512> doc;
    doc["type"] = "register";
    doc["device_id"] = DEVICE_ID;
    doc["device_type"] = "esp32_station";
    doc["firmware_version"] = "1.0.0";
    doc["ip_address"] = WiFi.localIP().toString();

    JsonArray sensors = doc.createNestedArray("sensors");
    sensors.add("button");
    sensors.add("noise_level");

    String msg;
    serializeJson(doc, msg);
    webSocket.sendTXT(msg);
    Serial.println("[WS] 已发送注册消息");
}

void sendHeartbeat() {
    StaticJsonDocument<128> doc;
    doc["type"] = "heartbeat";
    doc["timestamp"] = millis();

    String msg;
    serializeJson(doc, msg);
    webSocket.sendTXT(msg);
}

void sendButtonEvent(const char* buttonId, bool pressed, int durationMs) {
    StaticJsonDocument<256> doc;
    doc["type"] = "button_event";
    doc["payload"]["button_id"] = buttonId;
    doc["payload"]["pressed"] = pressed;
    doc["payload"]["duration_ms"] = durationMs;
    doc["timestamp"] = (float)millis() / 1000.0;

    String msg;
    serializeJson(doc, msg);
    webSocket.sendTXT(msg);
    Serial.printf("[BTN] %s %s (duration: %dms)\n", buttonId, pressed ? "按下" : "释放", durationMs);
}

void sendSensorData(const char* sensorType, float value, const char* unit) {
    StaticJsonDocument<256> doc;
    doc["type"] = "sensor_data";
    doc["payload"]["sensor_type"] = sensorType;
    doc["payload"]["value"] = value;
    doc["payload"]["unit"] = unit;
    doc["timestamp"] = (float)millis() / 1000.0;

    String msg;
    serializeJson(doc, msg);
    webSocket.sendTXT(msg);
}

// ============================================================
// 消息接收处理
// ============================================================

void handleServerMessage(const char* message) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, message);

    if (error) {
        Serial.printf("[WS] JSON 解析失败: %s\n", error.c_str());
        return;
    }

    const char* type = doc["type"];

    if (strcmp(type, "command") == 0) {
        handleCommand(doc["payload"]);
    } else if (strcmp(type, "training_event") == 0) {
        handleTrainingEvent(doc["payload"]);
    } else if (strcmp(type, "ack") == 0) {
        // 确认消息，忽略
    }
}

void handleCommand(JsonObject payload) {
    const char* actuatorType = payload["actuator_type"];
    const char* action = payload["action"];

    if (strcmp(actuatorType, "led") == 0) {
        handleLEDCommand(payload);
    } else if (strcmp(actuatorType, "buzzer") == 0) {
        handleBuzzerCommand(payload);
    } else if (strcmp(actuatorType, "display") == 0) {
        handleDisplayCommand(payload);
    }
}

void handleLEDCommand(JsonObject payload) {
    JsonObject params = payload["params"];
    const char* colorStr = params["color"] | "green";
    const char* pattern = params["pattern"] | "on";
    int duration = payload["duration_ms"] | 0;

    CRGB color = parseColor(colorStr);
    int ledIndex = 0;  // 默认控制所有 LED

    // 设置 LED 动画
    for (int i = 0; i < NUM_LEDS; i++) {
        ledAnims[i].color = color;
        ledAnims[i].pattern = pattern;
        ledAnims[i].startTime = millis();
        ledAnims[i].duration = duration;
        ledAnims[i].active = true;
    }

    Serial.printf("[LED] color=%s pattern=%s duration=%d\n", colorStr, pattern, duration);
}

void handleBuzzerCommand(JsonObject payload) {
    int frequency = payload["params"]["frequency_hz"] | 1000;
    int duration = payload["duration_ms"] | 200;

    tone(PIN_BUZZER, frequency, duration);
    buzzerActive = true;
    buzzerEndTime = millis() + duration;

    Serial.printf("[BUZZER] freq=%dHz duration=%dms\n", frequency, duration);
}

void handleDisplayCommand(JsonObject payload) {
    const char* text = payload["params"]["text"] | "";
    int line = payload["params"]["line"] | 0;
    // 如果连接了 OLED，在这里实现显示逻辑
    Serial.printf("[DISPLAY] line%d: %s\n", line, text);
}

void handleTrainingEvent(JsonObject payload) {
    const char* eventType = payload["event_type"];

    Serial.printf("[TRAINING] 事件: %s\n", eventType);

    if (strcmp(eventType, "session_start") == 0) {
        // 蓝灯亮
        setAllLEDs(CRGB::Blue, "on", 3000);
    } else if (strcmp(eventType, "answer_correct") == 0) {
        // 绿灯 + 正向蜂鸣
        setAllLEDs(CRGB::Green, "on", 2000);
        tone(PIN_BUZZER, 1500, 150);
    } else if (strcmp(eventType, "answer_wrong") == 0) {
        // 红灯 + 负向蜂鸣
        setAllLEDs(CRGB::Red, "on", 2000);
        tone(PIN_BUZZER, 500, 300);
    } else if (strcmp(eventType, "level_up") == 0) {
        // 绿灯快闪
        setAllLEDs(CRGB::Green, "blink_fast", 3000);
        for (int i = 0; i < 3; i++) {
            tone(PIN_BUZZER, 2000, 100);
            delay(150);
        }
    } else if (strcmp(eventType, "level_down") == 0) {
        // 红灯慢闪
        setAllLEDs(CRGB::Red, "blink_slow", 3000);
    } else if (strcmp(eventType, "session_complete") == 0) {
        // 全灭
        setAllLEDs(CRGB::Black, "off", 0);
    }
}

// ============================================================
// 按钮读取
// ============================================================

void readButtons(unsigned long now) {
    for (int i = 0; i < 3; i++) {
        bool raw = digitalRead(BTN_PINS[i]) == LOW;  // 按下为 LOW

        // 去抖处理
        if (raw != buttons[i].lastRaw) {
            buttons[i].debounceTime = now;
        }

        if ((now - buttons[i].debounceTime) > DEBOUNCE_MS) {
            if (raw && !buttons[i].pressed) {
                // 按下事件
                buttons[i].pressed = true;
                buttons[i].pressTime = now;
                sendButtonEvent(buttons[i].id.c_str(), true, 0);
            } else if (!raw && buttons[i].pressed) {
                // 释放事件
                buttons[i].pressed = false;
                int duration = now - buttons[i].pressTime;
                sendButtonEvent(buttons[i].id.c_str(), false, duration);
            }
        }

        buttons[i].lastRaw = raw;
    }
}

// ============================================================
// 噪声传感器
// ============================================================

void readNoiseSensor() {
    // 多次采样取平均
    long sum = 0;
    for (int i = 0; i < NOISE_SAMPLES; i++) {
        sum += analogRead(PIN_NOISE_SENSOR);
    }
    float avg = (float)sum / NOISE_SAMPLES;

    // 转换为 dB（近似值，需要校准）
    // ESP32 ADC 范围 0-4095，映射到 30-100 dB
    noiseLevel = map(avg, 0, 4095, 30, 100);

    // 每秒上报一次
    static unsigned long lastReport = 0;
    if (millis() - lastReport >= 1000) {
        lastReport = millis();
        sendSensorData("noise_level", noiseLevel, "dB");
    }
}

// ============================================================
// LED 动画
// ============================================================

void setAllLEDs(CRGB color, const char* pattern, unsigned long duration) {
    for (int i = 0; i < NUM_LEDS; i++) {
        ledAnims[i].color = color;
        ledAnims[i].pattern = pattern;
        ledAnims[i].startTime = millis();
        ledAnims[i].duration = duration;
        ledAnims[i].active = true;
    }
}

void updateLEDAnimations(unsigned long now) {
    bool changed = false;

    for (int i = 0; i < NUM_LEDS; i++) {
        if (!ledAnims[i].active) continue;

        // 检查是否超时
        if (ledAnims[i].duration > 0 && (now - ledAnims[i].startTime >= ledAnims[i].duration)) {
            ledAnims[i].active = false;
            leds[i] = CRGB::Black;
            changed = true;
            continue;
        }

        unsigned long elapsed = now - ledAnims[i].startTime;

        if (ledAnims[i].pattern == "on") {
            leds[i] = ledAnims[i].color;
            changed = true;
        } else if (ledAnims[i].pattern == "off") {
            leds[i] = CRGB::Black;
            changed = true;
        } else if (ledAnims[i].pattern == "blink_slow") {
            // 1Hz 闪烁
            leds[i] = ((elapsed / 500) % 2 == 0) ? ledAnims[i].color : CRGB::Black;
            changed = true;
        } else if (ledAnims[i].pattern == "blink_fast") {
            // 5Hz 闪烁
            leds[i] = ((elapsed / 100) % 2 == 0) ? ledAnims[i].color : CRGB::Black;
            changed = true;
        } else if (ledAnims[i].pattern == "pulse") {
            // 呼吸灯效果
            uint8_t brightness = beatsin8(2, 0, 255);  // 2Hz 呼吸
            leds[i] = ledAnims[i].color;
            leds[i].fadeToBlackBy(255 - brightness);
            changed = true;
        }
    }

    if (changed) {
        FastLED.show();
    }
}

// ============================================================
// 蜂鸣器更新
// ============================================================

void updateBuzzer(unsigned long now) {
    if (buzzerActive && now >= buzzerEndTime) {
        buzzerActive = false;
        noTone(PIN_BUZZER);
    }
}

// ============================================================
// 工具函数
// ============================================================

CRGB parseColor(const char* colorStr) {
    if (strcmp(colorStr, "green") == 0) return CRGB::Green;
    if (strcmp(colorStr, "red") == 0) return CRGB::Red;
    if (strcmp(colorStr, "blue") == 0) return CRGB::Blue;
    if (strcmp(colorStr, "yellow") == 0) return CRGB::Yellow;
    if (strcmp(colorStr, "white") == 0) return CRGB::White;
    return CRGB::Black;
}
