package com.kirana.common;

import com.kirana.config.AppProperties;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/** AES-256-GCM encryption for secrets stored in the database. Output is IV (12 bytes) + ciphertext + tag. */
@Component
public class SecretCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;
    private static final int TAG_BITS = 128;

    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();

    public SecretCipher(AppProperties properties) {
        String encoded = properties.encryptionKey();
        if (encoded == null || encoded.isBlank()) {
            throw new IllegalStateException("APP_ENCRYPTION_KEY is not set (base64 of 32 bytes, e.g. openssl rand -base64 32)");
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(encoded.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("APP_ENCRYPTION_KEY must be base64", e);
        }
        if (raw.length != 32) {
            throw new IllegalStateException("APP_ENCRYPTION_KEY must decode to 32 bytes, got " + raw.length);
        }
        this.key = new SecretKeySpec(raw, "AES");
    }

    public byte[] encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return ByteBuffer.allocate(iv.length + ciphertext.length).put(iv).put(ciphertext).array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    public String decrypt(byte[] payload) {
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, payload, 0, IV_LENGTH));
            byte[] plaintext = cipher.doFinal(payload, IV_LENGTH, payload.length - IV_LENGTH);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Decryption failed (wrong APP_ENCRYPTION_KEY?)", e);
        }
    }
}
