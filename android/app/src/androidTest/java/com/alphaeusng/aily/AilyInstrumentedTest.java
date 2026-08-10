package com.alphaeusng.aily;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Shell checks for the packaged AIly Android app (not Capacitor sample placeholders). */
@RunWith(AndroidJUnit4.class)
public class AilyInstrumentedTest {

    @Test
    public void packageNameIsAily() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.alphaeusng.aily", appContext.getPackageName());
    }

    @Test
    public void applicationLabelIsAily() throws PackageManager.NameNotFoundException {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        PackageManager pm = appContext.getPackageManager();
        ApplicationInfo info = pm.getApplicationInfo(appContext.getPackageName(), 0);
        CharSequence label = pm.getApplicationLabel(info);
        assertNotNull(label);
        assertTrue(label.toString().toLowerCase().contains("aily"));
    }
}
