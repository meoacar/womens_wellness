package com.kadinatlasi.wellness

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference
import java.util.concurrent.atomic.AtomicBoolean

object StepEventBus {
  @Volatile
  private var reactContextRef: WeakReference<ReactApplicationContext>? = null

  fun attach(context: ReactApplicationContext) {
    reactContextRef = WeakReference(context)
  }

  fun detach(context: ReactApplicationContext) {
    if (reactContextRef?.get() === context) {
      reactContextRef = null
    }
  }

  fun emitBootSteps(bootSteps: Int, todaySteps: Int? = null) {
    val ctx = reactContextRef?.get() ?: return
    if (!ctx.hasActiveReactInstance()) return

    val params = Arguments.createMap().apply {
      putInt("bootSteps", bootSteps)
      if (todaySteps != null) {
        putInt("todaySteps", todaySteps)
      }
    }
    try {
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("HardwareStepCounterUpdate", params)
    } catch (_: Exception) {
    }
  }
}

class StepCounterModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), SensorEventListener {

  private val sensorManager: SensorManager? by lazy {
    reactContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
  }

  private val stepCounterSensor: Sensor? by lazy {
    sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      ?: sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
  }

  private var isListening = false
  private var listenerCount = 0

  init {
    StepEventBus.attach(reactContext)
  }

  override fun getName(): String = "HardwareStepCounter"

  private fun hasActivityPermission(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return true
    }
    return ContextCompat.checkSelfPermission(
      reactContext,
      Manifest.permission.ACTIVITY_RECOGNITION
    ) == PackageManager.PERMISSION_GRANTED
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(stepCounterSensor != null)
  }

  @ReactMethod
  fun getCurrentBootSteps(promise: Promise) {
    val sensor = stepCounterSensor
    val manager = sensorManager
    if (sensor == null || manager == null || !hasActivityPermission()) {
      promise.resolve(-1)
      return
    }
    if (sensor.type != Sensor.TYPE_STEP_COUNTER) {
      promise.resolve(-1)
      return
    }

    val settled = AtomicBoolean(false)
    val handler = Handler(Looper.getMainLooper())
    var oneShotListener: SensorEventListener? = null

    val timeoutRunnable = Runnable {
      if (settled.compareAndSet(false, true)) {
        oneShotListener?.let {
          try {
            manager.unregisterListener(it)
          } catch (_: Exception) {
          }
        }
        promise.resolve(-1)
      }
    }

    oneShotListener = object : SensorEventListener {
      override fun onSensorChanged(event: SensorEvent?) {
        if (event != null && event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
          if (settled.compareAndSet(false, true)) {
            handler.removeCallbacks(timeoutRunnable)
            try {
              manager.unregisterListener(this)
            } catch (_: Exception) {
            }
            val bootSteps = event.values[0].toInt()
            StepTrackerPrefs.applyBootSteps(reactContext, bootSteps)
            promise.resolve(bootSteps)
          }
        }
      }

      override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    }

    try {
      val registered = manager.registerListener(
        oneShotListener,
        sensor,
        SensorManager.SENSOR_DELAY_FASTEST
      )
      if (!registered) {
        if (settled.compareAndSet(false, true)) {
          promise.resolve(-1)
        }
        return
      }
      handler.postDelayed(timeoutRunnable, 1500)
    } catch (_: Exception) {
      if (settled.compareAndSet(false, true)) {
        promise.resolve(-1)
      }
    }
  }

  @ReactMethod
  fun startListening() {
    StepEventBus.attach(reactContext)
    if (StepForegroundService.isServiceRunning) return
    val sensor = stepCounterSensor ?: return
    val manager = sensorManager ?: return
    if (isListening || !hasActivityPermission()) return

    try {
      isListening = manager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_FASTEST, 0)
    } catch (_: Exception) {
      isListening = false
    }
  }

  @ReactMethod
  fun stopListening() {
    if (!isListening) return
    try {
      sensorManager?.unregisterListener(this)
    } catch (_: Exception) {
    } finally {
      isListening = false
    }
  }

  @ReactMethod
  fun startLiveNotification(goal: Int, promise: Promise) {
    if (goal > 0) {
      val current = StepTrackerPrefs.getSnapshot(reactContext)
      StepTrackerPrefs.syncFromJs(reactContext, current.todaySteps, goal, false)
    }
    StepTrackerPrefs.setLiveNotificationEnabled(reactContext, true)
    val started = StepForegroundService.start(reactContext)
    if (started) {
      stopListening()
    }
    promise.resolve(started)
  }

  @ReactMethod
  fun stopLiveNotification(promise: Promise) {
    StepTrackerPrefs.setLiveNotificationEnabled(reactContext, false)
    StepForegroundService.stop(reactContext)
    promise.resolve(true)
  }

  @ReactMethod
  fun pauseLiveNotification() {
    StepForegroundService.stop(reactContext)
  }

  @ReactMethod
  fun isLiveNotificationEnabled(promise: Promise) {
    promise.resolve(StepTrackerPrefs.isLiveNotificationEnabled(reactContext))
  }

  @ReactMethod
  fun getDailyStepSnapshot(promise: Promise) {
    val snap = StepTrackerPrefs.getSnapshot(reactContext)
    val map = Arguments.createMap().apply {
      putString("dateKey", snap.dateKey)
      putInt("todaySteps", snap.todaySteps)
      putInt("stepsGoal", snap.stepsGoal)
      putInt("lastBootSteps", snap.lastBootSteps)
      putBoolean("liveNotificationEnabled", snap.liveNotificationEnabled)
    }
    promise.resolve(map)
  }

  @ReactMethod
  fun syncNativeBaseline(steps: Int, goal: Int, isManualOverride: Boolean) {
    StepTrackerPrefs.syncFromJs(reactContext, steps, goal, isManualOverride)
    StepForegroundService.refreshIfRunning(reactContext)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    listenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    listenerCount = maxOf(0, listenerCount - count)
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event == null) return
    if (StepForegroundService.isServiceRunning) return
    if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
      val bootSteps = event.values[0].toInt()
      val snap = StepTrackerPrefs.applyBootSteps(reactContext, bootSteps)
      StepEventBus.emitBootSteps(bootSteps, snap.todaySteps)
    } else if (event.sensor.type == Sensor.TYPE_STEP_DETECTOR) {
      val delta = event.values.size.coerceAtLeast(1)
      val snap = StepTrackerPrefs.applyStepDelta(reactContext, delta)
      StepEventBus.emitBootSteps(snap.lastBootSteps, snap.todaySteps)
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun invalidate() {
    stopListening()
    StepEventBus.detach(reactContext)
    super.invalidate()
  }
}
