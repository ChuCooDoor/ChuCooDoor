import rp from 'request-promise-native';

class Dahua {
  constructor(baseUrl, username, password, cameraId) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    this.cameraId = cameraId;
  }

  getSessionId() {
    let options = {
      method: 'POST',
      uri: `${this.baseUrl}/RPC2_Login`,
      body: {
        method: 'global.login',
        params: {
          userName: this.username
        },
        id: 10000
      },
      json: true,
      jar: true
    };

    return rp(options);
  }

  login(res) {
    let options = {
      method: 'POST',
      uri: `${this.baseUrl}/RPC2_Login`,
      body: {
        method: 'global.login',
        session: res.session,
        params: {
          userName: this.username,
          password: this.password,
          clientType: 'Dahua3.0-Web3.0-NOTIE',
          authorityType: 'OldDigest'
        },
        id: 10000
      },
      json: true,
      jar: true
    };

    return rp(options);
  }

  getSnapshotLink(session) {
    return `${this.baseUrl}/cgi-bin/Snapshot.cgi?channel=${this.cameraId}&sessionId=${session}`;
  }
}

export { Dahua as default };
