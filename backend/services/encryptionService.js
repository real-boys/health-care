const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;   // 128 bits
    this.tagLength = 16;  // 128 bits
    this.saltLength = 32; // 256 bits
  }

  // Generate a secure encryption key
  generateKey() {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  // Generate a secure salt for key derivation
  generateSalt() {
    return crypto.randomBytes(this.saltLength).toString('hex');
  }

  // Derive key from password using PBKDF2
  deriveKey(password, salt, iterations = 100000) {
    return crypto.pbkdf2Sync(password, salt, iterations, this.keyLength, 'sha256');
  }

  // Encrypt data with AES-256-GCM
  encrypt(data, keyHex, additionalData = null) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from(additionalData || '', 'utf8'));
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.algorithm,
        additionalData
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  // Decrypt data with AES-256-GCM
  decrypt(encryptedData, keyHex) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from(encryptedData.additionalData || '', 'utf8'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  // Encrypt medical record with patient-specific key
  encryptMedicalRecord(record, patientKey) {
    const additionalData = `medical-record:${record.id}:${record.patientId}`;
    return this.encrypt(record, patientKey, additionalData);
  }

  // Decrypt medical record with patient-specific key
  decryptMedicalRecord(encryptedRecord, patientKey) {
    return this.decrypt(encryptedRecord, patientKey);
  }

  // Encrypt file buffer
  encryptFile(buffer, keyHex) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipher(this.algorithm, key);
      
      const encrypted = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
      ]);
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted: encrypted.toString('base64'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.algorithm,
        originalSize: buffer.length
      };
    } catch (error) {
      console.error('File encryption error:', error);
      throw new Error('File encryption failed');
    }
  }

  // Decrypt file buffer
  decryptFile(encryptedFileData, keyHex) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(encryptedFileData.iv, 'hex');
      const tag = Buffer.from(encryptedFileData.tag, 'hex');
      const encrypted = Buffer.from(encryptedFileData.encrypted, 'base64');
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAuthTag(tag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      console.error('File decryption error:', error);
      throw new Error('File decryption failed');
    }
  }

  // Generate key pair for asymmetric encryption (RSA)
  generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return { publicKey, privateKey };
  }

  // Encrypt with public key (RSA)
  encryptWithPublicKey(data, publicKey) {
    try {
      const encrypted = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(JSON.stringify(data))
      );
      
      return encrypted.toString('base64');
    } catch (error) {
      console.error('Public key encryption error:', error);
      throw new Error('Public key encryption failed');
    }
  }

  // Decrypt with private key (RSA)
  decryptWithPrivateKey(encryptedData, privateKey) {
    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(encryptedData, 'base64')
      );
      
      return JSON.parse(decrypted.toString());
    } catch (error) {
      console.error('Private key decryption error:', error);
      throw new Error('Private key decryption failed');
    }
  }

  // Create digital signature
  sign(data, privateKey) {
    try {
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(JSON.stringify(data));
      sign.end();
      
      return sign.sign(privateKey, 'base64');
    } catch (error) {
      console.error('Signing error:', error);
      throw new Error('Digital signature failed');
    }
  }

  // Verify digital signature
  verify(data, signature, publicKey) {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(JSON.stringify(data));
      verify.end();
      
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  // Hash data for integrity verification
  hash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // Verify data integrity
  verifyIntegrity(data, expectedHash) {
    const actualHash = this.hash(data);
    return actualHash === expectedHash;
  }

  // Generate secure random token
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Key rotation - generate new key and re-encrypt data
  async rotateKey(oldKeyHex, encryptedData) {
    try {
      // Decrypt with old key
      const decryptedData = this.decrypt(encryptedData, oldKeyHex);
      
      // Generate new key
      const newKey = this.generateKey();
      
      // Encrypt with new key
      const newEncryptedData = this.encrypt(decryptedData, newKey);
      
      return {
        newKey,
        encryptedData: newEncryptedData
      };
    } catch (error) {
      console.error('Key rotation error:', error);
      throw new Error('Key rotation failed');
    }
  }

  // Batch encrypt multiple records
  batchEncrypt(records, keyHex) {
    const results = [];
    
    for (const record of records) {
      try {
        const encrypted = this.encryptMedicalRecord(record, keyHex);
        results.push({
          id: record.id,
          encrypted,
          success: true
        });
      } catch (error) {
        results.push({
          id: record.id,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  // Batch decrypt multiple records
  batchDecrypt(encryptedRecords, keyHex) {
    const results = [];
    
    for (const encryptedRecord of encryptedRecords) {
      try {
        const decrypted = this.decryptMedicalRecord(encryptedRecord.encrypted, keyHex);
        results.push({
          id: encryptedRecord.id,
          data: decrypted,
          success: true
        });
      } catch (error) {
        results.push({
          id: encryptedRecord.id,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }
}

module.exports = new EncryptionService();
