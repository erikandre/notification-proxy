# Notification Proxy

**PLEASE NOTE:** This software is not meant for production use. It's just a prototyping tool (that I developed it to be able to send socket notifications from a Parse server).

A proxy for sending notifications to multiple clients, connected over socket connections based, on http requests.
By default the proxy opens two ports:

* 9000: Accepts socket connections from clients which needs to register themself after connecting (see details below).
* 9001: Accepts HTTP requests (PUT and GET) which can trigger notifications to be sent to any of the clients connected to port 9000.

## Usage

To improve stability it is recommended that you use another tool for making sure that the script is restarted if it does crash. In the example below I'm using [forever](https://github.com/foreverjs/forever).

``
npm install
forever proxy.js <access key>
``

## Client protocol

To register to recieve notifications for a certain id, the client should send the following JSON payload.

```json
{
  "type":"register",
  "value":"<id>"
}
```

## Control protocol

To send a notification to users registered with a certain id, perform a POST to port 9001 using the following URL and the body containing the notification payload (which could be whatever you want it to be):

```
/notify?key=<access key specified when starting server>&id=<client registration id>
```
