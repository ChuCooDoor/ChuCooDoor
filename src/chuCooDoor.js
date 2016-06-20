import rp from 'request-promise';
import Logger from './logger.js';
import Hydra from './hydra.js';
import Webduino from 'webduino-js';

class ChuCooDoor {
  constructor(deviceInfo, mqttBroker, devGroupChatId, hydraInfos, bot) {
    this.bot = bot;
    this.deviceInfo = deviceInfo;
    this.status = -2
    this.devGroupChatId = devGroupChatId;
    this.logger = new Logger(this.deviceInfo.groupTitle);
    this.hydra = new Hydra(hydraInfos.baseUrl, hydraInfos.id, this.deviceInfo);

    // device info of webduino
    this.WebduinoOptions = {
      device: this.deviceInfo.boardId,
      server: mqttBroker
    };

    this.createWebArduino(this.WebduinoOptions);

    this.board.on(Webduino.BoardEvent.READY, () => {this.onReady();});
    this.board.on(Webduino.BoardEvent.BEFOREDISCONNECT, () => {this.onBeforeDisconnect();});
    this.board.on(Webduino.BoardEvent.DISCONNECT, () => {this.onDisconnect();});
    this.board.on(Webduino.BoardEvent.ERROR, error => {this.onError(error);} );

  }

  createWebArduino(options) {
    this.board = new Webduino.WebArduino(options);
  }

  getChatId() {
    return this.deviceInfo.telegram_groupChatId;
  }

  getDeviceStatus() {

  }

  onReady() {
    let lock = new Webduino.module.Button(this.board, this.board.getDigitalPin( this.deviceInfo.boardPin ));
    /*
    ** `status` code list
    ** -2: initial
    ** -1: error
    ** 0: close (same as board value)
    ** 1: open (same as board value)
    */
    this.status = -2;

    this.log('Ready');

    // check status when device is on ready.
    this.onCheck();

    // check status when lock is triggered.
    lock.on('pressed', () => {this.onCheck();});
    lock.on('released', () => {this.onCheck();});
  }

  onBeforeDisconnect() {
    this.log('before disconnect');
  }

  onDisconnect() {
    this.status = -1;

    this.sendMessage(this.devGroupChatId, 'ＧＧ')
      .then(message => {
        this.log('斷線訊息寄送成功');
      })
      .catch(error=> {
        this.log('斷線訊息寄送失敗：' + error);
      });

    this.log('disconnect');

    setTimeout( () => {createWebArduino(webduinoOptions);}, 5000);
  }

  onError(error) {
    this.status = -1;
    this.log(error)
    this.sendMessage(this.devGroupChatId, error)
      .then(message => {
        this.log('Error 訊息寄送成功');
      })
      .catch(error=> {
        this.log('Error 訊息寄送失敗：' + error);
      });
  }

  onCheck() {
    // kill timer to prevent bad call(status of lock change too frequently).
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout( () => {this.check();}, 2000);
  }

  check() {
    const boardValue = this.board.getDigitalPin(this.deviceInfo.boardPin).value;

    this.log('boardValue: ' + boardValue);

    // prevent bad call(status of lock has not changed).
    if (this.status !== boardValue) {
      // prepare group id and text or telegram bot.
      let chatId = this.deviceInfo.telegram_groupChatId;
      let text = '';
      if (boardValue === 1) {
        text = '開門';
      } else if (boardValue === 0) {
        text = '關門';
      }
      // for initial check.
      if (this.status === -2) {
        text = '開始監控: ' + text.concat('中');
        chatId = this.devGroupChatId;
      }

      // change status of lock.
      this.status = boardValue;
      this.sendMessage(chatId, text)
        .then(message => {
          this.log('開始偵測訊息寄送成功');
          this.getSnapshot(chatId, message.message_id);
        })
        .catch(error=> {
          this.log('開始偵測訊息寄送失敗：' + error);
        });

      this.log(text);

    } else {
      this.log('忽略');
    }
  }

  getSnapshot(chatId, messageId) {
    let hydraCamera;

    this.hydra.login()
      .then(res => {
        this.hydra.getCameraList()
          .then(res => {
            // search camera whose id is equal to device's camera id.
            for (let index = 0; index < res.P.length; index++) {
              if (res.P[index].id == this.deviceInfo.hydraCameraId) {
                hydraCamera = res.P[index];
                break;
              }
            }
            if (!hydraCamera) {
              let message_options = {};
              // no camera is matched.
              if (this.devGroupChatId == this.deviceInfo.telegram_groupChatId) {
                message_options = {reply_to_message_id: messageId};
              }
              this.sendMessage(this.devGroupChatId, '找無攝影機', message_options)
                .then(message => {
                  this.log('找無攝影機訊息寄送成功');
                })
                .catch(error=> {
                  this.log('錯誤訊息寄送失敗：' + error);
                });
              this.log('找無攝影機');
            } else {
              this.hydra.getSnapshotLink(hydraCamera.data.streamHigh)
                .then(res => {
                  const snapshotLink = res;
                  // 取得截圖網址後，延遲半秒鐘再拿圖。
                  setTimeout( () => {
                    this.getImage(res.P)
                      .then(res => {
                        this.log('成功獲取截圖');

                        let message_options = {
                          disable_notification: true,
                          reply_to_message_id: messageId
                        };
                        this.bot.sendPhoto(chatId, res, message_options)
                          .then(message => {
                            this.log('截圖寄送成功');
                          })
                          .catch(error=> {
                            this.log('截圖寄送失敗' + error);
                          });
                      })
                      .catch(error=> {
                        this.log('無法取得截圖 ; ' + JSON.stringify(snapshotLink) + ' ; ' + error);
                        let message_options = {
                          parse_mode: 'Markdown'
                        };
                        if (this.devGroupChatId == this.deviceInfo.telegram_groupChatId) {
                          message_options.reply_to_message_id = messageId;
                        }

                        this.sendMessage(this.devGroupChatId, '無法取得截圖\n`' + JSON.stringify(snapshotLink) + '`\n`' + error+ '`',  message_options)
                          .then(message => {
                            this.log('無法取得截圖訊息寄送成功');
                          })
                          .catch(error=> {
                            this.log('無法取得截圖訊息寄送失敗：' + error);
                          });
                      });
                  }, 500);
                })
                .catch(error=> {
                  let message_options = {
                    parse_mode: 'Markdown'
                  };
                  if (this.devGroupChatId == this.deviceInfo.telegram_groupChatId) {
                    message_options.reply_to_message_id = messageId;
                  }

                  this.sendMessage(this.devGroupChatId, '無法取得截圖網址\n`' + error+ '`', message_options)
                    .then(message => {
                      this.log('無法取得截圖網址訊息寄送成功');
                    })
                    .catch(error=> {
                      this.log('無法取得截圖網址訊息寄送失敗： ' + error);
                    });
                  this.log('無法取得截圖網址： ' + error);
                });
            }
          })
          .catch(error=> {
            let message_options = {
              parse_mode: 'Markdown'
            };
            if (this.devGroupChatId == this.deviceInfo.telegram_groupChatId) {
              message_options.reply_to_message_id = messageId;
            }

            this.sendMessage(this.devGroupChatId, '無法取得攝影機列表\n`' + error+ '`', message_options)
              .then(message => {
                this.log('無法取得攝影機列表訊息寄送成功');
              })
              .catch(error=> {
                this.log('無法取得攝影機列表訊息寄送失敗： ' + error);
              });
            this.log('無法取得攝影機列表');
          });
      })
      .catch(error=> {
        let message_options = {
          parse_mode: 'Markdown'
        };
        if (this.devGroupChatId == this.deviceInfo.telegram_groupChatId) {
          message_options.reply_to_message_id = messageId;
        }
        this.sendMessage(this.devGroupChatId, '無法登入 Hydra\n`' + error+ '`', message_options)
          .then(message => {
            this.log('無法登入 Hydra 訊息寄送成功');
          })
          .catch(error=> {
            this.log('無法登入 Hydra 訊息寄送失敗：' + error);
          });
        this.log('無法登入 Hydra');
      });
  }

  getImage(url) {
    let options = {
      uri: url,
      jar: true,
      encoding: null
    };

    return rp(options);
  }

  sendMessage(chatId, text, options) {
    text = `${this.deviceInfo.groupTitle}: ${text}`;
    return this.bot.sendMessage(chatId, text, options);
  }

  log(text) {
    this.logger.log(text);
  }

}

export { ChuCooDoor as default };
