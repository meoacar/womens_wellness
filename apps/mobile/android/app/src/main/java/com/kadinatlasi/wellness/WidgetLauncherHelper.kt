package com.kadinatlasi.wellness

import android.app.PendingIntent
import android.content.Context
import android.content.Intent

object WidgetLauncherHelper {
  const val PREFS_NAME = "KadinAtlasiWidgetPrefs"
  const val EXTRA_WIDGET_ROUTE = "widgetRoute"
  const val KEY_PENDING_ROUTE = "pendingWidgetRoute"

  fun buildLaunchIntent(
    context: Context,
    route: String,
    requestCode: Int
  ): PendingIntent {
    val intent = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra(EXTRA_WIDGET_ROUTE, route)
    }
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  fun captureWidgetRoute(context: Context, intent: Intent?) {
    val route = intent?.getStringExtra(EXTRA_WIDGET_ROUTE) ?: return
    if (route.isNotBlank()) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_PENDING_ROUTE, route)
        .apply()
      intent.removeExtra(EXTRA_WIDGET_ROUTE)
    }
  }
}
