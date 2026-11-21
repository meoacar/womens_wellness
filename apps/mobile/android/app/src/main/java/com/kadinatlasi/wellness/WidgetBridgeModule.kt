package com.kadinatlasi.wellness

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

class WidgetBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "KadinAtlasiWidget"

  @ReactMethod
  fun updateWidgetData(data: ReadableMap) {
    val prefs = reactContext.getSharedPreferences(
      WidgetLauncherHelper.PREFS_NAME,
      Context.MODE_PRIVATE
    )
    val editor = prefs.edit()

    fun putStringIfPresent(key: String) {
      if (data.hasKey(key) && !data.isNull(key) && data.getType(key) == ReadableType.String) {
        editor.putString(key, data.getString(key))
      }
    }

    fun putIntIfPresent(key: String) {
      if (data.hasKey(key) && !data.isNull(key) && data.getType(key) == ReadableType.Number) {
        editor.putInt(key, data.getDouble(key).toInt())
      }
    }

    putStringIfPresent("phaseLabel")
    putStringIfPresent("headline")
    putStringIfPresent("subline")
    putStringIfPresent("cycleValue")
    putStringIfPresent("cycleSub")
    putStringIfPresent("cycleBigValue")
    putStringIfPresent("cycleBigSub")
    putStringIfPresent("cycleFooter")
    putStringIfPresent("waterValue")
    putStringIfPresent("waterSub")
    putIntIfPresent("waterPct")
    putStringIfPresent("stepsValue")
    putStringIfPresent("stepsSub")
    putIntIfPresent("stepsPct")
    putStringIfPresent("zodiacBadge")
    putStringIfPresent("streakBadge")
    putStringIfPresent("mindHeadline")
    putStringIfPresent("astroSignValue")
    putStringIfPresent("meditationText")
    putStringIfPresent("updatedAt")
    editor.apply()

    KadinAtlasiWidgetProvider.updateAllWidgets(reactContext)
    StepForegroundService.refreshIfRunning(reactContext)
  }

  @ReactMethod
  fun clearWidgetData() {
    val prefs = reactContext.getSharedPreferences(
      WidgetLauncherHelper.PREFS_NAME,
      Context.MODE_PRIVATE
    )
    prefs.edit().clear().apply()
    KadinAtlasiWidgetProvider.updateAllWidgets(reactContext)
    StepForegroundService.refreshIfRunning(reactContext)
  }

  @ReactMethod
  fun consumePendingRoute(promise: Promise) {
    val prefs = reactContext.getSharedPreferences(
      WidgetLauncherHelper.PREFS_NAME,
      Context.MODE_PRIVATE
    )
    val route = prefs.getString(WidgetLauncherHelper.KEY_PENDING_ROUTE, null)
    if (!route.isNullOrBlank()) {
      prefs.edit().remove(WidgetLauncherHelper.KEY_PENDING_ROUTE).apply()
      promise.resolve(route)
    } else {
      promise.resolve(null)
    }
  }
}
