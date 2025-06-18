const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Lead = require("../models/Lead");
const ClientBroker = require('../models/ClientBroker');
const ClientNetwork = require('../models/ClientNetwork');
const InjectionService = require('../services/injectionService');
const asyncHandler = require('../middleware/async');

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
exports.createOrder = asyncHandler(async (req, res, next) => {
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
      excludeClients = [],
      excludeBrokers = [],
      excludeNetworks = [],
      clientNetwork,
      clientBroker,
      newClientBroker,
      injectionType,
      autoInjectionSettings,
    } = req.body;

    const { ftd = 0, filler = 0, cold = 0, live = 0 } = requests || {};

    if (ftd + filler + cold + live === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one lead type must be requested",
      });
    }

    // --- Handle Client Broker ---
    let finalClientBrokerId = null;
    if (clientBroker) {
      if (clientBroker.id === 'add_new' && newClientBroker) {
        // Create a new broker
        if (!clientNetwork) {
          return next(new ErrorResponse('Client network is required to create a new broker', 400));
        }
        const newBroker = await ClientBroker.create({
          name: newClientBroker,
          clientNetwork: clientNetwork,
          createdBy: req.user.id,
        });
        finalClientBrokerId = newBroker._id;
      } else if (clientBroker.id) {
        finalClientBrokerId = clientBroker.id;
      }
    }
    // --- End Handle Client Broker ---

    const pulledLeads = [];
    const fulfilled = { ftd: 0, filler: 0, cold: 0, live: 0 };

    // Base query filters for country and gender if specified
    const countryFilter = country ? { country: new RegExp(country, "i") } : {};
    const genderFilter = gender ? { gender } : {};

    // Build exclusion filters
    const exclusionFilters = {};

    if (excludeClients.length > 0) {
      exclusionFilters.client = { $nin: excludeClients };
    }

    if (excludeBrokers.length > 0) {
      exclusionFilters.clientBroker = { $nin: excludeBrokers };
    }

    if (excludeNetworks.length > 0) {
      exclusionFilters.clientNetwork = { $nin: excludeNetworks };
    }

    // Pull FTD leads
    if (ftd > 0) {
      const ftdLeads = await Lead.find({
        leadType: "ftd",
        ...countryFilter,
        ...genderFilter,
        ...exclusionFilters,
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
            ...exclusionFilters,
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
        ...exclusionFilters,
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
        ...exclusionFilters,
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
      excludeClients: excludeClients.length > 0 ? excludeClients : undefined,
      excludeBrokers: excludeBrokers.length > 0 ? excludeBrokers : undefined,
      excludeNetworks: excludeNetworks.length > 0 ? excludeNetworks : undefined,
      clientNetwork: clientNetwork,
      clientBroker: finalClientBrokerId,
      injectionType: injectionType,
      autoInjectionSettings: autoInjectionSettings,
      // Set cancellation details if no leads available
      ...(orderStatus === "cancelled" && {
        cancelledAt: new Date(),
        cancellationReason:
          "No leads available matching the requested criteria and exclusion filters",
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

    // Enhanced success message with exclusion details
    let exclusionMessage = "";
    if (excludeClients.length > 0) {
      exclusionMessage += ` (excluded clients: ${excludeClients.join(", ")})`;
    }
    if (excludeBrokers.length > 0) {
      exclusionMessage += ` (excluded brokers: ${excludeBrokers.join(", ")})`;
    }
    if (excludeNetworks.length > 0) {
      exclusionMessage += ` (excluded networks: ${excludeNetworks.join(", ")})`;
    }

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

        msg += exclusionMessage;
        return msg;
      })(),
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

exports.startOrderInjection = asyncHandler(async (req, res, next) => {
    const injectionService = new InjectionService(req.params.id, req.user._id);
    await injectionService.startInjection();

    res.status(200).json({
        success: true,
        message: 'Order injection process started successfully.'
    });
});

/**
 * @desc    Manually inject a single FTD lead
 * @route   POST /api/v1/orders/:orderId/leads/:leadId/inject
 * @access  Private (Admin, Affiliate Manager)
 */
exports.injectFtdLead = asyncHandler(async (req, res, next) => {
    // This is for manual injection of a single FTD lead into a specific broker
    const { orderId, leadId } = req.params;
    const { clientBrokerId } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const lead = await Lead.findById(leadId);
    if (!lead || lead.leadType !== 'ftd') {
        return res.status(404).json({ success: false, message: 'FTD Lead not found' });
    }
    
    const broker = await ClientBroker.findById(clientBrokerId);
    if (!broker) {
        return res.status(404).json({ success: false, message: 'Client Broker not found' });
    }

    // You might want additional checks here, e.g., if the broker belongs to the order's network
    if (broker.clientNetwork.toString() !== order.clientNetwork.toString()) {
        return res.status(400).json({ success: false, message: `Broker ${broker.name} does not belong to the order's network.` });
    }

    const injectionService = new InjectionService(orderId, req.user._id);
    await injectionService.init();
    await injectionService.injectLead(lead, broker);

    res.status(200).json({ success: true, message: `FTD Lead ${leadId} processed for injection.`});
});

/**
 * @desc    Assign a Client Broker to a lead assignment that is pending broker assignment
 * @route   POST /api/v1/orders/:orderId/leads/:leadId/assign-broker
 * @access  Private (Admin, Affiliate Manager)
 */
exports.assignBrokerToLeadAssignment = asyncHandler(async (req, res, next) => {
    const { orderId, leadId } = req.params;
    const { clientBrokerId } = req.body;
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    
    const clientBroker = await ClientBroker.findById(clientBrokerId);
    if (!clientBroker) {
        return res.status(404).json({ success: false, message: 'Client Broker not found' });
    }

    // Validation: Ensure the chosen broker belongs to the order's client network
    if (clientBroker.clientNetwork.toString() !== order.clientNetwork.toString()) {
        return res.status(400).json({ success: false, message: `Broker ${clientBroker.name} does not belong to the order's network.` });
    }

    // Find the assignment within the lead that corresponds to this order
    const assignment = lead.assignments.find(a => a.order.equals(order._id));

    if (!assignment) {
        return res.status(404).json({ success: false, message: 'No assignment found for this lead in this order.' });
    }

    if (assignment.status !== 'pending_broker_assignment') {
        return res.status(400).json({ success: false, message: `Assignment status is '${assignment.status}', not 'pending_broker_assignment'. Cannot re-assign broker.` });
    }

    // Update the assignment
    assignment.clientBroker = clientBroker._id;
    assignment.status = 'injected';
    
    // Increment the fulfilled count on the order
    if (order.fulfilled[lead.leadType] < order.requests[lead.leadType]) {
        order.fulfilled[lead.leadType]++;
    }

    order.logs.push({
        message: `Broker ${clientBroker.name} was manually assigned to lead ${lead.fullName || lead._id}. Injection complete.`,
        type: 'info',
        lead: lead._id
    });
    
    // Save both documents
    await lead.save();
    await order.save();
    
    res.status(200).json({
        success: true,
        message: `Broker successfully assigned to lead ${leadId}.`,
        data: lead
    });
});

/**
 * @desc    Get all leads associated with a specific order
 * @route   GET /api/v1/orders/:id/leads
 * @access  Private (Admin, Affiliate Manager)
 */
exports.getLeadsForOrder = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    // Validate order ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid order ID'
        });
    }

    // Check if order exists
    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }

    // Get leads associated with this order
    const leads = await Lead.find({ orderId: id })
        .populate('assignedTo', 'fullName email fourDigitCode')
        .populate('assignments.clientNetwork', 'name')
        .populate('assignments.clientBroker', 'name')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: leads.length,
        data: leads
    });
});

/**
 * @desc    Get all orders with pagination and filtering
 * @route   GET /api/v1/orders
 * @access  Private (Admin, Affiliate Manager)
 */
exports.getOrders = asyncHandler(async (req, res, next) => {
    res.status(200).json(res.advancedResults);
});

/**
 * @desc    Get single order by ID
 * @route   GET /api/v1/orders/:id
 * @access  Private (Admin, Affiliate Manager)
 */
exports.getOrderById = asyncHandler(async (req, res, next) => {
    const order = await Order.findById(req.params.id)
        .populate('requester', 'fullName email')
        .populate('clientNetwork', 'name')
        .populate('assignedTo', 'fullName email');

    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }

    res.status(200).json({
        success: true,
        data: order
    });
});

/**
 * @desc    Update order
 * @route   PUT /api/v1/orders/:id
 * @access  Private (Admin, Affiliate Manager)
 */
exports.updateOrder = asyncHandler(async (req, res, next) => {
    let order = await Order.findById(req.params.id);

    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }

    order = await Order.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        data: order
    });
});

/**
 * @desc    Delete order
 * @route   DELETE /api/v1/orders/:id
 * @access  Private (Admin)
 */
exports.deleteOrder = asyncHandler(async (req, res, next) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }

    await order.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});

/**
 * @desc    Get order statistics
 * @route   GET /api/v1/orders/stats
 * @access  Private (Admin, Affiliate Manager)
 */
exports.getOrderStats = asyncHandler(async (req, res, next) => {
    const stats = await Order.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalRequested: { $sum: { $add: ['$requests.fresh', '$requests.filler', '$requests.ftd'] } },
                totalFulfilled: { $sum: { $add: ['$fulfilled.fresh', '$fulfilled.filler', '$fulfilled.ftd'] } }
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: stats
    });
});

/**
 * @desc    Export order leads
 * @route   GET /api/v1/orders/:id/export
 * @access  Private (Admin, Affiliate Manager)
 */
exports.exportOrderLeads = asyncHandler(async (req, res, next) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }

    const leads = await Lead.find({ orderId: req.params.id });

    res.status(200).json({
        success: true,
        data: leads,
        message: 'Order leads exported successfully'
    });
});

/**
 * @desc    Get exclusion options
 * @route   GET /api/v1/orders/exclusion-options
 * @access  Private (Admin, Affiliate Manager)
 */
exports.getExclusionOptions = asyncHandler(async (req, res, next) => {
    try {
        // Get unique client networks
        const clientNetworks = await ClientNetwork.find({}, 'name').distinct('name');
        
        // Get unique client brokers
        const clientBrokers = await ClientBroker.find({}, 'name').distinct('name');
        
        // For networks, we can use the same client networks data
        // or create a separate collection if needed
        const networks = clientNetworks;
        
        const exclusionOptions = {
            clients: clientNetworks || [],
            brokers: clientBrokers || [],
            networks: networks || []
        };

        res.status(200).json({
            success: true,
            data: exclusionOptions
        });
    } catch (error) {
        console.error('Error fetching exclusion options:', error);
        res.status(200).json({
            success: true,
            data: {
                clients: [],
                brokers: [],
                networks: []
            }
        });
    }
});

/**
 * @desc    Assign client info to order leads
 * @route   PUT /api/v1/orders/:id/assign-client-info
 * @access  Private (Admin, Affiliate Manager)
 */
exports.assignClientInfoToOrderLeads = asyncHandler(async (req, res, next) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        return res.status(404).json({
            success: false,
            message: 'Order not found'
        });
    }

    const { clientInfo } = req.body;

    // Update all leads associated with this order
    await Lead.updateMany(
        { orderId: req.params.id },
        { $set: { clientInfo } }
    );

    res.status(200).json({
        success: true,
        message: 'Client info assigned to order leads successfully'
    });
});
