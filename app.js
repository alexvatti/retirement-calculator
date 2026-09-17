/* ============================================================
   Retirement Corpus & SIP Gap Calculator
   Vanilla JavaScript — recalculates on every input change.
   ============================================================ */

(function () {
  "use strict";

  // Which lifestyle drives the KPI cards: "A" (present) or "B" (target)
  let selectedScenario = "B";

  // ---------- Element references ----------
  const els = {
    // inputs
    presentAge: document.getElementById("presentAge"),
    retirementAge: document.getElementById("retirementAge"),
    lifeExpectancy: document.getElementById("lifeExpectancy"),
    currentExpenses: document.getElementById("currentExpenses"),
    desiredExpenses: document.getElementById("desiredExpenses"),
    existingCorpus: document.getElementById("existingCorpus"),
    preReturn: document.getElementById("preReturn"),
    postReturn: document.getElementById("postReturn"),
    inflation: document.getElementById("inflation"),

    // slider value labels
    preReturnVal: document.getElementById("preReturnVal"),
    postReturnVal: document.getElementById("postReturnVal"),
    inflationVal: document.getElementById("inflationVal"),

    // KPI outputs
    kpiTargetCorpus: document.getElementById("kpiTargetCorpus"),
    kpiExistingFV: document.getElementById("kpiExistingFV"),
    kpiSip: document.getElementById("kpiSip"),
    kpiScenarioTag: document.getElementById("kpiScenarioTag"),

    // insight + progress
    insightText: document.getElementById("insightText"),
    insightBanner: document.getElementById("insightBanner"),
    coveragePct: document.getElementById("coveragePct"),
    coverageBar: document.getElementById("coverageBar"),

    // timeline stats
    statYearsToRetire: document.getElementById("statYearsToRetire"),
    statRetireDuration: document.getElementById("statRetireDuration"),
    statFirstMonthExpense: document.getElementById("statFirstMonthExpense"),
    statCorpusGap: document.getElementById("statCorpusGap"),

    // scenarios
    scnAMonthly: document.getElementById("scnAMonthly"),
    scnACorpus: document.getElementById("scnACorpus"),
    scnASip: document.getElementById("scnASip"),
    scnAExpense: document.getElementById("scnAExpense"),
    scnBMonthly: document.getElementById("scnBMonthly"),
    scnBCorpus: document.getElementById("scnBCorpus"),
    scnBSip: document.getElementById("scnBSip"),
    scnBExpense: document.getElementById("scnBExpense"),
    scenarioDiff: document.getElementById("scenarioDiff"),
  };

  // ---------- Formatting helpers ----------
  const inrFormatter = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  });

  function formatINR(value) {
    if (!isFinite(value) || isNaN(value)) return "₹0";
    return "₹" + inrFormatter.format(Math.round(value));
  }

  // Compact readable form for insights: ₹1.25 Cr / ₹45.30 L
  function formatCompactINR(value) {
    if (!isFinite(value) || isNaN(value) || value <= 0) return "₹0";
    if (value >= 1e7) return "₹" + (value / 1e7).toFixed(2) + " Cr";
    if (value >= 1e5) return "₹" + (value / 1e5).toFixed(2) + " L";
    return formatINR(value);
  }

  function num(el, fallback) {
    const v = parseFloat(el.value);
    return isNaN(v) ? fallback : v;
  }

  // ---------- Core financial math ----------
  //
  // Given a desired monthly expense (in today's value), this computes the
  // full plan: target corpus, existing corpus growth, gap and required SIP.
  //
  function computePlan(params) {
    const {
      yearsToRetire,
      retirementDuration,
      desiredMonthly,
      existingCorpus,
      preRate,   // decimal, e.g. 0.12
      postRate,  // decimal
      inflation, // decimal
    } = params;

    // 1) Future value of the desired MONTHLY expense at retirement
    //    (adjusted for inflation over the years left to retire).
    const futureMonthlyExpense =
      desiredMonthly * Math.pow(1 + inflation, yearsToRetire);
    const futureAnnualExpense = futureMonthlyExpense * 12;

    // 2) Real rate of return during retirement.
    //    ((1 + post) / (1 + inflation)) - 1
    const realRate = (1 + postRate) / (1 + inflation) - 1;

    // 3) Target corpus = Present Value of an Annuity DUE over the
    //    retirement duration (income drawn at the start of each year).
    let targetCorpus;
    if (retirementDuration <= 0) {
      targetCorpus = 0;
    } else if (Math.abs(realRate) < 1e-9) {
      // If real rate ~ 0, PV is simply expense * number of years.
      targetCorpus = futureAnnualExpense * retirementDuration;
    } else {
      const pvOrdinary =
        futureAnnualExpense *
        ((1 - Math.pow(1 + realRate, -retirementDuration)) / realRate);
      targetCorpus = pvOrdinary * (1 + realRate); // annuity-due adjustment
    }

    // 4) Future value of existing corpus, growing at the pre-retirement rate.
    const existingFV = existingCorpus * Math.pow(1 + preRate, yearsToRetire);

    // 5) Corpus gap.
    const corpusGap = Math.max(targetCorpus - existingFV, 0);

    // 6) Required monthly SIP via Future Value of an Annuity (ordinary).
    //    FV = SIP * [ ((1+i)^n - 1) / i ]
    const months = yearsToRetire * 12;
    const i = preRate / 12;
    let requiredSip = 0;
    if (corpusGap > 0 && months > 0) {
      if (Math.abs(i) < 1e-12) {
        requiredSip = corpusGap / months;
      } else {
        const factor = (Math.pow(1 + i, months) - 1) / i;
        requiredSip = corpusGap / factor;
      }
    }

    return {
      futureMonthlyExpense,
      futureAnnualExpense,
      realRate,
      targetCorpus,
      existingFV,
      corpusGap,
      requiredSip,
    };
  }

  // ---------- Pulse animation on value change ----------
  function setText(el, text) {
    if (el.textContent !== text) {
      el.textContent = text;
      el.classList.remove("value-pulse");
      // force reflow to restart animation
      void el.offsetWidth;
      el.classList.add("value-pulse");
    }
  }

  // ---------- Main recalculation ----------
  function recalc() {
    // Read + sanitize inputs
    let presentAge = num(els.presentAge, 45);
    let retirementAge = num(els.retirementAge, 50);
    let lifeExpectancy = num(els.lifeExpectancy, 80);
    const currentMonthly = Math.max(num(els.currentExpenses, 30000), 0);
    const desiredMonthly = Math.max(num(els.desiredExpenses, 50000), 0);
    const existingCorpus = Math.max(num(els.existingCorpus, 5000000), 0);
    const preRate = num(els.preReturn, 12) / 100;
    const postRate = num(els.postReturn, 8) / 100;
    const inflation = num(els.inflation, 6) / 100;

    // Update slider labels
    els.preReturnVal.textContent = num(els.preReturn, 12) + "%";
    els.postReturnVal.textContent = num(els.postReturn, 8) + "%";
    els.inflationVal.textContent = num(els.inflation, 6) + "%";

    // Derived timeline values (guarded)
    const yearsToRetire = Math.max(retirementAge - presentAge, 0);
    const retirementDuration = Math.max(lifeExpectancy - retirementAge, 0);

    const common = {
      yearsToRetire,
      retirementDuration,
      existingCorpus,
      preRate,
      postRate,
      inflation,
    };

    // Scenario A: present lifestyle, Scenario B: target lifestyle
    const scnA = computePlan({ ...common, desiredMonthly: currentMonthly });
    const scnB = computePlan({ ...common, desiredMonthly });

    // The KPI cards follow whichever lifestyle is currently selected.
    const plan = selectedScenario === "A" ? scnA : scnB;

    // ----- Render KPIs (based on selected lifestyle) -----
    setText(els.kpiTargetCorpus, formatINR(plan.targetCorpus));
    setText(els.kpiExistingFV, formatINR(plan.existingFV));
    setText(els.kpiSip, formatINR(plan.requiredSip));
    if (els.kpiScenarioTag) {
      els.kpiScenarioTag.textContent =
        selectedScenario === "A" ? "Present" : "Target";
    }

    // ----- Timeline stats -----
    setText(els.statYearsToRetire, String(yearsToRetire));
    setText(els.statRetireDuration, String(retirementDuration));
    setText(els.statFirstMonthExpense, formatINR(plan.futureMonthlyExpense));
    setText(els.statCorpusGap, formatINR(plan.corpusGap));

    // ----- Coverage progress -----
    let coverage = 0;
    if (plan.targetCorpus > 0) {
      coverage = Math.min((plan.existingFV / plan.targetCorpus) * 100, 100);
    }
    els.coveragePct.textContent = Math.round(coverage) + "%";
    els.coverageBar.style.width = coverage + "%";

    // ----- Scenario cards -----
    els.scnAMonthly.textContent = formatINR(currentMonthly);
    els.scnBMonthly.textContent = formatINR(desiredMonthly);

    setText(els.scnACorpus, formatCompactINR(scnA.targetCorpus));
    setText(els.scnASip, formatINR(scnA.requiredSip));
    setText(els.scnAExpense, formatINR(scnA.futureMonthlyExpense));

    setText(els.scnBCorpus, formatCompactINR(scnB.targetCorpus));
    setText(els.scnBSip, formatINR(scnB.requiredSip));
    setText(els.scnBExpense, formatINR(scnB.futureMonthlyExpense));

    // ----- Scenario difference note -----
    const sipDiff = scnB.requiredSip - scnA.requiredSip;
    const corpusDiff = scnB.targetCorpus - scnA.targetCorpus;
    if (currentMonthly === desiredMonthly) {
      els.scenarioDiff.textContent =
        "Both scenarios are identical because your target spending matches today's spending.";
    } else if (desiredMonthly > currentMonthly) {
      els.scenarioDiff.textContent =
        "Upgrading to your target lifestyle needs about " +
        formatCompactINR(corpusDiff) +
        " more corpus, which is roughly " +
        formatINR(Math.max(sipDiff, 0)) +
        " extra every month in SIPs.";
    } else {
      els.scenarioDiff.textContent =
        "Your target lifestyle is more modest than today's, saving you about " +
        formatCompactINR(Math.abs(corpusDiff)) +
        " in required corpus.";
    }

    // ----- Friendly insight banner -----
    els.insightText.innerHTML = buildInsight({
      yearsToRetire,
      retirementDuration,
      plan,
      presentAge,
      retirementAge,
      lifeExpectancy,
    });
  }

  // ---------- Plain-language insight ----------
  function buildInsight(ctx) {
    const { yearsToRetire, retirementDuration, plan } = ctx;

    if (ctx.retirementAge <= ctx.presentAge) {
      return "Your retirement age should be greater than your current age. Please adjust the ages to see your plan.";
    }
    if (ctx.lifeExpectancy <= ctx.retirementAge) {
      return "Life expectancy should be greater than your retirement age so we can plan your retirement years.";
    }

    if (plan.corpusGap <= 0) {
      return (
        "<span class='font-semibold text-emerald-700'>You're on track!</span> " +
        "Your existing savings are projected to grow to " +
        "<span class='font-semibold'>" + formatCompactINR(plan.existingFV) + "</span>, " +
        "which already covers your target corpus of " +
        "<span class='font-semibold'>" + formatCompactINR(plan.targetCorpus) + "</span>. " +
        "No additional monthly investment is strictly required."
      );
    }

    return (
      "To retire in <span class='font-semibold'>" + yearsToRetire + " years</span> and " +
      "fund <span class='font-semibold'>" + retirementDuration + " years</span> of retirement, " +
      "you'll need about <span class='font-semibold'>" + formatCompactINR(plan.targetCorpus) + "</span>. " +
      "Your current savings grow to <span class='font-semibold'>" + formatCompactINR(plan.existingFV) + "</span>, " +
      "leaving a gap of <span class='font-semibold'>" + formatCompactINR(plan.corpusGap) + "</span>. " +
      "Invest about <span class='font-semibold text-emerald-700'>" + formatINR(plan.requiredSip) + "/month</span> to close it."
    );
  }

  // ---------- Wire up events ----------
  const watched = [
    "presentAge", "retirementAge", "lifeExpectancy",
    "currentExpenses", "desiredExpenses", "existingCorpus",
    "preReturn", "postReturn", "inflation",
  ];
  watched.forEach(function (id) {
    const el = els[id];
    el.addEventListener("input", recalc);
    el.addEventListener("change", recalc);
  });

  // ---------- Lifestyle card selection (highlight when chosen) ----------
  const scenarioA = document.getElementById("scenarioA");
  const scenarioB = document.getElementById("scenarioB");

  function selectScenario(key) {
    selectedScenario = key;
    if (scenarioA) scenarioA.classList.toggle("selected", key === "A");
    if (scenarioB) scenarioB.classList.toggle("selected", key === "B");
    recalc(); // refresh KPI cards to match the chosen lifestyle
  }

  if (scenarioA) scenarioA.addEventListener("click", function () { selectScenario("A"); });
  if (scenarioB) scenarioB.addEventListener("click", function () { selectScenario("B"); });

  // Target lifestyle chosen by default
  selectScenario("B");
})();
