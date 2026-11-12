package com.dersasistani.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * Ana ekran widget'ı: ana renkte başlık (tarih, ders sayısı, hızlı ekleme), "Şu an / Sıradaki" kartı,
 * günün dersleri (renk çubuklu) ve bugünün görevleri. Ders başlangıç/bitişlerinde kendini yeniler.
 */
public class TodayWidget extends AppWidgetProvider {

    private static final String PREFS = "CapacitorStorage";
    private static final String KEY = "widget-v1";
    private static final String ACTION_TICK = "com.dersasistani.app.WIDGET_TICK";
    private static final int ROWS = 6;
    private static final String[] MONTHS = {"Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"};
    private static final String[] DAYS = {"Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"};

    private static final int[] ROW = {R.id.row0, R.id.row1, R.id.row2, R.id.row3, R.id.row4, R.id.row5};
    private static final int[] BAR = {R.id.bar0, R.id.bar1, R.id.bar2, R.id.bar3, R.id.bar4, R.id.bar5};
    private static final int[] TIME = {R.id.time0, R.id.time1, R.id.time2, R.id.time3, R.id.time4, R.id.time5};
    private static final int[] END = {R.id.end0, R.id.end1, R.id.end2, R.id.end3, R.id.end4, R.id.end5};
    private static final int[] TITLE = {R.id.title0, R.id.title1, R.id.title2, R.id.title3, R.id.title4, R.id.title5};
    private static final int[] SUB = {R.id.sub0, R.id.sub1, R.id.sub2, R.id.sub3, R.id.sub4, R.id.sub5};

    private static class Item {
        String date, start, end, title, sub, status;
        int color, startMin, endMin;
        boolean off() { return "cancelled".equals(status) || "postponed".equals(status); }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refreshAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String a = intent.getAction();
        if (ACTION_TICK.equals(a) || Intent.ACTION_DATE_CHANGED.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) {
            refreshAll(context);
        }
    }

    /** Uygulama veri kaydettiğinde ve zamanlayıcıyla çağrılır */
    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TodayWidget.class));
        if (ids == null || ids.length == 0) return;
        long[] nextTick = {0};
        RemoteViews views = build(context, nextTick);
        for (int id : ids) manager.updateAppWidget(id, views);
        schedule(context, nextTick[0]);
    }

    /** Bir sonraki ders başlangıcı/bitişi ya da gece yarısı widget'ı yeniden çizer */
    private static void schedule(Context context, long at) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null || at <= 0) return;
            Intent i = new Intent(context, TodayWidget.class).setAction(ACTION_TICK);
            PendingIntent pi = PendingIntent.getBroadcast(context, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.set(AlarmManager.RTC, at, pi);
        } catch (Exception ignored) {
            // Zamanlayıcı kurulamazsa widget yine 30 dakikada bir yenilenir
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

    private static int parseColor(String c) {
        try {
            return Color.parseColor(c);
        } catch (Exception e) {
            return 0xFF6542F0;
        }
    }

    private static String dateKey(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static String inMinutes(int diff) {
        if (diff < 60) return diff + " dk sonra";
        int h = diff / 60, m = diff % 60;
        return m == 0 ? h + " sa sonra" : h + " sa " + m + " dk sonra";
    }

    private static int headFor(String accent) {
        if (accent == null) return R.drawable.widget_head_mor;
        switch (accent) {
            case "mavi": return R.drawable.widget_head_mavi;
            case "turkuaz": return R.drawable.widget_head_turkuaz;
            case "yesil": return R.drawable.widget_head_yesil;
            case "turuncu": return R.drawable.widget_head_turuncu;
            case "pembe": return R.drawable.widget_head_pembe;
            case "kirmizi": return R.drawable.widget_head_kirmizi;
            default: return R.drawable.widget_head_mor;
        }
    }

    private static PendingIntent link(Context context, int code, String uri) {
        Intent i = new Intent(context, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (uri != null) {
            i.setAction(Intent.ACTION_VIEW);
            i.setData(Uri.parse(uri));
        }
        return PendingIntent.getActivity(context, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static RemoteViews build(Context context, long[] nextTick) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        v.setOnClickPendingIntent(R.id.widget_root, link(context, 0, "dersasistani://bugun"));
        v.setOnClickPendingIntent(R.id.w_add, link(context, 2, "dersasistani://yeni-ders"));
        v.setOnClickPendingIntent(R.id.w_tasks, link(context, 3, "dersasistani://gorevler"));

        Calendar now = Calendar.getInstance();
        String today = dateKey(now);
        Calendar tm = (Calendar) now.clone();
        tm.add(Calendar.DAY_OF_MONTH, 1);
        String tomorrow = dateKey(tm);
        int nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);

        v.setTextViewText(R.id.w_day, String.valueOf(now.get(Calendar.DAY_OF_MONTH)));
        v.setTextViewText(R.id.w_weekday, DAYS[now.get(Calendar.DAY_OF_WEEK) - 1]);
        v.setTextViewText(R.id.w_month, MONTHS[now.get(Calendar.MONTH)] + " " + now.get(Calendar.YEAR));

        List<Item> todays = new ArrayList<>();
        List<Item> tomorrows = new ArrayList<>();
        String accent = "mor";
        int taskCount = 0;
        String firstTask = null;
        boolean firstLate = false;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = prefs.getString(KEY, null);
            if (raw != null) {
                JSONObject data = new JSONObject(raw);
                accent = data.optString("accent", "mor");
                // v2: hazır başlık/renk; eski sürümün verisi uygulama bir kez açılınca yenilenir
                JSONArray arr = data.optJSONArray("items");
                if (arr == null) arr = data.optJSONArray("events");
                if (arr != null) {
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject e = arr.getJSONObject(i);
                        String date = e.optString("date");
                        if (!today.equals(date) && !tomorrow.equals(date)) continue;
                        Item it = new Item();
                        it.date = date;
                        it.start = e.optString("start");
                        it.end = e.optString("end");
                        it.status = e.optString("status");
                        it.title = e.optString("title", e.optString("groupCode", ""));
                        it.sub = e.optString("sub", "");
                        it.color = parseColor(e.optString("color", "#6542F0"));
                        it.startMin = minutes(it.start);
                        it.endMin = minutes(it.end);
                        (today.equals(date) ? todays : tomorrows).add(it);
                    }
                }
                JSONArray tasks = data.optJSONArray("tasks");
                taskCount = data.optInt("taskCount", tasks != null ? tasks.length() : 0);
                if (tasks != null && tasks.length() > 0) {
                    firstTask = tasks.getJSONObject(0).optString("title");
                    firstLate = tasks.getJSONObject(0).optBoolean("late");
                }
            }
        } catch (Exception ex) {
            v.setTextViewText(R.id.w_hero_title, "Veri okunamadı");
            v.setTextViewText(R.id.w_hero_sub, "Uygulamayı bir kez açın");
            return v;
        }

        v.setInt(R.id.w_head, "setBackgroundResource", headFor(accent));
        Collections.sort(todays, (a, b) -> a.start.compareTo(b.start));
        Collections.sort(tomorrows, (a, b) -> a.start.compareTo(b.start));

        int active = 0;
        Item current = null, next = null;
        for (Item it : todays) {
            if (it.off()) continue;
            active++;
            if (current == null && it.startMin <= nowMin && it.endMin > nowMin) current = it;
            if (next == null && it.startMin > nowMin) next = it;
        }
        Item tomorrowFirst = null;
        for (Item it : tomorrows) if (!it.off()) { tomorrowFirst = it; break; }

        v.setTextViewText(R.id.w_count, active == 0 ? "Ders yok" : active + " ders");

        // Şu an / sıradaki kartı
        if (current != null) {
            v.setTextViewText(R.id.w_hero_label, "ŞU AN · " + current.end + "'de bitiyor");
            v.setTextViewText(R.id.w_hero_title, current.title);
            v.setTextViewText(R.id.w_hero_sub, current.start + " – " + current.end + (next != null ? "   ·   Sonra: " + next.start + " " + next.title : ""));
        } else if (next != null) {
            v.setTextViewText(R.id.w_hero_label, "SIRADAKİ · " + inMinutes(next.startMin - nowMin).toUpperCase(new Locale("tr")));
            v.setTextViewText(R.id.w_hero_title, next.title);
            v.setTextViewText(R.id.w_hero_sub, next.start + " – " + next.end + (next.sub.isEmpty() ? "" : "   ·   " + next.sub));
        } else if (active > 0) {
            v.setTextViewText(R.id.w_hero_label, "BUGÜN");
            v.setTextViewText(R.id.w_hero_title, "Bugünkü dersler bitti ✓");
            v.setTextViewText(R.id.w_hero_sub, tomorrowFirst != null ? "Yarın ilk ders " + tomorrowFirst.start + " · " + tomorrowFirst.title : "Yarın ders yok");
        } else {
            v.setTextViewText(R.id.w_hero_label, "BUGÜN");
            v.setTextViewText(R.id.w_hero_title, "Bugün ders yok 🎉");
            v.setTextViewText(R.id.w_hero_sub, tomorrowFirst != null ? "Yarın ilk ders " + tomorrowFirst.start + " · " + tomorrowFirst.title : "İyi dinlenmeler");
        }

        // Günün listesi: geçmiş dersler soluk, iptaller üstü çizili görünümde (soluk + "İptal")
        int shown = 0;
        for (int i = 0; i < ROWS; i++) v.setViewVisibility(ROW[i], View.GONE);
        for (Item it : todays) {
            if (shown >= ROWS) break;
            boolean past = it.endMin <= nowMin || it.off();
            boolean live = it == current;
            v.setViewVisibility(ROW[shown], View.VISIBLE);
            v.setInt(BAR[shown], "setColorFilter", it.color);
            v.setInt(BAR[shown], "setImageAlpha", past ? 90 : 255);
            v.setTextViewText(TIME[shown], it.start);
            v.setTextViewText(END[shown], it.end);
            v.setTextViewText(TITLE[shown], ("done".equals(it.status) ? "✓ " : "") + it.title);
            v.setTextViewText(SUB[shown], live ? "● Şu an · " + it.sub : it.sub);
            if (past) {
                // Açık ve koyu temada okunur, soluk bir gri
                v.setTextColor(TIME[shown], 0xFF9896B0);
                v.setTextColor(END[shown], 0xFF9896B0);
                v.setTextColor(TITLE[shown], 0xFF9896B0);
                v.setTextColor(SUB[shown], 0xFF9896B0);
            }
            shown++;
        }
        if (todays.size() > shown) {
            v.setViewVisibility(R.id.w_more, View.VISIBLE);
            v.setTextViewText(R.id.w_more, "+" + (todays.size() - shown) + " etkinlik daha");
        } else {
            v.setViewVisibility(R.id.w_more, View.GONE);
        }

        // Görevler
        if (taskCount > 0 && firstTask != null) {
            v.setViewVisibility(R.id.w_tasks, View.VISIBLE);
            String head = taskCount == 1 ? "1 görev" : taskCount + " görev";
            v.setTextViewText(R.id.w_tasks_text, head + " · " + firstTask + (firstLate ? " (gecikti)" : ""));
        } else {
            v.setViewVisibility(R.id.w_tasks, View.GONE);
        }

        // Bir sonraki yenileme: ilk başlangıç/bitiş anı, yoksa gece yarısı
        int nextMin = 24 * 60;
        for (Item it : todays) {
            if (it.off()) continue;
            if (it.startMin > nowMin && it.startMin < nextMin) nextMin = it.startMin;
            if (it.endMin > nowMin && it.endMin < nextMin) nextMin = it.endMin;
        }
        Calendar at = (Calendar) now.clone();
        at.set(Calendar.HOUR_OF_DAY, 0);
        at.set(Calendar.MINUTE, 0);
        at.set(Calendar.SECOND, 5);
        at.set(Calendar.MILLISECOND, 0);
        at.add(Calendar.MINUTE, nextMin);
        nextTick[0] = at.getTimeInMillis();
        return v;
    }
}
