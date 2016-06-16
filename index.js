'use strict';

// import modules
var webduino = require('webduino-js');
var TelegramBot = require('node-telegram-bot-api');
var rp = require('request-promise');
var config = require('./env.js');

// init variables
var devicesInfo = config.devicesInfo;
var mqttBroker = config.mqttBroker;
var hydraBaseUrl = config.hydraBaseUrl;
var hydraId = config.hydraId;
var telegram_token = config.telegram_token;
var devGroupChatId = config.telegram_devGroupChatId;

// init telegram bot with polling
var bot = new TelegramBot(telegram_token, {polling: true});

bot.sendMessage(devGroupChatId, '系統啟動！')
  .then(function (message) {
    log('System', '系統啟動訊息寄送成功');
  })
  .catch(function (err) {
    log('System', '系統啟動訊息寄送失敗：' + error);
  });

for (var index = 0; index < devicesInfo.length; index++) {
  new ChuCooDoor(devicesInfo[index]);
}

function ChuCooDoor(deviceInfo) {
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
      log(deviceInfo.groupTitle, error)
      sendMessage(devGroupChatId, error, deviceInfo.groupTitle)
        .then(function (message) {
          log(deviceInfo.groupTitle, 'Error 訊息寄送成功');
        })
        .catch(function (err) {
          log(deviceInfo.groupTitle, 'Error 訊息寄送失敗：' + error);
        });

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
      var chatId = '';
      if (status == 1 || status == 0) {
        // someone switch the lock.
        // sent to general group.
        chatId = deviceInfo.telegram_groupChatId;
        timer = setTimeout(check, 2000);
      } else {
        // check status at first.
        // sent to dev group only.
        chatId = devGroupChatId;
        timer = setTimeout(check, 4000);
      }

      ////////////////

      function check() {
        console.log('');
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
          sendMessage(chatId, text, deviceInfo.groupTitle)
            .then(function (message) {
              log(deviceInfo.groupTitle, '開始偵測訊息寄送成功');
              getSnapshot(chatId, deviceInfo, message.message_id);
            })
            .catch(function (err) {
              log(deviceInfo.groupTitle, '開始偵測訊息寄送失敗：' + err);
            });

          log(deviceInfo.groupTitle, text);

        } else {
          log(deviceInfo.groupTitle, '忽略');
        }
      }
    }

  }

  function onBeforeDisconnect() {
    log(deviceInfo.groupTitle, 'before disconnect');
    console.log('');
  }

  function onDisconnect() {
    status = -1;

    sendMessage(devGroupChatId, 'ＧＧ', deviceInfo.groupTitle)
      .then(function (message) {
        log(deviceInfo.groupTitle, '斷線訊息寄送成功');
      })
      .catch(function (err) {
        log(deviceInfo.groupTitle, '斷線訊息寄送失敗：' + error);
      });

    log(deviceInfo.groupTitle, 'disconnect');
    console.log('');

    setTimeout(createWebArduino, 5000);
  }
}

bot.onText(/\/getId/, function (msg) {
  var fromUsername = msg.chat.title;
  var chatId = msg.chat.id;

  sendMessage(devGroupChatId, chatId, fromUsername)
    .then(function (message) {
      log('System：', '回應訊息寄送成功');
    })
    .catch(function (err) {
      log('System：', '回應訊息寄送失敗：' + err);
    });
});

function log(groupTitle, text) {
  var d = new Date();
  var date = d.toLocaleDateString();
  var time = d.toLocaleTimeString();
  console.log(date + ' ' + time + ': ' + groupTitle + ' ' + text);
}

function sendMessage(chatId, text, groupTitle, options) {
  text = groupTitle + ': ' + text;
  return bot.sendMessage(chatId, text, options);
}

/*
** login Hydra > get camera list > search camera > get snapshot link > get imgage > send snapshot
*/
function getSnapshot(chatId, deviceInfo, messageId) {
  var hydraCamera;
  var message_options = {};

  loginHydra()
    .then(function (res) {
      getCameraList()
        .then(function (res) {
          // search camera whose id is equal to device's camera id.
          for (var index = 0; index < res.P.length; index++) {
            if (res.P[index].id == deviceInfo.hydraCameraId) {
              hydraCamera = res.P[index];
              break;
            }
          }
          if (hydraCamera == undefined) {
            // no camera is matched.
            if (devGroupChatId == deviceInfo.telegram_groupChatId) {
              message_options = {reply_to_message_id: messageId};
            }
            sendMessage(devGroupChatId, '找無攝影機', deviceInfo.groupTitle, message_options)
              .then(function (message) {
                log(deviceInfo.groupTitle, '找無攝影機訊息寄送成功');
              })
              .catch(function (err) {
                log(deviceInfo.groupTitle, '錯誤訊息寄送失敗：' + err);
              });
            log(deviceInfo.groupTitle, '找無攝影機');
          } else {
            getSnapshotLink(hydraCamera.data.streamHigh)
              .then(function (res) {
                var snapshotLink = res;
                // 取得截圖網址後，延遲半秒鐘再拿圖。
                setTimeout(function () {
                  getImgage(res.P)
                    .then(function (res) {
                      log(deviceInfo.groupTitle, '成功獲取截圖');

                      message_options = {
                        disable_notification: true
                      };

                      bot.sendPhoto(chatId, res, {reply_to_message_id: messageId})
                        .then(function (message) {
                          log(deviceInfo.groupTitle, '截圖寄送成功');
                        })
                        .catch(function (err) {
                          log(deviceInfo.groupTitle, '截圖寄送失敗' + err);
                        });
                    })
                    .catch(function (err) {
                      log(deviceInfo.groupTitle, '無法取得截圖 ; ' + JSON.stringify(snapshotLink) + ' ; ' + err);
                      message_options = {
                        parse_mode: 'Markdown'
                      };
                      if (devGroupChatId == deviceInfo.telegram_groupChatId) {
                        message_options.reply_to_message_id = messageId;
                      }

                      sendMessage(devGroupChatId, '無法取得截圖\n`' + JSON.stringify(snapshotLink) + '`\n`' + err + '`', deviceInfo.groupTitle, message_options)
                        .then(function (message) {
                          log(deviceInfo.groupTitle, '無法取得截圖訊息寄送成功');
                        })
                        .catch(function (err) {
                          log(deviceInfo.groupTitle, '無法取得截圖訊息寄送失敗：' + err);
                        });
                    });
                }, 500);
              })
              .catch(function (err) {
                message_options = {
                  parse_mode: 'Markdown'
                };
                if (devGroupChatId == deviceInfo.telegram_groupChatId) {
                  message_options.reply_to_message_id = messageId;
                }

                sendMessage(devGroupChatId, '無法取得截圖網址\n`' + err + '`', deviceInfo.groupTitle, message_options)
                  .then(function (message) {
                    log(deviceInfo.groupTitle, '無法取得截圖網址訊息寄送成功');
                  })
                  .catch(function (err) {
                    log(deviceInfo.groupTitle, '無法取得截圖網址訊息寄送失敗： ' + err);
                  });
                log(deviceInfo.groupTitle, '無法取得截圖網址： ' + err);
              });
          }
        })
        .catch(function (err) {
          message_options = {
            parse_mode: 'Markdown'
          };
          if (devGroupChatId == deviceInfo.telegram_groupChatId) {
            message_options.reply_to_message_id = messageId;
          }

          sendMessage(devGroupChatId, '無法取得攝影機列表\n`' + err + '`', 'System', message_options)
            .then(function (message) {
              log(deviceInfo.groupTitle, '無法取得攝影機列表訊息寄送成功');
            })
            .catch(function (err) {
              log(deviceInfo.groupTitle, '無法取得攝影機列表訊息寄送失敗： ' + err);
            });
          log(deviceInfo.groupTitle, '無法取得攝影機列表');
        });
    })
    .catch(function (err) {
      message_options = {
        parse_mode: 'Markdown'
      };
      if (devGroupChatId == deviceInfo.telegram_groupChatId) {
        message_options.reply_to_message_id = messageId;
      }
      sendMessage(devGroupChatId, '無法登入 Hydra\n`' + err + '`', 'System', message_options)
        .then(function (message) {
          log(deviceInfo.groupTitle, '無法登入 Hydra 訊息寄送成功');
        })
        .catch(function (err) {
          log(deviceInfo.groupTitle, '無法登入 Hydra 訊息寄送失敗：' + err);
        });
      log(deviceInfo.groupTitle, '無法登入 Hydra');
    });
}

function loginHydra() {
  var options = {
    uri: hydraBaseUrl + '/guest?login_id=' + hydraId,
    json: true,
    jar: true
  };

  return rp(options);
}

function getCameraList() {
  var options = {
    uri: hydraBaseUrl + '/readCamera',
    json: true,
    jar: true
  };

  return rp(options);
}

function getSnapshotLink(cameraStreamId) {
  var options = {
    uri: hydraBaseUrl + '/snapshot?streamID=' + cameraStreamId,
    json: true,
    jar: true
  };

  return rp(options);
}

function getImgage(url) {
  var options = {
    uri: url,
    jar: true,
    encoding: null
  };

  return rp(options);
}
