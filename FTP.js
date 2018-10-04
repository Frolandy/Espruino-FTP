var commandSocket;
var dataSocket;

var responseCode =  {

    BEGIN:                  -1,
    DATA_CONNECT_OK:         1,
    WAIT_RESP:               2,
    PUT_FILE_OK:           150,
    COMMAND_CONNECT_OK:    220,
    DATA_SEND:             226,
    USERNAME_OK:           331,
    PASSWORD_OK:           230,
    MODE_OK:               227,
    ERR_CODE:              999

};

var config = null;

var ftpCommands = {

    MODE: "PASV\r\n",
    PUT_FILE: "STOR ",
    SIZE: "SIZE ",
    USER: "USER ",
    PASSWORD: "PASS "

};

var response = null;
var expectedResponse = null;
var dataPort = null;

const MAX_WAIT_COUNT = 20;
const responseTimeOut = 30;
const timeOutEndConnection = 3500;

var timeoutOnSend = 100;

var waitCount = MAX_WAIT_COUNT;
var message = null;


var FTP = function(configuration){

    config = configuration;

};

function parseFtpMsg(answer){

    if(parseInt("" + answer[0].slice(0,3)) === responseCode.MODE_OK){
        dataPort = JSON.stringify(answer).split(')');
    }

    if(parseInt("" + answer[0].slice(0,3)) === responseCode.DATA_SEND){
        response = responseCode.BEGIN;
    }else{

        switch(parseInt("" + answer[0].slice(0,3))){

            case expectedResponse: 
                response = expectedResponse;
                break;

            default:
                if(parseInt("" + answer[1].slice(0,3)) === expectedResponse)
                    response = expectedResponse;
                else{
                    response = responseCode.ERR_CODE;
                }
        }
    }
}

function close_sockets(){

    dataSocket.end();
    dataSocket = null;
    dataSocketOpen = false;

    return setTimeout(function(){
        commandSocket.end();
        commandSocket = null;
    }, timeoutOnSend);

}

function create_commandSocket(ip, port){

    commandSocket = require("net").connect({host: ip, port: port}, function() { 

        commandSocket.on('data', function(data) {
            parseFtpMsg(data.split("\n"));
        });

    });

}

function create_dataSocket(ip, port){

    dataSocket = require("net").connect({host: ip, port: port}, function(){
        dataSocketOpen = true;
    });

}


function ftp_connect(){
 
    switch(response){

         case responseCode.BEGIN:


            expectedResponse = responseCode.COMMAND_CONNECT_OK;
            response = responseCode.WAIT_RESP;
            waitCount = MAX_WAIT_COUNT;

            create_commandSocket(config.ip, config.port);

            return setTimeout(function(){
                ftp_connect();
            }, responseTimeOut);


        case responseCode.COMMAND_CONNECT_OK:

            expectedResponse = responseCode.USERNAME_OK;
            response = responseCode.WAIT_RESP;
            waitCount = MAX_WAIT_COUNT;

            commandSocket.write(ftpCommands.USER + config.user + "\r\n");

            return setTimeout(function(){
                ftp_connect();
            }, responseTimeOut);


        case responseCode.USERNAME_OK:

            expectedResponse = responseCode.PASSWORD_OK;
            response = responseCode.WAIT_RESP;
            waitCount = MAX_WAIT_COUNT;

            commandSocket.write(ftpCommands.PASSWORD + config.password + "\r\n");

            return setTimeout(function(){
                ftp_connect();
            }, responseTimeOut);


        case responseCode.PASSWORD_OK:
        
            expectedResponse = responseCode.MODE_OK;
            response = responseCode.WAIT_RESP;
            waitCount = MAX_WAIT_COUNT;

            commandSocket.write(ftpCommands.MODE);

            return setTimeout(function(){
                ftp_connect();
            }, responseTimeOut);



        case responseCode.MODE_OK:

            expectedResponse = responseCode.PUT_FILE_OK;
            response = responseCode.WAIT_RESP;
            waitCount = MAX_WAIT_COUNT;

            commandSocket.write(ftpCommands.PUT_FILE + config.fileName + config.format + "\r\n");

            return setTimeout(function(){
                ftp_connect();
            }, responseTimeOut);
        


        case responseCode.PUT_FILE_OK:

            response = responseCode.DATA_CONNECT_OK;
            expectedResponse = responseCode.ERR_CODE;
            waitCount = MAX_WAIT_COUNT;

            var first_byte = parseInt(dataPort[0].split(',')[4]);
            var second_byte = parseInt(dataPort[0].split(',')[5]);
            var newPort = first_byte*256 + second_byte;

            create_dataSocket(config.ip, newPort);

            first_byte = null;
            second_byte = null;
            newPort = null;

            return setTimeout(function(){
                ftp_connect();
            }, responseTimeOut + 70);


        case responseCode.DATA_CONNECT_OK:

            if(dataSocketOpen){

                response = responseCode.BEGIN;
                waitCount = MAX_WAIT_COUNT;

                dataSocket.write(message);

                message = null;


                return setTimeout(function(){
                    close_sockets();
                 }, timeOutEndConnection);

            }else return setTimeout(function(){
                response = responseCode.ERR_CODE;
                ftp_connect();
            }, responseTimeOut);


        case responseCode.ERR_CODE: 

            return setTimeout(function(){
        
                print("ERROR FTP CONNECT");
                waitCount = MAX_WAIT_COUNT;
                response = responseCode.BEGIN;
                close_sockets();
            
        }, responseTimeOut);


        case responseCode.WAIT_RESP: 

                waitCount--;

                if(!waitCount){
                    response = responseCode.ERR_CODE;
                    expectedResponse = responseCode.ERR_CODE;
                    waitCount = MAX_WAIT_COUNT;
                }

            return setTimeout(function(){
                ftp_connect();
            }, responseTimeOut);

     }
}

FTP.prototype.sendMessage = function (msg){

    response = responseCode.BEGIN;

    message = msg;
    ftp_connect();

};


exports.connect = function(configuration, timeout) {
  timeoutOnSend = timeout;
  return new FTP(configuration);

};
