import Http from 'http';
import Router from 'router';
import BodyParser from 'body-parser';
import TelegramBot from 'node-telegram-bot-api';
import rp from 'request-promise-native';
import Logger from './logger.js';
import ChuCooDoorWebduino from './chuCooDoorWebduino.js';
import ChuCooDoorRPI from './chuCooDoorRPI.js';
import { basicInfos, hydraInfos, devicesInfos } from './env.js';

// init telegram bot with polling

const bot = new TelegramBot(basicInfos.telegram_token, {polling: true});
const logger = new Logger('System');

// init ChuCooDoors

let chuCooDoors = [];

for (var index = 0; index < devicesInfos.length; index++) {
  if (devicesInfos[index].type === 'webduino') {
    chuCooDoors.push( new ChuCooDoorWebduino(devicesInfos[index], basicInfos.mqttBroker, basicInfos.telegram_devGroupChatId, bot) );
  } else if (devicesInfos[index].type === 'rpi') {
    chuCooDoors.push( new ChuCooDoorRPI(devicesInfos[index], basicInfos.telegram_devGroupChatId, bot) );
  }
}

// server for rpi-senser

let router = new Router();
router.use(BodyParser.json());

router.post('/updateStatus', function (request, response) {
  console.log(JSON.stringify(request.body));
  const boardId = request.body.boardId;
  const boardValue = request.body.boardValue;

  logger.log(`收到更新狀態要求 boardId: ${boardId}, boardValue: ${boardValue}`);

  for (let index = 0; index < chuCooDoors.length; index++) {
    if (chuCooDoors[index].getBoardId() === boardId && chuCooDoors[index].getType() === 'rpi') {
      chuCooDoors[index].updateStatus(boardValue);
      response.writeHead( 200, {
        'Content-Type' : 'application/json; charset=utf-8'
      });
      response.end( JSON.stringify({message: 'Succeed'}) );
      break;
    }
  }

  response.writeHead( 404, {
    'Content-Type' : 'application/json; charset=utf-8'
  });
  response.end( JSON.stringify({message: 'Not Found'}) );

});

const server = Http.createServer(function(request, response) {
  // router(req, res, finalhandler(req, res));
  router( request, response, function( error ) {
    if ( !error ) {
      response.writeHead( 404, {
        'Content-Type' : 'application/json; charset=utf-8'
      });
    } else {
      // Handle errors
      console.log( error.message, error.stack );
      response.writeHead( 400, {
        'Content-Type' : 'application/json; charset=utf-8'
      });
    }
    response.end( JSON.stringify({message: 'RESTful API Server is running!'}) );
  });
})

server.listen(3000);


// bot scripts

bot.sendMessage(basicInfos.telegram_devGroupChatId, '系統啟動！')
  .then(message => {
    logger.log('系統啟動訊息寄送成功');
  })
  .catch(error => {
    logger.log(`系統啟動訊息寄送失敗： ${error}`);
  });

bot.onText(/\/getId/, function (msg) {
  const chatId = msg.chat.id;

  bot.sendMessage(basicInfos.telegram_devGroupChatId, chatId)
    .then(message => {
      logger.log(`回應 ID 寄送成功`);
    })
    .catch(error => {
      logger.log(`回應 ID 寄送失敗： ${error}`);
    });
});

bot.onText(/\/status/, function (msg) {
  const chatId = msg.chat.id;
  const msgId = msg.message_id;

  for (let index = 0; index < chuCooDoors.length; index++) {
    if (chuCooDoors[index].getChatId() == chatId || chatId == basicInfos.telegram_devGroupChatId) {
      chuCooDoors[index].sendDeviceStatus(chatId, msgId);
    }
  }
});
