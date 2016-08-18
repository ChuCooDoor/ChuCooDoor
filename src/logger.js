class Logger {
  constructor(groupTitle) {
    this.groupTitle = groupTitle;
  }

  log(text) {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hours = date.getHours();
    const min = date.getMinutes();
    const dateTimeText = `${year}/${month}/${day} ${hours}:${min}`;

    console.log(`${dateTimeText}: ${this.groupTitle} ${text}`);
  }

}

export { Logger as default };
