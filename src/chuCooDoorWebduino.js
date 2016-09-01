import rp from 'request-promise-native';
import Webduino from 'webduino-js';
import Logger from './logger.js';

class ChuCooDoorWebduino {
  constructor(deviceInfo, mqttBroker, devGroupChatId, bot) {
    this.bot = bot;
    this.deviceInfo = deviceInfo;
    this.status = -2;
    this.devGroupChatId = devGroupChatId;
    this.logger = new Logger(this.deviceInfo.groupTitle);

    // device info of webduino
    this.webduinoOptions = {
      device: this.deviceInfo.boardId,
      server: mqttBroker
    };

    this.createWebArduino(this.webduinoOptions);
  }

  createWebArduino(options) {
    this.board = new Webduino.WebArduino(options);

    this.board.on(Webduino.BoardEvent.READY, () => {this.onReady();});
    this.board.on(Webduino.BoardEvent.BEFOREDISCONNECT, () => {this.onBeforeDisconnect();});
    this.board.on(Webduino.BoardEvent.DISCONNECT, () => {this.onDisconnect();});
    this.board.on(Webduino.BoardEvent.ERROR, error => {this.onError(error);} );
  }

  getChatId() {
    return this.deviceInfo.telegram_groupChatId;
  }

  getBoardId() {
    return this.deviceInfo.boardId;
  }

  getType() {
    return this.deviceInfo.type;
  }

  sendDeviceStatus(chatId, msgId) {
    const status = this.status;
    let text = '';

    if (status == -2) {
      text = '初始化中';
    } else if (status == -1) {
      text = 'GG 中';
    } else if (status == 1) {
      text = `${this.deviceInfo.textForSensorOutputHigh}中`;
    } else if (status == 0) {
      text = `${this.deviceInfo.textForSensorOutputLow}中`;
    }

    this.sendMessage(chatId, text, {reply_to_message_id: msgId})
      .then(message => {
        this.log('回應狀態寄送成功');
        for (let i = 0; i < this.deviceInfo.snapshots.length; i++) {
          this.getSnapshot(this.deviceInfo.snapshots[i].link, chatId, message.message_id);
        }
      })
      .catch(error => {
        this.log('回應狀態寄送失敗：' + error);
      });
  }

  onReady() {
    let lock = new Webduino.module.Button(this.board, this.board.getDigitalPin( this.deviceInfo.boardPin ));
    /*
    ** `status` code list
    ** -2: initial
    ** -1: error
    ** 0: sensorOutputLow; (same as board value)
    ** 1: sensorOutputHigh (same as board value)
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
      .catch(error => {
        this.log('斷線訊息寄送失敗：' + error);
      });

    this.log('disconnect');

    this.createWebArduino(this.webduinoOptions);
  }

  onError(error) {
    this.status = -1;
    this.log(error)
    this.sendMessage(this.devGroupChatId, error)
      .then(message => {
        this.log('Error 訊息寄送成功');
      })
      .catch(error => {
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
        text = this.deviceInfo.textForSensorOutputHigh;
      } else if (boardValue === 0) {
        text = this.deviceInfo.textForSensorOutputLow;
      }
      // for initial check.
      if (this.status === -2) {
        text = '開始監控: ' + text.concat('中');
        chatId = this.devGroupChatId;
      }

      // change status of lock.
      this.status = boardValue;
      // 控制是否傳送通知訊息
      if (
        ( (this.status == 1) && this.deviceInfo.notifyWhenSensorOutputHigh)
        ||
        ( (this.status == 0) && this.deviceInfo.notifyWhenSensorOutputLow)
      ) {
        this.sendMessage(chatId, text)
          .then(message => {
            this.log('開始偵測訊息寄送成功');
            for (let i = 0; i < this.deviceInfo.snapshots.length; i++) {
              const snapshot = this.deviceInfo.snapshots[i];
              for (let j = 0; j < snapshot.delayMilliseconds.length; j++) {
                setTimeout(
                  () => {
                    this.getSnapshot(snapshot.link, chatId, message.message_id);
                  }, snapshot.delayMilliseconds[j]
                );
              }
            }
          })
          .catch(error=> {
            this.log('開始偵測訊息寄送失敗：' + error);
          });
      }
      this.log(text);

    } else {
      this.log('忽略');
    }
  }

  getSnapshot(snapshotLink, chatId, messageId) {
    this.getImage(snapshotLink)
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
            this.log(`截圖寄送失敗 ${error}`);
          });
        })
        .catch(error=> {
          this.log(`無法取得截圖 ${error}`);

          let message_options = {
            parse_mode: 'Markdown'
          };

          if (this.devGroupChatId == this.deviceInfo.telegram_groupChatId) {
            message_options.reply_to_message_id = messageId;
          }

          this.sendMessage(this.devGroupChatId, '無法取得截圖\n`' + error+ '`',  message_options)
            .then(message => {
              this.log('無法取得截圖訊息寄送成功');
            })
            .catch(error=> {
              this.log('無法取得截圖訊息寄送失敗：' + error);
            });
        });
  }

  getImage(url) {
    let options = {
      uri: url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
      },
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

export { ChuCooDoorWebduino as default };
