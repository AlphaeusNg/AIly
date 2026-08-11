package com.alphaeusng.aily;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Local-only Android usage access. It does not schedule, persist, or upload reads. */
@CapacitorPlugin(name = "AilyUsage")
public class AilyUsagePlugin extends Plugin {

    static final int MAX_ENTRIES = 50;

    static final class UsageEntry {
        final String packageName;
        final String label;
        final long foregroundMs;

        UsageEntry(String packageName, String label, long foregroundMs) {
            this.packageName = packageName;
            this.label = label;
            this.foregroundMs = foregroundMs;
        }
    }

    @PluginMethod
    public void getPermissionStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasUsageAccess());
        call.resolve(result);
    }

    @PluginMethod
    public void openUsageAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        getBridge()
            .executeOnMainThread(
                () -> {
                    try {
                        getActivity().startActivity(intent);
                        call.resolve();
                    } catch (RuntimeException error) {
                        call.reject("Unable to open Android usage access settings", "SETTINGS_UNAVAILABLE", error);
                    }
                }
            );
    }

    @PluginMethod
    public void listTodayUsage(PluginCall call) {
        if (!Boolean.TRUE.equals(call.getBoolean("consented", false))) {
            call.reject("Tutorial usage consent is required", "USAGE_CONSENT_REQUIRED");
            return;
        }
        if (!hasUsageAccess()) {
            call.reject("Android usage access is not granted", "USAGE_ACCESS_REQUIRED");
            return;
        }

        Context context = getContext();
        UsageStatsManager manager = context.getSystemService(UsageStatsManager.class);
        if (manager == null) {
            call.reject("Android usage service is unavailable", "USAGE_SERVICE_UNAVAILABLE");
            return;
        }

        Calendar start = Calendar.getInstance();
        start.set(Calendar.HOUR_OF_DAY, 0);
        start.set(Calendar.MINUTE, 0);
        start.set(Calendar.SECOND, 0);
        start.set(Calendar.MILLISECOND, 0);
        long endMs = System.currentTimeMillis();
        Map<String, UsageStats> stats = manager.queryAndAggregateUsageStats(start.getTimeInMillis(), endMs);

        Map<String, Long> durations = new HashMap<>();
        Map<String, String> labels = new HashMap<>();
        PackageManager packageManager = context.getPackageManager();
        if (stats != null) {
            for (Map.Entry<String, UsageStats> item : stats.entrySet()) {
                UsageStats usage = item.getValue();
                if (usage == null) continue;
                long duration = usage.getTotalTimeInForeground();
                if (duration <= 0) continue;
                String packageName = item.getKey();
                durations.merge(packageName, duration, Long::sum);
                labels.put(packageName, applicationLabel(packageManager, packageName));
            }
        }

        JSArray rows = new JSArray();
        for (UsageEntry entry : boundedEntries(durations, labels, MAX_ENTRIES)) {
            JSObject row = new JSObject();
            row.put("packageName", entry.packageName);
            row.put("label", entry.label);
            row.put("foregroundMs", entry.foregroundMs);
            rows.put(row);
        }
        JSObject result = new JSObject();
        result.put("permission", "granted");
        result.put("day", new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(start.getTime()));
        result.put("samples", rows);
        call.resolve(result);
    }

    private boolean hasUsageAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;
        int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                getContext().getPackageName()
            )
            : legacyUsageMode(appOps);
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @SuppressWarnings("deprecation")
    private int legacyUsageMode(AppOpsManager appOps) {
        return appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            getContext().getPackageName()
        );
    }

    private static String applicationLabel(PackageManager packageManager, String packageName) {
        try {
            ApplicationInfo info = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? packageManager.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0))
                : legacyApplicationInfo(packageManager, packageName);
            CharSequence label = packageManager.getApplicationLabel(info);
            String value = label == null ? "" : label.toString().trim();
            return value.isEmpty() ? packageName : value;
        } catch (PackageManager.NameNotFoundException | SecurityException ignored) {
            // Package visibility may hide the label; package key remains honest and usable.
            return packageName;
        }
    }

    @SuppressWarnings("deprecation")
    private static ApplicationInfo legacyApplicationInfo(PackageManager packageManager, String packageName)
        throws PackageManager.NameNotFoundException {
        return packageManager.getApplicationInfo(packageName, 0);
    }

    static List<UsageEntry> boundedEntries(
        Map<String, Long> durations,
        Map<String, String> labels,
        int requestedLimit
    ) {
        int limit = Math.max(0, Math.min(requestedLimit, MAX_ENTRIES));
        if (limit == 0 || durations == null) return List.of();
        List<UsageEntry> result = new ArrayList<>();
        for (Map.Entry<String, Long> item : durations.entrySet()) {
            String packageName = item.getKey() == null ? "" : item.getKey().trim();
            long duration = item.getValue() == null ? 0 : item.getValue();
            if (packageName.isEmpty() || duration <= 0) continue;
            packageName = packageName.substring(0, Math.min(packageName.length(), 200));
            String label = labels == null ? packageName : labels.getOrDefault(item.getKey(), packageName);
            label = label == null ? packageName : label.trim();
            if (label.isEmpty()) label = packageName;
            label = label.substring(0, Math.min(label.length(), 120));
            result.add(new UsageEntry(packageName, label, duration));
        }
        result.sort(
            Comparator.comparingLong((UsageEntry entry) -> entry.foregroundMs)
                .reversed()
                .thenComparing(entry -> entry.packageName)
        );
        return new ArrayList<>(result.subList(0, Math.min(limit, result.size())));
    }
}
