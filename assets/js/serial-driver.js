// assets/js/serial-driver.js - Driver Web Serial Port
class SerialDriver {
  constructor(onDataReceived, onStatusChange) {
    this.port = null;
    this.reader = null;
    this.readableStreamClosed = null;
    this.keepReading = false;
    this.onDataReceived = onDataReceived;
    this.onStatusChange = onStatusChange;

    if ('serial' in navigator) {
      navigator.serial.addEventListener('disconnect', (event) => {
        if (this.port && event.target === this.port) {
          this.disconnect();
          alert("⚠️ Koneksi terputus! Kabel Serial USB terlepas.");
        }
      });
    }
  }

  async connect(baudRate = 9600) {
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: parseInt(baudRate) });
      this.keepReading = true;
      this.onStatusChange(true);
      this._startReading();
    } catch (err) {
      alert("Gagal menghubungkan ke Serial: " + err.message);
      this.onStatusChange(false);
    }
  }

  async _startReading() {
    const textDecoder = new TextDecoderStream();
    this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();
    let buffer = '';

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine !== "" && this.onDataReceived) {
              this.onDataReceived(cleanLine);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error membaca serial stream:", err);
    } finally {
      this.reader.releaseLock();
    }
  }

  async disconnect() {
    this.keepReading = false;

    // Lepas lock pada stream sebelum port ditutup
    if (this.reader) {
      await this.reader.cancel().catch(() => {});
      this.reader = null;
    }

    if (this.readableStreamClosed) {
      await this.readableStreamClosed.catch(() => {});
      this.readableStreamClosed = null;
    }

    if (this.port) {
      await this.port.close();
      this.port = null;
    }

    this.onStatusChange(false);
  }
}