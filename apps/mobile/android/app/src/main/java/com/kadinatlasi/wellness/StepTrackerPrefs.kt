package com.kadinatlasi.wellness

import android.content.Context
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class StepSnapshot(
  val dateKey: String,
  val todaySteps: Int,
  val stepsGoal: Int,
  val lastBootSteps: Int,
  val liveNotificationEnabled: Boolean
)

data class CycleNotificationInfo(
  val compactBadge: String,
  val expandedLine: String
)

object StepTrackerPrefs {
  private const val STEP_PREFS_NAME = "KadinAtlasiStepServicePrefs"
  private const val KEY_SERVICE_ENABLED = "liveNotificationEnabled"
  private const val KEY_DATE_KEY = "dateKey"
  private const val KEY_TODAY_STEPS = "todaySteps"
  private const val KEY_STEPS_GOAL = "stepsGoal"
  private const val KEY_LAST_BOOT_STEPS = "lastBootSteps"

  private val trLocale = Locale("tr", "TR")

  fun localDateKey(date: Date = Date()): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)

  fun currentTimeText(date: Date = Date()): String =
    SimpleDateFormat("HH:mm", Locale.US).format(date)

  fun formatInt(value: Int): String =
    NumberFormat.getIntegerInstance(trLocale).format(value.coerceAtLeast(0))

  fun formatCalories(steps: Int): String {
    val kcal = steps.coerceAtLeast(0) * 0.04
    val nf = NumberFormat.getNumberInstance(trLocale).apply {
      minimumFractionDigits = 1
      maximumFractionDigits = 1
    }
    return nf.format(kcal)
  }

  fun formatKm(steps: Int): String {
    val km = (steps.coerceAtLeast(0) * 0.75) / 1000.0
    val nf = NumberFormat.getNumberInstance(trLocale).apply {
      minimumFractionDigits = 1
      maximumFractionDigits = 1
    }
    return nf.format(km)
  }

  private fun isConsecutiveNextDay(prevKey: String, todayKey: String): Boolean {
    return try {
      val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
      val prevDate = sdf.parse(prevKey) ?: return false
      val todayDate = sdf.parse(todayKey) ?: return false
      val diffDays = ((todayDate.time - prevDate.time) / (24L * 60L * 60L * 1000L))
      diffDays == 1L
    } catch (_: Exception) {
      false
    }
  }

  fun getSnapshot(context: Context): StepSnapshot {
    val prefs = context.getSharedPreferences(STEP_PREFS_NAME, Context.MODE_PRIVATE)
    val todayKey = localDateKey()
    val savedDate = prefs.getString(KEY_DATE_KEY, todayKey) ?: todayKey
    val sameDay = savedDate == todayKey

    val todaySteps = if (sameDay) prefs.getInt(KEY_TODAY_STEPS, 0).coerceAtLeast(0) else 0
    val stepsGoal = prefs.getInt(KEY_STEPS_GOAL, 7000).coerceAtLeast(1000)
    var lastBootSteps = prefs.getInt(KEY_LAST_BOOT_STEPS, -1)
    val enabled = prefs.getBoolean(KEY_SERVICE_ENABLED, true)

    if (!sameDay) {
      val editor = prefs.edit()
        .putString(KEY_DATE_KEY, todayKey)
        .putInt(KEY_TODAY_STEPS, 0)
      if (!isConsecutiveNextDay(savedDate, todayKey)) {
        lastBootSteps = -1
        editor.putInt(KEY_LAST_BOOT_STEPS, -1)
      }
      editor.apply()
    }

    return StepSnapshot(
      dateKey = todayKey,
      todaySteps = todaySteps,
      stepsGoal = stepsGoal,
      lastBootSteps = lastBootSteps,
      liveNotificationEnabled = enabled
    )
  }

  fun setLiveNotificationEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(STEP_PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_SERVICE_ENABLED, enabled)
      .apply()
  }

  fun isLiveNotificationEnabled(context: Context): Boolean =
    context.getSharedPreferences(STEP_PREFS_NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_SERVICE_ENABLED, true)

  @Synchronized
  fun applyBootSteps(context: Context, bootSteps: Int): StepSnapshot {
    val current = getSnapshot(context)
    if (bootSteps < 0) return current

    val prefs = context.getSharedPreferences(STEP_PREFS_NAME, Context.MODE_PRIVATE)
    var nextSteps = current.todaySteps
    val prevBoot = current.lastBootSteps

    if (prevBoot >= 0 && bootSteps != prevBoot) {
      val delta = if (bootSteps >= prevBoot) bootSteps - prevBoot else bootSteps
      if (delta in 1..149999) {
        nextSteps += delta
      }
    }

    prefs.edit()
      .putString(KEY_DATE_KEY, current.dateKey)
      .putInt(KEY_TODAY_STEPS, nextSteps)
      .putInt(KEY_LAST_BOOT_STEPS, bootSteps)
      .apply()

    if (nextSteps != current.todaySteps) {
      syncStepsToWidgets(context, nextSteps, current.stepsGoal)
    }

    return current.copy(todaySteps = nextSteps, lastBootSteps = bootSteps)
  }

  @Synchronized
  fun applyStepDelta(context: Context, delta: Int): StepSnapshot {
    val current = getSnapshot(context)
    if (delta <= 0) return current
    val nextSteps = current.todaySteps + delta
    context.getSharedPreferences(STEP_PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_DATE_KEY, current.dateKey)
      .putInt(KEY_TODAY_STEPS, nextSteps)
      .apply()
    syncStepsToWidgets(context, nextSteps, current.stepsGoal)
    return current.copy(todaySteps = nextSteps)
  }

  @Synchronized
  fun syncFromJs(
    context: Context,
    steps: Int,
    goal: Int,
    isManualOverride: Boolean
  ): StepSnapshot {
    val current = getSnapshot(context)
    val safeGoal = if (goal > 0) goal else current.stepsGoal
    val safeSteps = steps.coerceAtLeast(0)
    val nextSteps = if (isManualOverride) safeSteps else maxOf(current.todaySteps, safeSteps)

    context.getSharedPreferences(STEP_PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_DATE_KEY, current.dateKey)
      .putInt(KEY_TODAY_STEPS, nextSteps)
      .putInt(KEY_STEPS_GOAL, safeGoal)
      .apply()

    syncStepsToWidgets(context, nextSteps, safeGoal)
    return current.copy(todaySteps = nextSteps, stepsGoal = safeGoal)
  }

  fun syncStepsToWidgets(context: Context, stepsToday: Int, stepsGoal: Int) {
    val widgetPrefs = context.getSharedPreferences(
      WidgetLauncherHelper.PREFS_NAME,
      Context.MODE_PRIVATE
    )
    val goal = stepsGoal.coerceAtLeast(1000)
    val pct = ((stepsToday * 100.0) / goal).toInt().coerceIn(0, 100)
    widgetPrefs.edit()
      .putString("stepsValue", formatInt(stepsToday))
      .putString("stepsSub", "/ ${formatInt(goal)} adım")
      .putInt("stepsPct", pct)
      .putString("updatedAt", currentTimeText())
      .apply()
    KadinAtlasiWidgetProvider.updateAllWidgets(context)
  }

  fun getCycleInfo(context: Context): CycleNotificationInfo {
    val prefs = context.getSharedPreferences(WidgetLauncherHelper.PREFS_NAME, Context.MODE_PRIVATE)
    val phaseLabel = prefs.getString("phaseLabel", "Döngü Takibi") ?: "Döngü Takibi"
    val headline = prefs.getString("headline", "Takvimini güncel tut") ?: "Takvimini güncel tut"
    val cycleValue = prefs.getString("cycleValue", "-") ?: "-"
    val cycleSub = prefs.getString("cycleSub", "") ?: ""

    val isMenstrual =
      cycleSub.contains("regl", ignoreCase = true) ||
        headline.contains("Regl dönem", ignoreCase = true)
    val isPregnancy =
      phaseLabel.contains("Hamilelik", ignoreCase = true) ||
        cycleSub.contains("gebelik", ignoreCase = true)

    val compactBadge = when {
      cycleValue == "-" || cycleValue.isBlank() -> "🌸 Takvim"
      isPregnancy -> "🤰 $cycleValue"
      isMenstrual -> "🩸 Regl $cycleValue"
      cycleSub.contains("kalan", ignoreCase = true) || cycleSub.contains("tahmin", ignoreCase = true) ->
        "🌸 Regle $cycleValue"
      else -> "🌸 $cycleValue"
    }

    val expandedLine = when {
      cycleValue == "-" || cycleValue.isBlank() -> "🌸 $phaseLabel • Regl bilgisi için takvimi aç"
      isPregnancy -> "🤰 $headline • $phaseLabel"
      isMenstrual -> "🩸 $headline • $phaseLabel"
      else -> "🌸 $headline • $phaseLabel"
    }

    return CycleNotificationInfo(
      compactBadge = compactBadge,
      expandedLine = expandedLine
    )
  }
}
