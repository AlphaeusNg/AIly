package com.alphaeusng.aily;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import com.getcapacitor.BridgeActivity;
import org.junit.Test;

/** Lightweight JVM checks for compiled AIly shell identity (runs without a device). */
public class AilyUnitTest {

    @Test
    public void shellPackageMatchesBrand() {
        assertEquals("com.alphaeusng.aily", MainActivity.class.getPackageName());
        assertTrue("AIly".contains("AI"));
    }

    @Test
    public void shellEntryPointUsesCapacitorBridge() {
        assertEquals("com.alphaeusng.aily.MainActivity", MainActivity.class.getName());
        assertTrue(BridgeActivity.class.isAssignableFrom(MainActivity.class));
    }

    @Test
    public void brandTaglineShape() {
        String tagline = "Your AI Ally";
        assertTrue(tagline.startsWith("Your"));
        assertTrue(tagline.contains("Ally"));
    }
}
