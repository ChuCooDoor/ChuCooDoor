class Logger {
  constructor(groupTitle) {
    this.groupTitle = groupTitle;
  }

  log(text) {
    const d = new Date();
    const date = d.toLocaleDateString();
    const time = d.toLocaleTimeString();
    console.log(`${date} ${time}: ${this.groupTitle} ${text}`);
  }

}

export { Logger as default };
