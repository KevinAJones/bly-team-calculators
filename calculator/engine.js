/* ============================================================
   The Bly Team × eXp Realty — Commission Split Engine
   Single source of truth. Mirrors "Bly Team Commission Splits.xlsx".
   ============================================================ */
(function (global) {
  "use strict";

  // --- Reference matrix: [leadSource, level, side] -> { office, agent } ---
  // Levels: "3", "2", "1", "new5" (1st 5 deals brand new), "exp3" (experienced, 1st 3 deals), "all" (leases)
  const REFERENCE = [
    // Zillow Preferred
    ["Zillow Preferred", "3",    "Buyer",  0.40, 0.60],
    ["Zillow Preferred", "3",    "Seller", 0.50, 0.50],
    ["Zillow Preferred", "2",    "Buyer",  0.40, 0.60],
    ["Zillow Preferred", "2",    "Seller", 0.50, 0.50],
    ["Zillow Preferred", "1",    "Buyer",  0.45, 0.55],
    ["Zillow Preferred", "1",    "Seller", 0.50, 0.50],
    ["Zillow Preferred", "new5", "Buyer",  0.50, 0.50],
    ["Zillow Preferred", "new5", "Seller", 0.50, 0.50],
    ["Zillow Preferred", "exp3", "Buyer",  0.50, 0.50],
    ["Zillow Preferred", "exp3", "Seller", 0.50, 0.50],
    // Office Generated
    ["Office Generated", "3",    "Buyer",  0.40, 0.60],
    ["Office Generated", "3",    "Seller", 0.45, 0.55],
    ["Office Generated", "2",    "Buyer",  0.45, 0.55],
    ["Office Generated", "2",    "Seller", 0.50, 0.50],
    ["Office Generated", "1",    "Buyer",  0.50, 0.50],
    ["Office Generated", "1",    "Seller", 0.55, 0.45],
    ["Office Generated", "new5", "Buyer",  0.50, 0.50],
    ["Office Generated", "new5", "Seller", 0.50, 0.50],
    ["Office Generated", "exp3", "Buyer",  0.50, 0.50],
    ["Office Generated", "exp3", "Seller", 0.50, 0.50],
    // SOI Generated
    ["SOI Generated",    "3",    "Buyer",  0.25, 0.75],
    ["SOI Generated",    "3",    "Seller", 0.30, 0.70],
    ["SOI Generated",    "2",    "Buyer",  0.35, 0.65],
    ["SOI Generated",    "2",    "Seller", 0.40, 0.60],
    ["SOI Generated",    "1",    "Buyer",  0.40, 0.60],
    ["SOI Generated",    "1",    "Seller", 0.45, 0.55],
    ["SOI Generated",    "new5", "Buyer",  0.50, 0.50],
    ["SOI Generated",    "new5", "Seller", 0.50, 0.50],
    ["SOI Generated",    "exp3", "Buyer",  0.50, 0.50],
    ["SOI Generated",    "exp3", "Seller", 0.50, 0.50],
    // Leases
    ["Leases",           "all",  "Buyer",  0.30, 0.70],
    ["Leases",           "all",  "Seller", 0.35, 0.65],
  ];

  // Which levels are valid for each lead source (drives dependent dropdowns)
  const LEVELS_BY_SOURCE = {
    "Zillow Preferred": ["3", "2", "1", "new5", "exp3"],
    "Office Generated": ["3", "2", "1", "new5", "exp3"],
    "SOI Generated":    ["3", "2", "1", "new5", "exp3"],
    "Leases":           ["all"],
  };

  const LEAD_SOURCES = ["Zillow Preferred", "Office Generated", "SOI Generated", "Leases"];

  const LEVEL_LABELS = {
    "3":    "Level 3",
    "2":    "Level 2",
    "1":    "Level 1",
    "new5": "Brand-new agent — first 5 deals",
    "exp3": "Experienced agent — first 3 deals",
    "all":  "All leases",
  };

  const POST_CAP_FEES = {
    "N/A":     0,
    "$250/tx": 250,
    "$75/tx":  75,
  };

  // Constants
  const EXP_SPLIT_RATE   = 0.20; // 20% of the agent's gross share, pre-cap
  const RISK_MGMT_FEE    = 40;   // per transaction, pre-cap
  const BROKER_REVIEW    = 25;   // flat per transaction
  const ISA_SHIFT        = 0.05; // ISA-converted lead shifts 5% agent -> office
  const MENTOR_SHARE     = 0.15; // mentor takes 15% of gross (out of agent's split)
  const ZILLOW_REFERRAL  = 0.40; // Zillow Preferred referral — taken off the top before splits
  const LEASE_RATE       = 0.50; // lease commission = 50% of one month's rent

  function lookup(leadSource, level, side) {
    const row = REFERENCE.find(
      (r) => r[0] === leadSource && r[1] === level && r[2] === side
    );
    if (!row) return { office: 0.5, agent: 0.5, found: false };
    return { office: row[3], agent: row[4], found: true };
  }

  /**
   * Compute a full commission breakdown.
   * @param {Object} i - inputs
   * @param {number} i.price        closing price ($)
   * @param {number} i.commission   commission rate (decimal, e.g. 0.03)
   * @param {string} i.leadSource
   * @param {string} i.level
   * @param {string} i.side         "Buyer" | "Seller"
   * @param {boolean} i.isaConverted
   * @param {boolean} i.mentor
   * @param {boolean} i.cappedExp   eXp company split capped?
   * @param {boolean} i.cappedRisk  risk-mgmt fee capped?
   * @param {string} i.postCapFee   "N/A" | "$250/tx" | "$75/tx"
   */
  function compute(i) {
    const base = lookup(i.leadSource, i.level, i.side);

    // Base agent / office split. ISA shifts 5% from agent to office. Mentor is NOT here.
    const agentPct = base.agent + (i.isaConverted ? -ISA_SHIFT : 0);
    const officePct = base.office + (i.isaConverted ? ISA_SHIFT : 0);

    const isLease = i.leadSource === "Leases";
    // Sale: gross = price × commission. Lease: gross = one month's rent × 50%.
    const gross = isLease
      ? (i.price || 0) * LEASE_RATE
      : (i.price || 0) * (i.commission || 0);

    // Zillow Preferred takes 40% off the top before any agent/office split.
    const referralRate = i.leadSource === "Zillow Preferred" ? ZILLOW_REFERRAL : 0;
    const zillowReferral = gross * referralRate;
    const splitBase = gross - zillowReferral;     // amount the splits actually apply to

    const agentBaseShare = splitBase * agentPct;   // agent's portion before mentor
    const officeShare = splitBase * officePct;     // team/office slice
    const mentorCut = i.mentor ? agentBaseShare * MENTOR_SHARE : 0; // 15% of the agent's portion
    const agentGrossShare = agentBaseShare - mentorCut; // agent's portion after mentor, before eXp fees

    const expCompanySplit = i.cappedExp ? 0 : agentGrossShare * EXP_SPLIT_RATE;
    const riskMgmtFee = i.cappedRisk ? 0 : RISK_MGMT_FEE;
    const brokerReview = BROKER_REVIEW;
    const postCapTxFee = POST_CAP_FEES[i.postCapFee] || 0;

    const totalExpFees = expCompanySplit + riskMgmtFee + brokerReview + postCapTxFee;
    const takeHome = agentGrossShare - totalExpFees;

    return {
      base,
      gross,
      isLease,
      referralRate,
      zillowReferral,
      splitBase,
      agentPct,
      officePct,
      agentBaseShare,
      agentGrossShare,
      officeShare,
      mentorCut,
      expCompanySplit,
      riskMgmtFee,
      brokerReview,
      postCapTxFee,
      totalExpFees,
      takeHome,
      // effective take-home as a share of gross
      takeHomePct: gross > 0 ? takeHome / gross : 0,
    };
  }

  const fmtUSD = (n, dp = 0) =>
    (n < 0 ? "-$" : "$") +
    Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    });

  const fmtPct = (n, dp = 0) => (n * 100).toFixed(dp) + "%";

  global.SplitEngine = {
    REFERENCE,
    LEAD_SOURCES,
    LEVELS_BY_SOURCE,
    LEVEL_LABELS,
    POST_CAP_FEES,
    constants: { EXP_SPLIT_RATE, RISK_MGMT_FEE, BROKER_REVIEW, ISA_SHIFT, MENTOR_SHARE, ZILLOW_REFERRAL, LEASE_RATE },
    lookup,
    compute,
    fmtUSD,
    fmtPct,
  };
})(window);
