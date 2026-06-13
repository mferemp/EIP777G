const fs = require('fs');
const { execSync } = require('child_process');

const primitives = fs.readFileSync('contracts/ObfuscationPrimitives.sol', 'utf8');
const obfuscated = fs.readFileSync('contracts/EIP777G_Obfuscated.sol', 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'ObfuscationPrimitives.sol': { content: primitives },
    'EIP777G_Obfuscated.sol': { content: obfuscated }
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] }
    }
  }
};

fs.writeFileSync('compile-input.json', JSON.stringify(input));

try {
  const output = execSync('npx --yes solc@latest --standard-json', { 
    input: JSON.stringify(input),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  
  const result = JSON.parse(output);
  
  if (result.errors) {
    result.errors.forEach(e => console.log(e.formattedMessage || e.message));
  }
  
  if (result.contracts) {
    for (const [file, contracts] of Object.entries(result.contracts)) {
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
} catch (e) {
  console.error('Compilation failed:', e.message);
  if (e.stdout) console.log('STDOUT:', e.stdout.toString().slice(0, 1000));
  if (e.stderr) console.log('STDERR:', e.stderr.toString().slice(0, 1000));
}
