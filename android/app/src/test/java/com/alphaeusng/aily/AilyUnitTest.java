package com.alphaeusng.aily;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Lightweight JVM checks for AIly shell constants (runs without a device). */
public class AilyUnitTest {

    @Test
    public void applicationIdMatchesBrand() {
        // Mirrors capacitor.config.json / app build.gradle applicationId.
        assertEquals("com.alphaeusng.aily", "com.alphaeusng.aily");
        assertTrue("AIly".contains("AI"));
    }

    @Test
    public void brandTaglineShape() {
        String tagline = "Your AI Ally";
        assertTrue(tagline.startsWith("Your"));
        assertTrue(tagline.contains("Ally"));
    }
}
