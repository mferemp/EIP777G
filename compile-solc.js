const fs = require('fs');
const solc = require('solc');

// Read contract sources
const primitives = fs.readFileSync('contracts/ObfuscationPrimitives.sol', 'utf8');
const obfuscated = fs.readFileSync('contracts/EIP777G_Obfuscated.sol', 'utf8');

// Fix the import - remove it since we'll provide both inline
const obfuscatedFixed = obfuscated.replace('import "./ObfuscationPrimitives.sol";', '');

// Prepare input for solc
const input = {
    language: 'Solidity',
    sources: {
        'ObfuscationPrimitives.sol': { content: primitives },
        'EIP777G_Obfuscated.sol': { content: obfuscatedFixed }
    },
    settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object']
            }
        }
    }
};

console.log('Compiling with import callback...');

// Custom import callback - return the inline sources
function findImports(path) {
    console.log('Import requested:', path);
    if (path === './ObfuscationPrimitives.sol') {
        return { contents: fs.readFileSync('contracts/ObfuscationPrimitives.sol', 'utf8') };
    }
    return { error: 'File not found: ' + path };
}

console.log('Compiling with import callback...');

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
    output.errors.forEach(e => {
        if (e.severity === 'error') {
            console.error(e.formattedMessage);
        }
    });
    process.exit(1);
}

if (output.contracts) {
    for (const [file, contracts] of Object.entries(output.contracts)) {
        for (const [name, data] of Object.entries(contracts)) {
            console.log(`\n=== ${name} ===`);
            if (data.evm?.bytecode?.object) {
                const bytecode = '0x' + data.evm.bytecode.object;
                console.log(`BYTECODE_LENGTH: ${bytecode.length}`);
                fs.writeFileSync('bytecode.txt', bytecode);
                console.log('Bytecode saved to bytecode.txt');
            }
            if (data.abi) {
                fs.writeFileSync('abi.json', JSON.stringify(data.abi, null, 2));
                console.log('ABI saved to abi.json');
            }
        }
    }
}

console.log('\nCompilation successful!');