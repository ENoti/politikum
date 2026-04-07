package com.politikum.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class NewsService {
    @Value("${politikum.news.path:NEWS.md}")
    private String newsPath;

    public String readNews() {
        try {
            Path path = Paths.get(newsPath).toAbsolutePath();
            if (!Files.exists(path)) return "";
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }
}
