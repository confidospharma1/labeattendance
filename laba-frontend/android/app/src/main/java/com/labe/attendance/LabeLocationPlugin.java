package com.labe.attendance;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * Returns one fresh location fix together with Android's mock-location flag,
 * so the server can reject attendance from fake-GPS apps.
 * Location permission is requested from JS via @capacitor/geolocation first.
 */
@CapacitorPlugin(name = "LabeLocation")
public class LabeLocationPlugin extends Plugin {

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        Context ctx = getContext();
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Location permission denied");
            return;
        }

        final LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) {
            call.reject("Location unavailable");
            return;
        }

        final List<String> providers = new ArrayList<>();
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) providers.add(LocationManager.GPS_PROVIDER);
        if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) providers.add(LocationManager.NETWORK_PROVIDER);
        if (providers.isEmpty()) {
            call.reject("Location services are disabled");
            return;
        }

        final int timeout = call.getInt("timeout", 20000);
        final Handler handler = new Handler(Looper.getMainLooper());
        final Location[] best = {null};
        final boolean[] finished = {false};
        final long startedAt = System.currentTimeMillis();

        final LocationListener[] listenerHolder = new LocationListener[1];
        final Runnable finish = new Runnable() {
            @Override
            public void run() {
                if (finished[0]) return;
                finished[0] = true;
                try {
                    lm.removeUpdates(listenerHolder[0]);
                } catch (SecurityException ignored) {
                }
                if (best[0] == null) {
                    call.reject("Location request timed out");
                } else {
                    call.resolve(toJs(best[0]));
                }
            }
        };

        listenerHolder[0] = new LocationListener() {
            @Override
            public void onLocationChanged(@NonNull Location location) {
                // Ignore stale cached fixes
                if (location.getTime() < startedAt - 5000) return;
                if (best[0] == null || location.getAccuracy() < best[0].getAccuracy()) best[0] = location;
                // Good enough: stop early
                if (location.getAccuracy() <= 25 || isMock(location)) handler.post(finish);
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {}

            @Override
            public void onProviderEnabled(@NonNull String provider) {}

            @Override
            public void onProviderDisabled(@NonNull String provider) {}
        };

        try {
            for (String p : providers) {
                lm.requestLocationUpdates(p, 500, 0, listenerHolder[0], Looper.getMainLooper());
            }
        } catch (SecurityException e) {
            call.reject("Location permission denied");
            return;
        }
        handler.postDelayed(finish, timeout);
    }

    private static boolean isMock(Location l) {
        if (Build.VERSION.SDK_INT >= 31) return l.isMock();
        //noinspection deprecation
        return l.isFromMockProvider();
    }

    private static JSObject toJs(Location l) {
        JSObject o = new JSObject();
        o.put("latitude", l.getLatitude());
        o.put("longitude", l.getLongitude());
        o.put("accuracy", l.getAccuracy());
        o.put("isMockLocation", isMock(l));
        return o;
    }
}
