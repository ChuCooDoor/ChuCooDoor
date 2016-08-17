import fs from 'fs';
import path from 'path';
import rp from 'request-promise-native';
import rpio from 'rpio';
import Logger from './logger.js';

class ChuCooDoorRPI {
  constructor(deviceInfo, devGroupChatId, bot) {
    this.bot = bot;
    this.deviceInfo = deviceInfo;
    this.devGroupChatId = devGroupChatId;
    this.logger = new Logger(this.deviceInfo.groupTitle);
    this.recordFilePath = path.join(__dirname, '../', 'record.json');
    this.status = -2;
    let record = JSON.parse(fs.readFileSync(this.recordFilePath));
    for (let i = 0; i < record.length; i++) {
      if (record[i].boardId === this.deviceInfo.boardId) {
        this.status = record[i].boardValue;
        break;
      }
    }
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
      text = '關門中';
    } else if (status == 0) {
      text = '開門中';
    }

    return this.sendMessage(chatId, text, {reply_to_message_id: msgId});
  }

  updateStatus(boardValue) {
    this.log('boardValue: ' + boardValue);

    // prevent bad call(status of lock has not changed).
    if (this.status !== boardValue) {
      // prepare group id and text or telegram bot.
      let chatId = this.deviceInfo.telegram_groupChatId;
      let text = '';

      const d = new Date();
      const date = d.toLocaleDateString();
      const time = d.toLocaleTimeString();

      if (boardValue === 1) {
        text = '關門';
      } else if (boardValue === 0) {
        text = '開門';
      }
      // for initial check.
      if (this.status === -2) {
        text = '開始監控: ' + text.concat('中');
        chatId = this.devGroupChatId;
      }

      text = text.concat(` - ${time}`);

      // change status of lock.
      let record = JSON.parse(fs.readFileSync(recordFilePath));
      for (let i = 0; i < record.length; i++) {
        if (record[i].boardId === this.deviceInfo.boardId) {
          record[i].boardValue = boardValue;
          break;
        }
      }
      fs.writeFileSync(recordFilePath, JSON.stringify(record) );
      this.status = boardValue;
      // 關門不發訊息
      if (this.status != 1) {
        this.sendMessage(chatId, text)
          .then(message => {
            this.log('門狀態改變訊息寄送成功');
            setTimeout( () => {this.getSnapshot(chatId, message.message_id);}, 3500 );
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

  getSnapshot(chatId, messageId) {
    let snapshotLink = `http://${this.deviceInfo.cameraIp}/web/snapshot.jpg`;

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
