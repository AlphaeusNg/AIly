package com.alphaeusng.aily;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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

    @Test
    public void usagePluginIsRegisteredWithExpectedBridgeMethods() throws NoSuchMethodException {
        assertTrue(MainActivity.nativePlugins().contains(AilyUsagePlugin.class));
        CapacitorPlugin annotation = AilyUsagePlugin.class.getAnnotation(CapacitorPlugin.class);
        assertEquals("AilyUsage", annotation.name());
        for (String methodName : List.of("getPermissionStatus", "openUsageAccessSettings", "listTodayUsage")) {
            Method method = AilyUsagePlugin.class.getMethod(methodName, com.getcapacitor.PluginCall.class);
            assertTrue(method.isAnnotationPresent(PluginMethod.class));
        }
    }

    @Test
    public void usageAggregationDropsInvalidRowsSortsAndCaps() {
        Map<String, Long> durations = new HashMap<>();
        durations.put("com.example.editor", 61_000L);
        durations.put("com.example.browser", 180_000L);
        durations.put("com.example.zero", 0L);
        durations.put("", 300_000L);
        Map<String, String> labels = new HashMap<>();
        labels.put("com.example.editor", "Editor");
        labels.put("com.example.browser", "Browser");

        List<AilyUsagePlugin.UsageEntry> rows = AilyUsagePlugin.boundedEntries(durations, labels, 2);

        assertEquals(2, rows.size());
        assertEquals("com.example.browser", rows.get(0).packageName);
        assertEquals("Browser", rows.get(0).label);
        assertEquals(180_000L, rows.get(0).foregroundMs);
        assertEquals("com.example.editor", rows.get(1).packageName);
        assertFalse(rows.stream().anyMatch(row -> row.packageName.contains("zero")));
        assertTrue(AilyUsagePlugin.boundedEntries(durations, labels, 0).isEmpty());
    }
}
