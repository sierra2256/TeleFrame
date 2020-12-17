const Telegraf = require("telegraf");
const Telegram = require("telegraf/telegram");
const Extra = require('telegraf/extra')
const download = require("image-downloader");
const moment = require("moment");
const exec = require("child_process").exec;
const fs = require(`fs`);
const botReply = require('./botReply');
const { HORIZONTAL_ALIGN_LEFT } = require("jimp");
const commandParts = require('telegraf-command-parts');

"use strict";

var Bot = class {
  constructor(
    imageWatchdog,
    logger,
    config
  ) {
    var self = this;
    this.bot = new Telegraf(config.botToken);
    this.telegram = new Telegram(config.botToken);
    this.logger = logger;
    this.imageWatchdog = imageWatchdog;
    this.config = config;
    this.bot.use(commandParts())

    //get bot name
    this.bot.telegram.getMe().then((botInfo) => {
      this.bot.options.username = botInfo.username;
      this.logger.info(
        "Using bot with name " + this.bot.options.username + "."
      );
    });

    //Welcome message on bot start
    this.bot.start((ctx) => botReply(ctx, 'welcome'));

    //Help message
    this.bot.help((ctx) => botReply(ctx, 'help'));


    //Middleware Check for whitelisted  ChatID
    const isChatWhitelisted = (ctx, next) => {
      if (
        (
          config.whitelistChats.length > 0 &&
          config.whitelistChats.indexOf(ctx.message.chat.id) == -1
        )
      ){
        this.logger.info(
          "Whitelist triggered:",
          ctx.message.chat.id,
          config.whitelistChats,
          config.whitelistChats.indexOf(ctx.message.chat.id)
        );
        botReply(ctx, 'whitelistInfo');

        //Break if Chat is not whitelisted
        return ;
      }

      return next();
    }


    //Middleware Check for whitelisted  ChatID
    const isAdminWhitelisted = (ctx, next) => {
      if (
          config.whitelistAdmins.indexOf(ctx.message.chat.id) == -1
      ){
        this.logger.info(
          "Admin-Whitelist triggered:",
          ctx.message.chat.id,
          config.whitelistAdmins,
          config.whitelistAdmins.indexOf(ctx.message.chat.id)
        );
        botReply(ctx, 'whitelistAdminInfo');

        //Break if Chat is not whitelisted
        return ;
      }

      return next();
    }

    //Download incoming assets
    this.bot.on(['photo', 'video', 'document'], isChatWhitelisted, (ctx) => {
      let fileId;
      if (ctx.updateSubTypes.indexOf('photo') > -1) {
        fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      } else if (ctx.updateSubTypes.indexOf('video') > -1) {
        fileId = ctx.message.video.file_id
      } else if (ctx.updateSubTypes.indexOf('document') > -1) {
        fileId = ctx.message.document.file_id;
      }


      this.telegram.getFileLink(fileId).then((link) => {
        // check for supported file types
        if (link.match(/\.(mp4|jpg|gif|png)$/) === null) {
          if (config.botReply) {
            botReply(ctx, 'documentFormatError');
          }
          return;
        }

        let fileExtension = '.' + link.split('.').pop();

        if (fileExtension !== '.mp4' || config.showVideos) {
          download
            .image({
              url: link,
              dest: config.imageFolder + "/" + moment().format("x") + fileExtension
            })
            .then(({ filename, image }) => {
              var chatName = ''
              if (ctx.message.chat.type == 'group') {
                chatName = ctx.message.chat.title;
              } else if (ctx.message.chat.type == 'private') {
                chatName = ctx.message.from.first_name;
              }
              this.newImage(
                filename,
                ctx.message.from.first_name,
                ctx.message.caption,
                ctx.message.chat.id,
                chatName,
                ctx.message.message_id
              );
              // let bot reply, if wanted and Download was successful
              if (config.botReply) {
                if (fileExtension.match(/\.(mp4|gif)$/)){
                  botReply(ctx, 'videoReceived');
                } else if (fileExtension.match(/\.(jpg|png)$/)){
                  botReply(ctx, 'imageReceived');
                }
              }
            })
            .catch((err) => {
              this.logger.error(err.stack);
            });
          }else{
            if (config.botReply) {
              botReply(ctx, 'videoReceivedError');
			}
		  }
        })
        .catch((err) => {
          this.logger.error('Download: ' + err.stack);
          ctx.reply('Sorry: ' + err.toString());
        });
    });

    this.bot.catch((err) => {
      this.logger.error(err.stack);
    });

    //Some small conversation
    this.bot.hears(/^hi/i, (ctx) => {
      botReply(ctx, 'hiReply', ctx.chat.first_name, ctx.chat.id);
      this.logger.info(ctx.chat);
    });


    this.bot.command("deleteImages", (ctx) => {
      this.logger.info(ctx.state.command.args)

      if (ctx.state.command.splitArgs.length > 1) {
        if (isNaN(ctx.state.command.splitArgs[0])){
          if (ctx.state.command.splitArgs[0] == "list") {
            this.retunrImageList(ctx)
          }
        } else {
          ctx.state.command.splitArgs.forEach(index => {
            this.deleteImage(ctx, parseInt(index))  
          });
          botReply(ctx, "imagesDeleted")
        }


      } else {
        if (isNaN(ctx.state.command.args)){
          if (ctx.state.command.args == "list") {
            this.returnImageList(ctx)
          }
        } else {
          let index = parseInt(ctx.state.command.args)
          this.deleteImage(ctx, index) 
        }
      }

    })

    //Add Admin Actions from config to Bot-Command
    if(this.config.adminAction.allowAdminAction ){
      var actions = this.config.adminAction.actions;
      this.logger.info("Add Admin-Actions");

      actions.forEach(action => {
        //only add action if comman isn't (empty or null) and action is enabled
        if(!!action.command && action.enable){
        this.bot.command(action.name, isAdminWhitelisted, (ctx) => {
          this.logger.warn("Command received: "+action.name);
          this.logger.warn(action.command);
          botReply(ctx, 'adminActionTriggered', action.name);

          exec(action.command, (error, stdout, stderr) => {
            if (error) {
              console.error(stderr);
              botReply(ctx, 'adminActionError', action.name, error.code, stderr);
              return;
            }

            console.log(stdout)
            botReply(ctx, 'adminActionSuccess', action.name, stdout);
          });
        })

        }
      });

    }

    this.logger.info("Bot created!");
  }

  returnImageList(ctx){

    if (this.imageWatchdog.images.length == 0){
      botReply(ctx, 'noImages')
    }

    for (let i = 0; i < this.imageWatchdog.images.length; i++) {
      ctx.reply(i + " - " + this.imageWatchdog.images[i].src);
      let fileName = this.imageWatchdog.images[i].src;
      let imageCaption = i;
      let Jimp = require("jimp")
      let loadedImage
      
      Jimp.read(fileName)
        .then(function (image){
          loadedImage = image;
          return Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);
        })
        .then(function (font) {
          loadedImage.print(font, 10,10,i)
          loadedImage.getBuffer(Jimp.MIME_PNG, (err,buffer) => {
            ctx.replyWithPhoto({ source : buffer, caption: imageCaption})
        })
      })
        .catch(function (err) {
          console.log(err);
        });
    };
   

  }

  startBot() {
    //Start bot
    var self = this;
    this.bot.startPolling(30, 100, null, () =>
      setTimeout(() => self.startBot(), 30000)
    );
    this.logger.info("Bot started!");
  }

  deleteImage(ctx, index){

    if (index >= this.imageWatchdog.images.length) {
      botReply(ctx, "imageNotExisting")
      return
    }

    this.imageWatchdog.deleteImage(index);

  }

  newImage(src, sender, caption, chatId, chatName, messageId) {
    //tell imageWatchdog that a new image arrived
    this.imageWatchdog.newImage(src, sender, caption, chatId, chatName, messageId);
  }

  sendMessage(message) {
    // function to send messages, used for whitlist handling
    return this.bot.telegram.sendMessage(config.whitelistChats[0], message);
  }

  sendAudio(filename, chatId, messageId) {
    // function to send recorded audio as voice reply
    fs.readFile(
      filename,
      function(err, data) {
        if (err) {
          this.logger.error(err);
          return;
        }
          this.telegram
            .sendVoice(chatId, {
              source: data
            }, {
              reply_to_message_id: messageId
            })
            .then(() => {
              this.logger.info("success");
            })
            .catch((err) => {
              this.logger.error("error", err);
            });

      }.bind(this)
    );
  }

};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") {
  module.exports = Bot;
}
