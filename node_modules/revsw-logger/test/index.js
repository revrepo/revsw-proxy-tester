//var winston = require('winston');

var logger = require('../index.js')({
  transports: {
    'Console': {},
    'File': {filename: 'test.log'},
    'Rsyslog': {  
	'Level' : 'debug',
//	'host' : 'localhost', // default
//	'port' : '',
//	'protocol' : 'tcp4'|'udp4'|'unix'|'unix-connect', // 
//	'path' : '/var/run/syslog' | '/dev/log' // path to dgram 
//	'type' : 'bsd' // default
	'app_name' : 'logger-test',
//	'eol' : '\r\n' // end of line character besides default	
    }
  }
});


logger.info('winston - info logged');
logger.debug('winston - error logged');
logger.error('winston - error logged');
logger.error('Super error with stack trace', new Error().stack);


logger.log('info', 'foo');
logger.info('winston - exiting now', { seriously: true }, function(err, level, msg, meta) {
  console.log('console - CALLING PROCESS EXIT');
  process.exit(0);
});
