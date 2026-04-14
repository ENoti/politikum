package com.politikum;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PolitikumApplication {
    public static void main(String[] args) {
        SpringApplication.run(PolitikumApplication.class, args);
    }
}