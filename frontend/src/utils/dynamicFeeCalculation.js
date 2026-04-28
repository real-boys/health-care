import { useState, useCallback } from 'react';

// Dynamic transaction fee calculation utility
export class DynamicFeeCalculator {
  constructor() {
    this.baseFee = 0.001; // Base fee in ETH
    this.gasPriceMultiplier = 1.2;
    this.congestionThreshold = 50; // Gas price threshold for congestion
    this.lastGasPrice = null;
    this.feeHistory = [];
  }

  // Calculate dynamic transaction fee based on current network conditions
  async calculateTransactionFee(transactionDetails) {
    try {
      const gasPrice = await this.getCurrentGasPrice();
      const gasLimit = await this.estimateGasLimit(transactionDetails);
      const networkCongestion = await this.getNetworkCongestion();
      
      const baseFee = this.calculateBaseFee(gasPrice, gasLimit);
      const priorityFee = this.calculatePriorityFee(networkCongestion);
      const congestionMultiplier = this.getCongestionMultiplier(networkCongestion);
      
      const totalFee = (baseFee + priorityFee) * congestionMultiplier;
      
      // Store fee history for trend analysis
      this.feeHistory.push({
        timestamp: new Date(),
        gasPrice,
        gasLimit,
        totalFee,
        networkCongestion
      });
      
      // Keep only last 100 entries
      if (this.feeHistory.length > 100) {
        this.feeHistory.shift();
      }
      
      return {
        totalFee: totalFee.toFixed(6),
        baseFee: baseFee.toFixed(6),
        priorityFee: priorityFee.toFixed(6),
        gasPrice: gasPrice.toFixed(9),
        gasLimit,
        networkCongestion,
        estimatedWaitTime: this.estimateWaitTime(networkCongestion),
        confidence: this.calculateConfidence()
      };
    } catch (error) {
      console.error('Error calculating transaction fee:', error);
      return this.getFallbackFee();
    }
  }

  // Get current gas price from network
  async getCurrentGasPrice() {
    try {
      // In a real implementation, this would fetch from the blockchain
      // For demo purposes, we'll simulate gas price with some randomness
      const baseGasPrice = 20; // Gwei
      const variation = Math.random() * 10 - 5; // ±5 Gwei variation
      return Math.max(1, baseGasPrice + variation);
    } catch (error) {
      console.error('Error fetching gas price:', error);
      return 20; // Fallback gas price
    }
  }

  // Estimate gas limit for transaction
  async estimateGasLimit(transactionDetails) {
    try {
      // Base gas limit for standard transactions
      let gasLimit = 21000;
      
      // Add gas for contract interactions
      if (transactionDetails.contractAddress) {
        gasLimit += 50000;
      }
      
      // Add gas for data payload
      if (transactionDetails.data) {
        gasLimit += transactionDetails.data.length * 68; // 68 gas per byte
      }
      
      // Add buffer for safety
      gasLimit = Math.ceil(gasLimit * 1.1);
      
      return gasLimit;
    } catch (error) {
      console.error('Error estimating gas limit:', error);
      return 100000; // Fallback gas limit
    }
  }

  // Get network congestion level
  async getNetworkCongestion() {
    try {
      // Simulate network congestion (0-100)
      // In real implementation, this would analyze recent blocks
      const recentBlockUtilization = Math.random() * 100;
      return Math.min(100, Math.max(0, recentBlockUtilization));
    } catch (error) {
      console.error('Error getting network congestion:', error);
      return 50; // Medium congestion as fallback
    }
  }

  // Calculate base fee
  calculateBaseFee(gasPrice, gasLimit) {
    return (gasPrice * gasLimit) / 1e9; // Convert from Gwei to ETH
  }

  // Calculate priority fee based on network conditions
  calculatePriorityFee(networkCongestion) {
    const basePriority = 0.000001; // 0.001 Gwei in ETH
    const congestionBonus = (networkCongestion / 100) * 0.00001;
    return basePriority + congestionBonus;
  }

  // Get congestion multiplier
  getCongestionMultiplier(networkCongestion) {
    if (networkCongestion < 30) return 1.0; // Low congestion
    if (networkCongestion < 70) return 1.2; // Medium congestion
    if (networkCongestion < 90) return 1.5; // High congestion
    return 2.0; // Very high congestion
  }

  // Estimate transaction wait time based on congestion
  estimateWaitTime(networkCongestion) {
    if (networkCongestion < 30) return '~30 seconds';
    if (networkCongestion < 70) return '~2 minutes';
    if (networkCongestion < 90) return '~5 minutes';
    return '~10+ minutes';
  }

  // Calculate confidence in fee estimation
  calculateConfidence() {
    if (this.feeHistory.length < 5) return 'Low';
    
    const recentFees = this.feeHistory.slice(-10);
    const variance = this.calculateVariance(recentFees.map(f => f.totalFee));
    
    if (variance < 0.0001) return 'High';
    if (variance < 0.001) return 'Medium';
    return 'Low';
  }

  // Calculate variance for confidence scoring
  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  // Get fallback fee in case of errors
  getFallbackFee() {
    return {
      totalFee: '0.005000',
      baseFee: '0.003000',
      priorityFee: '0.002000',
      gasPrice: '25.000000000',
      gasLimit: 100000,
      networkCongestion: 50,
      estimatedWaitTime: '~2 minutes',
      confidence: 'Low'
    };
  }

  // Get fee trend analysis
  getFeeTrend() {
    if (this.feeHistory.length < 10) {
      return 'Insufficient data';
    }
    
    const recent = this.feeHistory.slice(-10);
    const older = this.feeHistory.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, f) => sum + f.totalFee, 0) / recent.length;
    const olderAvg = older.reduce((sum, f) => sum + f.totalFee, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) return 'Increasing';
    if (change < -10) return 'Decreasing';
    return 'Stable';
  }

  // Get optimal fee for specific priority level
  async getOptimalFee(priority = 'standard', transactionDetails) {
    const feeData = await this.calculateTransactionFee(transactionDetails);
    
    switch (priority) {
      case 'slow':
        return {
          ...feeData,
          totalFee: (parseFloat(feeData.totalFee) * 0.7).toFixed(6),
          estimatedWaitTime: '~10+ minutes'
        };
      case 'fast':
        return {
          ...feeData,
          totalFee: (parseFloat(feeData.totalFee) * 1.5).toFixed(6),
          estimatedWaitTime: '~30 seconds'
        };
      case 'instant':
        return {
          ...feeData,
          totalFee: (parseFloat(feeData.totalFee) * 2.5).toFixed(6),
          estimatedWaitTime: '~15 seconds'
        };
      default:
        return feeData;
    }
  }
}

// React hook for dynamic fee calculation
export const useDynamicFeeCalculation = () => {
  const [calculator] = useState(() => new DynamicFeeCalculator());
  const [currentFee, setCurrentFee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const calculateFee = useCallback(async (transactionDetails, priority = 'standard') => {
    setLoading(true);
    setError(null);
    
    try {
      const fee = await calculator.getOptimalFee(priority, transactionDetails);
      setCurrentFee(fee);
      return fee;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [calculator]);

  const getFeeTrend = useCallback(() => {
    return calculator.getFeeTrend();
  }, [calculator]);

  return {
    calculateFee,
    currentFee,
    loading,
    error,
    feeTrend: getFeeTrend()
  };
};
