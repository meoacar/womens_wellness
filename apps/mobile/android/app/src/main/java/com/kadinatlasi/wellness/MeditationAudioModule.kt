package com.kadinatlasi.wellness

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Random
import kotlin.math.PI
import kotlin.math.sin

class MeditationAudioModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  @Volatile
  private var isPlaying = false

  @Volatile
  private var currentTrackId = "432hz"

  @Volatile
  private var volume = 0.65f

  private var audioThread: Thread? = null
  private val lock = Any()

  override fun getName(): String = "MeditationAudio"

  @ReactMethod
  fun play(trackId: String, vol: Double) {
    synchronized(lock) {
      currentTrackId = trackId
      volume = vol.toFloat().coerceIn(0.05f, 1.0f)
      if (isPlaying) {
        return
      }
      isPlaying = true
      val thread = Thread({ renderLoop() }, "MeditationAudioThread")
      thread.priority = Thread.NORM_PRIORITY
      audioThread = thread
      thread.start()
    }
  }

  @ReactMethod
  fun setVolume(vol: Double) {
    volume = vol.toFloat().coerceIn(0.05f, 1.0f)
  }

  @ReactMethod
  fun stop() {
    synchronized(lock) {
      isPlaying = false
      audioThread = null
    }
  }

  private fun renderLoop() {
    val sampleRate = 22050
    val bufferFrames = 2048
    val minBytes = AudioTrack.getMinBufferSize(
      sampleRate,
      AudioFormat.CHANNEL_OUT_MONO,
      AudioFormat.ENCODING_PCM_16BIT
    ).coerceAtLeast(bufferFrames * 4)

    var track: AudioTrack? = null
    try {
      track = AudioTrack.Builder()
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        )
        .setAudioFormat(
          AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(sampleRate)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build()
        )
        .setBufferSizeInBytes(minBytes)
        .setTransferMode(AudioTrack.MODE_STREAM)
        .build()

      track.play()

      val pcm = ShortArray(bufferFrames)
      val rng = Random(42)

      // Continuous phase accumulators
      var t = 0.0
      val dt = 1.0 / sampleRate
      var fadeGain = 0.0

      // Filtered noise state (pink/brown warmth)
      var lp1 = 0.0
      var lp2 = 0.0
      var b0 = 0.0
      var b1 = 0.0
      var b2 = 0.0

      // Bell strike state
      var bellTimer = 0.0
      var bellAmp = 0.0
      var bellFreq = 432.0
      val bellNotes = doubleArrayOf(432.0, 528.0, 576.0, 648.0)
      var bellNoteIndex = 0

      while (isPlaying) {
        val activeTrack = currentTrackId
        val targetVol = volume.toDouble()

        for (i in 0 until bufferFrames) {
          if (!isPlaying) break
          fadeGain = (fadeGain + 0.00015).coerceAtMost(1.0)

          val white = rng.nextDouble() * 2.0 - 1.0
          // Pink-ish smoothing
          b0 = 0.99765 * b0 + white * 0.0990460
          b1 = 0.96300 * b1 + white * 0.2965164
          b2 = 0.57000 * b2 + white * 1.0526913
          val pink = (b0 + b1 + b2 + white * 0.1848) * 0.12

          var sample = 0.0

          when (activeTrack) {
            "rain" -> {
              // Gentle warm rainfall with subtle low-frequency rumble & droplet shimmer
              lp1 += 0.08 * (pink - lp1)
              lp2 += 0.22 * (pink - lp2)
              val lfo = 0.82 + 0.18 * sin(2.0 * PI * 0.09 * t)
              sample = (lp1 * 0.75 + lp2 * 0.45) * lfo
            }
            "ocean" -> {
              // Slow rolling waves (~9 sec period)
              lp1 += 0.045 * (pink - lp1)
              lp2 += 0.015 * (lp1 - lp2)
              val waveEnv = 0.22 + 0.78 * Math.pow((0.5 + 0.5 * sin(2.0 * PI * 0.11 * t - PI / 2.0)), 2.2)
              val subPad = 0.08 * sin(2.0 * PI * 108.0 * t) * waveEnv
              sample = (lp1 * 1.25 + lp2 * 0.7) * waveEnv + subPad
            }
            "forest" -> {
              // Soft breeze + distant pentatonic singing bowl chime every ~6.5s
              lp1 += 0.03 * (pink - lp1)
              val breezeLfo = 0.6 + 0.4 * sin(2.0 * PI * 0.07 * t)
              bellTimer += dt
              if (bellTimer >= 6.5) {
                bellTimer = 0.0
                bellAmp = 0.28
                bellFreq = bellNotes[bellNoteIndex % bellNotes.size]
                bellNoteIndex += 1
              }
              bellAmp *= 0.99991
              val chime = bellAmp * (
                0.7 * sin(2.0 * PI * bellFreq * t) +
                0.22 * sin(2.0 * PI * (bellFreq * 1.5) * t) +
                0.08 * sin(2.0 * PI * (bellFreq * 2.0) * t)
              )
              sample = lp1 * 0.65 * breezeLfo + chime
            }
            else -> {
              // "432hz" warm harmonic ambient pad + gentle singing bowl pulse
              val breathLfo = 0.68 + 0.32 * sin(2.0 * PI * 0.12 * t)
              val f0 = 216.0
              val pad = (
                0.42 * sin(2.0 * PI * f0 * t) +
                0.26 * sin(2.0 * PI * (f0 * 1.5) * t) + // Perfect fifth 324 Hz
                0.22 * sin(2.0 * PI * (f0 * 2.0) * t) + // 432 Hz
                0.10 * sin(2.0 * PI * (f0 * 2.005) * t) // Warm gentle chorus shimmer
              ) * 0.30 * breathLfo
              lp1 += 0.02 * (pink - lp1)
              sample = pad + lp1 * 0.15
            }
          }

          val scaled = (sample * fadeGain * targetVol * 18000.0).coerceIn(-32000.0, 32000.0)
          pcm[i] = scaled.toInt().toShort()
          t += dt
        }

        if (isPlaying) {
          track.write(pcm, 0, bufferFrames)
        }
      }
    } catch (_: Exception) {
    } finally {
      try {
        track?.pause()
        track?.flush()
        track?.stop()
        track?.release()
      } catch (_: Exception) {
      }
    }
  }

  override fun invalidate() {
    stop()
    super.invalidate()
  }
}
