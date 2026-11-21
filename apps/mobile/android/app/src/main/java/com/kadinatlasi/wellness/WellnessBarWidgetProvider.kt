package com.kadinatlasi.wellness

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

class WellnessBarWidgetProvider : AppWidgetProvider() {

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
        ComponentName(context, WellnessBarWidgetProvider::class.java)
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
      val views = RemoteViews(context.packageName, R.layout.widget_wellness_bar)

      val waterVal = prefs.getString("waterValue", "0 ml") ?: "0 ml"
      val waterSub = prefs.getString("waterSub", "/ 2.000 ml") ?: "/ 2.000 ml"
      val waterPct = prefs.getInt("waterPct", 0).coerceIn(0, 100)

      val stepsVal = prefs.getString("stepsValue", "0") ?: "0"
      val stepsSub = prefs.getString("stepsSub", "/ 7.000 adım") ?: "/ 7.000 adım"
      val stepsPct = prefs.getInt("stepsPct", 0).coerceIn(0, 100)

      views.setTextViewText(R.id.wellness_water_val, waterVal)
      views.setTextViewText(R.id.wellness_water_sub, waterSub)
      views.setTextViewText(R.id.wellness_water_pct, "%$waterPct")
      views.setProgressBar(R.id.wellness_water_bar, 100, waterPct, false)

      views.setTextViewText(R.id.wellness_steps_val, stepsVal)
      views.setTextViewText(R.id.wellness_steps_sub, stepsSub)
      views.setTextViewText(R.id.wellness_steps_pct, "%$stepsPct")
      views.setProgressBar(R.id.wellness_steps_bar, 100, stepsPct, false)

      views.setOnClickPendingIntent(
        R.id.wellness_water_box,
        WidgetLauncherHelper.buildLaunchIntent(context, "/water", 301)
      )
      views.setOnClickPendingIntent(
        R.id.wellness_steps_box,
        WidgetLauncherHelper.buildLaunchIntent(context, "/wellness/steps", 302)
      )

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }
  }
}
