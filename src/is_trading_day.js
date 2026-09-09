const { isWorkday } = require('chinese-days');

const date = new Date();
const dateStr = date.toISOString().split('T')[0];

if (isWorkday(dateStr)) {
  console.log('true');
} else {
  console.log('false');
}
