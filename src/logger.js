import Moment from 'moment';

class Logger {
  constructor(groupTitle) {
    this.groupTitle = groupTitle;
  }

  log(text) {
    const dateText = Moment().format( 'YYYY/MM/DD HH:mm:ss')
    console.log(`${dateText}: ${this.groupTitle} ${text}`);
  }
}

export { Logger as default };
