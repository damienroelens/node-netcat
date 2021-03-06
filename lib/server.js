var net           = require('net');
var inherits      = require('util').inherits;
var EventEmitter  = require('events').EventEmitter;
var _             = require('underscore');
var ut            = require('./util');

module.exports = Server;

function Server(port, host, options) {
  if (!(this instanceof Server)) {
    return new Server(port, host, options);
  }

  EventEmitter.call(this);
  Server.init.call(this, port, host, options);
}

inherits(Server, EventEmitter);

Server.init = function(port, host, options) {
  var self = this;

  if (!port) {
    throw new Error('in node-nc server the port is mandatory!');  
  }

  // check args
  if (_.isObject(host)) {
    options = host;
    host = 'localhost';
  }

  this._clients       = {};
  this._port          = port;
  this._host          = host || 'localhost';
  this.timeout        = (options && options.timeout) || 3600000;

  function handler (socket) {
    var client = socket.remoteAddress + ':' + socket.remotePort;

    // socket configurations
    socket.setKeepAlive(true, 60000);
    socket.setTimeout(this._timeout);

    if (options && options.readEncoding) {
      socket.setEncoding(options.readEncoding); 
    }

    //
    // client events handlers
    //
    function data(chunk) {
      self.emit('data', client, chunk);
    }

    function timeout() {
      socket.destroy();
    }

    function close() {
      delete self._clients[client];
      self.emit('client_off', client);
    }

    //
    // client events
    //
    socket.on('data', data);
    socket.on('timeout', timeout);
    socket.on('close', close);
  }

  self._server = net.createServer(handler);

  //
  // server events handlers
  //
  function listening() {
    self.emit('ready');
  }

  function error(err) {
    self.emit('error', err);
  }

  function close() {
    self.emit('close');
  }

  function conn(socket) {
    self._clients[socket.remoteAddress + ':' + socket.remotePort] = socket;
    self.emit('client_on', socket.remoteAddress + ':' + socket.remotePort);
  }

  // server events
  process.nextTick(function serverEvents() {
    self._server.on('listening', listening);
    self._server.on('connection', conn);
    self._server.on('close', close);
    self._server.on('error', error);
  });
};

Server.prototype.listen = function() {
  this._server.listen(this._port, this._host);
};

Server.prototype.close = function(cb) {
  cb = cb || ut.noop;
  this._server.close(cb);
};

Server.prototype.send = function(client, msg, end, cb) {
  if (typeof end === 'function') {
    cb = end;
    end = false;
  }
  
  cb = cb || ut.noop;
  msg = msg || new Buffer([0x00]);

  if (_.isNumber(msg)) {
    msg = msg.toString();
  }

  if (!Buffer.isBuffer(msg)) {
    msg = new Buffer(msg.toString());
  }

  // check client exists
  if (!_.contains(_.keys(this._clients), client)) {
    cb();
  } else {
    // client exists
    // send and close connection
    if (end) {
      this._clients[client].end(msg);
      cb();
    } else {
      this._clients[client].write(msg, cb);  
    }
  }
};

Server.prototype.getClients = function() {
  return _.keys(this._clients);
};
