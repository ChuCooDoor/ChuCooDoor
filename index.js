'use strict';

// import modules
var webduino = require('webduino-js');
var TelegramBot = require('node-telegram-bot-api');
var config = require('./env.js');

// init variables

var boardPin = config.boardPin;
var boardId = config.boardId;
var mqttBroker = config.mqttBroker;
var telegram_token = config.telegram_token;
var groupTitle = config.groupTitle;
var groupChatId = config.telegram_groupChatId;
var devGroupChatId = config.telegram_devGroupChatId;
var board, lock, status, timer;

var bot = new TelegramBot(telegram_token, {polling: true});

// device info of webduino
var deviceInfo = {
  device: boardId,
  server: mqttBroker
};

createWebArduino();

board.on(webduino.BoardEvent.READY, onReady);
board.on(webduino.BoardEvent.BEFOREDISCONNECT, onBeforeDisconnect);
board.on(webduino.BoardEvent.DISCONNECT, onDisconnect);
board.on(webduino.BoardEvent.ERROR, function (error) {
    status = -1;
    sendMessage(devGroupChatId, error);
    log(error)
    console.log('');
});

////////////////

function createWebArduino() {
  board = new webduino.WebArduino(deviceInfo);
}

function onReady() {
  lock = new webduino.module.Button(board, board.getDigitalPin( boardPin ));
  /*
  ** `status` code list
  ** -2: initial
  ** -1: error
  ** 0: close (same as board value)
  ** 1: open (same as board value)
  */
  status = -2;

  log('Ready');
  console.log('');

  sendMessage(devGroupChatId, '開始監控');

  // check status when device is on ready.
  onCheck();

  // check status when lock is triggered.
  lock.on('pressed', onCheck);
  lock.on('released', onCheck);

  ////////////////

  function onCheck() {
    // kill timer to prevent bad call(status of lock change too frequently).
    if (timer) {
      clearTimeout(timer);
    }

    // set telegram group id.
    if (status == 1 || status == 0) {
      // someone switch the lock.
      // sent to general group.
      var chatId = groupChatId;
    } else {
      // check status at first.
      // sent to dev group only.
      var chatId = devGroupChatId;
    }

    // request for checking status
    timer = setTimeout(check, 2000);

    ////////////////

    function check() {
      var boardValue = board.getDigitalPin(boardPin).value;

      log('boardValue: ' + boardValue);

      // prevent bad call(status of lock has not changed).
      if (status != boardValue) {
        log('Status: ' + status);

        // prepare text for telegram bot.
        var text = '';
        if (boardValue == 1) {
          text = '開門';
        } else if (boardValue == 0) {
          text = '關門';
        }
        // for initial check.
        if (status == -2) {
          text = text.concat('中');
        }

        // change status of lock.
        status = boardValue;
        sendMessage(chatId, text);
        log(text);

      } else {
        log('忽略');
      }
      console.log('');
    }
  }

}

function onBeforeDisconnect() {
  log('before disconnect');
  console.log('');
}

function onDisconnect() {
  status = -1;

  sendMessage(devGroupChatId, 'ＧＧ');

  log('disconnect');
  console.log('');

  setTimeout(createWebArduino, 5000);
}

bot.onText(/\/getId/, function (msg) {
  var fromUsername = msg.from.username;
  var chatId = msg.chat.id;

  sendMessage(devGroupChatId, chatId);
});

function log(text) {
  var d = new Date();
  var date = d.toLocaleDateString();
  var time = d.toLocaleTimeString();
  console.log(date + ' ' + time + ': ' + text);
}

function sendMessage(chatId, text) {
  var newText = '';
  if (chatId == devGroupChatId) {
    newText = groupTitle + ': ' + text;
  } else {
    newText = text;
  }
  bot.sendMessage(chatId, newText);
}
