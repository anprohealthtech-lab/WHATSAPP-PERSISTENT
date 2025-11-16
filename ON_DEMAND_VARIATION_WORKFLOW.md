# On-Demand Message Variation Generation - Updated Workflow

## Overview
The bulk messaging system now generates **unique message variations on-demand** for each contact during the sending process, eliminating the need to pre-generate all variations upfront.

## Key Changes

### 1. Updated Edge Function (`supabase-edge-function-updated.ts`)
**Enhanced Logging:**
- Each request gets a unique `requestId` for tracking
- Comprehensive logging at every step:
  - Request body and parameters
  - Supabase connection status
  - Previous variations fetched
  - Gemini API request/response details
  - Response parsing with part-by-part logging
  - Database insertion status
  
**Improved Error Handling:**
- Detailed error messages for empty responses
- Full Gemini response logged when parsing fails
- Separate handling for API errors vs parsing errors

**Model Update:**
- Changed to `gemini-2.0-flash-exp` for better performance
- Increased temperature to 0.9 for more variation
- Increased max tokens to 1024
- Added topP and topK parameters

**Key Features:**
```typescript
// Request tracking
const requestId = crypto.randomUUID();
console.log(`[${requestId}] === NEW REQUEST ===`);

// Detailed parsing with logging
const textParts = parts.map((p, idx) => {
  console.log(`[${requestId}] Part ${idx}:`, JSON.stringify(p, null, 2));
  return p.text;
});

// Empty message detection
if (!tweakedMessage || tweakedMessage.length === 0) {
  console.error(`[${requestId}] WARNING: Empty tweaked message!`);
  return error response with gemini_response for debugging
}
```

### 2. New VariationService (`NodeBackend/server/services/VariationService.ts`)
Handles on-demand variation generation with these capabilities:

**Single Variation Generation:**
```typescript
const result = await variationService.generateVariation({
  campaignId: "abc123",
  message: "Original message text",
  fixedParams: { date: "Nov 20", link: "https://..." },
  contactPhone: "+1234567890"
});
```

**Batch Generation (with delays):**
```typescript
const results = await variationService.generateBatch(
  requests,
  1000 // 1 second delay between each
);
```

**Pre-warming (generate variations in advance):**
```typescript
await variationService.prewarmVariations(
  campaignId,
  originalMessage,
  fixedParams,
  3 // Generate 3 variations upfront
);
```

### 3. Updated CampaignService
**New Bulk Send Flow:**

1. **Pre-warm Phase** (before sending):
   - Generates 3 variations immediately
   - Ensures fast start for first few messages

2. **Per-Contact Processing**:
   ```
   For each contact:
     ├─ Generate unique variation via edge function
     ├─ Personalize with contact details ({{name}}, {{phone}})
     ├─ Apply extra field placeholders ({{field1}}, {{field2}})
     ├─ Apply fixed params placeholders ({{date}}, {{link}})
     ├─ Send via WhatsApp
     ├─ Update database status
     └─ Wait 60-90 seconds (random) before next contact
   ```

3. **Comprehensive Logging**:
   ```
   🚀 Starting bulk send for campaign abc123 - 10 contacts
   🔥 Pre-warming first 3 variations...
   ✅ Pre-warm complete: 3/3 variations ready
   
   [1/10] Processing: John Doe (+1234567890)
     ↪ Generating unique variation #4...
     ✓ Variation #4 generated (342 chars)
     ↪ Sending personalized message...
     ✅ Message sent successfully to John Doe
     ⏳ Waiting 73 seconds before next message...
   
   [2/10] Processing: Jane Smith (+0987654321)
     ↪ Generating unique variation #5...
     ...
   ```

## Timing Strategy

### Variation Generation + Message Sending
- **Pre-warm**: 3 variations generated upfront (~3-5 seconds total)
- **Per Contact**: 
  - Variation generation: ~1-2 seconds
  - Message send: ~1 second
  - Delay: 60-90 seconds (random)
  - **Total per contact**: ~62-93 seconds

### For 10 Contacts Example:
```
Contact 1: 0s - Pre-warmed variation ready, send immediately
           Wait 73s
Contact 2: 73s - Generate variation, send
           Wait 68s  
Contact 3: 141s - Generate variation, send
           Wait 85s
...
Contact 10: ~12 minutes total
```

## Benefits of On-Demand Generation

### ✅ **True Uniqueness**
- Each message uses the FULL context of all previous variations
- No message is ever duplicated or too similar
- Variation #100 knows about variations #1-99

### ✅ **Memory Efficient**
- Don't need to store all variations in memory
- Generate only what's needed, when it's needed

### ✅ **Scalable**
- Works for 10 contacts or 10,000 contacts
- No upfront generation bottleneck

### ✅ **Adaptive**
- If a contact fails, we don't waste a pre-generated variation
- Can retry with a new unique variation

### ✅ **Real-time Progress**
- User sees variations being generated in real-time
- Better UX with detailed progress logs

## Placeholder Support

The system supports multiple placeholder types:

### 1. Contact Placeholders
- `{{name}}` - Contact's name
- `{{phone}}` - Contact's phone number

### 2. Extra Field Placeholders
From Excel columns:
- `{{company}}` - Company name
- `{{position}}` - Job position
- `{{customField}}` - Any custom column

### 3. Fixed Params Placeholders
Defined at campaign creation:
- `{{date}}` - Event date
- `{{time}}` - Event time
- `{{link}}` - Registration link
- `{{venue}}` - Event location

### Example:
**Template:**
```
Hi {{name}}, join us on {{date}} at {{time}} for {{event}}!
Register: {{link}}
```

**Fixed Params:**
```json
{
  "date": "November 20, 2025",
  "time": "6:00 PM",
  "event": "Healthcare Entrepreneurship Session",
  "link": "https://forms.gle/abc123"
}
```

**Contact Data:**
```json
{
  "name": "Dr. Sharma",
  "phone": "+919876543210"
}
```

**Result:**
```
Hi Dr. Sharma, join us on November 20, 2025 at 6:00 PM for Healthcare Entrepreneurship Session!
Register: https://forms.gle/abc123
```

## API Response Format

### Success Response:
```json
{
  "success": true,
  "tweaked_message": "Generated unique message text here...",
  "variation_number": 5,
  "campaign_id": "abc123",
  "original_message": "Original template...",
  "contact_phone": "+1234567890"
}
```

### Error Response:
```json
{
  "success": false,
  "error": "Generated message is empty",
  "variation_number": 5,
  "gemini_response": { /* full response for debugging */ }
}
```

## Deployment Instructions

### 1. Deploy Updated Edge Function
```bash
# Copy the updated function code
cp supabase-edge-function-updated.ts supabase/functions/bulk-message-generator/index.ts

# Deploy to Supabase
supabase functions deploy bulk-message-generator
```

### 2. Run Database Migration
Execute in Supabase Dashboard > SQL Editor:
```sql
ALTER TABLE message_variations 
  RENAME COLUMN variation TO message;

ALTER TABLE message_variations 
  ADD COLUMN IF NOT EXISTS original_message TEXT,
  ADD COLUMN IF NOT EXISTS variation_number INTEGER,
  ADD COLUMN IF NOT EXISTS fixed_params JSONB;
```

### 3. Restart Backend Server
```bash
cd NodeBackend
npm run dev
```

## Testing the System

### Test Single Variation:
```bash
curl -X POST https://zvbmbawglcdmncknzmfh.supabase.co/functions/v1/bulk-message-generator \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "campaign_id": "test-123",
    "message": "Join us for an amazing event!",
    "fixed_params": {
      "date": "Nov 20",
      "time": "6 PM"
    },
    "contact_phone": "+1234567890"
  }'
```

### View Logs:
Go to Supabase Dashboard → Edge Functions → bulk-message-generator → Logs

Look for entries like:
```
[abc-123-def] === NEW REQUEST ===
[abc-123-def] Generating variation #5...
[abc-123-def] ✅ SUCCESS - Variation #5 created and saved
```

## Troubleshooting

### Empty tweaked_message?
1. Check Supabase logs for `[requestId] Gemini full response:`
2. Look for `[requestId] Part 0:` to see actual response structure
3. Verify `ALLGOOGLE_KEY` is set correctly
4. Check if Gemini API quota is exceeded

### Variations Too Similar?
- Increase temperature (currently 0.9)
- Increase previous variations context (currently 20)
- Add more specific instructions to prompt

### Slow Generation?
- Pre-warm more variations (currently 3)
- Reduce maxOutputTokens (currently 1024)
- Use faster Gemini model

## Future Enhancements

1. **Caching**: Cache variations for retry scenarios
2. **Parallel Generation**: Generate next variation while sending current message
3. **Quality Check**: Validate variation uniqueness before sending
4. **A/B Testing**: Track which variation styles get better responses
5. **Smart Delay**: Adjust delays based on WhatsApp rate limits
