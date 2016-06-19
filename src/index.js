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
