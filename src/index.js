import TelegramBot from 'node-telegram-bot-api';
import rp from 'request-promise';
import Logger from './logger.js';
import ChuCooDoor from './chuCooDoor.js';
import { basicInfos, hydraInfos, devicesInfos } from './env.js';


// init telegram bot with polling
const bot = new TelegramBot(basicInfos.telegram_token, {polling: true});
const logger = new Logger('System');
let chuCooDoors = [];

for (var index = 0; index < devicesInfos.length; index++) {
  chuCooDoors.push( new ChuCooDoor(devicesInfos[index], basicInfos.mqttBroker, basicInfos.telegram_devGroupChatId, hydraInfos, bot) );
}

bot.sendMessage(basicInfos.telegram_devGroupChatId, '系統啟動！')
  .then(message => {
    logger.log('系統啟動訊息寄送成功');
  })
  .catch(err => {
    logger.log(`系統啟動訊息寄送失敗： ${error}`);
  });

bot.onText(/\/getId/, function (msg) {
  const chatId = msg.chat.id;

  for (let index = 0; index < chuCooDoors.length; index++) {
    if (chuCooDoors[index].getChatId() == chatId) {
      chuCooDoors[index].sendMessage(basicInfos.telegram_devGroupChatId, chatId)
        .then(function (message) {
          chuCooDoors[index].log('回應 ID 寄送成功');
        })
        .catch(function (error) {
          chuCooDoors[index].log('回應 ID 寄送失敗：' + error);
        });
    }
  }
});

bot.onText(/\/status/, function (msg) {
  const chatId = msg.chat.id;
  const msgId = msg.message_id;

  for (let index = 0; index < chuCooDoors.length; index++) {
    if (chuCooDoors[index].getChatId() == chatId || chatId == basicInfos.telegram_devGroupChatId) {
      chuCooDoors[index].sendDeviceStatus(chatId, msgId)
        .then(function (message) {
          chuCooDoors[index].log('回應狀態寄送成功');
          chuCooDoors[index].getSnapshot(chatId, message.message_id);
        })
        .catch(function (error) {
          chuCooDoors[index].log('回應狀態寄送失敗：' + error);
        });
    }
  }
});
