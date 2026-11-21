package com.kadinatlasi.wellness

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

class CycleWidgetProvider : AppWidgetProvider() {

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
      val ids = manager.getAppWidgetIds(ComponentName(context, CycleWidgetProvider::class.java))
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
      val views = RemoteViews(context.packageName, R.layout.widget_cycle_card)

      val phaseLabel = prefs.getString("phaseLabel", "Takip") ?: "Takip"
      val bigValue = prefs.getString("cycleBigValue", "-") ?: "-"
      val bigSub = prefs.getString("cycleBigSub", "Takvimi açarak takip et") ?: "Takvimi açarak takip et"
      val footer = prefs.getString("cycleFooter", "Takvime Git →") ?: "Takvime Git →"

      views.setTextViewText(R.id.cycle_widget_phase, phaseLabel)
      views.setTextViewText(R.id.cycle_widget_big_value, bigValue)
      views.setTextViewText(R.id.cycle_widget_big_sub, bigSub)
      views.setTextViewText(R.id.cycle_widget_footer, footer)

      views.setOnClickPendingIntent(
        R.id.cycle_widget_root,
        WidgetLauncherHelper.buildLaunchIntent(context, "/(tabs)/calendar", 200)
      )

      appWidgetManager.updateAppWidget(appWidgetId, views)
    }
  }
}
