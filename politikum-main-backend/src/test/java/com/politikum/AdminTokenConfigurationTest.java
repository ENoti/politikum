package com.politikum;

import com.politikum.controller.PublicApiController;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminTokenConfigurationTest {
    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"short", "                "})
    void rejectsMissingOrWeakAdminToken(String token) {
        assertThatThrownBy(() -> new PublicApiController(null, null, null, "unused", token))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("politikum.admin-token must be set");
    }
}
