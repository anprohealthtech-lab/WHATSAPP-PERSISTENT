# WhatsApp Campaign Bulk Messaging System

## Overview

This system enables bulk WhatsApp message sending with AI-generated variations, personalization, and contact management.

## Features

1. **Campaign Management** - Create and manage WhatsApp campaigns
2. **Contact Upload** - Import contacts from Excel files (.xlsx, .xls, .csv)
3. **AI Message Variations** - Generate WhatsApp-safe message variations using Supabase Edge Functions
4. **Bulk Sending** - Send personalized messages with 1-1.5 minute delays between messages
5. **Placeholder Support** - Maintain `{{name}}` and custom placeholders for personalization

## Database Schema

### Tables Created

```sql
-- Campaigns table
campaigns (
  id VARCHAR PRIMARY KEY,
  name TEXT NOT NULL,
  original_message TEXT NOT NULL,
  fixed_params JSONB,
  selected_variation TEXT,
  total_contacts INTEGER DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Campaign recipients table  
campaign_recipients (
  id VARCHAR PRIMARY KEY,
  campaign_id VARCHAR REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  extra JSONB,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMP,
  error_reason TEXT,
  created_at TIMESTAMP
)

-- Message variations table
message_variations (
  id VARCHAR PRIMARY KEY,
  campaign_id VARCHAR REFERENCES campaigns(id) ON DELETE CASCADE,
  variation TEXT NOT NULL,
  created_at TIMESTAMP
)
```

## API Endpoints

### Campaign Management

#### Create Campaign
```http
POST /api/campaigns
Content-Type: application/json

{
  "name": "Appointment Reminders",
  "originalMessage": "Hi {{name}}, reminder for appointment on {{date}} at {{time}}.",
  "fixedParams": {
    "date": "20 Nov 2025",
    "time": "5:00 PM",
    "clinic_name": "Womanhood Clinic"
  }
}
```

#### Get Campaign
```http
GET /api/campaigns/:campaignId
```

### Contact Management

#### Upload Contacts
```http
POST /api/campaigns/:campaignId/contacts/upload
Content-Type: multipart/form-data

file: [Excel file with columns: name, phone, and optional extra columns]
```

**Expected Excel Format:**
| name   | phone        | city      | age |
|--------|--------------|-----------|-----|
| Roohi  | 919901234567 | Ahmedabad | 28  |
| Rajesh | 919987654321 | Mumbai    | 35  |

#### Get Contacts
```http
GET /api/campaigns/:campaignId/contacts
```

### Message Variations

#### Save Variation
```http
POST /api/campaigns/:campaignId/variations
Content-Type: application/json

{
  "variation": "Hey {{name}}, quick reminder about your appointment..."
}
```

#### Get Variations
```http
GET /api/campaigns/:campaignId/variations
```

### Bulk Send

#### Send Campaign
```http
POST /api/campaigns/:campaignId/send-bulk
Content-Type: application/json

{
  "variation_message": "Hey {{name}}, reminder for {{date}} at {{time}}.",
  "contacts": [  // Optional - if omitted, loads from DB
    {
      "name": "Roohi",
      "phone": "919901234567",
      "extra": { "city": "Ahmedabad" }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "campaign_id": "abc123",
  "total": 123,
  "sent": 120,
  "failed": 3,
  "failed_list": [
    {
      "phone": "919901234567",
      "name": "John",
      "reason": "invalid_number"
    }
  ]
}
```

## Edge Function Integration

### Calling the Edge Function

The frontend calls your Supabase Edge Function (`bulk-message-generator`) with this format:

```javascript
fetch('https://your-project.supabase.co/functions/v1/bulk-message-generator', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
  },
  body: JSON.stringify({
    message: "Hi {{name}}, reminder for your appointment on {{date}} at {{time}}.",
    campaign_id: "campaign-123",
    fixed_params: {
      name_placeholder: "{{name}}",  // CRITICAL: Preserve this exactly
      date: "20 Nov 2025",
      time: "5:00 PM",
      clinic_name: "Womanhood Clinic"
    }
  })
})
```

### Edge Function Prompt Requirements

Your edge function must include this in the prompt:

```
CRITICAL: Do NOT change or remove the placeholder {{name}}. 
It must appear exactly as {{name}} in the final message.
All other placeholders should be replaced with their values from fixed_params.
```

**Example Response:**
```json
{
  "variation": "Hey {{name}}, just a quick reminder about your appointment on 20 Nov 2025 at 5:00 PM at Womanhood Clinic. Looking forward to seeing you!"
}
```

## Frontend Component

### Usage

```tsx
import { CampaignMessageVariationPanel } from '@/components/CampaignMessageVariationPanel';

function CampaignsPage() {
  return (
    <CampaignMessageVariationPanel
      supabaseUrl="https://your-project.supabase.co"
      supabaseAnonKey="your-anon-key"
      edgeFunctionUrl="https://your-project.supabase.co/functions/v1/bulk-message-generator"
    />
  );
}
```

### Component Features

1. **Create Campaign** - Form to set up new campaigns
2. **Upload Recipients** - File upload with preview
3. **Generate Variations** - Call edge function and save variations
4. **Send Campaign** - Bulk send with progress tracking

## Workflow

1. **Create Campaign**
   - Set campaign name
   - Define original message template with `{{name}}` placeholder
   - Add fixed parameters (date, time, location, etc.)

2. **Upload Contacts**
   - Upload Excel file with name and phone columns
   - System validates and stores contacts
   - Shows preview of loaded contacts

3. **Generate Variation**
   - Click "Generate New Variation"
   - Frontend calls Supabase Edge Function
   - AI generates WhatsApp-safe variation preserving `{{name}}`
   - Variation saved to database

4. **Send Campaign**
   - Review active variation and contact count
   - Click "Send to All Contacts"
   - System sends personalized messages with delays
   - Returns success/failure summary

## Message Personalization

### Placeholder Replacement

The system replaces placeholders in this order:

1. **{{name}}** - Replaced with contact's name
2. **{{customField}}** - Replaced from contact's `extra` object

**Example:**

Original variation:
```
Hey {{name}}, reminder for your appointment in {{city}} on {{date}}!
```

Contact data:
```json
{
  "name": "Roohi",
  "phone": "919901234567",
  "extra": { "city": "Ahmedabad" }
}
```

Final message:
```
Hey Roohi, reminder for your appointment in Ahmedabad on 20 Nov 2025!
```

## Timing and Rate Limiting

- **Delay between messages**: 60-90 seconds (1-1.5 minutes)
- **Estimated time**: contacts × 1.25 minutes
- **Example**: 100 contacts = ~125 minutes (2 hours)

## Error Handling

The system tracks:
- Sent messages with timestamp
- Failed messages with reason
- Status updates per recipient

Failed messages include reasons like:
- `invalid_number`
- `whatsapp_not_connected`
- `rate_limit_exceeded`

## Environment Variables

Add to `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://user:pass@host:port/database
```

## Database Migration

Run migrations to create tables:

```bash
cd NodeBackend
npm run db:push
```

## Testing

1. Create a test campaign
2. Upload a small Excel file (2-3 contacts)
3. Generate a variation
4. Send to test contacts
5. Monitor logs for delivery status

## Troubleshooting

### Common Issues

**Issue**: Edge function not preserving `{{name}}`
- **Solution**: Update edge function prompt with explicit instruction

**Issue**: Messages taking too long
- **Solution**: Normal - 1-1.5 minutes per message is intended

**Issue**: Upload fails
- **Solution**: Ensure Excel has `name` and `phone` columns

**Issue**: Database connection error
- **Solution**: Set `DATABASE_URL` in `.env`

## Production Considerations

1. **Rate Limiting**: Adjust delays based on WhatsApp limits
2. **Error Recovery**: Implement retry logic for failed messages
3. **Monitoring**: Track campaign progress and failures
4. **Scaling**: Consider queue-based approach for large campaigns
5. **Compliance**: Ensure GDPR/privacy compliance for contact data

## Support

For issues or questions, check:
- API logs at `/api/logs`
- Campaign recipient status in database
- WhatsApp service connection status
