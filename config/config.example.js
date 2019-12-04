var config = {
  botToken: "",
  whitelistChats: [],
  playSoundOnRecieve: "sound1.mp3",
  showVideos: true,
  playVideoAudio: false,
  imageFolder: "images",
  fullscreen: true,
  fadeTime: 1500,
  interval: 10 * 1000,
  imageCount: 30,
  showSender: true,
  showCaption: true,
  toggleMonitor: false,
  turnOnHour: 9,
  turnOffHour: 22,
  // show confirm message before delete an image
  confirmDeleteImage: true,
  // show confirm message before shutdown
  confirmShutdown: true,
  // show confirm message before reboot
  confirmReboot: true,
  touchBar: {
    height: "75px",
    // timout to automatically hide the touchbar.
    // To disable auto hide set value to 0
    autoHideTimeout: 30 * 1000,
    elements: [
      "previousImage",
      "playPause",
      "nextImage",
      "record",
      "starImage",
      "deleteImage",
      "mute",
      "shutdown",
      "reboot"
    ]
  },
  keys: {
    next: "right",
    previous: "left",
    play: "l",
    pause: "k"
  },
  voiceReply: {
    key: "a",
    maxRecordTime: 60*1000,
  },
  // languageFile defines the relative from the config folder to a language file.
  // Set the path to one of the predefined files of 'config/i18n' - i.e.
  //   languageFile: 'config/i18n/de.js'
  // You can define your own phrases.
  // To do that, copy one of the 'config/i18n/<xx>.js'
  // to 'config/texts.js' and change the phrases as you like.
  // If the file 'config/texts.js' exists, it will be loaded preferentially.
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") {
  module.exports = config;
}
