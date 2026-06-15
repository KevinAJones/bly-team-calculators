/* ============================================================
   The Bly Team × eXp Realty — Business Plan Engine
   Wraps the commission SplitEngine and runs it IN REVERSE:
   from a take-home income goal back to closings, then to a
   listing/buyer production funnel and a weekly cadence.

   Depends on window.SplitEngine (engine.js, loaded first).
   ============================================================ */
(function (global) {
  "use strict";
  var E = global.SplitEngine;

  // eXp annual caps / flat fees (per transaction unless noted)
  var EXP_CAP        = 4000;  // TEAM-member company-dollar cap: 20% split stops once cumulative split hits this
  var RISK_FEE       = 40;    // risk-management fee, per tx, pre-cap
  var BROKER_REVIEW  = 25;    // flat per tx, always
  var POSTCAP_TX     = 250;   // per tx after capping, until $5k paid...
  var POSTCAP_TX_LO  = 75;    // ...then drops to $75 per tx
  var POSTCAP_FEE_CAP = 5000; // total post-cap tx fees before the rate drops
  var EXP_SPLIT_RATE = 0.20;
  var WEEKS_PER_MONTH = 52 / 12; // 4.333…

  // Map the friendly mix keys to the engine's lead-source names
  var SOURCE_KEYS = [
    { key: "soi",    name: "SOI Generated",    label: "Sphere / SOI" },
    { key: "office", name: "Office Generated", label: "Office" },
    { key: "zillow", name: "Zillow Preferred", label: "Zillow" },
  ];

  var STATE_DEFAULTS = {
    timeframe: 12,          // months
    incomeGoal: 100000,     // annual take-home target ($)
    avgPrice: 350000,
    commissionPct: 3.0,
    level: "2",
    listingPct: 50,         // % of closings that are listing (seller) side
    mixSOI: 50, mixOffice: 30, mixZillow: 20, // relative weights, normalized
    setHeldPct: 80,         // appt set -> held
    heldTakenPct: 80,       // held -> taken (signed)
    takenClosePct: 80,      // taken -> closed
    isaConverted: false,
    mentor: false,
    modelCap: true,         // model the eXp cap across the year
  };

  // ---- Formatters ----
  var fmtCurrency = function (n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0);
  };
  var fmtNum1 = function (n) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(isFinite(n) ? n : 0);
  };
  var fmtInt = function (n) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(isFinite(n) ? n : 0);
  };

  // Normalize the three lead-source weights to fractions summing to 1.
  function sourceWeights(s) {
    var raw = { soi: Math.max(0, s.mixSOI), office: Math.max(0, s.mixOffice), zillow: Math.max(0, s.mixZillow) };
    var sum = raw.soi + raw.office + raw.zillow;
    if (sum <= 0) return { soi: 1 / 3, office: 1 / 3, zillow: 1 / 3 };
    return { soi: raw.soi / sum, office: raw.office / sum, zillow: raw.zillow / sum };
  }

  // Blend the PERCENTAGE-based commission components across the
  // (source × side) mix. These don't depend on cap state — the cap only
  // touches the flat eXp company split + per-tx fees, handled in the sim.
  function blendedDeal(s) {
    var w = sourceWeights(s);
    var sellerW = clampPct(s.listingPct) / 100;
    var buyerW = 1 - sellerW;
    var sides = [
      { side: "Seller", w: sellerW },
      { side: "Buyer", w: buyerW },
    ];

    var acc = { gross: 0, agentBase: 0, office: 0, referral: 0, mentor: 0 };
    SOURCE_KEYS.forEach(function (src) {
      var sw = w[src.key];
      if (sw <= 0) return;
      sides.forEach(function (sd) {
        if (sd.w <= 0) return;
        var r = E.compute({
          price: s.avgPrice,
          commission: s.commissionPct / 100,
          leadSource: src.name,
          level: s.level,
          side: sd.side,
          isaConverted: s.isaConverted,
          mentor: s.mentor,
          cappedExp: false,
          cappedRisk: false,
          postCapFee: "N/A",
        });
        var ww = sw * sd.w;
        acc.gross    += ww * r.gross;
        acc.agentBase+= ww * r.agentBaseShare; // before mentor
        acc.office   += ww * r.officeShare;
        acc.referral += ww * r.zillowReferral;
        acc.mentor   += ww * r.mentorCut;
      });
    });
    acc.agentGross = acc.agentBase - acc.mentor; // agent's share after mentor, before eXp fees
    return acc;
  }

  function clampPct(v) { return Math.max(0, Math.min(100, v)); }

  // ---- Main: reverse from income goal to a full plan ----
  function computePlan(s) {
    var deal = blendedDeal(s);
    var grossPerDeal = deal.gross;
    var Wags = deal.agentGross;                 // weighted agent gross share / deal
    var companyPerDealPre = Wags * EXP_SPLIT_RATE;
    var goal = Math.max(0, s.incomeGoal);

    // Deal-by-deal simulation accumulating take-home until the goal is met.
    var cumCompany = 0, cumTake = 0, units = 0, postTxPaid = 0, capDeal = null;
    var agg = { gross: 0, office: 0, referral: 0, mentor: 0, company: 0, flat: 0, take: 0 };
    var GUARD = 2000;
    var preCapTake = Wags - companyPerDealPre - (RISK_FEE + BROKER_REVIEW);
    var unreachable = preCapTake <= 0 && !(s.modelCap); // can't ever reach goal

    while (cumTake < goal && units < GUARD) {
      units++;
      var company, flat, postTx = 0;
      var capActive = s.modelCap && cumCompany >= EXP_CAP;
      if (capActive) {
        company = 0;
        postTx = postTxPaid < POSTCAP_FEE_CAP ? POSTCAP_TX : POSTCAP_TX_LO;
        flat = BROKER_REVIEW + postTx;
        if (capDeal === null) capDeal = units;
      } else {
        if (s.modelCap) {
          var remaining = EXP_CAP - cumCompany;
          company = Math.min(companyPerDealPre, remaining);
          if (company < companyPerDealPre && capDeal === null) capDeal = units;
        } else {
          company = companyPerDealPre;
        }
        flat = RISK_FEE + BROKER_REVIEW;
      }
      var take = Wags - company - flat;
      // Guard against non-converging (deal nets ≤ 0): stop adding deals.
      if (take <= 0 && units > 1) { units--; unreachable = true; break; }

      cumCompany += company;
      cumTake += take;
      postTxPaid += postTx;
      agg.gross    += grossPerDeal;
      agg.office   += deal.office;
      agg.referral += deal.referral;
      agg.mentor   += deal.mentor;
      agg.company  += company;
      agg.flat     += flat;
      agg.take     += take;
    }

    var expFeesTotal = agg.company + agg.flat;
    var othersTotal = agg.office + agg.mentor; // team/office slice (mentor folded in, like the calc)
    var gci = agg.gross;
    var avgTakePerDeal = units > 0 ? agg.take / units : 0;
    var postCapTake = Wags - (BROKER_REVIEW + POSTCAP_TX); // a representative post-cap deal

    // ---- Production funnel (listing vs buyer) ----
    var sellerPct = clampPct(s.listingPct) / 100;
    var buyerPct = 1 - sellerPct;
    var rShow = s.setHeldPct > 0 ? s.setHeldPct / 100 : 0.01;
    var rTaken = s.heldTakenPct > 0 ? s.heldTakenPct / 100 : 0.01;
    var rClose = s.takenClosePct > 0 ? s.takenClosePct / 100 : 0.01;

    function funnel(unitShare) {
      var close = Math.ceil(units * unitShare);
      var take = Math.ceil(close / rClose);
      var held = Math.ceil(take / rTaken);
      var set = Math.ceil(held / rShow);
      return { close: close, take: take, held: held, set: set };
    }
    var L = funnel(sellerPct); L.gci = gci * sellerPct;
    var B = funnel(buyerPct);  B.gci = gci * buyerPct;

    // ---- Cadence ----
    var d = s.timeframe > 0 ? s.timeframe : 12;
    var monthly = {
      lClose: L.close / d, lTake: L.take / d, lHeld: L.held / d, lSet: L.set / d,
      bClose: B.close / d, bTake: B.take / d, bHeld: B.held / d, bSet: B.set / d,
    };
    var weekly = {
      totalSet: (L.set + B.set) / d / WEEKS_PER_MONTH,
      totalHeld: (L.held + B.held) / d / WEEKS_PER_MONTH,
      lHeld: (L.held / d) / WEEKS_PER_MONTH,
      bHeld: (B.held / d) / WEEKS_PER_MONTH,
      totalTaken: (L.take + B.take) / d / WEEKS_PER_MONTH,
    };

    return {
      units: units,
      unreachable: unreachable,
      gci: gci,
      avgComm: grossPerDeal,
      avgTakePerDeal: avgTakePerDeal,
      takeTotal: agg.take,
      goal: goal,
      // annual "where the commission goes"
      breakdown: {
        take: agg.take,
        expFees: expFeesTotal,
        office: othersTotal,
        referral: agg.referral,
        gross: gci,
      },
      cap: {
        modeled: !!s.modelCap,
        capDeal: capDeal,           // closing # at which the eXp split is met (null = never)
        preCapTake: preCapTake,
        postCapTake: postCapTake,
        uplift: postCapTake - preCapTake,
      },
      listings: L,
      buyers: B,
      monthly: monthly,
      weekly: weekly,
    };
  }

  global.BlyPlan = {
    STATE_DEFAULTS: STATE_DEFAULTS,
    SOURCE_KEYS: SOURCE_KEYS,
    sourceWeights: sourceWeights,
    computePlan: computePlan,
    fmtCurrency: fmtCurrency,
    fmtNum1: fmtNum1,
    fmtInt: fmtInt,
    LEVEL_LABELS: E.LEVEL_LABELS,
  };
})(window);
