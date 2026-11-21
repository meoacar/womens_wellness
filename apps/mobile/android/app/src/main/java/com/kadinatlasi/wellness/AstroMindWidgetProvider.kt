package com.kadinatlasi.wellness

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

class AstroMindWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    for (id in appWidgetIds) {
      updateSingle(context, appWidgetManager, id)
    }
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(
        ComponentName(context, AstroMindWidgetProvider::class.java)
      )
      for (id in ids) {
        updateSingle(context, manager, id)
      }
    }

    private fun updateSingle(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetId: Int
    ) {
      val prefs = context.getSharedPreferences(WidgetLauncherHelper.PREFS_NAME, Context.MODE_PRIVATE)
      val views = RemoteViews(context.packageName, R.layout.widget_astro_mind)

      val zodiacPill = prefs.getString("zodiacBadge", "✨ Astroloji") ?: "✨ Astroloji"
      val streakPill = prefs.getString("streakBadge", "🔥 Seri") ?: "🔥 Seri"
      val headline = prefs.getString(
        "mindHeadline",
        "Bugünkü kozmik enerjin & nefes alanın hazır"
      ) ?: "Bugünkü kozmik enerjin & nefes alanın hazır"
      val astroSignVal = prefs.getString("astroSignValue", "Günlük Burç") ?: "Günlük Burç"
      val meditationVal = prefs.getString("meditationText", "0 / 10 dk") ?: "0 / 10 dk"
      val updatedAt = prefs.getString("updatedAt", "") ?: ""

      views.setTextViewText(R.id.astro_zodiac_pill, zodiacPill)
      views.setTextViewText(R.id.astro_streak_pill, streakPill)
      views.setTextViewText(R.id.astro_headline, headline)
      views.setTextViewText(R.id.astro_sign_value, astroSignVal)
      views.setTextViewText(R.id.astro_meditation_value, meditationVal)
      views.setTextViewText(R.id.astro_updated_at, updatedAt)

      views.setOnClickPendingIntent(
        R.id.astro_widget_root,
        WidgetLauncherHelper.buildLaunchIntent(context, "/astrology", 400)
      )
      views.setOnClickPendingIntent(
        R.id.astro_tile_horoscope,
        WidgetLauncherHelper.buildLaunchIntent(context, "/astrology", 401)
      )
      views.setOnClickPendingIntent(
        R.id.astro_tile_meditation,
        WidgetLauncherHelper.buildLaunchIntent(context, "/wellness/meditation", 402)
      )

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }
  }
}
