const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Lead = require("../models/Lead");

/**
 * FILLER LEADS PHONE NUMBER REPETITION RULES
 * ==========================================
 * This module implements phone number repetition filtering for filler leads orders:
 *
 * 1. Orders with ≤10 filler leads: No repetition of first four digits after phone prefix
 * 2. Orders with 11-20 filler leads: Max 2 repetitions per phone pattern, max 10 pairs total
 * 3. Orders with 21-40 filler leads: Max 4 repetitions per phone pattern
 * 4. Orders with >40 filler leads: No repetition restrictions
 *
 * The system extracts the first four digits after the country code from phone numbers
 * (e.g., +1234567890 -> "2345") and groups leads by these patterns to apply the rules.
 */

/**
 * Helper function to extract first four digits after prefix from phone number
 * This is used to identify phone number patterns for filler leads repetition rules
 * @param {string} phoneNumber - Phone number in format 1234567890 (without +) or +1234567890
 * @returns {string|null} - First four digits after country code (e.g., "2345")
 */
const getFirstFourDigitsAfterPrefix = (phoneNumber) => {
  console.log(`[DEBUG-PHONE] Input: ${phoneNumber}`);

  if (!phoneNumber) {
    console.log(`[DEBUG-PHONE] No phone number provided`);
    return null;
  }

  // Remove all non-digits
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  console.log(`[DEBUG-PHONE] Cleaned: ${cleanPhone}`);

  if (cleanPhone.length < 5) {
    console.log(`[DEBUG-PHONE] Too short: ${cleanPhone.length} digits`);
    return null;
  }

  // For phone numbers stored without +, we need to handle different formats:
  // - If it starts with country code (e.g., "12345678901" for US +1), skip first 1-3 digits
  // - If it's already without country code, take first 4 digits
  // - Common country codes: 1 (US/Canada), 44 (UK), 49 (Germany), etc.

  let result;

  // Check if it starts with common single-digit country codes (1, 7, etc.)
  if (cleanPhone.length >= 11 && ["1", "7"].includes(cleanPhone[0])) {
    // Skip 1 digit country code, take next 4
    result = cleanPhone.substring(1, 5);
  }
  // Check if it starts with common 2-digit country codes (44, 49, 33, etc.)
  else if (
    cleanPhone.length >= 12 &&
    ["44", "49", "33", "34", "39", "41", "43", "45", "46", "47", "48"].includes(
      cleanPhone.substring(0, 2)
    )
  ) {
    // Skip 2 digit country code, take next 4
    result = cleanPhone.substring(2, 6);
  }
  // Check if it starts with common 3-digit country codes (359, 371, etc.)
  else if (
    cleanPhone.length >= 13 &&
    ["359", "371", "372", "373", "374", "375", "376", "377", "378"].includes(
      cleanPhone.substring(0, 3)
    )
  ) {
    // Skip 3 digit country code, take next 4
    result = cleanPhone.substring(3, 7);
  }
  // Default: assume first 4 digits are what we want (no country code)
  else {
    result = cleanPhone.substring(0, 4);
  }

  console.log(`[DEBUG-PHONE] Result: ${result}`);
  return result;
};

/**
 * Helper function to apply phone number repetition rules for filler leads
 * Implements the following rules based on the number of filler leads requested:
 * - ≤10 leads: All leads must have unique first four digits after prefix
 * - 11-20 leads: Max 2 repetitions per pattern, but no more than 10 pairs total with same first 4 digits
 * - 21-40 leads: Max 4 repetitions per pattern, but no more than 20 pairs total with same first 4 digits
 * - >40 leads: No restrictions
 * @param {Array} fillerLeads - Array of filler lead objects
 * @param {number} requestedCount - Number of filler leads requested
 * @returns {Array} - Filtered array of leads following repetition rules
 */
const applyFillerPhoneRepetitionRules = (fillerLeads, requestedCount) => {
  if (!fillerLeads || fillerLeads.length === 0) {
    console.log(`[FILLER-DEBUG] No leads provided`);
    return fillerLeads;
  }

  console.log(`[FILLER-DEBUG] ===== STARTING FILLER PROCESSING =====`);
  console.log(
    `[FILLER-DEBUG] Input: ${fillerLeads.length} filler leads available, ${requestedCount} requested`
  );

  // Group leads by first four digits of phone number
  const phoneGroups = {};
  const leadsWithoutValidPhone = [];

  fillerLeads.forEach((lead, index) => {
    const firstFour = getFirstFourDigitsAfterPrefix(lead.newPhone);
    console.log(
      `[FILLER-DEBUG] Lead ${index}: Phone=${lead.newPhone}, FirstFour=${firstFour}, ID=${lead._id}`
    );

    if (firstFour) {
      if (!phoneGroups[firstFour]) {
        phoneGroups[firstFour] = [];
      }
      phoneGroups[firstFour].push(lead);
    } else {
      console.log(
        `[FILLER-DEBUG] Lead ${index} has no valid phone pattern, adding to backup`
      );
      leadsWithoutValidPhone.push(lead);
    }
  });

  const uniquePatterns = Object.keys(phoneGroups);
  console.log(
    `[FILLER-DEBUG] Phone groups created:`,
    uniquePatterns.map((key) => `${key}:${phoneGroups[key].length}`).join(", ")
  );
  console.log(
    `[FILLER-DEBUG] Leads without valid phone: ${leadsWithoutValidPhone.length}`
  );

  const selectedLeads = [];

  // Apply the repetition rules based on requested count
  if (requestedCount <= 10) {
    // Rule 1: All leads must have unique first four digits
    console.log(`[FILLER-DEBUG] ===== RULE 1 (≤10 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads with unique patterns, have ${uniquePatterns.length} unique patterns`
    );

    // Check if we have enough unique patterns
    if (uniquePatterns.length < requestedCount) {
      console.log(
        `[FILLER-DEBUG] ERROR: Not enough unique patterns! Have ${uniquePatterns.length}, need ${requestedCount}`
      );
      console.log(
        `[FILLER-DEBUG] Will return as many unique patterns as possible + leads without valid phone if needed`
      );

      // Take one from each unique pattern
      uniquePatterns.forEach((pattern, index) => {
        if (selectedLeads.length < requestedCount) {
          selectedLeads.push(phoneGroups[pattern][0]);
          console.log(
            `[FILLER-DEBUG] Selected lead ${selectedLeads.length} with pattern ${pattern}`
          );
        }
      });

      // If still need more, add leads without valid phone patterns
      let leadsWithoutPhoneIndex = 0;
      while (
        selectedLeads.length < requestedCount &&
        leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
      ) {
        selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
        console.log(
          `[FILLER-DEBUG] Added lead without valid phone pattern: ${
            leadsWithoutPhoneIndex + 1
          }`
        );
        leadsWithoutPhoneIndex++;
      }
    } else {
      // We have enough unique patterns - take exactly requestedCount with unique patterns
      for (let i = 0; i < requestedCount; i++) {
        selectedLeads.push(phoneGroups[uniquePatterns[i]][0]);
        console.log(
          `[FILLER-DEBUG] Selected lead ${i + 1} with pattern ${
            uniquePatterns[i]
          }`
        );
      }
    }
  } else if (requestedCount <= 20) {
    // Rule 2: Max 2 repetitions per pattern, max 10 pairs total
    // This means: each pattern can appear many times, but we count pairs (every 2nd occurrence of same pattern)
    // and limit total pairs to 10, not pairs per pattern
    console.log(`[FILLER-DEBUG] ===== RULE 2 (11-20 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads, max 10 pairs total across all patterns`
    );

    const patternCount = {}; // Track how many leads we've taken from each pattern
    let totalPairs = 0;
    const maxPairs = 10;

    // Strategy: Continue adding leads from available patterns until we reach the requested count
    // Count pairs as every 2nd occurrence of the same pattern
    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;

      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;

        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;

        // Can we add another lead from this pattern?
        if (currentCount < availableInGroup) {
          // Check if this would create a new pair (every 2nd lead from same pattern creates a pair)
          const wouldCreatePair = (currentCount + 1) % 2 === 0; // 2nd, 4th, 6th, etc. create pairs

          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[FILLER-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }

          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;

          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${
                selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${
                selectedLeads.length
              }`
            );
          }
        }
      }

      // If we couldn't add any leads this round, we're done
      if (addedThisRound === 0) {
        console.log(
          `[FILLER-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }

    // If still need more leads and have leads without valid phone, add them
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[FILLER-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else if (requestedCount <= 40) {
    // Rule 3: Max 4 repetitions per pattern, max 20 pairs total
    // This means: each pattern can appear many times, but we count pairs (every 2nd occurrence of same pattern)
    // and limit total pairs to 20, not pairs per pattern
    console.log(`[FILLER-DEBUG] ===== RULE 3 (21-40 leads) =====`);
    console.log(
      `[FILLER-DEBUG] Need ${requestedCount} leads, max 20 pairs total across all patterns`
    );

    const patternCount = {}; // Track how many leads we've taken from each pattern
    let totalPairs = 0;
    const maxPairs = 20;

    // Strategy: Continue adding leads from available patterns until we reach the requested count
    // Count pairs as every 2nd occurrence of the same pattern
    while (selectedLeads.length < requestedCount) {
      let addedThisRound = 0;

      for (const pattern of uniquePatterns) {
        if (selectedLeads.length >= requestedCount) break;

        const currentCount = patternCount[pattern] || 0;
        const availableInGroup = phoneGroups[pattern].length;

        // Can we add another lead from this pattern?
        if (currentCount < availableInGroup) {
          // Check if this would create a new pair (every 2nd lead from same pattern creates a pair)
          const wouldCreatePair = (currentCount + 1) % 2 === 0; // 2nd, 4th, 6th, etc. create pairs

          if (wouldCreatePair && totalPairs >= maxPairs) {
            console.log(
              `[FILLER-DEBUG] Skipping pattern ${pattern} - would exceed total pair limit (${totalPairs}/${maxPairs})`
            );
            continue;
          }

          selectedLeads.push(phoneGroups[pattern][currentCount]);
          patternCount[pattern] = currentCount + 1;
          addedThisRound++;

          if (wouldCreatePair) {
            totalPairs++;
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (creates pair #${totalPairs}), total pairs: ${totalPairs}/${maxPairs} (total leads: ${
                selectedLeads.length
              })`
            );
          } else {
            console.log(
              `[FILLER-DEBUG] Added lead #${
                currentCount + 1
              } from pattern ${pattern} (no pair), total leads: ${
                selectedLeads.length
              }`
            );
          }
        }
      }

      // If we couldn't add any leads this round, we're done
      if (addedThisRound === 0) {
        console.log(
          `[FILLER-DEBUG] No more leads can be added due to constraints or availability, stopping at ${selectedLeads.length} leads`
        );
        break;
      }
    }

    // If still need more leads and have leads without valid phone, add them
    let leadsWithoutPhoneIndex = 0;
    while (
      selectedLeads.length < requestedCount &&
      leadsWithoutPhoneIndex < leadsWithoutValidPhone.length
    ) {
      selectedLeads.push(leadsWithoutValidPhone[leadsWithoutPhoneIndex]);
      console.log(
        `[FILLER-DEBUG] Added lead without valid phone pattern to reach target`
      );
      leadsWithoutPhoneIndex++;
    }
  } else {
    // Rule 4: No restrictions for orders > 40
    console.log(`[FILLER-DEBUG] ===== RULE 4 (>40 leads) =====`);
    console.log(
      `[FILLER-DEBUG] No restrictions, returning up to ${requestedCount} leads`
    );
    return fillerLeads.slice(0, requestedCount);
  }

  console.log(`[FILLER-DEBUG] ===== FINAL RESULT =====`);
  console.log(
    `[FILLER-DEBUG] Selected ${selectedLeads.length} leads out of ${requestedCount} requested`
  );

  // Log pattern distribution in final result
  const finalPatternCount = {};
  selectedLeads.forEach((lead) => {
    const pattern = getFirstFourDigitsAfterPrefix(lead.newPhone);
    finalPatternCount[pattern] = (finalPatternCount[pattern] || 0) + 1;
  });

  console.log(
    `[FILLER-DEBUG] Final pattern distribution:`,
    Object.entries(finalPatternCount)
      .map(([pattern, count]) => `${pattern || "NO_PATTERN"}:${count}`)
      .join(", ")
  );

  if (selectedLeads.length < requestedCount) {
    console.log(
      `[FILLER-DEBUG] WARNING: Could not fulfill complete request. Got ${selectedLeads.length}/${requestedCount} leads`
    );
  }

  return selectedLeads;
};

// Helper function to determine max repetitions based on filler count
const getMaxRepetitionsForFillerCount = (count) => {
  if (count <= 10) return 1;
  if (count <= 20) return 2;
  if (count <= 40) return 4;
  return Infinity; // No limit for larger orders
};

// @desc    Create a new order and pull leads
// @route   POST /api/orders
// @access  Private (Admin, Manager with canCreateOrders permission)
exports.createOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      requests,
      priority,
      notes,
      country,
      gender,
      injectionSettings = { enabled: false },
      selectedClientNetwork
    } = req.body;

    const { ftd = 0, filler = 0, cold = 0, live = 0 } = requests || {};

    if (ftd + filler + cold + live === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one lead type must be requested",
      });
    }

    // Validate client network access for affiliate managers (for reference selection only)
    if (req.user.role === "affiliate_manager" && selectedClientNetwork) {
      const ClientNetwork = require("../models/ClientNetwork");
      const clientNetwork = await ClientNetwork.findOne({
        _id: selectedClientNetwork,
        assignedAffiliateManagers: req.user._id,
        isActive: true,
      });

      if (!clientNetwork) {
        return res.status(403).json({
          success: false,
          message: "Access denied - client network not assigned to you or inactive",
        });
      }
    }

    const pulledLeads = [];
    const fulfilled = { ftd: 0, filler: 0, cold: 0, live: 0 };

    // Base query filters for country and gender if specified
    const countryFilter = country ? { country: new RegExp(country, "i") } : {};
    const genderFilter = gender ? { gender } : {};

    // Pull FTD leads
    if (ftd > 0) {
      const ftdLeads = await Lead.find({
        leadType: "ftd",
        ...countryFilter,
        ...genderFilter,
      }).limit(ftd);

      if (ftdLeads.length > 0) {
        pulledLeads.push(...ftdLeads);
        fulfilled.ftd = ftdLeads.length;
      }
    }

    // Pull Filler leads with phone number repetition rules
    if (filler > 0) {
      console.log(`[FILLER-DEBUG] ===== FETCHING FILLER LEADS =====`);
      console.log(`[FILLER-DEBUG] Requested filler leads: ${filler}`);

      // Fetch more leads than requested to have enough variety for filtering
      // The multiplier ensures we have enough variety to apply repetition rules
      // With large databases (5000+ leads), we need much higher multipliers to get pattern diversity
      let fetchMultiplier = 1;
      if (filler <= 10) {
        fetchMultiplier = 50; // Need lots of variety for unique pattern rule - fetch 500 leads for 10 requested
      } else if (filler <= 20) {
        fetchMultiplier = 25; // Need massive variety for 2-max rule - fetch 500 leads for 20 requested
      } else if (filler <= 40) {
        fetchMultiplier = 15; // Need lots of variety for 4-max rule - fetch 600 leads for 40 requested
      } else {
        fetchMultiplier = 5; // Still need variety for larger orders
      }

      const fetchLimit = Math.max(filler, Math.ceil(filler * fetchMultiplier));
      console.log(
        `[FILLER-DEBUG] Fetch multiplier: ${fetchMultiplier}, fetching up to ${fetchLimit} leads`
      );

      // Use aggregation with $sample to get random leads for better pattern diversity
      // This helps ensure we don't just get leads with similar phone patterns
      const fillerLeads = await Lead.aggregate([
        {
          $match: {
            leadType: "filler",
            ...countryFilter,
            ...genderFilter,
          },
        },
        {
          $sample: { size: fetchLimit },
        },
      ]);

      console.log(
        `[FILLER-DEBUG] Found ${fillerLeads.length} filler leads in database`
      );

      if (fillerLeads.length > 0) {
        const appliedFillerLeads = applyFillerPhoneRepetitionRules(
          fillerLeads,
          filler
        );
        pulledLeads.push(...appliedFillerLeads);
        fulfilled.filler = appliedFillerLeads.length;
        console.log(
          `[FILLER-DEBUG] Final result: ${appliedFillerLeads.length} filler leads added to order`
        );
      } else {
        console.log(`[FILLER-DEBUG] No filler leads found matching criteria`);
      }
    }

    // Pull Cold leads
    if (cold > 0) {
      const coldLeads = await Lead.find({
        leadType: "cold",
        ...countryFilter,
        ...genderFilter,
      }).limit(cold);

      if (coldLeads.length > 0) {
        pulledLeads.push(...coldLeads);
        fulfilled.cold = coldLeads.length;
      }
    }

    // Pull Live leads
    if (live > 0) {
      const liveLeads = await Lead.find({
        leadType: "live",
        ...countryFilter,
        ...genderFilter,
      }).limit(live);

      if (liveLeads.length > 0) {
        pulledLeads.push(...liveLeads);
        fulfilled.live = liveLeads.length;
      }
    }

    // Determine order status based on fulfillment
    const totalRequested = ftd + filler + cold + live;
    const totalFulfilled =
      fulfilled.ftd + fulfilled.filler + fulfilled.cold + fulfilled.live;

    let orderStatus;
    if (totalFulfilled === 0) {
      orderStatus = "cancelled";
    } else if (
      totalFulfilled === totalRequested &&
      fulfilled.ftd === ftd &&
      fulfilled.filler === filler &&
      fulfilled.cold === cold &&
      fulfilled.live === live
    ) {
      orderStatus = "fulfilled";
    } else {
      orderStatus = "partial";
    }

    // Calculate injection progress for non-FTD leads if injection is enabled
    let injectionProgress = {
      totalToInject: 0,
      totalInjected: 0,
      successfulInjections: 0,
      failedInjections: 0,
      ftdsPendingManualFill: fulfilled.ftd // FTDs always require manual filling
    };

    if (injectionSettings.enabled) {
      // Calculate total leads to inject (excluding FTDs)
      const leadTypesToInject = injectionSettings.includeTypes || {};
      if (leadTypesToInject.filler) injectionProgress.totalToInject += fulfilled.filler;
      if (leadTypesToInject.cold) injectionProgress.totalToInject += fulfilled.cold;
      if (leadTypesToInject.live) injectionProgress.totalToInject += fulfilled.live;
    }

    // Initialize FTD handling status
    let ftdHandling = {
      status: fulfilled.ftd > 0 ? "manual_fill_required" : "completed"
    };

    // Create the order first
    const order = new Order({
      requester: req.user._id,
      requests: { ftd, filler, cold, live },
      fulfilled,
      leads: pulledLeads.map((l) => l._id),
      priority: priority || "medium",
      notes,
      status: orderStatus,
      countryFilter: country || null,
      genderFilter: gender || null,
      selectedClientNetwork: selectedClientNetwork || null,
      
      // Add injection settings
      injectionSettings: {
        enabled: injectionSettings.enabled,
        mode: injectionSettings.mode || "manual",
        scheduledTime: injectionSettings.scheduledTime,
        status: injectionSettings.enabled ? "pending" : "completed",
        includeTypes: injectionSettings.includeTypes || {
          filler: true,
          cold: true,
          live: true
        }
      },

      // Add FTD handling and injection progress
      ftdHandling,
      injectionProgress,

      // Set cancellation details if no leads available
      ...(orderStatus === "cancelled" && {
        cancelledAt: new Date(),
        cancellationReason:
          "No leads available matching the requested criteria",
      }),
    });

    await order.save();

    // Then update leads with the order ID
    if (pulledLeads.length > 0) {
      // Get current state of leads to check existing assignments
      const existingLeads = await Lead.find({ 
        _id: { $in: pulledLeads.map((l) => l._id) }
      }).select('_id assignedTo isAssigned assignedAt');

      // Separate leads that are already assigned vs unassigned
      const alreadyAssignedLeads = existingLeads.filter(lead => lead.isAssigned && lead.assignedTo);
      const unassignedLeads = existingLeads.filter(lead => !lead.isAssigned || !lead.assignedTo);

      console.log(`[ORDER-ASSIGNMENT] Processing ${pulledLeads.length} leads for order ${order._id}`);
      console.log(`[ORDER-ASSIGNMENT] - ${alreadyAssignedLeads.length} leads already assigned to agents (preserving assignments)`);
      console.log(`[ORDER-ASSIGNMENT] - ${unassignedLeads.length} leads unassigned (will assign to order creator: ${req.user.role})`);

      // For already assigned leads, only update orderId (preserve agent assignment)
      if (alreadyAssignedLeads.length > 0) {
        await Lead.updateMany(
          { _id: { $in: alreadyAssignedLeads.map(l => l._id) } },
          {
            $set: {
              orderId: order._id,
            },
          }
        );
        console.log(`[ORDER-ASSIGNMENT] Successfully preserved agent assignments for ${alreadyAssignedLeads.length} leads`);
      }

      // For unassigned leads, assign to order creator and set orderId
      if (unassignedLeads.length > 0) {
        await Lead.updateMany(
          { _id: { $in: unassignedLeads.map(l => l._id) } },
          {
            $set: {
              assignedTo: req.user._id,
              assignedAt: new Date(),
              isAssigned: true,
              orderId: order._id,
            },
          }
        );
        console.log(`[ORDER-ASSIGNMENT] Successfully assigned ${unassignedLeads.length} unassigned leads to order creator`);
      }

      // Verify the update was successful
      const updatedLeads = await Lead.find({
        _id: { $in: pulledLeads.map((l) => l._id) },
      });

      // Check if any leads weren't properly updated
      const notUpdated = updatedLeads.filter(
        (lead) =>
          !lead.orderId || lead.orderId.toString() !== order._id.toString()
      );

      if (notUpdated.length > 0) {
        // If any leads weren't updated, delete the order and throw an error
        await Order.findByIdAndDelete(order._id);
        throw new Error(
          `Failed to update orderId for ${notUpdated.length} leads`
        );
      }
    }

    // Populate the order for response
    await order.populate([
      { path: "requester", select: "fullName email role" },
      {
        path: "leads",
        select: "leadType firstName lastName country email phone orderId",
      },
    ]);

    res.status(201).json({
      success: true,
      message: (() => {
        let msg = `Order created with ${pulledLeads.length} leads`;
        if (orderStatus === "fulfilled") {
          msg += " - fully fulfilled";
        } else if (orderStatus === "partial") {
          msg += ` - partially fulfilled (${totalFulfilled}/${totalRequested} leads)`;
        } else {
          msg += " - cancelled (no leads available)";
        }
        if (country) msg += ` from ${country}`;
        if (gender) msg += ` with gender: ${gender}`;

        // Add phone number filtering info for filler leads
        if (filler > 0 && fulfilled.filler > 0) {
          const maxReps = getMaxRepetitionsForFillerCount(filler);
          if (maxReps === 1) {
            msg += ` (filler leads: no phone number repetitions)`;
          } else if (maxReps === 2) {
            msg += ` (filler leads: max 2 repetitions per phone pattern, max 10 pairs)`;
          } else if (maxReps === 4) {
            msg += ` (filler leads: max 4 repetitions per phone pattern)`;
          }
        }

        return msg;
      })(),
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get orders (Admin sees all, Manager sees own)
// @route   GET /api/orders
// @access  Private (Admin, Manager)
exports.getOrders = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const {
      page = 1,
      limit = 10,
      status,
      priority,
      startDate,
      endDate,
    } = req.query;

    // Build query
    let query = {};

    // Role-based filtering
    if (req.user.role !== "admin") {
      query.requester = req.user._id;
    }

    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate("requester", "fullName email role")
      .populate({
        path: "leads",
        select: "leadType firstName lastName country email phone orderId",
        populate: [
          {
            path: "assignedTo",
            select: "fullName email",
          },
          {
            path: "comments.author",
            select: "fullName",
          },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private (Admin, Manager - own orders only)
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("requester", "fullName email role")
      .populate({
        path: "leads",
        populate: [
          {
            path: "assignedTo",
            select: "fullName email",
          },
          {
            path: "comments.author",
            select: "fullName",
          },
        ],
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permission (non-admin can only see their own orders)
    if (
      req.user.role !== "admin" &&
      order.requester._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order details
// @route   PUT /api/orders/:id
// @access  Private (Admin, Manager - own orders only)
exports.updateOrder = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors.array(),
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check permission
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order",
      });
    }

    const { priority, notes } = req.body;

    if (priority) order.priority = priority;
    if (notes !== undefined) order.notes = notes;

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order
// @route   DELETE /api/orders/:id
// @access  Private (Admin, Manager - own orders only)
exports.cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { reason } = req.body;

    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Check permission
      if (
        req.user.role !== "admin" &&
        order.requester.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to cancel this order",
        });
      }

      if (order.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "Order is already cancelled",
        });
      }

      // Unassign leads
      await Lead.updateMany(
        { _id: { $in: order.leads } },
        {
          $set: {
            isAssigned: false,
            assignedTo: null,
            assignedAt: null,
          },
        },
        { session }
      );

      // Update order
      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = reason;

      await order.save({ session });

      res.status(200).json({
        success: true,
        message: "Order cancelled successfully",
        data: order,
      });
    });
  } catch (error) {
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private (Admin, Manager)
exports.getOrderStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match stage for aggregation
    let matchStage = {};

    // Role-based filtering
    if (req.user.role !== "admin") {
      matchStage.requester = new mongoose.Types.ObjectId(req.user._id);
    }

    // Date filtering
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRequested: {
            $sum: {
              $add: [
                "$requests.ftd",
                "$requests.filler",
                "$requests.cold",
                "$requests.live",
              ],
            },
          },
          totalFulfilled: {
            $sum: {
              $add: [
                "$fulfilled.ftd",
                "$fulfilled.filler",
                "$fulfilled.cold",
                "$fulfilled.live",
              ],
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export leads from order as CSV
// @route   GET /api/orders/:id/export
// @access  Private (Admin, Manager - own orders only)
exports.exportOrderLeads = async (req, res, next) => {
  try {
    const orderId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Get order and check ownership
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user can access this order (Admin or owns the order)
    if (
      req.user.role !== "admin" &&
      order.requester.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get all leads for this order
    const leads = await Lead.find({ orderId: orderId })
      .populate("assignedTo", "fullName")
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1 });

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads found for this order",
      });
    }

    // Generate CSV content
    const csvHeaders = [
      "Lead Type",
      "First Name",
      "Last Name",
      "Email",
      "Prefix",
      "Phone",
      "Country",
      "Gender",
      "Status",
      "DOB",
      "Address",
      "Old Email",
      "Old Phone",
      "Client",
      "Client Broker",
      "Client Network",
      "Facebook",
      "Twitter",
      "LinkedIn",
      "Instagram",
      "Telegram",
      "WhatsApp",
      "ID front",
      "ID back",
      "Selfie front",
      "Selfie back",
      "Assigned To",
      "Created By",
      "Created At",
      "Assigned At",
    ];

    // Helper function to format dates for Excel compatibility
    const formatDateForExcel = (date) => {
      if (!date) return "";
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";

      // Format as DD/MM/YYYY which is more Excel-friendly
      const day = d.getDate().toString().padStart(2, "0");
      const month = (d.getMonth() + 1).toString().padStart(2, "0");
      const year = d.getFullYear();

      return `${day}/${month}/${year}`;
    };

    // Helper function to extract document URL by description
    const getDocumentUrl = (documents, description) => {
      if (!documents || !Array.isArray(documents)) return "";
      const doc = documents.find(
        (d) =>
          d.description &&
          d.description.toLowerCase().includes(description.toLowerCase())
      );
      return doc ? doc.url || "" : "";
    };

    // Convert leads to CSV rows
    const csvRows = leads.map((lead) => [
      lead.leadType || "",
      lead.firstName || "",
      lead.lastName || "",
      lead.newEmail || "",
      lead.prefix || "",
      lead.newPhone || "",
      lead.country || "",
      lead.gender || "",
      lead.status || "",
      formatDateForExcel(lead.dob),
      lead.address || "",
      lead.oldEmail || "",
      lead.oldPhone || "",
      lead.client || "",
      lead.clientBroker || "",
      lead.clientNetwork || "",
      lead.socialMedia?.facebook || "",
      lead.socialMedia?.twitter || "",
      lead.socialMedia?.linkedin || "",
      lead.socialMedia?.instagram || "",
      lead.socialMedia?.telegram || "",
      lead.socialMedia?.whatsapp || "",
      getDocumentUrl(lead.documents, "ID Front"),
      getDocumentUrl(lead.documents, "ID Back"),
      getDocumentUrl(lead.documents, "Selfie with ID Front"),
      getDocumentUrl(lead.documents, "Selfie with ID Back"),
      lead.assignedTo?.fullName || "",
      lead.createdBy?.fullName || "",
      formatDateForExcel(lead.createdAt),
      formatDateForExcel(lead.assignedAt),
    ]);

    // Helper function to escape CSV values
    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      // If the value contains comma, double quote, or newline, wrap in quotes and escape quotes
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Build CSV content
    const csvContent = [
      csvHeaders.map(escapeCsvValue).join(","),
      ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    // Set response headers for file download
    const filename = `order_${orderId}_leads_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");

    // Send CSV content
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export error:", error);
    next(error);
  }
};

// @desc    Assign client, broker, and network info to all leads in order
// @route   PUT /api/orders/:id/assign-client-info
// @access  DISABLED - This functionality has been removed
// 
// This endpoint has been disabled to prevent mass assignment of client info to all leads in an order.
// Use individual lead assignment endpoints instead: PUT /api/leads/:id/assign-client-network
exports.assignClientInfoToOrderLeads = async (req, res, next) => {
  return res.status(410).json({
    success: false,
    message: "This functionality has been disabled. Please use individual lead assignment instead.",
    details: "Use PUT /api/leads/:id/assign-client-network to assign client networks to individual leads."
  });
};



// @desc    Start order injection
// @route   POST /api/orders/:id/start-injection
// @access  Private (Admin, Affiliate Manager)
exports.startOrderInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('leads');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has permission (only admins and affiliate managers)
    if (req.user.role !== "admin" && req.user.role !== "affiliate_manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins and affiliate managers can start injection.",
      });
    }

    // Check if injection is enabled for this order
    if (!order.injectionSettings.enabled) {
      return res.status(400).json({
        success: false,
        message: "Injection is not enabled for this order",
      });
    }

    // Check if injection is in a valid state to start
    if (order.injectionSettings.status !== "pending" && order.injectionSettings.status !== "paused") {
      return res.status(400).json({
        success: false,
        message: `Cannot start injection. Current status: ${order.injectionSettings.status}`,
      });
    }

    // Update injection status
    order.injectionSettings.status = "in_progress";
    order.injectionProgress.lastInjectionAt = new Date();

    await order.save();

    // Start the actual injection process based on mode
    if (order.injectionSettings.mode === "bulk") {
      // Start bulk injection immediately
      startBulkInjection(order);
    } else if (order.injectionSettings.mode === "scheduled") {
      // Start scheduled injection
      startScheduledInjection(order);
    }

    res.status(200).json({
      success: true,
      message: `Injection started successfully in ${order.injectionSettings.mode} mode`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Pause order injection
// @route   POST /api/orders/:id/pause-injection
// @access  Private (Admin, Affiliate Manager)
exports.pauseOrderInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.injectionSettings.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: "Cannot pause injection. Injection is not currently in progress.",
      });
    }

    order.injectionSettings.status = "paused";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Injection paused successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Stop order injection
// @route   POST /api/orders/:id/stop-injection
// @access  Private (Admin, Affiliate Manager)
exports.stopOrderInjection = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.injectionSettings.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Injection is already completed",
      });
    }

    order.injectionSettings.status = "completed";
    order.injectionProgress.completedAt = new Date();
    await order.save();

    res.status(200).json({
      success: true,
      message: "Injection stopped successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Skip FTDs and mark for manual filling
// @route   POST /api/orders/:id/skip-ftds
// @access  Private (Admin, Affiliate Manager)
exports.skipOrderFTDs = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.ftdHandling.status !== "manual_fill_required") {
      return res.status(400).json({
        success: false,
        message: "No FTDs requiring manual filling found",
      });
    }

    order.ftdHandling.status = "skipped";
    order.ftdHandling.skippedAt = new Date();
    order.ftdHandling.notes = "FTDs skipped for manual filling later by affiliate manager/admin";

    await order.save();

    res.status(200).json({
      success: true,
      message: "FTDs marked for manual filling later",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Helper functions for injection processing
const startBulkInjection = async (order) => {
  try {
    console.log(`Starting bulk injection for order ${order._id}`);
    
    // Get leads that should be injected (non-FTD leads based on settings)
    const Lead = require("../models/Lead");
    const leadsToInject = await Lead.find({
      _id: { $in: order.leads },
      leadType: { $in: getInjectableLeadTypes(order.injectionSettings.includeTypes) }
    });

    console.log(`Found ${leadsToInject.length} leads to inject for order ${order._id}`);

    // Process leads one by one with delays
    for (const lead of leadsToInject) {
      await injectSingleLead(lead, order._id);
      // Add delay between injections to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Update order status when completed
    await updateOrderInjectionProgress(order._id, leadsToInject.length, leadsToInject.length);
    
  } catch (error) {
    console.error(`Error in bulk injection for order ${order._id}:`, error);
    // Update order status to failed
    await Order.findByIdAndUpdate(order._id, {
      'injectionSettings.status': 'failed'
    });
  }
};

const startScheduledInjection = async (order) => {
  try {
    console.log(`Starting scheduled injection for order ${order._id}`);
    
    // Get leads that should be injected
    const Lead = require("../models/Lead");
    const leadsToInject = await Lead.find({
      _id: { $in: order.leads },
      leadType: { $in: getInjectableLeadTypes(order.injectionSettings.includeTypes) }
    });

    // Schedule injections at random intervals within the specified time window
    scheduleRandomInjections(leadsToInject, order);
    
  } catch (error) {
    console.error(`Error in scheduled injection for order ${order._id}:`, error);
    await Order.findByIdAndUpdate(order._id, {
      'injectionSettings.status': 'failed'
    });
  }
};

const getInjectableLeadTypes = (includeTypes) => {
  const types = [];
  if (includeTypes.filler) types.push('filler');
  if (includeTypes.cold) types.push('cold');
  if (includeTypes.live) types.push('live');
  // Never include 'ftd' as they are always manual
  return types;
};

const injectSingleLead = async (lead, orderId) => {
  try {
    const { spawn } = require("child_process");
    const path = require('path');

    const leadData = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.newEmail,
      phone: lead.newPhone,
      country: lead.country,
      country_code: lead.prefix || "1",
      landingPage: "https://ftd-copy.vercel.app/landing",
      password: "TPvBwkO8",
    };

    const scriptPath = path.resolve(path.join(__dirname, '..', '..', 'injector_playwright.py'));

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn("python", [scriptPath, JSON.stringify(leadData)]);

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on("data", (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderrData += data.toString();
      });

      pythonProcess.on("close", async (code) => {
        if (code === 0) {
          console.log(`Successfully injected lead ${lead._id} for order ${orderId}`);
          await updateOrderInjectionProgress(orderId, 0, 1); // Add 1 successful injection
          resolve(true);
        } else {
          console.error(`Failed to inject lead ${lead._id} for order ${orderId}:`, stderrData);
          await updateOrderInjectionProgress(orderId, 1, 0); // Add 1 failed injection
          resolve(false);
        }
      });

      pythonProcess.on("error", (error) => {
        console.error(`Python process error for lead ${lead._id}:`, error);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Error injecting lead ${lead._id}:`, error);
    return false;
  }
};

const updateOrderInjectionProgress = async (orderId, failedCount = 0, successCount = 0) => {
  try {
    const update = {};
    if (failedCount > 0) {
      update['$inc'] = { 'injectionProgress.failedInjections': failedCount };
    }
    if (successCount > 0) {
      update['$inc'] = { ...update['$inc'], 'injectionProgress.successfulInjections': successCount };
    }
    
    await Order.findByIdAndUpdate(orderId, update);
    
    // Check if injection is complete
    const order = await Order.findById(orderId);
    const totalProcessed = order.injectionProgress.successfulInjections + order.injectionProgress.failedInjections;
    
    if (totalProcessed >= order.injectionProgress.totalToInject) {
      await Order.findByIdAndUpdate(orderId, {
        'injectionSettings.status': 'completed',
        'injectionProgress.completedAt': new Date()
      });
      console.log(`Injection completed for order ${orderId}`);
    }
  } catch (error) {
    console.error(`Error updating injection progress for order ${orderId}:`, error);
  }
};

const scheduleRandomInjections = (leads, order) => {
  // Parse start and end times
  const [startHour, startMinute] = order.injectionSettings.scheduledTime.startTime.split(':').map(Number);
  const [endHour, endMinute] = order.injectionSettings.scheduledTime.endTime.split(':').map(Number);
  
  const startTimeMs = (startHour * 60 + startMinute) * 60 * 1000;
  const endTimeMs = (endHour * 60 + endMinute) * 60 * 1000;
  const windowMs = endTimeMs - startTimeMs;
  
  if (windowMs <= 0) {
    console.error('Invalid time window for scheduled injection');
    return;
  }
  
  leads.forEach((lead, index) => {
    // Generate random delay within the time window
    const randomDelay = Math.random() * windowMs;
    const totalDelay = startTimeMs + randomDelay;
    
    setTimeout(async () => {
      // Check if injection is still active before proceeding
      const currentOrder = await Order.findById(order._id);
      if (currentOrder.injectionSettings.status === 'in_progress') {
        await injectSingleLead(lead, order._id);
      }
    }, totalDelay);
  });
};
