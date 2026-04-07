package com.politikum.util;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;

public final class CryptoUtils {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final HexFormat HEX = HexFormat.of();

    private CryptoUtils() {}

    public static String randToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    public static String hashUserToken(String token) {
        try {
            byte[] salt = new byte[16];
            RANDOM.nextBytes(salt);
            int iterations = 120_000;
            byte[] hash = pbkdf2(token, salt, iterations, 32);
            return "pbkdf2_sha256$" + iterations + "$" + HEX.formatHex(salt) + "$" + HEX.formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("hash_failed", e);
        }
    }

    public static boolean verifyUserToken(String token, String stored) {
        try {
            String[] parts = String.valueOf(stored).split("\\$");
            if (parts.length != 4 || !"pbkdf2_sha256".equals(parts[0])) return false;
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = HEX.parseHex(parts[2]);
            byte[] expected = HEX.parseHex(parts[3]);
            byte[] got = pbkdf2(token, salt, iterations, expected.length);
            return MessageDigest.isEqual(got, expected);
        } catch (Exception e) {
            return false;
        }
    }

    private static byte[] pbkdf2(String token, byte[] salt, int iterations, int length) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(token.toCharArray(), salt, iterations, length * 8);
        SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        return skf.generateSecret(spec).getEncoded();
    }
}
