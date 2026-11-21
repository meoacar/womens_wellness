package com.kadinatlasi.wellness

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

class KadinAtlasiWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    for (appWidgetId in appWidgetIds) {
      updateSingleWidget(context, appWidgetManager, appWidgetId)
    }
  }

  companion object {
    const val PREFS_NAME = WidgetLauncherHelper.PREFS_NAME

    fun updateAllWidgets(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val summaryIds = manager.getAppWidgetIds(
        ComponentName(context, KadinAtlasiWidgetProvider::class.java)
      )
      for (id in summaryIds) {
        updateSingleWidget(context, manager, id)
      }
      CycleWidgetProvider.updateAll(context)
      WellnessBarWidgetProvider.updateAll(context)
      AstroMindWidgetProvider.updateAll(context)
    }

    private fun updateSingleWidget(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetId: Int
    ) {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val views = RemoteViews(context.packageName, R.layout.kadin_atlasi_widget)

      val phaseLabel = prefs.getString("phaseLabel", "Döngü Takibi") ?: "Döngü Takibi"
      val headline = prefs.getString("headline", "Günlük özetin hazır") ?: "Günlük özetin hazır"
      val subline = prefs.getString(
        "subline",
        "Uygulamayı açarak verilerini senkronize et"
      ) ?: "Uygulamayı açarak verilerini senkronize et"
      val cycleValue = prefs.getString("cycleValue", "-") ?: "-"
      val cycleSub = prefs.getString("cycleSub", "Takvimi aç") ?: "Takvimi aç"
      val waterValue = prefs.getString("waterValue", "0 ml") ?: "0 ml"
      val waterSub = prefs.getString("waterSub", "/ 2.000 ml") ?: "/ 2.000 ml"
      val stepsValue = prefs.getString("stepsValue", "0") ?: "0"
      val stepsSub = prefs.getString("stepsSub", "/ 7.000 adım") ?: "/ 7.000 adım"
      val updatedAt = prefs.getString("updatedAt", "") ?: ""

      views.setTextViewText(R.id.widget_phase_pill, phaseLabel)
      views.setTextViewText(R.id.widget_headline, headline)
      views.setTextViewText(R.id.widget_subline, subline)
      views.setTextViewText(R.id.widget_cycle_value, cycleValue)
      views.setTextViewText(R.id.widget_cycle_sub, cycleSub)
      views.setTextViewText(R.id.widget_water_value, waterValue)
      views.setTextViewText(R.id.widget_water_sub, waterSub)
      views.setTextViewText(R.id.widget_steps_value, stepsValue)
      views.setTextViewText(R.id.widget_steps_sub, stepsSub)
      views.setTextViewText(R.id.widget_updated_at, updatedAt)

      views.setOnClickPendingIntent(
        R.id.widget_root,
        WidgetLauncherHelper.buildLaunchIntent(context, "/(tabs)/home", 100)
      )
      views.setOnClickPendingIntent(
        R.id.widget_tile_cycle,
        WidgetLauncherHelper.buildLaunchIntent(context, "/(tabs)/calendar", 101)
      )
      views.setOnClickPendingIntent(
        R.id.widget_tile_water,
        WidgetLauncherHelper.buildLaunchIntent(context, "/water", 102)
      )
      views.setOnClickPendingIntent(
        R.id.widget_tile_steps,
        WidgetLauncherHelper.buildLaunchIntent(context, "/wellness/steps", 103)
      )

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }
  }
}
