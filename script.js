/* =============================================================
   WaterSafe Campus — script.js
   Vanilla JS only. Organized into labeled sections below.
   ============================================================= */

(function () {
  'use strict';

  var STORAGE_KEY = 'watersafe_reports';

  // ===========================================================
  // Utility helpers
  // ===========================================================

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generateReportId(existingCount) {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var seq = String(existingCount + 1).padStart(3, '0');
    return 'WS-' + y + m + d + '-' + seq;
  }

  // ===========================================================
  // Navigation (sticky nav + mobile hamburger menu)
  // ===========================================================

  function initNavigation() {
    var hamburger = document.getElementById('hamburger');
    var navMenu = document.getElementById('nav-menu');
    if (!hamburger || !navMenu) return;

    hamburger.addEventListener('click', function () {
      var isOpen = navMenu.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    var links = navMenu.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function () {
        navMenu.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    }
  }

  // ===========================================================
  // Water point URL detection (simulates scanning a QR code)
  // A link like index.html?point=07 should pre-select WP-07.
  // Invalid or missing values fall back to manual selection.
  // ===========================================================

  function initQrDetection() {
    var select = document.getElementById('water-point');
    var banner = document.getElementById('qr-banner');
    var bannerText = document.getElementById('qr-banner-text');
    var bannerClear = document.getElementById('qr-banner-clear');
    if (!select || !banner || !bannerText) return null;

    var matchedValue = null;

    try {
      var params = new URLSearchParams(window.location.search);
      var raw = params.get('point');
      if (raw) {
        var padded = raw.trim().padStart(2, '0');
        var option = select.querySelector('option[value="' + padded + '"]');
        if (option) {
          select.value = padded;
          bannerText.textContent = option.textContent.trim();
          banner.classList.remove('hidden');
          matchedValue = padded;
        }
        // Unknown point codes (e.g. ?point=99) are ignored gracefully —
        // the page simply falls back to manual selection below.
      }
    } catch (err) {
      // Malformed URL — fall back to manual selection.
    }

    if (bannerClear) {
      bannerClear.addEventListener('click', function () {
        banner.classList.add('hidden');
        select.value = '';
        select.focus();
      });
    }

    select.addEventListener('change', function () {
      if (select.value !== matchedValue) {
        banner.classList.add('hidden');
      }
    });

    return matchedValue;
  }

  // ===========================================================
  // Photo preview (FileReader — nothing is uploaded anywhere)
  // ===========================================================

  function initPhotoPreview() {
    var input = document.getElementById('photo');
    var wrap = document.getElementById('photo-preview-wrap');
    var img = document.getElementById('photo-preview');
    var removeBtn = document.getElementById('photo-remove');
    var errorMsg = document.getElementById('photo-error');
    if (!input) return;

    input.addEventListener('change', function () {
      errorMsg.classList.add('hidden');
      var file = input.files && input.files[0];
      if (!file) return;

      if (!file.type || file.type.indexOf('image/') !== 0) {
        errorMsg.classList.remove('hidden');
        input.value = '';
        wrap.classList.add('hidden');
        return;
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        img.src = e.target.result;
        wrap.classList.remove('hidden');
      };
      reader.onerror = function () {
        errorMsg.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        input.value = '';
        img.src = '';
        wrap.classList.add('hidden');
      });
    }
  }

  // ===========================================================
  // LocalStorage handling (safe read/write, key: watersafe_reports)
  // ===========================================================

  function getReports() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      // Corrupted or unavailable storage — treat as empty rather than break the page.
      return [];
    }
  }

  function saveReports(reports) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
      return true;
    } catch (err) {
      return false;
    }
  }

  // ===========================================================
  // Report form handling
  // ===========================================================

  function initReportForm() {
    var form = document.getElementById('report-form');
    if (!form) return;

    var select = document.getElementById('water-point');
    var otherCheckbox = document.getElementById('issue-other');
    var otherWrap = document.getElementById('other-text-wrap');
    var otherText = document.getElementById('other-text');
    var descriptionEl = document.getElementById('description');
    var errorsBox = document.getElementById('form-errors');
    var successCard = document.getElementById('success-card');
    var photoInput = document.getElementById('photo');
    var photoPreviewWrap = document.getElementById('photo-preview-wrap');
    var qrBanner = document.getElementById('qr-banner');

    otherCheckbox.addEventListener('change', function () {
      otherWrap.classList.toggle('hidden', !otherCheckbox.checked);
      if (!otherCheckbox.checked) otherText.value = '';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorsBox.classList.add('hidden');
      errorsBox.innerHTML = '';

      var pointValue = select.value;
      var checkedBoxes = Array.prototype.slice.call(form.querySelectorAll('input[name="issue"]:checked'));
      var checkedIssues = checkedBoxes.map(function (cb) { return cb.value; });

      var errors = [];
      if (!pointValue) errors.push('Please select a water point.');
      if (checkedIssues.length === 0) errors.push('Please select at least one issue.');
      if (otherCheckbox.checked && !otherText.value.trim()) errors.push('Please describe the "Other" issue.');

      if (errors.length > 0) {
        errorsBox.innerHTML = '<ul>' + errors.map(function (m) { return '<li>' + escapeHtml(m) + '</li>'; }).join('') + '</ul>';
        errorsBox.classList.remove('hidden');
        return;
      }

      var pointOption = select.options[select.selectedIndex];
      var pointName = pointOption.textContent.trim();
      var issueLabels = checkedIssues.map(function (v) {
        return (v === 'Other' && otherText.value.trim()) ? 'Other (' + otherText.value.trim() + ')' : v;
      });

      var reports = getReports();
      var id = generateReportId(reports.length);
      var report = {
        id: id,
        waterPointId: pointValue,
        waterPointName: pointName,
        issues: issueLabels,
        description: descriptionEl.value.trim(),
        date: new Date().toISOString(),
        status: 'Pending Review',
        hasPhoto: !!(photoInput.files && photoInput.files.length > 0)
      };

      reports.push(report);
      saveReports(reports);

      document.getElementById('success-id').textContent = id;
      document.getElementById('success-point').textContent = pointName;
      document.getElementById('success-issue').textContent = issueLabels.join(', ');

      form.classList.add('hidden');
      successCard.classList.remove('hidden');

      var search = document.getElementById('report-search');
      renderReportsList(search ? search.value : '');
    });

    var submitAnotherBtn = document.getElementById('submit-another');
    if (submitAnotherBtn) {
      submitAnotherBtn.addEventListener('click', function () {
        form.reset();
        otherWrap.classList.add('hidden');
        photoPreviewWrap.classList.add('hidden');
        if (qrBanner) qrBanner.classList.add('hidden');
        successCard.classList.add('hidden');
        form.classList.remove('hidden');
      });
    }
  }

  // ===========================================================
  // Dashboard rendering (sample stats are static HTML; the
  // "reports submitted in this browser" list below is dynamic)
  // ===========================================================

  function renderReportsList(filterText) {
    var container = document.getElementById('reports-list');
    if (!container) return;

    var reports = getReports().slice().reverse();
    var filter = (filterText || '').trim().toLowerCase();

    var filtered = filter
      ? reports.filter(function (r) {
          var haystack = (r.waterPointName + ' ' + r.waterPointId + ' ' + r.issues.join(' ')).toLowerCase();
          return haystack.indexOf(filter) !== -1;
        })
      : reports;

    if (reports.length === 0) {
      container.innerHTML = '<p class="reports-empty">No reports submitted yet in this browser. Submit one above to see it appear here.</p>';
      return;
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p class="reports-empty">No reports match your search.</p>';
      return;
    }

    container.innerHTML = filtered.map(function (r) {
      var dateStr = '';
      try { dateStr = new Date(r.date).toLocaleString(); } catch (err) { dateStr = ''; }
      return '<div class="report-item">' +
        '<span class="report-id">' + escapeHtml(r.id) + '</span>' +
        '<span>' + escapeHtml(r.waterPointName) + '</span>' +
        '<span>' + escapeHtml(r.issues.join(', ')) + '</span>' +
        '<span class="report-date">' + escapeHtml(dateStr) + '</span>' +
        '<span class="report-status">' + escapeHtml(r.status) + '</span>' +
        '</div>';
    }).join('');
  }

  function initDashboard() {
    renderReportsList('');

    var search = document.getElementById('report-search');
    if (search) {
      search.addEventListener('input', function () {
        renderReportsList(search.value);
      });
    }

    var resetBtn = document.getElementById('reset-demo');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        var confirmed = window.confirm('This clears all reports submitted in this browser. Continue?');
        if (!confirmed) return;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
          // Ignore — re-render below will show the empty state regardless.
        }
        renderReportsList(search ? search.value : '');
      });
    }
  }

  // ===========================================================
  // Quiz logic
  // ===========================================================

  var QUIZ_QUESTIONS = [
    {
      q: 'Does clear, odourless water automatically prove it is safe to drink?',
      options: [
        'Yes, appearance and smell are reliable safety tests',
        'No, some contaminants have no taste, smell or colour',
        'Only if it comes from a tap',
        'Yes, but only in cold climates'
      ],
      correct: 1
    },
    {
      q: 'What does TDS (Total Dissolved Solids) represent?',
      options: [
        'The amount of bacteria present in the water',
        'The combined concentration of dissolved minerals and salts',
        'The acidity level of the water',
        'The temperature of the water'
      ],
      correct: 1
    },
    {
      q: 'Which category of contaminant includes bacteria, viruses and parasites?',
      options: ['Chemical contaminants', 'Microbiological contaminants', 'Physical contaminants', 'Radiological contaminants'],
      correct: 1
    },
    {
      q: 'Why is turbidity (cloudiness) monitored in drinking water?',
      options: [
        'It has no real significance for water quality',
        'High turbidity can shield microorganisms from disinfection and can signal an upstream problem',
        'It measures how hard the water is',
        'It only affects colour, nothing else'
      ],
      correct: 1
    },
    {
      q: 'Why does proper storage of drinking water matter?',
      options: [
        'Treated water can still become contaminated during storage and handling',
        'Once water is treated, it can never become unsafe again',
        'Storage only affects taste, never safety',
        'Storage matters only for bottled water'
      ],
      correct: 0
    },
    {
      q: 'Why is laboratory testing important even when water looks fine?',
      options: [
        'Testing is mostly a formality with little real value',
        "Many contaminants can't be detected by sight, taste or smell alone",
        'Testing is only needed after a visible problem appears',
        'Testing replaces the need for proper storage'
      ],
      correct: 1
    },
    {
      q: 'Which of the following can damage or contaminate a drinking-water point?',
      options: [
        'Cracked pipes and damaged infrastructure',
        'Routine cleaning of dispensers',
        'Covering storage containers',
        'Reporting a problem promptly'
      ],
      correct: 0
    },
    {
      q: 'What should a student do after noticing a problem at a water point?',
      options: [
        'Ignore it if the water still looks normal',
        'Report the issue and avoid relying only on appearance or taste',
        'Wait for someone else to notice it first',
        'Drink from a different point without telling anyone'
      ],
      correct: 1
    },
    {
      q: 'What is the main purpose of testing for indicator bacteria such as E. coli?',
      options: [
        "To measure the water's temperature",
        'To flag possible faecal contamination without testing for every pathogen individually',
        "To determine the water's mineral content",
        'To check how the water tastes'
      ],
      correct: 1
    },
    {
      q: 'Which statement about parameters like pH and TDS is most accurate?',
      options: [
        'Any one of them alone can confirm water is completely safe',
        'Each gives useful information, but none can alone prove water is fully safe',
        'They are irrelevant to drinking water safety',
        'They only matter for swimming pools'
      ],
      correct: 1
    }
  ];

  function initQuiz() {
    var container = document.getElementById('quiz-questions');
    var form = document.getElementById('quiz-form');
    var errorBox = document.getElementById('quiz-error');
    var resultBox = document.getElementById('quiz-result');
    var scoreEl = document.getElementById('quiz-score');
    var messageEl = document.getElementById('quiz-message');
    var retakeBtn = document.getElementById('quiz-retake');
    if (!container || !form) return;

    container.innerHTML = QUIZ_QUESTIONS.map(function (item, i) {
      var options = item.options.map(function (opt, j) {
        var id = 'q' + i + '-o' + j;
        return '<label class="quiz-option" for="' + id + '">' +
          '<input type="radio" id="' + id + '" name="q' + i + '" value="' + j + '">' +
          '<span>' + escapeHtml(opt) + '</span></label>';
      }).join('');
      return '<div class="quiz-question">' +
        '<p>' + (i + 1) + '. ' + escapeHtml(item.q) + '</p>' +
        '<div class="quiz-options">' + options + '</div>' +
        '</div>';
    }).join('');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var answeredAll = true;
      var score = 0;

      QUIZ_QUESTIONS.forEach(function (item, i) {
        var selected = form.querySelector('input[name="q' + i + '"]:checked');
        if (!selected) {
          answeredAll = false;
          return;
        }
        if (parseInt(selected.value, 10) === item.correct) score++;
      });

      if (!answeredAll) {
        errorBox.classList.remove('hidden');
        return;
      }
      errorBox.classList.add('hidden');

      scoreEl.textContent = score + '/' + QUIZ_QUESTIONS.length;
      var message;
      if (score >= 8) {
        message = 'Strong awareness of basic drinking-water safety concepts.';
      } else if (score >= 5) {
        message = 'Good start. Reviewing the Water Safety section can strengthen your understanding.';
      } else {
        message = 'Use the Water Safety section to build your understanding of contamination, testing and safe handling.';
      }
      messageEl.textContent = message;

      form.classList.add('hidden');
      resultBox.classList.remove('hidden');
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    if (retakeBtn) {
      retakeBtn.addEventListener('click', function () {
        form.reset();
        errorBox.classList.add('hidden');
        resultBox.classList.add('hidden');
        form.classList.remove('hidden');
      });
    }
  }

  // ===========================================================
  // Init
  // ===========================================================

  document.addEventListener('DOMContentLoaded', function () {
    initNavigation();
    initPhotoPreview();
    initQrDetection();
    initReportForm();
    initDashboard();
    initQuiz();
  });
})();