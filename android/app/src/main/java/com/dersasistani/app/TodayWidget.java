package com.dersasistani.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Ana ekran widget'ı: bugünün dersleri ve sıradaki ders */
public class TodayWidget extends AppWidgetProvider {

    private static final String PREFS = "CapacitorStorage";
    private static final String KEY = "ders-asistan-v1";
    private static final String[] MONTHS = {"Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"};
    private static final String[] DAYS = {"Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"};

    private static class Item {
        String start;
        String end;
        String title;
        String status;
        int startMin;
        int endMin;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, build(context));
        }
    }

    /** Uygulama veri kaydettiğinde çağrılır */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TodayWidget.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }

    private static int minutes(String hm) {
        try {
            String[] p = hm.split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        } catch (Exception e) {
            return 0;
        }
    }

    private static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pi);

        Calendar now = Calendar.getInstance();
        String today = String.format(Locale.US, "%04d-%02d-%02d", now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1, now.get(Calendar.DAY_OF_MONTH));
        int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
        views.setTextViewText(R.id.widget_date, now.get(Calendar.DAY_OF_MONTH) + " " + MONTHS[now.get(Calendar.MONTH)] + ", " + DAYS[now.get(Calendar.DAY_OF_WEEK) - 1]);

        List<Item> items = new ArrayList<>();
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY, null);
            if (raw != null) {
                JSONObject data = new JSONObject(raw);
                Map<String, String> groupNames = new HashMap<>();
                JSONObject groups = data.optJSONObject("groups");
                if (groups != null) {
                    JSONArray names = groups.names();
                    if (names != null) {
                        for (int i = 0; i < names.length(); i++) {
                            String code = names.getString(i);
                            JSONObject g = groups.optJSONObject(code);
                            String n = g != null ? g.optString("name", "") : "";
                            if (!n.isEmpty()) groupNames.put(code, n);
                        }
                    }
                }
                Map<String, String> students = new HashMap<>();
                JSONArray st = data.optJSONArray("students");
                if (st != null) {
                    for (int i = 0; i < st.length(); i++) {
                        JSONObject s = st.getJSONObject(i);
                        students.put(s.optString("id"), s.optString("name"));
                    }
                }
                JSONArray events = data.optJSONArray("events");
                if (events != null) {
                    for (int i = 0; i < events.length(); i++) {
                        JSONObject e = events.getJSONObject(i);
                        String kind = e.optString("kind");
                        String status = e.optString("status");
                        String date = e.optString("date");
                        if (!today.equals(date) || "cancelled".equals(status)) continue;
                        Item it = new Item();
                        it.start = e.optString("start");
                        it.end = e.optString("end");
                        it.status = status;
                        it.startMin = minutes(it.start);
                        it.endMin = minutes(it.end);
                        if ("kurum".equals(kind)) {
                            String code = e.optString("groupCode", e.optString("title"));
                            it.title = groupNames.containsKey(code) ? groupNames.get(code) : code;
                        } else if ("ozel".equals(kind)) {
                            String name = students.get(e.optString("studentId"));
                            it.title = "Özel: " + (name != null ? name : e.optString("title"));
                        } else {
                            it.title = e.optString("title");
                        }
                        items.add(it);
                    }
                }
            }
        } catch (Exception ex) {
            views.setTextViewText(R.id.widget_next, "Veri okunamadı");
            views.setTextViewText(R.id.widget_list, "");
            return views;
        }

        Collections.sort(items, (a, b) -> a.start.compareTo(b.start));

        Item current = null;
        Item next = null;
        for (Item it : items) {
            if (it.startMin <= nowMin && it.endMin > nowMin && current == null) current = it;
            if (it.startMin > nowMin && next == null) next = it;
        }

        if (current != null) {
            views.setTextViewText(R.id.widget_next, "Şu an: " + current.title + " · bitişe " + (current.endMin - nowMin) + " dk");
        } else if (next != null) {
            int diff = next.startMin - nowMin;
            String when = diff < 60 ? diff + " dk sonra" : (diff / 60) + " sa " + (diff % 60) + " dk sonra";
            views.setTextViewText(R.id.widget_next, "Sıradaki: " + next.title + " · " + next.start + " (" + when + ")");
        } else if (items.isEmpty()) {
            views.setTextViewText(R.id.widget_next, "Bugün ders yok 🎉");
        } else {
            views.setTextViewText(R.id.widget_next, "Bugünkü dersler bitti");
        }

        SpannableStringBuilder sb = new SpannableStringBuilder();
        int shown = 0;
        for (Item it : items) {
            if (shown >= 7) break;
            if (sb.length() > 0) sb.append("\n");
            int lineStart = sb.length();
            String mark = "done".equals(it.status) ? "✓ " : ("postponed".equals(it.status) ? "↷ " : "");
            sb.append(it.start).append("  ");
            sb.setSpan(new StyleSpan(Typeface.BOLD), lineStart, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            sb.append(mark).append(it.title);
            if (it.endMin <= nowMin) {
                sb.setSpan(new ForegroundColorSpan(0xFF8B95A9), lineStart, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            shown++;
        }
        if (items.size() > shown) sb.append("\n+").append(String.valueOf(items.size() - shown)).append(" ders daha");
        views.setTextViewText(R.id.widget_list, sb);
        // Not hatırlatması kaldırıldı (v0.7): bu satır boş kalır
        views.setTextViewText(R.id.widget_missing, "");
        return views;
    }
}
