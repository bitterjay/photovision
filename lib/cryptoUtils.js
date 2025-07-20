// Crypto utilities for secure API key storage
// Uses AES-256-GCM for encryption with authenticated encryption

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class CryptoUtils {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyPath = path.join(__dirname, '..', '.encryption-key');
        this.saltLength = 32;
        this.ivLength = 16;
        this.tagLength = 16;
        this.keyDerivationIterations = 100000;
    }

    /**
     * Get or generate the encryption key
     * The key is derived from machine-specific data and stored locally
     */
    async getOrCreateEncryptionKey() {
        try {
            // Try to read existing key
            const keyData = await fs.readFile(this.keyPath, 'utf8');
            return Buffer.from(keyData, 'hex');
        } catch (error) {
            // Generate new key if doesn't exist
            if (error.code === 'ENOENT') {
                const key = await this.generateEncryptionKey();
                await fs.writeFile(this.keyPath, key.toString('hex'), 'utf8');
                // Set restrictive permissions (owner read/write only)
                await fs.chmod(this.keyPath, 0o600);
                return key;
            }
            throw error;
        }
    }

    /**
     * Generate a new encryption key based on machine-specific data
     */
    async generateEncryptionKey() {
        // Combine multiple sources of entropy
        const machineId = [
            os.hostname(),
            os.platform(),
            os.arch(),
            os.cpus()[0].model,
            process.env.USER || process.env.USERNAME || 'default'
        ].join('|');
        
        // Add random salt for additional entropy
        const salt = crypto.randomBytes(this.saltLength);
        
        // Derive key using PBKDF2
        return crypto.pbkdf2Sync(
            machineId,
            salt,
            this.keyDerivationIterations,
            32, // 256 bits
            'sha256'
        );
    }

    /**
     * Encrypt sensitive data
     * @param {string} text - The text to encrypt
     * @returns {Object} Encrypted data with iv, tag, and encrypted text
     */
    async encrypt(text) {
        if (!text) {
            throw new Error('No text provided for encryption');
        }

        try {
            const key = await this.getOrCreateEncryptionKey();
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipheriv(this.algorithm, key, iv);
            
            const encrypted = Buffer.concat([
                cipher.update(text, 'utf8'),
                cipher.final()
            ]);
            
            const tag = cipher.getAuthTag();
            
            // Return as base64 encoded strings for JSON storage
            return {
                encrypted: encrypted.toString('base64'),
                iv: iv.toString('base64'),
                tag: tag.toString('base64')
            };
        } catch (error) {
            console.error('Encryption error:', error.message);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     * @param {Object} encryptedData - Object with encrypted, iv, and tag
     * @returns {string} Decrypted text
     */
    async decrypt(encryptedData) {
        if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv || !encryptedData.tag) {
            throw new Error('Invalid encrypted data format');
        }

        try {
            const key = await this.getOrCreateEncryptionKey();
            const decipher = crypto.createDecipheriv(
                this.algorithm,
                key,
                Buffer.from(encryptedData.iv, 'base64')
            );
            
            decipher.setAuthTag(Buffer.from(encryptedData.tag, 'base64'));
            
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(encryptedData.encrypted, 'base64')),
                decipher.final()
            ]);
            
            return decrypted.toString('utf8');
        } catch (error) {
            console.error('Decryption error:', error.message);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Mask an API key for display (show only first and last few characters)
     * @param {string} apiKey - The API key to mask
     * @returns {string} Masked API key
     */
    maskApiKey(apiKey) {
        if (!apiKey || apiKey.length < 10) {
            return '****';
        }
        
        const prefix = apiKey.substring(0, 7); // 'sk-ant-'
        const suffix = apiKey.substring(apiKey.length - 4);
        return `${prefix}...${suffix}`;
    }

    /**
     * Validate Claude API key format
     * @param {string} apiKey - The API key to validate
     * @returns {boolean} Whether the key appears to be valid format
     */
    validateClaudeApiKeyFormat(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        
        // Claude API keys start with 'sk-ant-' and are typically 50+ characters
        return apiKey.startsWith('sk-ant-') && apiKey.length > 40;
    }

    /**
     * Clear sensitive data from memory
     * @param {*} data - Data to clear
     */
    clearSensitiveData(data) {
        if (typeof data === 'string') {
            // For strings, we can't truly clear them from memory in JavaScript
            // But we can at least ensure they're not referenced
            data = null;
        } else if (Buffer.isBuffer(data)) {
            // For buffers, we can fill with zeros
            data.fill(0);
        }
    }
}

module.exports = CryptoUtils;