package com.kirana.storage;

import com.kirana.common.ApiException;
import com.kirana.config.AppProperties;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Customers' handwritten-list photos and voice notes. They live under MEDIA_DIR/requests, which /media/** does not
 * serve; clients get short-lived signed links to {@code /api/v1/media/private/{name}} instead.
 */
@Service
public class PrivateMediaService {

    static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;
    static final long MAX_AUDIO_BYTES = 5L * 1024 * 1024;
    static final Duration LINK_TTL = Duration.ofHours(6);
    static final String DIR = "requests";
    private static final Pattern NAME = Pattern.compile("^[0-9a-f-]{36}\\.(jpg|png|webp|m4a|webm|ogg|mp3|wav|aac)$");

    public enum Kind { IMAGE, AUDIO }

    public record Stored(String name, String contentType) {
    }

    private final Path dir;
    private final byte[] signingKey;
    private final Clock clock;

    public PrivateMediaService(LocalStorageService storage, AppProperties properties, Clock clock) {
        this.dir = storage.root().resolve(DIR);
        this.signingKey = hmac(properties.jwt().secret().getBytes(StandardCharsets.UTF_8),
                "private-media".getBytes(StandardCharsets.UTF_8));
        this.clock = clock;
    }

    /** Validates by magic bytes (the client's content type is not trusted) and stores; returns the file name. */
    public Stored store(MultipartFile file, Kind kind, String field) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        long max = kind == Kind.IMAGE ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
        if (file.getSize() > max) {
            throw ApiException.validation(field, "must be at most " + max / (1024 * 1024) + " MB");
        }
        try (InputStream in = file.getInputStream()) {
            byte[] bytes = in.readAllBytes();
            String extension = kind == Kind.IMAGE ? LocalStorageService.detectImageType(bytes) : detectAudioType(bytes);
            if (extension == null) {
                throw ApiException.validation(field, kind == Kind.IMAGE
                        ? "must be a JPG, PNG or WebP photo"
                        : "must be an audio recording (M4A, WebM, Ogg, MP3, WAV or AAC)");
            }
            Files.createDirectories(dir);
            String name = UUID.randomUUID() + "." + extension;
            Files.write(dir.resolve(name), bytes);
            return new Stored(name, contentType(name));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not store " + field, e);
        }
    }

    /** Link valid for {@link #LINK_TTL}; null for a missing file. */
    public String signedUrl(String name) {
        if (name == null) {
            return null;
        }
        long exp = Instant.now(clock).plus(LINK_TTL).getEpochSecond();
        return "/api/v1/media/private/" + name + "?exp=" + exp + "&sig=" + sign(name, exp);
    }

    /** The file for a valid, unexpired signature. */
    public Optional<Path> open(String name, long exp, String sig) {
        if (name == null || !NAME.matcher(name).matches() || sig == null
                || Instant.now(clock).getEpochSecond() > exp
                || !MessageDigest.isEqual(sign(name, exp).getBytes(StandardCharsets.US_ASCII),
                        sig.getBytes(StandardCharsets.US_ASCII))) {
            return Optional.empty();
        }
        Path file = dir.resolve(name);
        return Files.isRegularFile(file) ? Optional.of(file) : Optional.empty();
    }

    public void delete(String name) {
        if (name != null && NAME.matcher(name).matches()) {
            try {
                Files.deleteIfExists(dir.resolve(name));
            } catch (IOException ignored) {
                // a leftover file is harmless
            }
        }
    }

    public static String contentType(String name) {
        String ext = name.substring(name.lastIndexOf('.') + 1);
        return switch (ext) {
            case "jpg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "m4a" -> "audio/mp4";
            case "webm" -> "audio/webm";
            case "ogg" -> "audio/ogg";
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            case "aac" -> "audio/aac";
            default -> "application/octet-stream";
        };
    }

    static String detectAudioType(byte[] b) {
        if (b.length >= 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p') {
            return "m4a"; // MP4/M4A (Android and iOS recorders)
        }
        if (b.length >= 4 && (b[0] & 0xFF) == 0x1A && (b[1] & 0xFF) == 0x45 && (b[2] & 0xFF) == 0xDF && (b[3] & 0xFF) == 0xA3) {
            return "webm"; // browsers' MediaRecorder
        }
        if (b.length >= 4 && b[0] == 'O' && b[1] == 'g' && b[2] == 'g' && b[3] == 'S') {
            return "ogg";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'A' && b[10] == 'V' && b[11] == 'E') {
            return "wav";
        }
        if (b.length >= 3 && b[0] == 'I' && b[1] == 'D' && b[2] == '3') {
            return "mp3";
        }
        if (b.length >= 2 && (b[0] & 0xFF) == 0xFF && ((b[1] & 0xF6) == 0xF0)) {
            return "aac"; // ADTS
        }
        if (b.length >= 2 && (b[0] & 0xFF) == 0xFF && ((b[1] & 0xE0) == 0xE0)) {
            return "mp3"; // MPEG frame sync without an ID3 tag
        }
        return null;
    }

    private String sign(String name, long exp) {
        byte[] mac = hmac(signingKey, (name + ":" + exp).getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac);
    }

    private static byte[] hmac(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }
}
