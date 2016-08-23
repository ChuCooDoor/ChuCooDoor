class Logger {
  constructor(groupTitle) {
    this.groupTitle = groupTitle;
  }

  log(text) {
    const date = new Date();
    const dateText = date.toLocaleDateString('zh-TW');

    console.log(`${dateText}: ${this.groupTitle} ${text}`);
  }
}

export { Logger as default };
