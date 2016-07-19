import rp from 'request-promise-native';

class Hydra {
  constructor(baseUrl, hydraId, deviceInfo) {
    this.deviceInfo = deviceInfo;
    this.hydraId = hydraId;
    this.baseUrl = baseUrl;
  }

  login() {
    let options = {
      uri: this.baseUrl + '/guest?login_id=' + this.hydraId,
      json: true,
      jar: true
    };

    return rp(options);
  }

  getCameraList() {
    let options = {
      uri: this.baseUrl + '/readCamera',
      json: true,
      jar: true
    };

    return rp(options);
  }

  getSnapshotLink(cameraStreamId) {
    let options = {
      uri: this.baseUrl + '/snapshot?streamID=' + cameraStreamId,
      json: true,
      jar: true
    };

    return rp(options);
  }
}

export { Hydra as default };
