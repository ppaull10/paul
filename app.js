/**
 * 筆順練習 — Stroke Order App
 * Traditional Chinese character stroke order animation & quiz
 */

(function () {
  'use strict';

  // ─── DOM References ───────────────────────────────
  const charInput     = document.getElementById('char-input');
  const btnSearch     = document.getElementById('btn-search');
  const writerContainer = document.getElementById('writer-container');
  const placeholder   = document.getElementById('placeholder');
  const controls      = document.getElementById('controls');
  const infoPanel     = document.getElementById('info-panel');

  const btnAnimate    = document.getElementById('btn-animate');
  const btnLoop       = document.getElementById('btn-loop');
  const btnQuiz       = document.getElementById('btn-quiz');
  const btnRadical    = document.getElementById('btn-radical');
  const speedSlider   = document.getElementById('speed-slider');
  const speedValue    = document.getElementById('speed-value');
  const themeToggle   = document.getElementById('theme-toggle');
  const quizFeedback  = document.getElementById('quiz-feedback');
  const toast         = document.getElementById('toast');

  const infoChar      = document.getElementById('info-char');
  const infoStrokes   = document.getElementById('info-strokes');
  const infoRadical   = document.getElementById('info-radical');
  const infoStatus    = document.getElementById('info-status');

  // ─── State ────────────────────────────────────────
  let writers = [];           // HanziWriter instances
  let currentChars = '';
  let isLooping = false;
  let isQuizMode = false;
  let showRadical = false;
  let animSpeed = 1;

  // ─── Theme ────────────────────────────────────────
  function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      themeToggle.textContent = saved === 'light' ? '☀️' : '🌙';
    }
  }

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    themeToggle.textContent = next === 'light' ? '☀️' : '🌙';
  });

  // ─── Helpers ──────────────────────────────────────

  /** Check if a character is likely CJK */
  function isCJK(ch) {
    const code = ch.codePointAt(0);
    return (
      (code >= 0x4E00  && code <= 0x9FFF)  || // CJK Unified
      (code >= 0x3400  && code <= 0x4DBF)  || // CJK Extension A
      (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
      (code >= 0xF900  && code <= 0xFAFF)  || // CJK Compat
      (code >= 0x2F800 && code <= 0x2FA1F)    // CJK Compat Supplement
    );
  }

  /** Show a toast message */
  function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = 'toast' + (type ? ` toast--${type}` : '');
    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  /** Set quiz feedback text */
  function setQuizFeedback(text, type) {
    quizFeedback.textContent = text;
    quizFeedback.className = 'quiz-feedback visible' + (type ? ` quiz-feedback--${type}` : '');
    clearTimeout(quizFeedback._timer);
    quizFeedback._timer = setTimeout(() => {
      quizFeedback.classList.remove('visible');
    }, 2000);
  }

  // ─── Writer Size ──────────────────────────────────
  function getWriterSize() {
    const vw = window.innerWidth;
    if (vw <= 400) return 140;
    if (vw <= 640) return 160;
    return 200;
  }

  // ─── Core: Create Writers ─────────────────────────
  function loadCharacters(chars) {
    // Clean up existing
    destroyWriters();

    const filtered = [...chars].filter(isCJK);

    if (filtered.length === 0) {
      showToast('유효한 한자를 입력해 주세요', 'error');
      return;
    }

    currentChars = filtered.join('');
    const size = getWriterSize();

    // Show UI
    placeholder.classList.add('hidden');
    writerContainer.classList.remove('hidden');
    controls.classList.remove('hidden');
    infoPanel.classList.remove('hidden');

    // Clear container
    writerContainer.innerHTML = '';

    filtered.forEach((ch, i) => {
      // Create wrapper
      const box = document.createElement('div');
      box.className = 'writer-box scale-in';
      box.style.animationDelay = `${i * 80}ms`;
      box.id = `writer-target-${i}`;

      const label = document.createElement('span');
      label.className = 'writer-box__label';
      label.textContent = `${i + 1}`;
      box.appendChild(label);

      writerContainer.appendChild(box);

      // Create HanziWriter instance
      try {
        const writer = HanziWriter.create(`writer-target-${i}`, ch, {
          width: size - 20,
          height: size - 20,
          padding: 8,
          showOutline: true,
          showCharacter: true,
          strokeColor: getStrokeColor(),
          outlineColor: getOutlineColor(),
          radicalColor: showRadical ? '#06b6d4' : undefined,
          strokeAnimationSpeed: animSpeed,
          delayBetweenStrokes: 300 / animSpeed,
          drawingColor: '#8b5cf6',
          drawingWidth: 6,
          showHintAfterMisses: 3,
          highlightOnComplete: true,
          charDataLoader: function (char, onComplete) {
            // Use the default CDN loader
            fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${char}.json`)
              .then(res => {
                if (!res.ok) throw new Error('Character not found');
                return res.json();
              })
              .then(data => onComplete(data))
              .catch(() => {
                showToast(`'${char}' 의 획순 데이터를 찾을 수 없습니다`, 'error');
                box.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              });
          },
          onLoadCharDataSuccess: function (data) {
            // Update info panel for first character
            if (i === 0) {
              infoChar.textContent = ch;
              infoStrokes.textContent = data.strokes.length;
              infoRadical.textContent = data.radStrokes ? '✓' : '—';
              infoStatus.textContent = '준비됨';
            }
          }
        });
        writers.push({ writer, char: ch, element: box });
      } catch (err) {
        showToast(`'${ch}' 로드 중 오류 발생`, 'error');
      }
    });
  }

  function destroyWriters() {
    writers.forEach(({ element }) => {
      // Remove SVG content
      const svgs = element.querySelectorAll('svg');
      svgs.forEach(svg => svg.remove());
    });
    writers = [];
    writerContainer.innerHTML = '';
  }

  // ─── Theme-aware colors ───────────────────────────
  function getStrokeColor() {
    const theme = document.documentElement.getAttribute('data-theme');
    return theme === 'light' ? '#1f2937' : '#e5e7eb';
  }

  function getOutlineColor() {
    const theme = document.documentElement.getAttribute('data-theme');
    return theme === 'light' ? '#d1d5db' : '#374151';
  }

  // ─── Animation ────────────────────────────────────
  function animateAll() {
    if (writers.length === 0) return;

    // Reset status
    infoStatus.textContent = '재생 중…';

    // Mark first as active
    writers.forEach(w => w.element.classList.remove('active'));
    if (writers[0]) writers[0].element.classList.add('active');

    // Chain animations
    function animateAt(index) {
      if (index >= writers.length) {
        infoStatus.textContent = '완료';
        writers.forEach(w => w.element.classList.remove('active'));
        if (isLooping) {
          setTimeout(() => animateAll(), 600);
        }
        return;
      }
      writers.forEach(w => w.element.classList.remove('active'));
      writers[index].element.classList.add('active');

      writers[index].writer.animateCharacter({
        onComplete: () => animateAt(index + 1)
      });
    }

    animateAt(0);
  }

  // ─── Quiz Mode ────────────────────────────────────
  function startQuiz() {
    if (writers.length === 0) return;

    isQuizMode = true;
    btnQuiz.classList.add('active');
    infoStatus.textContent = '퀴즈 모드';

    writers.forEach(({ writer, element }, index) => {
      element.classList.add('active');
      writer.quiz({
        onMistake: (strokeData) => {
          setQuizFeedback(`오답! 다시 시도해 주세요 (획 ${strokeData.strokeNum + 1})`, 'mistake');
        },
        onCorrectStroke: (strokeData) => {
          setQuizFeedback(`정답! 획 ${strokeData.strokeNum + 1} ✓`, 'correct');
        },
        onComplete: (summaryData) => {
          element.classList.remove('active');
          const total = summaryData.totalMistakes;
          if (total === 0) {
            setQuizFeedback('완벽합니다! 🎉', 'correct');
            showToast('모든 획을 정확히 작성했습니다!', 'success');
          } else {
            setQuizFeedback(`완료! 오답: ${total}회`, 'mistake');
          }
          infoStatus.textContent = '퀴즈 완료';
        }
      });
    });
  }

  function stopQuiz() {
    isQuizMode = false;
    btnQuiz.classList.remove('active');
    // Re-render characters
    if (currentChars) loadCharacters(currentChars);
    infoStatus.textContent = '준비됨';
  }

  // ─── Event Listeners ──────────────────────────────

  // Search / Load
  btnSearch.addEventListener('click', () => {
    const val = charInput.value.trim();
    if (!val) {
      showToast('한자를 입력해 주세요', 'error');
      charInput.focus();
      return;
    }
    loadCharacters(val);
  });

  charInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnSearch.click();
    }
  });

  // Animate
  btnAnimate.addEventListener('click', () => {
    if (isQuizMode) stopQuiz();
    animateAll();
  });

  // Loop toggle
  btnLoop.addEventListener('click', () => {
    isLooping = !isLooping;
    btnLoop.classList.toggle('active', isLooping);
    if (isLooping) {
      showToast('반복 재생 켜짐', 'success');
      animateAll();
    } else {
      showToast('반복 재생 꺼짐');
    }
  });

  // Quiz toggle
  btnQuiz.addEventListener('click', () => {
    if (isQuizMode) {
      stopQuiz();
    } else {
      startQuiz();
    }
  });

  // Speed slider
  speedSlider.addEventListener('input', () => {
    animSpeed = parseFloat(speedSlider.value);
    speedValue.textContent = `${animSpeed}×`;

    // Update existing writers
    writers.forEach(({ writer }) => {
      writer.updateDimensions({
        strokeAnimationSpeed: animSpeed
      });
    });
  });

  // Radical toggle
  btnRadical.addEventListener('click', () => {
    showRadical = !showRadical;
    btnRadical.classList.toggle('active', showRadical);

    if (currentChars) {
      loadCharacters(currentChars);
    }

    showToast(showRadical ? '부수 하이라이트 켜짐' : '부수 하이라이트 꺼짐');
  });

  // ─── Init ─────────────────────────────────────────
  initTheme();

  // Focus input on page load
  setTimeout(() => charInput.focus(), 500);

})();
