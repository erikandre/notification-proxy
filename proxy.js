#!/usr/bin/env node

var net = require('net');
var http = require("http");
var url = require('url');
var qs = require('querystring');

const clientPort = 9000;
const controlPort = 9001;

var clients = [];
var id2clients = {};
var client2id = {};

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
        processCommand(JSON.parse(data.toString()), client);
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
      response.writeHead(500);
      response.end();
    }
  }
).listen(controlPort, function(err) {
  console.log('Listening for control commands on port ' + controlPort);
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
	if (parsedUrl.pathname == '/notify') {
		handleNotify(parsedUrl, request, response);
	}
}

function handleNotify(url, request, response) {
  var params = qs.parse(url.query);
  var id = params['id'];
  var body = "";
  request.on('data', function(chunk) {
		body += chunk;
	});
	request.on('end', function() {
		var clients = getClientsForId(id);
    if (clients != null) {
      clients.forEach(function(client) {
          client.write(body);
      });
      response.writeHead(200);
  		response.end();
    }
    else {
      response.writeHead(404);
  		response.end();
    }
	});
}

function serveStats(response) {
  response.writeHeader(200);
	response.write('Connected clients: ' + clients.length, 'utf8');
  response.end();
}

function processCommand(command, client) {
  if (command.type == 'register') {
    var id = command.value;
    if (!id2clients.hasOwnProperty(id)) {
      id2clients[id] = [];
    }
    id2clients[id].push(client);
    if (!client2id.hasOwnProperty(client)) {
      client2id[client] = [];
    }
    client2id[client].push(id);
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
  // Remove registrations for client
  if (client2id.hasOwnProperty(client)) {
    var count = 0; // Count number of registrations removed
    client2id[client].forEach(function(id) {
      if (id2clients.hasOwnProperty(id)) {
        var clients = id2clients[id];
        count += removeClientFromList(clients, client);
      }
    });
    console.log('Removed ' + count + ' registrations');
    delete client2id[client];
  }
  else {
    console.log('Client has no registrations');
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
