const net = require('net');
const fs = require('fs');
const Promise = require('bluebird');
const yaml = require('js-yaml');
const dns = require('dns');

const configFile = process.argv[2] || './hosts.yml' 

console.log(`Using config file: ${configFile}`);

function tcpTest(addr) {
    return new Promise(function(resolve, reject) {
        const client = new net.Socket();
        client.connect(addr, () => {
            client.destroy();
            resolve(addr);
        });
        client.setTimeout(10000, function() {
            client.destroy();
            resolve(Object.assign({}, addr, { error: "Timeout" }));
        });    
        client.on('error', (err) => {
            client.destroy();
            if (err.code === 'ECONNREFUSED') {
                resolve(addr);
            }
            else {
                reject(Object.assign({}, addr, { error: err }));
            }
        });
    });
}

function resolveAddress(addr) {
    return new Promise((resolve) => {
        dns.lookup(addr.host, (err, resolvedAddresses) => {
            resolve(Object.assign({}, addr, {host: `${addr.host}(${err || resolvedAddresses})`})); 
        });
    });
}

function printResult({host, port, error}) {
    console.log(`\t${host}:${port} - ${error ? 'ERR' : 'OK'}`);
}

function toHostObject(line) {
    const [host, port = 80] = line.split(":");
    return {host, port};
}

function retrieveHostList(data) {
    return data.split("\n")
    .filter(line => !line.startsWith("#") && line.length > 0)
    .map(toHostObject)
    .filter(addr => addr.host && addr.port);
}

function testByCategory(category, hosts) {
    const promises = hosts.map(toHostObject)
                          .map(addr => tcpTest(addr).then(resolveAddress));

    Promise.all(promises).then((tcpResults) => {
        console.log(`Testing ${category}:`);
        tcpResults.forEach(printResult);
    })
    .catch(tcpResults => {
        console.error(tcpResults);
    });                           
}

function parseLine(line) {
    const [host, portsString = ''] = line.split(':');
    const ports = portsString.split(',').map(x => parseInt(x.trim()));

    return ports.map(port => `${host}:${port}`);
}

const lines = fs.readFileSync(configFile, 'utf8') || '';

const hostList = lines.split('\n')
     .map(parseLine)
     .reduce((acc, val) => acc.concat(...val), []);

testByCategory('sample', hostList);
//console.log(hostList);