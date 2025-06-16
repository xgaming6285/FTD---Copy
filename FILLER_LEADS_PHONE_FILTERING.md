# Filler Leads Phone Number Repetition Filtering

## Overview

This feature implements phone number repetition filtering for filler leads orders based on the number of leads requested. The system prevents excessive repetition of phone number patterns to maintain lead quality and variety **while still fulfilling the exact requested number of leads whenever possible**.

## Rules Implementation

### Rule 1: Orders with ≤10 Filler Leads

- **Restriction**: No repetition of first four digits after phone prefix
- **Behavior**: Each phone pattern (first 4 digits after country code) can appear only once
- **Goal**: Return exactly the requested number of leads, all with unique first-four-digit patterns
- **Example**: If you request 8 filler leads, you'll get exactly 8 leads, each with a unique first-four-digit pattern (if 8+ unique patterns available)
- **Note**: If there are fewer unique patterns than requested leads, you'll get as many unique patterns as available

### Rule 2: Orders with 11-20 Filler Leads

- **Restriction**: Maximum 2 repetitions per phone pattern, but no more than 10 pairs total with same first 4 digits
- **Behavior**: The system distributes leads across available patterns to reach the exact requested count
- **Goal**: Return exactly the requested number of leads while respecting constraints
- **Example**: For 15 leads, you could get leads distributed across patterns, with some patterns having 2 leads (pairs) up to the 10-pair limit, and others having 1 lead
- **Strategy**: Cycles through available patterns, adding leads while respecting the 2-per-pattern and 10-pair limits

### Rule 3: Orders with 21-40 Filler Leads

- **Restriction**: Maximum 4 repetitions per phone pattern, but no more than 20 pairs total with same first 4 digits
- **Behavior**: Each phone pattern can appear up to 4 times, but total pairs are limited to 20
- **Goal**: Return exactly the requested number of leads while respecting constraints
- **Example**: For 30 leads, patterns are filled up to 4 leads each, with pair counting ensuring no more than 20 pairs total
- **Strategy**: Distributes leads evenly across patterns while tracking pairs

### Rule 4: Orders with >40 Filler Leads

- **Restriction**: No repetition restrictions
- **Behavior**: All available filler leads are returned without filtering, up to the requested amount
- **Goal**: Return exactly the requested number of leads with no pattern restrictions

## Technical Implementation

### Phone Number Processing

```javascript
// Extracts first four digits after country code
// +1234567890 -> "2345"
const getFirstFourDigitsAfterPrefix = (phoneNumber) => {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  return cleanPhone.substring(1, 5);
};
```

### Lead Distribution Strategy

The system now uses a **round-robin distribution approach** for Rules 2 and 3:

1. **Cycle through all available phone patterns**
2. **Add leads from each pattern in turn**
3. **Respect per-pattern limits** (2 for Rule 2, 4 for Rule 3)
4. **Track pair usage** and stop adding pairs when limit is reached
5. **Continue until exact requested count is reached** or constraints prevent further additions

### Lead Fetching Strategy

The system fetches more leads than requested to ensure sufficient variety for filtering:

- **≤10 leads**: Fetches 3x the requested amount to ensure enough unique patterns
- **11-20 leads**: Fetches 2x the requested amount for pattern variety
- **21-40 leads**: Fetches 1.5x the requested amount for some extra options
- **>40 leads**: Fetches the exact amount requested

### Modified Order Creation Flow

1. Calculate fetch multiplier based on requested filler count
2. Fetch expanded set of filler leads from database
3. Apply phone repetition filtering rules while **trying to fulfill exact requested count**
4. Return filtered leads (up to requested count, respecting constraints)
5. Update order with actual fulfilled count

## API Response Enhancement

Order creation responses now include information about phone filtering:

```json
{
  "success": true,
  "message": "Order created with 15 leads - fully fulfilled (filler leads: max 2 repetitions per phone pattern, max 10 pairs)",
  "data": { ... }
}
```

## Files Modified

- `backend/controllers/orders.js`: Main implementation with helper functions and modified order creation logic
- Added comprehensive JSDoc documentation for all new functions

## Usage Examples

### Example 1: 8 Filler Leads Requested (Rule 1)

- System fetches 24 filler leads from database (3x multiplier)
- Groups leads by phone patterns (first 4 digits after prefix)
- Applies Rule 1: Takes exactly 1 lead per unique pattern
- **Result**: 8 leads, all with different first-4-digit patterns

### Example 2: 15 Filler Leads Requested (Rule 2)

- System fetches 30 filler leads from database (2x multiplier)
- Groups leads by phone patterns
- Applies Rule 2 using round-robin distribution:
  - Cycles through patterns, adding 1 lead from each
  - Continues cycling, adding 2nd lead from patterns (creating pairs) up to 10-pair limit
  - **Result**: Exactly 15 leads distributed across patterns with constraints respected

### Example 3: 30 Filler Leads Requested (Rule 3)

- System fetches 45 filler leads from database (1.5x multiplier)
- Groups leads by phone patterns
- Applies Rule 3 using round-robin distribution:
  - Distributes leads across patterns, max 4 per pattern
  - Tracks pairs to ensure no more than 20 pairs total
  - **Result**: Exactly 30 leads with no pattern appearing more than 4 times

## Benefits

1. **Exact Fulfillment**: Always tries to return exactly the requested number of leads
2. **Quality Control**: Prevents orders with too many similar phone numbers
3. **Variety**: Ensures diverse phone number patterns in each order
4. **Scalability**: Rules adapt based on order size
5. **Flexibility**: Works within constraints while maximizing fulfillment
6. **Transparency**: Clear messaging about filtering applied
7. **No Restrictions**: Large orders (>40 leads) have no limitations

## Testing

The implementation has been tested with sample data to verify:

- **Exact count fulfillment** when sufficient leads are available
- Correct extraction of phone number patterns
- Proper application of each rule while maximizing fulfillment
- Accurate counting and limiting of repetitions and pairs
- Correct handling of edge cases (insufficient leads, limited patterns, etc.)
- Graceful degradation when constraints prevent full fulfillment
