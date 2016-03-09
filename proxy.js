#!/usr/bin/env node

var net = require('net');
var http = require("http");
var url = require('url');
var qs = require('querystring');

const clientPort = 9000;
const controlPort = 9001;

var args = process.argv;
args.splice(0, 2); // Remove 'node' and the name of the script

var clients = [];
var id2clients = {};

if (args.length < 1) {
  console.error('Usage:');
	console.error('./proxy.js <key>');
	process.exit(1);
}
var commandKey = args[0];

var server = net.createServer(
  function(client) {
    console.log('Client connected');
    clients.push(client);
    client.on('end', function() {
      console.log('Client disconnected');
      cleanup(client);
    });
    client.on('data', function(data) {
      if (data == "") {
        return;
      }
      try {
        console.log(data.toString());
        processClientCommand(JSON.parse(data.toString()), client);
      }
      catch(err) {
        console.error('Ignoring invalid input');
        console.error(err);
      }
    });
  }
);
server.listen(clientPort, function(err) {
  if (err) throw err;
  console.log('Listening for clients on port ' + clientPort);
});

// Create control server
http.createServer(
  function(request, response) {
    try {
      if (request.method == 'GET') {
	      handleGet(request, response);
      } else if (request.method == 'POST') {
        handlePost(request, response);
      }
    }
    catch (err) {
      throw err;
      console.error(err);
      response.writeHead(500);
      response.end();
    }
  }
).listen(controlPort, function(err) {
  console.log('Listening for control commands on port ' + controlPort + ' using key: ' + commandKey);
});

function handleGet(request, response) {
	console.log('GET URL: ' + request.url);
	var parsedUrl = url.parse(request.url);
	if (parsedUrl.pathname == '/') {
		// Serve the main html page
		serveStats(response);
	} else if (parsedUrl.pathname == '/todo') {
    // Not sure if we need more stuff
	}
}

function handlePost(request, response) {
	console.log('POST URL: ' + request.url);
	var parsedUrl = url.parse(request.url);
  var params = qs.parse(parsedUrl.query);
  if (params.key != commandKey) {
    response.writeHead(403);
    response.end();
    return;
  }
	if (parsedUrl.pathname == '/notify') {
		handleNotify(parsedUrl, request, response);
	}
  else if (parsedUrl.pathname == '/broadcast') {
		handleBroadcast(parsedUrl, request, response);
	}
}

/**
* Send a message to all clients registered with a specific id
*/
function handleNotify(url, request, response) {
  var params = qs.parse(url.query);
  var id = params['id'];
  readRequestBody(request, function(body) {
    var count = 0;
    var clients = getClientsForId(id);
    if (clients != null && clients.length > 0) {
      var deadClients = [];
      clients.forEach(function(client) {
          try {
            client.write(body);
            count++;
          }
          catch (err) {
            deadClients.push(client);
          }
      });
      // Clean up any dead clients
      if (deadClients.length > 0) {
        deadClients.forEach(function(client) {
            cleanup(client);
        });
        console.log('Cleaned up ' + deadClients.length + ' dead clients');
      }
      response.writeHead(200);
  		response.end();
    }
    else {
      response.writeHead(404);
  		response.end();
    }
    console.log('Notified ' + count + ' clients');
  });
}

/**
* Send a broadcast message to all connected clients
*/
function handleBroadcast(url, request, response) {
  readRequestBody(request, function(body) {
    count = 0;
    clients.forEach(function(client) {
        try {
          client.write(body);
          count++;
        }
        catch(err) {
          // Ignored
        }
    });
    console.log('Successfully sent broadcast to ' + count + ' out of ' + clients.length + ' clients');
    response.writeHead(200);
    response.end();
  });
}

function readRequestBody(request, callback) {
  var body = "";
  request.on('data', function(chunk) {
		body += chunk;
	});
	request.on('end', function() {
		callback(body.replace(/(\r\n|\n|\r)/gm,"") + '\n');
	});
}

function serveStats(response) {
  response.writeHeader(200);
  var buffer = clients.length + ' clients connected\n';
  for (var id in id2clients) {
    if (id2clients.hasOwnProperty(id)) {
        buffer += id + ' - ';
        id2clients[id].forEach(function(client) {
            buffer += client.remoteAddress + ' ';
        });
        buffer += '\n';
    }
  }
	response.write(buffer);
  response.end();
}

function processClientCommand(command, client) {
  if (command.type == 'register') {
    var id = command.value;
    if (!id2clients.hasOwnProperty(id)) {
      id2clients[id] = [];
    }
    id2clients[id].push(client);
  }
}

function getClientsForId(id) {
  if (id2clients.hasOwnProperty(id)) {
    return id2clients[id];
  }
  else {
    return null;
  }
}

function cleanup(client) {
  // Unregister client
  removeClientFromList(clients, client);
  for (var id in id2clients) {
    if (id2clients.hasOwnProperty(id)) {
        removeClientFromList(id2clients[id], client);
    }
  }
}

function removeClientFromList(list, client) {
  var index = list.indexOf(client);
  if (index == -1) {
    console.error('Could not remove client from list');
    return 0;
  }
  else {
    list.splice(index, 1);
    return 1;
  }
}
