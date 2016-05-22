'use strict';

// import modules
var webduino = require('webduino-js');
var TelegramBot = require('node-telegram-bot-api');
var config = require('./env.js');

// init variables
var devicesInfo = config.devicesInfo;
var mqttBroker = config.mqttBroker;
var telegram_token = config.telegram_token;
var devGroupChatId = config.telegram_devGroupChatId;

var bot = new TelegramBot(telegram_token, {polling: true});

for (var index = 0; index < devicesInfo.length; index++) {
  new ChuCooDoor(devicesInfo[index]);
}

function ChuCooDoor(deviceInfo) {
  // deviceInfo = deviceInfo;
  var board, lock, status, timer;

  // device info of webduino
  var webduinoOption = {
    device: deviceInfo.boardId,
    server: mqttBroker
  };

  createWebArduino();

  board.on(webduino.BoardEvent.READY, onReady);
  board.on(webduino.BoardEvent.BEFOREDISCONNECT, onBeforeDisconnect);
  board.on(webduino.BoardEvent.DISCONNECT, onDisconnect);
  board.on(webduino.BoardEvent.ERROR, function (error) {
      status = -1;
      sendMessage(devGroupChatId, error, deviceInfo.groupTitle);
      log(deviceInfo.groupTitle, error)
      console.log('');
  });

  ////////////////

  function createWebArduino() {
    board = new webduino.WebArduino(webduinoOption);
  }

  function onReady() {
    lock = new webduino.module.Button(board, board.getDigitalPin( deviceInfo.boardPin ));
    /*
    ** `status` code list
    ** -2: initial
    ** -1: error
    ** 0: close (same as board value)
    ** 1: open (same as board value)
    */
    status = -2;

    log(deviceInfo.groupTitle, 'Ready');
    console.log('');

    // sendMessage(devGroupChatId, '開始監控', deviceInfo.groupTitle);

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
        var chatId = deviceInfo.telegram_groupChatId;
      } else {
        // check status at first.
        // sent to dev group only.
        var chatId = devGroupChatId;
      }

      // request for checking status
      timer = setTimeout(check, 2000);

      ////////////////

      function check() {
        var boardValue = board.getDigitalPin(deviceInfo.boardPin).value;

        log(deviceInfo.groupTitle, 'boardValue: ' + boardValue);

        // prevent bad call(status of lock has not changed).
        if (status != boardValue) {
          log(deviceInfo.groupTitle, 'Status: ' + status);

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
            text = '開始監控: ' + text;
          }

          // change status of lock.
          status = boardValue;
          sendMessage(chatId, text, deviceInfo.groupTitle);
          log(deviceInfo.groupTitle, text);

        } else {
          log(deviceInfo.groupTitle, '忽略');
        }
        console.log('');
      }
    }

  }

  function onBeforeDisconnect() {
    log(deviceInfo.groupTitle, 'before disconnect');
    console.log('');
  }

  function onDisconnect() {
    status = -1;

    sendMessage(devGroupChatId, 'ＧＧ', deviceInfo.groupTitle);

    log(deviceInfo.groupTitle, 'disconnect');
    console.log('');

    setTimeout(createWebArduino, 5000);
  }
}

bot.onText(/\/getId/, function (msg) {
  var fromUsername = msg.chat.title;
  var chatId = msg.chat.id;

  sendMessage(devGroupChatId, chatId, fromUsername);
});

function log(groupTitle, text) {
  var d = new Date();
  var date = d.toLocaleDateString();
  var time = d.toLocaleTimeString();
  console.log(date + ' ' + time + ': ' + groupTitle + ' ' + text);
}

function sendMessage(chatId, text, groupTitle) {
  var newText = '';
  if (chatId == devGroupChatId) {
    newText = groupTitle + ': ' + text;
  } else {
    newText = text;
  }
  bot.sendMessage(chatId, newText);
}
