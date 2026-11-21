package com.kadinatlasi.wellness

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

class StepForegroundService : Service(), SensorEventListener {

  private val sensorManager: SensorManager? by lazy {
    getSystemService(Context.SENSOR_SERVICE) as? SensorManager
  }

  private val stepCounterSensor: Sensor? by lazy {
    sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      ?: sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
  }

  private val handler = Handler(Looper.getMainLooper())
  private var isSensorRegistered = false
  private var lastNotificationUpdateMs = 0L
  private var pendingRefreshRunnable: Runnable? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    ensureNotificationChannel(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        isServiceRunning = false
        unregisterStepListener()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_REFRESH -> {
        if (!StepTrackerPrefs.isLiveNotificationEnabled(this)) {
          isServiceRunning = false
          unregisterStepListener()
          ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
          stopSelf()
          return START_NOT_STICKY
        }
        startAsForeground()
        registerStepListener()
        updateNotification(force = true)
        return START_STICKY
      }
      else -> {
        if (!hasRequiredPermissions(this) || !StepTrackerPrefs.isLiveNotificationEnabled(this)) {
          isServiceRunning = false
          stopSelf()
          return START_NOT_STICKY
        }
        isServiceRunning = true
        startAsForeground()
        registerStepListener()
        return START_STICKY
      }
    }
  }

  override fun onDestroy() {
    isServiceRunning = false
    pendingRefreshRunnable?.let { handler.removeCallbacks(it) }
    pendingRefreshRunnable = null
    unregisterStepListener()
    super.onDestroy()
  }

  private fun startAsForeground() {
    val notification = buildNotification(this)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    isServiceRunning = true
    lastNotificationUpdateMs = System.currentTimeMillis()
  }

  private fun registerStepListener() {
    if (isSensorRegistered) return
    val sensor = stepCounterSensor ?: return
    val manager = sensorManager ?: return
    if (!hasActivityPermission(this)) return

    try {
      isSensorRegistered = manager.registerListener(
        this,
        sensor,
        SensorManager.SENSOR_DELAY_FASTEST,
        0
      )
    } catch (_: Exception) {
      isSensorRegistered = false
    }
  }

  private fun unregisterStepListener() {
    if (!isSensorRegistered) return
    try {
      sensorManager?.unregisterListener(this)
    } catch (_: Exception) {
    } finally {
      isSensorRegistered = false
    }
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event == null) return
    if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
      val bootSteps = event.values[0].toInt()
      val snapshot = StepTrackerPrefs.applyBootSteps(this, bootSteps)
      StepEventBus.emitBootSteps(bootSteps, snapshot.todaySteps)
      scheduleNotificationUpdate()
    } else if (event.sensor.type == Sensor.TYPE_STEP_DETECTOR) {
      val delta = event.values.size.coerceAtLeast(1)
      val snapshot = StepTrackerPrefs.applyStepDelta(this, delta)
      StepEventBus.emitBootSteps(snapshot.lastBootSteps, snapshot.todaySteps)
      scheduleNotificationUpdate()
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  private fun scheduleNotificationUpdate() {
    val now = System.currentTimeMillis()
    val elapsed = now - lastNotificationUpdateMs
    if (elapsed >= UPDATE_THROTTLE_MS) {
      pendingRefreshRunnable?.let { handler.removeCallbacks(it) }
      pendingRefreshRunnable = null
      updateNotification(force = true)
      return
    }
    if (pendingRefreshRunnable != null) return
    val delay = UPDATE_THROTTLE_MS - elapsed
    val runnable = Runnable {
      pendingRefreshRunnable = null
      updateNotification(force = true)
    }
    pendingRefreshRunnable = runnable
    handler.postDelayed(runnable, delay)
  }

  private fun updateNotification(force: Boolean) {
    val now = System.currentTimeMillis()
    if (!force && now - lastNotificationUpdateMs < UPDATE_THROTTLE_MS) return
    lastNotificationUpdateMs = now
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    manager.notify(NOTIFICATION_ID, buildNotification(this))
  }

  companion object {
    const val CHANNEL_ID = "kadin_atlasi_live_tracker"
    const val NOTIFICATION_ID = 7401
    const val ACTION_START = "com.kadinatlasi.wellness.action.START_STEP_SERVICE"
    const val ACTION_REFRESH = "com.kadinatlasi.wellness.action.REFRESH_STEP_SERVICE"
    const val ACTION_STOP = "com.kadinatlasi.wellness.action.STOP_STEP_SERVICE"
    private const val UPDATE_THROTTLE_MS = 1500L

    @Volatile
    var isServiceRunning: Boolean = false
      private set

    fun hasActivityPermission(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
      return ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACTIVITY_RECOGNITION
      ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasNotificationPermission(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
      return ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS
      ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasRequiredPermissions(context: Context): Boolean =
      hasActivityPermission(context) && hasNotificationPermission(context)

    fun ensureNotificationChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: return
      if (manager.getNotificationChannel(CHANNEL_ID) != null) return

      val channel = NotificationChannel(
        CHANNEL_ID,
        "Canlı Adım & Döngü Takibi",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Kilit ekranında ve bildirim çubuğunda adım, kalori ve regl özeti gösterir."
        setShowBadge(false)
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      manager.createNotificationChannel(channel)
    }

    fun buildNotification(context: Context): Notification {
      ensureNotificationChannel(context)
      val snap = StepTrackerPrefs.getSnapshot(context)
      val cycle = StepTrackerPrefs.getCycleInfo(context)

      val pct = ((snap.todaySteps * 100.0) / snap.stepsGoal.coerceAtLeast(1000))
        .toInt()
        .coerceIn(0, 100)
      val stepsFormatted = StepTrackerPrefs.formatInt(snap.todaySteps)
      val kcalFormatted = StepTrackerPrefs.formatCalories(snap.todaySteps)
      val kmFormatted = StepTrackerPrefs.formatKm(snap.todaySteps)

      val collapsed = RemoteViews(context.packageName, R.layout.notification_step_tracker).apply {
        setTextViewText(R.id.notif_steps_text, "👟 $stepsFormatted")
        setTextViewText(R.id.notif_calories_text, "🔥 $kcalFormatted")
        setTextViewText(R.id.notif_cycle_pill, cycle.compactBadge)
        setProgressBar(R.id.notif_steps_progress, 100, pct, false)
        setOnClickPendingIntent(
          R.id.notif_open_steps_btn,
          WidgetLauncherHelper.buildLaunchIntent(context, "/wellness/steps", 402)
        )
        setOnClickPendingIntent(
          R.id.notif_cycle_pill,
          WidgetLauncherHelper.buildLaunchIntent(context, "/(tabs)/calendar", 403)
        )
      }

      val expanded = RemoteViews(
        context.packageName,
        R.layout.notification_step_tracker_expanded
      ).apply {
        setTextViewText(R.id.notif_exp_steps, "👟 $stepsFormatted adım")
        setTextViewText(R.id.notif_exp_calories, "🔥 $kcalFormatted kcal")
        setTextViewText(R.id.notif_exp_distance, "$kmFormatted km")
        setTextViewText(R.id.notif_exp_goal_pct, "%$pct")
        setProgressBar(R.id.notif_exp_progress, 100, pct, false)
        setTextViewText(R.id.notif_exp_cycle_text, cycle.expandedLine)
        setOnClickPendingIntent(
          R.id.notif_exp_cycle_row,
          WidgetLauncherHelper.buildLaunchIntent(context, "/(tabs)/calendar", 404)
        )
      }

      return NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_step_notification)
        .setColor(0xFFEC4899.toInt())
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setShowWhen(false)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setCategory(NotificationCompat.CATEGORY_PROGRESS)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setStyle(NotificationCompat.DecoratedCustomViewStyle())
        .setCustomContentView(collapsed)
        .setCustomBigContentView(expanded)
        .setContentIntent(WidgetLauncherHelper.buildLaunchIntent(context, "/wellness/steps", 401))
        .build()
    }

    fun start(context: Context): Boolean {
      if (!hasRequiredPermissions(context)) return false
      if (!StepTrackerPrefs.isLiveNotificationEnabled(context)) return false
      val intent = Intent(context, StepForegroundService::class.java).apply {
        action = ACTION_START
      }
      return try {
        ContextCompat.startForegroundService(context, intent)
        true
      } catch (_: Exception) {
        false
      }
    }

    fun refreshIfRunning(context: Context) {
      if (!isServiceRunning) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        ?: return
      try {
        manager.notify(NOTIFICATION_ID, buildNotification(context))
      } catch (_: Exception) {
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, StepForegroundService::class.java).apply {
        action = ACTION_STOP
      }
      try {
        context.startService(intent)
      } catch (_: Exception) {
      }
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      manager?.cancel(NOTIFICATION_ID)
      isServiceRunning = false
    }
  }
}
