const WebSockets = require("ws"),
    Blockchain = require("./blockchain");

const sockets = [];

const { 
    getBlockchain, 
    getNewestBlock, 
    isBlockStructureVaild, 
    addBlcokToChain, 
    replaceChain } = Blockchain;

const getSockets = () => sockets;

// Messages Types
const GET_LATEST = "GET_LATEST";
const GET_ALL = "GET_ALL";
const BLOCKCHAIN_RESPONSE = "BLOCKCHAIN_RESPONSE";

// Messages Createors
const getLatest = () => {
    return {
        type: GET_LATEST,
        data: null
    };
};

const getAll = () => {
    return {
        type: GET_ALL,
        data: null
    };
};

const blockchainResponse = data => {
    return {
        type: BLOCKCHAIN_RESPONSE,
        data
    };
};

const startP2PServer = server => {
    const wsServer = new WebSockets.Server({ server });
    wsServer.on("connection", ws => {
        console.log(`Hello Socket!`);
        initSocketConnection(ws);
    });
    console.log("Nomadcoin p2p server start!");
};

const initSocketConnection = ws => {
    sockets.push(ws);
    handleSocketMessages(ws);
    handleSocketError(ws);
    sendMessage(ws, getLatest());
};

const parseData = data => {
    try {
        return JSON.parse(data)
    } catch(e) {
        console.log(e);
        return null;
    }
};

const handleSocketMessages = ws => {
    ws.on("message", data => {
        const message = parseData(data);
        if (message === null) {
            return;
        }
        console.log(message);
        switch(message.type) {
            case GET_LATEST:
                sendMessage(ws, responseLatest());
                break;
            case GET_ALL:
                sendMessage(ws, responseAll());
                break;

            case BLOCKCHAIN_RESPONSE:
                const receivedBlocks = message.data
                if (receivedBlocks === null) {
                    break;
                }
                handleBlockchainResponse(receivedBlocks)
                break;
        }
    });
};

const handleBlockchainResponse = receivedBlocks => {
    if (receivedBlocks.length === 0) {
        console.log("Received blocks have a length of 0");
        return ;
    }
    const latestBlockRecieved = receivedBlocks[receivedBlocks.length - 1];
    if (!isBlockStructureVaild(latestBlockRecieved)) {
        console.log("The block chain structure of the block reviced is not vaild");
        return;
    }
    const newestBlock = getNewestBlock();
    if (latestBlockRecieved.index > newestBlock.index) {
        if (newestBlock.hash === latestBlockRecieved.previousHash) {
            if (addBlcokToChain(latestBlockRecieved)) {
                broadcastNewBlock();
            }
        } else if (receivedBlocks.length === 1) {
            sendMessageToAll(getAll())
        } else {
            replaceChain(receivedBlocks);
        }
    }
};

const sendMessage = (ws, message) => ws.send(JSON.stringify(message));

const sendMessageToAll = message => sockets.forEach(ws => sendMessage(ws, message))

const broadcastNewBlock = () => sendMessageToAll(responseLatest())

const responseLatest = () => blockchainResponse([getNewestBlock()])

const responseAll = () => blockchainResponse(getBlockchain())

const handleSocketError = ws => {
    const closeSocketConnection = ws => {
        ws.close();
        sockets.splice(sockets.indexOf(ws, 1));
    };
    ws.on('close', () => closeSocketConnection(ws));
    ws.on('error', () => closeSocketConnection(ws));
}

const connectToPeers = newPeer => {
    const ws = new WebSockets(newPeer);
    ws.on("open", () => {
        initSocketConnection(ws);
    });
};

module.exports = {
    startP2PServer,
    connectToPeers,
    broadcastNewBlock
};