const CryptoJS = require("crypto-js"),
    hexToBinary = require("hex-to-binary");

const BLOCK_GENERATION_INTERVAL = 10; //sec
const DIFFICULTY_ADJUSMENT_INTERVAL = 10; //block 

class Block {
    constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

const genesisBlock = new Block(
    0,
    "5FECEB66FFC86F38D952786C6D696C79C2DBC239DD4E91B46729D73A27FB57E9",
    null,
    1537619350,
    "this is the genesis",
    0,
    0
);

let blockchain = [genesisBlock];

const getNewestBlock = () => blockchain[blockchain.length - 1]

const getTimeStamp = () => Math.round(new Date().getTime() / 1000);

const getBlockchain = () => blockchain;

const createHash = (index, previousHash, timestamp, data, difficulty, nonce) => 
    CryptoJS.SHA256(
        index + 
        previousHash + 
        timestamp + 
        JSON.stringify(data) + 
        difficulty + 
        nonce)
        .toString();

const createNewBlock = data => {
    const previousBlock = getNewestBlock();
    const newBlockIndex = previousBlock.index + 1;
    const newTimeStamp = getTimeStamp();
    const difficulty = findDifficulty();
    const newBlock = findBlock(
        newBlockIndex,
        previousBlock.hash,
        newTimeStamp,
        data,
        difficulty
    );
    addBlcokToChain(newBlock);
    require("./p2p").broadcastNewBlock();
    return newBlock;
};

const findDifficulty = () => {
    const newestBlock = getNewestBlock();
    if(newestBlock.index % DIFFICULTY_ADJUSMENT_INTERVAL === 0 && 
        newestBlock.index !== 0) {
        return calculateNewDifficulty(newestBlock, getBlockchain());
    } else {
        return newestBlock.difficulty
    }
};

const calculateNewDifficulty = (newestBlock, blockchain) => {
    const lastCalculatedBlock = blockchain[blockchain.length - DIFFICULTY_ADJUSMENT_INTERVAL];
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSMENT_INTERVAL;
    const timeTaken = newestBlock.timestamp - lastCalculatedBlock.timestamp;
    if(timeTaken < timeExpected / 2) {
        return lastCalculatedBlock.difficulty + 1;
    } else if(timeTaken > timeExpected * 2) {
        return lastCalculatedBlock.difficulty - 1;
    } else {
        return lastCalculatedBlock.difficulty;
    }
};

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    while (true) {
        console.log('current nonce: ', nonce);
        const hash = createHash(
            index,
            previousHash,
            timestamp,
            data,
            difficulty,
            nonce
        );
        //Todo: check amount of zeros 
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(
                index, 
                hash, 
                previousHash, 
                timestamp, 
                data, 
                difficulty, 
                nonce
            );
        }
        nonce++;
    }
};

const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInbinary = hexToBinary(hash);
    const requiredZeros = "0".repeat(difficulty);
    console.log('Trying difficulty: ', difficulty, 'with hash', hashInbinary);
    return hashInbinary.startsWith(requiredZeros);
};

const getBlockHash = block => createHash(
    block.index, 
    block.previousHash, 
    block.timestamp, 
    block.data,
    block.difficulty,
    block.nonce);

const isTimeStampValid = (newBlock, oldBlock) => {
    return (
        oldBlock.timestamp - 60 < newBlock.timestamp && 
        newBlock.timestamp - 60 < getTimeStamp()
    );
};

const isBlockValid = (candidateBlock, latestBlock) => {
    if(!isBlockStructureVaild(candidateBlock)){
        console.log("The candidate block structure is not valid");
        return false;
    }
    else if(latestBlock.index + 1 !== candidateBlock.index){
        console.log("The candidate block doesnt have a valid index");
        return false;
    } else if(latestBlock.hash !== candidateBlock.previousHash){
        console.log("The previousHash of the candidate block is not the hash of the latest block");
        return false;
    } else if(getBlockHash(candidateBlock) !== candidateBlock.hash){
        console.log("The hash of this block is invalid");
        return false;
    } else if(!isTimeStampValid(candidateBlock, latestBlock)) {
        console.log('The timestamp of this block to is dodgy');
        return false;
    }
    return true;
};

const isBlockStructureVaild = block => {
    return (
        typeof block.index === "number" && 
        typeof block.hash === "string" && 
        typeof block.previousHash === "string" && 
        typeof block.timestamp === "number" && 
        typeof block.data === "string"
    )
};

const isChainValid = candidateChain => {
    const isGenesisValid = block => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };
    if(!isGenesisValid(candidateChain[0])){
        console.log("The candidateChain's gneesisBlcok is not hte same as our genesisBlock");
        return false;
    }
    for(let i = 1; i < candidateChain.length; i++){
        if(!isBlockStructureVaild(candidateChain[i], candidateChain[i - 1])){
            return false;
        }
    }
    return true;
};

const sumDifficulty = anyBlockchain => 
    anyBlockchain
        .map(block => block.difficulty)
        .map(difficulty => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);

const replaceChain = candidateChain => {
    if(
        isChainValid(candidateChain) && 
        sumDifficulty(candidateChain) > sumDifficulty(getBlockchain())
    ){
        blockchain = candidateChain;
    } else {
        return false;
    }
};

const addBlcokToChain = newBlock => {
    if (isBlockValid(newBlock, getNewestBlock())) {
        getBlockchain().push(newBlock);
        return true;
    } else {
        return false;
    }
};

module.exports = {
    getBlockchain,
    createNewBlock,
    getNewestBlock,
    isBlockStructureVaild,
    addBlcokToChain,
    replaceChain
};