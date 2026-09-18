/* WASL specialist waveform player.
 * Draws a decoded audio overview, supports seek/speed controls, and timestamped notes.
 */
(function (global) {
  "use strict";

  function formatTime(seconds) {
    var safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    var minutes = Math.floor(safe / 60);
    var remainder = Math.floor(safe % 60);
    return minutes + ":" + String(remainder).padStart(2, "0");
  }

  async function decodePeaks(url, bars) {
    var response = await fetch(url);
    var bytes = await response.arrayBuffer();
    var AudioContextClass = global.AudioContext || global.webkitAudioContext;
    var context = new AudioContextClass();
    var buffer = await context.decodeAudioData(bytes.slice(0));
    var channel = buffer.getChannelData(0);
    var block = Math.max(1, Math.floor(channel.length / bars));
    var peaks = [];

    for (var bar = 0; bar < bars; bar++) {
      var start = bar * block;
      var end = Math.min(channel.length, start + block);
      var peak = 0;
      for (var index = start; index < end; index++) {
        peak = Math.max(peak, Math.abs(channel[index]));
      }
      peaks.push(peak);
    }

    if (context.close) await context.close();
    return peaks;
  }

  function renderNotes(list, notes, audio, labels) {
    list.innerHTML = "";
    if (!notes.length) {
      var empty = document.createElement("p");
      empty.className = "wave-empty";
      empty.textContent = labels.empty;
      list.appendChild(empty);
      return;
    }

    notes.forEach(function (note) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "wave-note";
      button.innerHTML = "<b>" + formatTime(note.time) + "</b><span></span>";
      button.querySelector("span").textContent = note.text;
      button.addEventListener("click", function () {
        audio.currentTime = note.time;
        audio.play().catch(function () {});
      });
      list.appendChild(button);
    });
  }

  function draw(canvas, peaks, progress) {
    var ratio = global.devicePixelRatio || 1;
    var width = Math.max(240, canvas.clientWidth || 480);
    var height = 92;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    var context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);

    var gap = 2;
    var barWidth = Math.max(1, width / peaks.length - gap);
    peaks.forEach(function (peak, index) {
      var x = index * (barWidth + gap);
      var barHeight = Math.max(3, peak * (height - 12));
      context.fillStyle = index / peaks.length <= progress ? "#5754e9" : "#cfd9ea";
      context.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
    });
  }

  async function mount(options) {
    var root = options.root;
    var audio = options.audio;
    var url = options.url;
    var notes = Array.isArray(options.notes) ? options.notes.slice() : [];
    var labels = options.labels;
    var canvas = root.querySelector("canvas");
    var current = root.querySelector("[data-wave-current]");
    var input = root.querySelector("[data-wave-note-input]");
    var add = root.querySelector("[data-wave-add]");
    var list = root.querySelector("[data-wave-notes]");
    var peaks;

    try {
      peaks = await decodePeaks(url, 96);
    } catch (error) {
      peaks = Array(96).fill(0.08);
      root.classList.add("wave-fallback");
      canvas.title = labels.unavailable || "Waveform unavailable";
    }

    function repaint() {
      var progress = audio.duration ? audio.currentTime / audio.duration : 0;
      draw(canvas, peaks, progress);
      current.textContent = formatTime(audio.currentTime);
    }

    canvas.addEventListener("click", function (event) {
      if (!audio.duration) return;
      var bounds = canvas.getBoundingClientRect();
      audio.currentTime = ((event.clientX - bounds.left) / bounds.width) * audio.duration;
      repaint();
    });

    root.querySelectorAll("[data-speed]").forEach(function (button) {
      button.addEventListener("click", function () {
        audio.playbackRate = Number(button.dataset.speed);
        root.querySelectorAll("[data-speed]").forEach(function (candidate) {
          candidate.classList.toggle("active", candidate === button);
        });
      });
    });

    add.addEventListener("click", async function () {
      var noteText = input.value.trim();
      if (!noteText) {
        input.focus();
        return;
      }
      notes.push({ time: Math.round(audio.currentTime * 10) / 10, text: noteText });
      notes.sort(function (a, b) {
        return a.time - b.time;
      });
      input.value = "";
      renderNotes(list, notes, audio, labels);
      if (options.onSave) await options.onSave(notes.slice());
    });

    audio.addEventListener("timeupdate", repaint);
    audio.addEventListener("loadedmetadata", repaint);
    if (global.ResizeObserver) {
      new ResizeObserver(repaint).observe(canvas);
    }
    renderNotes(list, notes, audio, labels);
    repaint();
  }

  global.WASL_WAVEFORM = { mount: mount, formatTime: formatTime };
})(window);
