import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';
import {
  Wallet,
  Shield,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  X,
  Smartphone,
  Laptop,
  Usb
} from 'lucide-react';

const WalletConnect = ({ onConnect, onDisconnect, account }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(null);
  const [error, setError] = useState(null);
  const [supportedWallets] = useState([
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: '🦊',
      description: 'Connect with your MetaMask browser extension',
      type: 'extension',
      isInstalled: () => typeof window !== 'undefined' && window.ethereum?.isMetaMask
    },
    {
      id: 'freighter',
      name: 'Freighter',
      icon: '🚀',
      description: 'Stellar wallet with cross-chain support',
      type: 'extension',
      isInstalled: () => typeof window !== 'undefined' && window.freighter
    },
    {
      id: 'albedo',
      name: 'Albedo',
      icon: '🌟',
      description: 'Browser-based Stellar wallet',
      type: 'web',
      isInstalled: () => true // Always available as web wallet
    },
    {
      id: 'ledger',
      name: 'Ledger',
      icon: '🔒',
      description: 'Hardware wallet for maximum security',
      type: 'hardware',
      isInstalled: () => true // Can be connected via WebHID/WebUSB
    }
  ]);

  useEffect(() => {
    checkWallets();
  }, []);

  const checkWallets = () => {
    // Check which wallets are installed
    supportedWallets.forEach(wallet => {
      wallet.installed = wallet.isInstalled();
    });
  };

  const connectWallet = async (walletId) => {
    setConnectingWallet(walletId);
    setError(null);

    try {
      let provider;
      let signer;
      let address;

      switch (walletId) {
        case 'metamask':
          const ethereumProvider = await detectEthereumProvider();
          if (!ethereumProvider) {
            throw new Error('MetaMask is not installed. Please install it to continue.');
          }
          
          const accounts = await ethereumProvider.request({ 
            method: 'eth_requestAccounts' 
          });
          
          provider = new ethers.providers.Web3Provider(ethereumProvider);
          signer = provider.getSigner();
          address = accounts[0];
          break;

        case 'freighter':
          if (!window.freighter) {
            throw new Error('Freighter is not installed. Please install it to continue.');
          }
          
          // Freighter integration (simplified)
          const freighterAddress = await window.freighter.getPublicKey();
          if (!freighterAddress) {
            throw new Error('Failed to connect to Freighter wallet.');
          }
          
          // For demo purposes, we'll create a mock provider
          provider = new ethers.providers.JsonRpcProvider('https://api.mainnet-beta.solana.com');
          address = freighterAddress;
          break;

        case 'albedo':
          // Albedo integration - opens popup for authentication
          try {
            const albedoResponse = await new Promise((resolve, reject) => {
              const popup = window.open(
                'https://albedo.link/public',
                'albedo',
                'width=400,height=600'
              );
              
              const checkClosed = setInterval(() => {
                if (popup.closed) {
                  clearInterval(checkClosed);
                  reject(new Error('Albedo connection cancelled'));
                }
              }, 1000);

              // Listen for messages from Albedo popup
              const messageHandler = (event) => {
                if (event.origin === 'https://albedo.link') {
                  clearInterval(checkClosed);
                  popup.close();
                  window.removeEventListener('message', messageHandler);
                  resolve(event.data);
                }
              };
              
              window.addEventListener('message', messageHandler);
              setTimeout(() => {
                clearInterval(checkClosed);
                popup.close();
                reject(new Error('Albedo connection timeout'));
              }, 300000); // 5 minute timeout
            });

            if (albedoResponse.pubkey) {
              address = albedoResponse.pubkey;
            } else {
              throw new Error('Failed to connect to Albedo wallet.');
            }
          } catch (err) {
            throw new Error('Albedo connection failed: ' + err.message);
          }
          break;

        case 'ledger':
          // Ledger integration (simplified - would need @ledgerhq/hw-transport-webusb)
          try {
            // This is a simplified version - in production you'd use proper Ledger libraries
            if (!navigator.usb && !navigator.hid) {
              throw new Error('Your browser does not support WebUSB/WebHID required for Ledger connection.');
            }
            
            // Mock Ledger connection for demo
            // In production, you'd use @ledgerhq/hw-transport-webusb or @ledgerhq/hw-transport-webhid
            throw new Error('Ledger connection requires additional setup. Please use MetaMask for now.');
            
          } catch (err) {
            throw new Error('Ledger connection failed: ' + err.message);
          }

        default:
          throw new Error('Unsupported wallet type');
      }

      // Call the onConnect callback with wallet info
      onConnect({
        address,
        provider,
        signer,
        walletType: walletId,
        walletName: supportedWallets.find(w => w.id === walletId)?.name
      });

      setIsModalOpen(false);
      
    } catch (err) {
      setError(err.message);
      console.error('Wallet connection error:', err);
    } finally {
      setConnectingWallet(null);
    }
  };

  const disconnectWallet = () => {
    onDisconnect();
    setError(null);
  };

  const getWalletIcon = (type) => {
    switch (type) {
      case 'extension':
        return <Laptop className="w-4 h-4" />;
      case 'web':
        return <Smartphone className="w-4 h-4" />;
      case 'hardware':
        return <Usb className="w-4 h-4" />;
      default:
        return <Wallet className="w-4 h-4" />;
    }
  };

  if (account) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-green-700 hidden sm:inline">
          {account.slice(0, 6)}...{account.slice(-4)}
        </span>
        <span className="text-sm font-medium text-green-700 sm:hidden">
          {account.slice(0, 4)}...{account.slice(-4)}
        </span>
        <button
          onClick={disconnectWallet}
          className="ml-2 text-green-600 hover:text-green-700 transition-colors"
          title="Disconnect wallet"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-md hover:shadow-lg"
      >
        <Shield className="w-4 h-4" />
        <span className="hidden sm:inline">Connect Wallet</span>
        <span className="sm:hidden">Connect</span>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Connect Wallet</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Choose your preferred wallet to connect to the platform
              </p>
            </div>

            <div className="p-6 space-y-3">
              {supportedWallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => connectWallet(wallet.id)}
                  disabled={connectingWallet === wallet.id || !wallet.installed}
                  className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    connectingWallet === wallet.id
                      ? 'border-purple-500 bg-purple-50 cursor-not-allowed'
                      : wallet.installed
                      ? 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 cursor-pointer'
                      : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{wallet.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{wallet.name}</h3>
                        {getWalletIcon(wallet.type)}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{wallet.description}</p>
                      {!wallet.installed && wallet.type !== 'web' && (
                        <p className="text-xs text-red-600 mt-1">
                          {wallet.type === 'hardware' 
                            ? 'Connect your device via USB' 
                            : 'Not installed - please install first'
                          }
                        </p>
                      )}
                    </div>
                    {connectingWallet === wallet.id ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <div className="px-6 pb-6">
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">Connection Error</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 pb-6">
              <div className="text-xs text-gray-500 text-center">
                By connecting a wallet, you agree to our Terms of Service and Privacy Policy
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletConnect;
