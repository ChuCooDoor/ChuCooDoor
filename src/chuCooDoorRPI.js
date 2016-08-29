import rp from 'request-promise-native';
import rpio from 'rpio';
import Logger from './logger.js';

class ChuCooDoorRPI {
  constructor(deviceInfo, devGroupChatId, bot) {
    this.bot = bot;
    this.deviceInfo = deviceInfo;
    this.status = -1;
    this.devGroupChatId = devGroupChatId;
    this.logger = new Logger(this.deviceInfo.groupTitle);
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

  syncBoardValue() {
    let options = {
      method: 'GET',
      uri: `http://${this.deviceInfo.boardIp}/boardValue/${this.deviceInfo.boardId}`,
      json: true // Automatically stringifies the body to JSON
    };

    return rp(options);
  }

  check() {
    let text = '';

    if (this.status == -1) {
      text = 'GG 中';
    } else if (this.status == 1) {
      text = '關門中';
    } else if (this.status == 0) {
      text = '開門中';
    }

    return text;
  }

  getDateText() {
    const date = new Date();
    return date.toLocaleString('zh-TW');
  }

  sendDeviceStatus(chatId, msgId) {
    this.syncBoardValue()
      .then(message => {
        this.log( 'syncBoardValue 成功: ' + JSON.stringify(message) );
        this.status = message.boardValue;

        const dateText = this.getDateText();

        this.sendMessage(chatId, `${this.check()} - ${dateText}`, {reply_to_message_id: msgId})
          .then(message => {
            this.log('回應狀態寄送成功');
            for (let i = 0; i < this.deviceInfo.snapshotLinks.length; i++) {
              this.getSnapshot(this.deviceInfo.snapshotLinks[i], chatId, message.message_id);
            }
          })
          .catch(error => {
            this.log('回應狀態寄送失敗：' + error);
          });
      })
      .catch(error => {
        this.log( 'syncBoardValue 失敗: ' + JSON.stringify(error) );
        this.status = -1;
        this.sendMessage(chatId, this.check(), {reply_to_message_id: msgId})
          .then(message => {
            this.log('回應狀態寄送成功');
            for (let i = 0; i < this.deviceInfo.snapshotLinks.length; i++) {
              this.getSnapshot(this.deviceInfo.snapshotLinks[i], chatId, message.message_id);
            }
          })
          .catch(error => {
            this.log('回應狀態寄送失敗：' + error);
          });
      });
  }

  updateStatus(boardValue) {
    this.log('boardValue: ' + boardValue);

    // prevent bad call(status of lock has not changed).
    if (this.status !== boardValue) {
      // prepare group id and text or telegram bot.
      let chatId = this.deviceInfo.telegram_groupChatId;
      let text = '';

      const dateText = this.getDateText();

      if (boardValue === 1) {
        text = '關門';
      } else if (boardValue === 0) {
        text = '開門';
      }

      text = text.concat(` - ${dateText}`);

      // change status of lock.
      this.status = boardValue;
      // 關門不發訊息
      if (this.status != 1) {
        this.sendMessage(chatId, text)
          .then(message => {
            this.log('門狀態改變訊息寄送成功');
            setTimeout(
              () => {
                for (let i = 0; i < this.deviceInfo.snapshotLinks.length; i++) {
                  this.getSnapshot(this.deviceInfo.snapshotLinks[i], chatId, message.message_id);
                }
              }, this.deviceInfo.snapshotDelayMillisecond
            );
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

export { ChuCooDoorRPI as default };
