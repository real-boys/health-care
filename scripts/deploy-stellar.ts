import { xdr, Contract, SorobanRpc, Address, Keypair, Networks } from '@stellar/stellar-sdk';
import fs from 'fs';
import path from 'path';

/**
 * Deploy Healthcare Drips contract to Stellar network
 */
export class StellarDeployer {
    private rpc: SorobanRpc.Server;
    private network: string;
    private networkPassphrase: string;

    constructor(rpcUrl: string, network: string) {
        this.rpc = new SorobanRpc.Server(rpcUrl);
        this.network = network;
        this.networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
    }

    /**
     * Deploy the Healthcare Drips contract
     */
    async deployContract(
        deployerKeypair: Keypair,
        wasmPath: string
    ): Promise<{ contractId: string; contractAddress: Address }> {
        console.log('🚀 Deploying Healthcare Drips contract to Stellar...');

        // Load WASM file
        const wasmBuffer = fs.readFileSync(wasmPath);
        const wasmBase64 = wasmBuffer.toString('base64');

        // Install contract
        console.log('📦 Installing contract...');
        const installResult = await this.sendTransaction(
            deployerKeypair,
            (builder) => {
                const contractCode = xdr.ScVal.scvBytes(wasmBuffer);
                return builder
                    .setOperation(
                        xdr.HostFunctionType.HOST_FUNCTION_TYPE_INSTALL_CONTRACT_WASM,
                        contractCode
                    )
                    .setTimeout(30);
            }
        );

        const contractCodeLedgerKey = xdr.LedgerKey.contractCode(
            new xdr.LedgerKeyContractCode({
                hash: installResult.result.retval.bytes(),
            })
        );

        // Create contract instance
        console.log('🏗️ Creating contract instance...');
        const createResult = await this.sendTransaction(
            deployerKeypair,
            (builder) => {
                const salt = xdr.ScVal.scvBytes(crypto.getRandomValues(new Uint8Array(32)));
                return builder
                    .setOperation(
                        xdr.HostFunctionType.HOST_FUNCTION_TYPE_CREATE_CONTRACT,
                        xdr.ScVal.scvVec([
                            contractCodeLedgerKey.toXDR(),
                            salt,
                        ])
                    )
                    .setTimeout(30);
            }
        );

        const contractId = createResult.result.retval
            .address()
            .contractId()
            .toString('hex');
        const contractAddress = new Address.ScAddress(
            createResult.result.retval.address()
        );

        console.log(`✅ Contract deployed successfully!`);
        console.log(`📍 Contract ID: ${contractId}`);
        console.log(`📍 Contract Address: ${contractAddress.toString()}`);

        return { contractId, contractAddress };
    }

    /**
     * Initialize the contract
     */
    async initializeContract(
        contractAddress: Address,
        deployerKeypair: Keypair,
        adminAddress: Address
    ): Promise<void> {
        console.log('⚙️ Initializing Healthcare Drips contract...');

        const contract = new Contract(contractAddress);
        
        await this.sendTransaction(
            deployerKeypair,
            (builder) => {
                return contract.call(
                    'initialize',
                    adminAddress.toScVal()
                )(builder)
                    .setTimeout(30);
            }
        );

        console.log('✅ Contract initialized successfully!');
    }

    /**
     * Send a transaction to the Stellar network
     */
    private async sendTransaction(
        signer: Keypair,
        operationBuilder: (builder: any) => any
    ): Promise<any> {
        const account = await this.rpc.getAccount(signer.publicKey());
        
        const transaction = new TransactionBuilder(account, {
            fee: '100',
            networkPassphrase: this.networkPassphrase,
        })
            .setTimeout(30)
            .addOperation(
                operationBuilder(new OperationBuilder())
            )
            .build();

        transaction.sign(signer);

        const result = await this.rpc.sendTransaction(transaction);
        
        if (result.status === 'ERROR') {
            throw new Error(`Transaction failed: ${result.errorResult}`);
        }

        // Wait for transaction confirmation
        let txResult = await this.rpc.getTransaction(result.hash);
        
        while (txResult.status === 'PENDING' || txResult.status === 'NOT_FOUND') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            txResult = await this.rpc.getTransaction(result.hash);
        }

        if (txResult.status === 'FAILED') {
            throw new Error(`Transaction failed: ${txResult.resultXdr}`);
        }

        return txResult;
    }

    /**
     * Deploy and initialize the complete Healthcare Drips platform
     */
    async deployPlatform(
        deployerKeypair: Keypair,
        wasmPath: string,
        adminAddress?: Address
    ): Promise<{
        contractId: string;
        contractAddress: Address;
        adminAddress: Address;
    }> {
        // Deploy contract
        const { contractId, contractAddress } = await this.deployContract(
            deployerKeypair,
            wasmPath
        );

        // Use deployer as admin if not specified
        const admin = adminAddress || new Address(deployerKeypair.publicKey());

        // Initialize contract
        await this.initializeContract(contractAddress, deployerKeypair, admin);

        return {
            contractId,
            contractAddress,
            adminAddress: admin,
        };
    }

    /**
     * Save deployment information to file
     */
    saveDeploymentInfo(
        deploymentInfo: any,
        outputPath: string = './deployment-stellar.json'
    ): void {
        const deploymentData = {
            network: this.network,
            timestamp: new Date().toISOString(),
            ...deploymentInfo,
        };

        fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
        console.log(`📋 Deployment info saved to: ${outputPath}`);
    }
}

/**
 * Main deployment function
 */
async function main() {
    try {
        console.log('🌟 Healthcare Drips - Stellar Deployment');
        console.log('==========================================');

        // Configuration
        const network = process.env.STELLAR_NETWORK || 'testnet';
        const rpcUrl = network === 'testnet' 
            ? 'https://soroban-testnet.stellar.org'
            : 'https://soroban.stellar.org';

        const secretKey = process.env.DEPLOYER_SECRET_KEY;
        if (!secretKey) {
            throw new Error('DEPLOYER_SECRET_KEY environment variable is required');
        }

        const wasmPath = process.env.WASM_PATH || './target/wasm32v1-none/release/healthcare_drips.wasm';

        // Initialize deployer
        const deployer = new StellarDeployer(rpcUrl, network);
        const deployerKeypair = Keypair.fromSecret(secretKey);

        console.log(`📡 Network: ${network}`);
        console.log(`🔑 Deployer: ${deployerKeypair.publicKey()}`);
        console.log(`📦 WASM: ${wasmPath}`);
        console.log('');

        // Check if WASM file exists
        if (!fs.existsSync(wasmPath)) {
            throw new Error(`WASM file not found: ${wasmPath}`);
        }

        // Deploy platform
        const deploymentInfo = await deployer.deployPlatform(
            deployerKeypair,
            wasmPath
        );

        // Save deployment info
        deployer.saveDeploymentInfo(deploymentInfo);

        console.log('');
        console.log('🎉 Deployment completed successfully!');
        console.log('');
        console.log('Contract Details:');
        console.log(`- Contract ID: ${deploymentInfo.contractId}`);
        console.log(`- Contract Address: ${deploymentInfo.contractAddress.toString()}`);
        console.log(`- Admin Address: ${deploymentInfo.adminAddress.toString()}`);
        console.log('');
        console.log('Next Steps:');
        console.log('1. Update your frontend with the new contract address');
        console.log('2. Test the contract functions');
        console.log('3. Set up contributor verification');
        console.log('4. Create initial healthcare issues');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

export default StellarDeployer;
