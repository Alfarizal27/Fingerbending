// js/mqtt-driver.js - Contoh Driver MQTT (Paho MQTT Client)
class MqttDriver {
  constructor(onDataReceived, onStatusChange) {
    this.client = null;
    this.onDataReceived = onDataReceived;
    this.onStatusChange = onStatusChange;
  }

  connect(brokerUrl = "ws://broker.hivemq.com:8000/mqtt", topic = "lab/flex/sensor") {
    this.client = new Paho.MQTT.Client(brokerUrl, "web_client_" + parseInt(Math.random() * 100));
    
    this.client.onMessageArrived = (message) => {
      if (this.onDataReceived) this.onDataReceived(message.payloadString.trim());
    };

    this.client.connect({
      onSuccess: () => {
        this.client.subscribe(topic);
        this.onStatusChange(true);
      },
      onFailure: (err) => {
        alert("Gagal konek MQTT: " + err.errorMessage);
        this.onStatusChange(false);
      }
    });
  }

  disconnect() {
    if (this.client) this.client.disconnect();
    this.onStatusChange(false);
  }
}